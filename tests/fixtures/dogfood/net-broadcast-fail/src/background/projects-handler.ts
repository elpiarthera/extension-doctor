// FIXTURE PROVENANCE: verbatim copy of src/background/projects-handler.ts
// from gptpowerups-extension @ origin/chi/d137-baseline-green
// (see CLAUDE.md T3-SHIP dogfood remedy (a) — fixtures versioned for CI)

/**
 * Projects handler — service worker side (D67 Bug B fix).
 *
 * Migrates ProjectsStore from per-origin IndexedDB to chrome.storage.local
 * (extension-scoped = cross-host visibility). Mirrors conversations-handler.ts pattern.
 *
 * Storage key: "gptu_projects_v1" = Record<string, Project>
 *
 * Message types handled:
 *   LIST_PROJECTS    → Record<string, Project>
 *   HYDRATE_PROJECTS → Record<string, Project> (alias — same as LIST_PROJECTS)
 *   CREATE_PROJECT   → Project (created + stored)
 *   UPDATE_PROJECT   → Project (updated + stored)
 *   DELETE_PROJECT   → { deleted: true } (re-parents children to root)
 *   MOVE_PROJECT     → Project (parentId updated)
 *   PROJECTS_CHANGED → broadcast ack (SW never receives this inbound normally)
 *
 * After every write: broadcasts PROJECTS_CHANGED to all tabs via chrome.tabs.query.
 *
 * Local-first strict — zero upload. chrome.storage.local is extension-scoped (NOT origin-scoped).
 */

import type { ExtensionResponse } from "../shared/types";
import type { Project } from "../stores/projects/types";

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gptu_projects_v1";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function readAll(): Promise<Record<string, Project>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const raw = result[STORAGE_KEY];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        resolve({});
        return;
      }
      resolve(raw as Record<string, Project>);
    });
  });
}

async function writeAll(projects: Record<string, Project>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: projects }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

async function broadcastProjectsChanged(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "PROJECTS_CHANGED" }).catch(() => {
          // Tab may not have content script loaded — ignore silently
        });
      }
    }
  } catch (err) {
    console.warn("[GPTPowerUps] broadcast PROJECTS_CHANGED failed:", err);
  }
}

// ---------------------------------------------------------------------------
// ID generation (mirrors store.ts original)
// ---------------------------------------------------------------------------

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Main handler (called from service-worker.ts message router)
// ---------------------------------------------------------------------------

export async function handleProjectsMessage(
  type: string,
  payload: unknown
): Promise<ExtensionResponse> {
  switch (type) {
    // -------------------------------------------------------------------------
    // Read operations
    // -------------------------------------------------------------------------

    case "LIST_PROJECTS":
    case "HYDRATE_PROJECTS": {
      const all = await readAll();
      return { ok: true, data: all };
    }

    // -------------------------------------------------------------------------
    // Create
    // -------------------------------------------------------------------------

    case "CREATE_PROJECT": {
      const input = payload as Partial<Project> | undefined;
      if (!input) return { ok: false, error: "payload required" };

      const now = Date.now();
      const project: Project = {
        id: generateId(),
        name: input.name ?? "Untitled",
        ownerId: input.ownerId ?? "",
        visibility: input.visibility ?? "private",
        createdAt: now,
        updatedAt: now,
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.sharedWith !== undefined ? { sharedWith: input.sharedWith } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      };

      const all = await readAll();
      all[project.id] = project;
      await writeAll(all);
      await broadcastProjectsChanged();
      return { ok: true, data: project };
    }

    // -------------------------------------------------------------------------
    // Update (patch)
    // -------------------------------------------------------------------------

    case "UPDATE_PROJECT": {
      const { id, patch } =
        (payload as { id?: string; patch?: Partial<Project> } | undefined) ?? {};
      if (!id) return { ok: false, error: "id required" };
      if (!patch) return { ok: false, error: "patch required" };

      const all = await readAll();
      const existing = all[id];
      if (!existing) return { ok: false, error: `Project not found: ${id}` };

      const updated: Project = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
      all[id] = updated;
      await writeAll(all);
      await broadcastProjectsChanged();
      return { ok: true, data: updated };
    }

    // -------------------------------------------------------------------------
    // Delete (with child re-parenting)
    // -------------------------------------------------------------------------

    case "DELETE_PROJECT": {
      const { id } = (payload as { id?: string } | undefined) ?? {};
      if (!id) return { ok: false, error: "id required" };

      const all = await readAll();
      if (!all[id]) return { ok: false, error: `Project not found: ${id}` };

      delete all[id];

      // Re-parent children to root (remove parentId)
      for (const [childId, child] of Object.entries(all)) {
        if (child.parentId === id) {
          const { parentId: _removed, ...rest } = child;
          void _removed;
          all[childId] = { ...rest, updatedAt: Date.now() } as Project;
        }
      }

      await writeAll(all);
      await broadcastProjectsChanged();
      return { ok: true, data: { deleted: true } };
    }

    // -------------------------------------------------------------------------
    // Move (change parentId)
    // -------------------------------------------------------------------------

    case "MOVE_PROJECT": {
      const { id, newParentId } =
        (payload as { id?: string; newParentId?: string } | undefined) ?? {};
      if (!id) return { ok: false, error: "id required" };

      const all = await readAll();
      const existing = all[id];
      if (!existing) return { ok: false, error: `Project not found: ${id}` };

      const { parentId: _old, ...rest } = existing;
      void _old;

      const updated: Project =
        newParentId !== undefined
          ? { ...rest, parentId: newParentId, updatedAt: Date.now() }
          : { ...rest, updatedAt: Date.now() };

      all[id] = updated;
      await writeAll(all);
      await broadcastProjectsChanged();
      return { ok: true, data: updated };
    }

    // -------------------------------------------------------------------------
    // Broadcast ack (SW receives this only if content-script mistakenly sends it)
    // -------------------------------------------------------------------------

    case "PROJECTS_CHANGED": {
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown projects message type: ${String(type)}` };
  }
}

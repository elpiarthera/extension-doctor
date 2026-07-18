// FIXTURE PROVENANCE: verbatim copy of src/background/conversations-handler.ts
// from gptpowerups-extension @ origin/chi/d137-baseline-green
// (fixtures are versioned so the dogfood proof runs in CI and for third parties)
//
// DECLARED DIVERGENCE from the source file, in two directions:
//
// 1. Internal ticket references in the body below are PRESERVED deliberately.
//    The rule under test asserts against the real product's source, not a
//    cleaned-up rewrite, so removing them would weaken what this fixture proves.
//
// 2. Two comments naming a person were REWRITTEN to state the same technical
//    fact without the name, because this repository is public. The rewrite is
//    limited to comment prose: no statement, no identifier and no control flow
//    was touched, so the behaviour the rule inspects is unchanged.
//
// This file is therefore a faithful copy of the source's CODE, not of its every
// comment. That is the property the dogfood proof depends on.

/**
 * Conversations handler — service worker side (T7 D67-Chi-Projects-V1).
 *
 * T7 migration: folderIds → projectIds.
 * Folder CRUD handlers (LIST_FOLDERS, CREATE_FOLDER, RENAME_FOLDER, DELETE_FOLDER) removed.
 * Project CRUD lives in src/stores/projects/store.ts (IndexedDB-backed, no SW proxy needed).
 *
 * MOVE_CONVERSATION payload updated:
 *   projectId: string | null
 *   action: "add" | "remove" | "replace"
 *   - "add"    : push projectId to projectIds if not already present
 *   - "remove" : filter projectId out of projectIds
 *   - "replace": set projectIds = [projectId] (or [] if projectId is null/empty)
 *
 * SAVE_CONVERSATION: normalises projectIds (ensures array, no migration from folderIds).
 *
 * Local-first STRICT — chrome.storage.local is extension-scoped (NOT origin-scoped).
 */

import type { Conversation } from "../core/conversations-store/types";
import type { ExtensionResponse } from "../shared/types";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gptu_conversations_v1";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function readAll(): Promise<Conversation[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const raw = result[STORAGE_KEY];
      if (!Array.isArray(raw)) {
        resolve([]);
        return;
      }
      resolve(raw as Conversation[]);
    });
  });
}

async function writeAll(conversations: Conversation[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: conversations }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

async function broadcastToAllTabs(
  type: "CONVERSATIONS_CHANGED" | "PROJECTS_CHANGED"
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type }).catch(() => {
          // Tab may not have content script loaded — ignore silently
        });
      }
    }
  } catch (err) {
    console.warn(`[GPTPowerUps] broadcast ${type} failed:`, err);
  }
}

async function broadcastConversationsChanged(): Promise<void> {
  return broadcastToAllTabs("CONVERSATIONS_CHANGED");
}

async function broadcastProjectsChanged(): Promise<void> {
  return broadcastToAllTabs("PROJECTS_CHANGED");
}

// ---------------------------------------------------------------------------
// Exported handler (called from service-worker.ts message router)
// ---------------------------------------------------------------------------

export async function handleConversationsMessage(
  type: string,
  payload: unknown
): Promise<ExtensionResponse> {
  switch (type) {
    case "LIST_CONVERSATIONS": {
      const all = await readAll();
      const sorted = all.toSorted((a, b) => b.capturedAt - a.capturedAt);
      return { ok: true, data: sorted };
    }

    case "GET_CONVERSATION": {
      const id = (payload as { id?: string } | undefined)?.id;
      if (!id) return { ok: false, error: "id required" };
      const all = await readAll();
      const found = all.find((c) => c.id === id) ?? null;
      return { ok: true, data: found };
    }

    case "SAVE_CONVERSATION": {
      const conv = (payload as { conversation?: Conversation } | undefined)?.conversation;
      if (!conv || !conv.id) return { ok: false, error: "conversation with id required" };
      // Ensure projectIds is always an array (defensive normalisation)
      if (!Array.isArray(conv.projectIds)) {
        (conv as Conversation).projectIds = [];
      }
      const all = await readAll();
      const idx = all.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        all[idx] = conv;
      } else {
        all.push(conv);
      }
      await writeAll(all);
      await broadcastConversationsChanged();
      return { ok: true, data: { saved: true } };
    }

    case "REMOVE_CONVERSATION": {
      const id = (payload as { id?: string } | undefined)?.id;
      if (!id) return { ok: false, error: "id required" };
      const all = await readAll();
      const filtered = all.filter((c) => c.id !== id);
      await writeAll(filtered);
      await broadcastConversationsChanged();
      return { ok: true, data: { removed: true } };
    }

    case "CLEAR_CONVERSATIONS": {
      await writeAll([]);
      await broadcastConversationsChanged();
      return { ok: true, data: { cleared: true } };
    }

    // -------------------------------------------------------------------------
    // T7 D67 — MOVE_CONVERSATION with projectId + action: "add" | "remove" | "replace"
    // -------------------------------------------------------------------------

    case "MOVE_CONVERSATION": {
      const {
        conversationId,
        projectId: targetProjectId,
        action = "replace",
      } = (payload as
        | {
            conversationId?: string;
            projectId?: string | null;
            action?: "add" | "remove" | "replace";
          }
        | undefined) ?? {};

      if (!conversationId) return { ok: false, error: "conversationId required" };

      const allConvs = await readAll();
      const idx = allConvs.findIndex((c) => c.id === conversationId);
      if (idx < 0) return { ok: false, error: "conversation not found" };

      const conv = allConvs[idx];
      if (!conv) return { ok: false, error: "conversation not found" };

      const current = conv.projectIds ?? [];

      let newProjectIds: string[];

      if (action === "add") {
        if (!targetProjectId) {
          newProjectIds = current; // adding null/empty = no-op
        } else {
          newProjectIds = current.includes(targetProjectId)
            ? current
            : [...current, targetProjectId];
        }
      } else if (action === "remove") {
        newProjectIds = targetProjectId ? current.filter((id) => id !== targetProjectId) : current;
      } else {
        // "replace" (default) — single target or unfiled
        newProjectIds = targetProjectId == null || targetProjectId === "" ? [] : [targetProjectId];
      }

      allConvs[idx] = { ...conv, projectIds: newProjectIds };

      await writeAll(allConvs);
      await broadcastConversationsChanged();
      await broadcastProjectsChanged();
      return { ok: true, data: { moved: true } };
    }

    default:
      return { ok: false, error: `Unknown conversations message type: ${String(type)}` };
  }
}

// ---------------------------------------------------------------------------
// runMigrations — no-op: no migration required at zero installed base
// ---------------------------------------------------------------------------

/** No-op: zero installed base, so no data migration is required. */
export async function runMigrations(): Promise<void> {
  // T7 D67: folderIds→projectIds is a pure field rename. No data to migrate.
}

// FIXTURE PROVENANCE: verbatim copy of src/background/media-handler.ts
// from gptpowerups-extension @ origin/chi/d137-baseline-green
// (see CLAUDE.md T3-SHIP dogfood remedy (a) — fixtures versioned for CI)

/**
 * Media handler — service worker side (V0.7.1).
 *
 * Source of truth: chrome.storage.local key "gptu_media_v1" = JSON array of Media.
 * Binaries: IndexedDB in SW ("gptu_media_blobs", store "blobs", key = blobKey).
 *
 * Message types handled:
 *   LIST_MEDIA          → Media[] sorted by capturedAt DESC
 *   GET_MEDIA           → Media | null
 *   SAVE_MEDIA          → upsert metadata
 *   SAVE_MEDIA_WITH_BLOB → upsert metadata + store Blob in IDB
 *   REMOVE_MEDIA        → delete metadata + blob
 *   MOVE_MEDIA          → project ops (add/remove/replace)
 *   GET_MEDIA_BLOB      → retrieve blob from IDB as base64
 *   MEDIA_CHANGED       → broadcast ack (SW never receives this inbound normally)
 *
 * Local-first strict — zero upload of binary content.
 */

import type { Media } from "../core/media-store/types";
import type { ExtensionResponse } from "../shared/types";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const MEDIA_STORAGE_KEY = "gptu_media_v1";
const MEDIA_BLOBS_DB_NAME = "gptu_media_blobs";
const MEDIA_BLOBS_STORE_NAME = "blobs";
const MEDIA_BLOBS_DB_VERSION = 1;

// ---------------------------------------------------------------------------
// chrome.storage.local helpers
// ---------------------------------------------------------------------------

async function readAll(): Promise<Media[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([MEDIA_STORAGE_KEY], (result) => {
      const raw = result[MEDIA_STORAGE_KEY];
      if (!Array.isArray(raw)) {
        resolve([]);
        return;
      }
      resolve(raw as Media[]);
    });
  });
}

async function writeAll(media: Media[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [MEDIA_STORAGE_KEY]: media }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// IDB-in-SW for binary blobs
// ---------------------------------------------------------------------------

let _blobDb: IDBDatabase | null = null;

async function openBlobDb(): Promise<IDBDatabase> {
  if (_blobDb) return _blobDb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEDIA_BLOBS_DB_NAME, MEDIA_BLOBS_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEDIA_BLOBS_STORE_NAME)) {
        db.createObjectStore(MEDIA_BLOBS_STORE_NAME, { keyPath: "blobKey" });
      }
    };
    req.onsuccess = (e) => {
      _blobDb = (e.target as IDBOpenDBRequest).result;
      resolve(_blobDb);
    };
    req.onerror = () => reject(req.error);
  });
}

async function saveBlobToIdb(blobKey: string, base64: string, mimeType: string): Promise<void> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_BLOBS_STORE_NAME, "readwrite");
    const store = tx.objectStore(MEDIA_BLOBS_STORE_NAME);
    const req = store.put({ blobKey, base64, mimeType });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getBlobFromIdb(
  blobKey: string
): Promise<{ base64: string; mimeType: string } | null> {
  const db = await openBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_BLOBS_STORE_NAME, "readonly");
    const store = tx.objectStore(MEDIA_BLOBS_STORE_NAME);
    const req = store.get(blobKey);
    req.onsuccess = () => {
      const result = req.result as
        | { blobKey: string; base64: string; mimeType: string }
        | undefined;
      resolve(result ? { base64: result.base64, mimeType: result.mimeType } : null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlobFromIdb(blobKey: string): Promise<void> {
  try {
    const db = await openBlobDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_BLOBS_STORE_NAME, "readwrite");
      const store = tx.objectStore(MEDIA_BLOBS_STORE_NAME);
      const req = store.delete(blobKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Blob may not exist — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

async function broadcastMediaChanged(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: "MEDIA_CHANGED" }).catch(() => {
          // Tab may not have content script loaded — ignore silently
        });
      }
    }
  } catch (err) {
    console.warn("[gptu] broadcast MEDIA_CHANGED failed:", err);
  }
}

// ---------------------------------------------------------------------------
// R4: Migration — folderId → folderIds[]
// Run once at SW boot/install (via runMediaMigrations called by service-worker.ts).
// ---------------------------------------------------------------------------

/**
 * Migrates legacy Media items:
 *   - folderId (singular) → projectIds[]   (pre-V0.7.0.2 schema)
 *   - folderIds[]         → projectIds[]   (V0.7.0.2–V0.7.1 schema; T5 D67 migration)
 * Idempotent — safe to run multiple times.
 */
export async function runMediaMigrations(): Promise<void> {
  const all = await readAll();
  let migrated = 0;

  const updated = all.map((m) => {
    const legacy = m as Media & { folderId?: string; folderIds?: string[] };

    // Step 1: fold singular folderId into an array (pre-V0.7.0.2)
    if (legacy.folderId !== undefined) {
      const ids = Array.isArray(legacy.folderIds)
        ? legacy.folderIds
        : legacy.folderId
          ? [legacy.folderId]
          : [];
      const { folderId: _f, folderIds: _fs, ...rest } = legacy;
      void _f;
      void _fs;
      migrated++;
      return { ...rest, projectIds: ids };
    }

    // Step 2: folderIds[] → projectIds[] (V0.7.0.2–V0.7.1)
    if (Array.isArray(legacy.folderIds) && !Array.isArray(m.projectIds)) {
      const { folderIds: _fs, ...rest } = legacy;
      void _fs;
      migrated++;
      return { ...rest, projectIds: legacy.folderIds };
    }

    // Step 3: ensure projectIds is always an array (defensive)
    if (!Array.isArray(m.projectIds)) {
      migrated++;
      return { ...m, projectIds: [] };
    }
    return m;
  });

  if (migrated > 0) {
    await writeAll(updated);
    console.info(
      `[gptu] media migration: patched ${migrated} items (folderId/folderIds → projectIds[])`
    );
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleMediaMessage(
  type: string,
  payload: unknown
): Promise<ExtensionResponse> {
  switch (type) {
    case "LIST_MEDIA": {
      const all = await readAll();
      const sorted = all.toSorted((a, b) => b.capturedAt - a.capturedAt);
      return { ok: true, data: sorted };
    }

    case "GET_MEDIA": {
      const id = (payload as { id?: string } | undefined)?.id;
      if (!id) return { ok: false, error: "id required" };
      const all = await readAll();
      const found = all.find((m) => m.id === id) ?? null;
      return { ok: true, data: found };
    }

    case "SAVE_MEDIA": {
      const media = (payload as { media?: Media } | undefined)?.media;
      if (!media || !media.id) return { ok: false, error: "media with id required" };
      if (!Array.isArray(media.projectIds)) {
        (media as Media).projectIds = [];
      }
      const all = await readAll();

      // Dedup by id first (upsert)
      const idx = all.findIndex((m) => m.id === media.id);
      if (idx >= 0) {
        all[idx] = media;
        await writeAll(all);
        await broadcastMediaChanged();
        return { ok: true, data: { saved: true } };
      }

      // F2: Dedup by content fingerprint — per-item, not per-page.
      // Images: dedup by (host, type, content src URL) — NOT by originUrl.
      //   Old: dedup by originUrl meant all images from same page would be blocked after first.
      //   Fix: dedup by the actual image src (media.content) — each distinct image is unique.
      // Code/artifact: dedup by (host, type, content[0..200]) — unchanged.
      const isDuplicate = all.some((m) => {
        if (m.host !== media.host || m.type !== media.type) return false;
        if (media.type === "image" && m.content && media.content) {
          // Dedup by src URL (content) — multiple images on same page have different srcs
          return m.content === media.content;
        }
        if ((media.type === "code" || media.type === "artifact") && m.content && media.content) {
          return m.content.slice(0, 200) === media.content.slice(0, 200);
        }
        return false;
      });

      if (isDuplicate) {
        // Silent skip — not an error, just an idempotent no-op
        return { ok: true, data: { saved: false, duplicate: true } };
      }

      // Fetch and store image blob for cross-host thumbnail rendering (B4 fix).
      // SW context: use arrayBuffer() + manual base64 encode (no FileReader needed).
      if (
        media.type === "image" &&
        media.content &&
        media.content.startsWith("http") &&
        !media.blobKey
      ) {
        try {
          const response = await fetch(media.content);
          const blob = await response.blob();
          const blobKey = `media_blob_${media.id}`;
          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          // Chunk btoa to avoid call-stack overflow on large images
          const CHUNK = 8192;
          let binary = "";
          for (let i = 0; i < uint8.length; i += CHUNK) {
            binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
          }
          const base64 = btoa(binary);
          await saveBlobToIdb(blobKey, base64, blob.type || media.mimeType);
          media.blobKey = blobKey;
          media.size = blob.size;
        } catch (err) {
          console.warn("[gptu] media: fetch blob failed for", media.content, err);
          // Continue saving metadata without blob — cross-host display degraded but not fatal
        }
      }

      all.push(media);
      await writeAll(all);
      await broadcastMediaChanged();
      return { ok: true, data: { saved: true } };
    }

    case "SAVE_MEDIA_WITH_BLOB": {
      const p = payload as { media?: Media; base64?: string; mimeType?: string } | undefined;
      if (!p?.media?.id) return { ok: false, error: "media with id required" };
      if (!p.base64) return { ok: false, error: "base64 required" };

      const media = p.media;
      if (!Array.isArray(media.projectIds)) {
        media.projectIds = [];
      }

      // Store blob in IDB
      const blobKey = media.blobKey ?? media.id;
      await saveBlobToIdb(blobKey, p.base64, p.mimeType ?? media.mimeType);
      media.blobKey = blobKey;

      const all = await readAll();
      const idx = all.findIndex((m) => m.id === media.id);
      if (idx >= 0) {
        all[idx] = media;
      } else {
        all.push(media);
      }
      await writeAll(all);
      await broadcastMediaChanged();
      return { ok: true, data: { saved: true, blobKey } };
    }

    case "GET_MEDIA_BLOB": {
      const blobKey = (payload as { blobKey?: string } | undefined)?.blobKey;
      if (!blobKey) return { ok: false, error: "blobKey required" };
      const result = await getBlobFromIdb(blobKey);
      return { ok: true, data: result };
    }

    case "REMOVE_MEDIA": {
      const id = (payload as { id?: string } | undefined)?.id;
      if (!id) return { ok: false, error: "id required" };
      const all = await readAll();
      const item = all.find((m) => m.id === id);
      const filtered = all.filter((m) => m.id !== id);
      await writeAll(filtered);
      // Clean up blob if present
      if (item?.blobKey) {
        await deleteBlobFromIdb(item.blobKey);
      }
      await broadcastMediaChanged();
      return { ok: true, data: { removed: true } };
    }

    case "MOVE_MEDIA": {
      const {
        mediaId,
        projectId: targetProjectId,
        action = "replace",
      } = (payload as
        | {
            mediaId?: string;
            projectId?: string | null;
            action?: "add" | "remove" | "replace";
          }
        | undefined) ?? {};

      if (!mediaId) return { ok: false, error: "mediaId required" };

      const all = await readAll();
      const idx = all.findIndex((m) => m.id === mediaId);
      if (idx < 0) return { ok: false, error: "media not found" };

      const item = all[idx];
      if (!item) return { ok: false, error: "media not found" };

      const current = item.projectIds ?? [];
      let newProjectIds: string[];

      if (action === "add") {
        newProjectIds = !targetProjectId
          ? current
          : current.includes(targetProjectId)
            ? current
            : [...current, targetProjectId];
      } else if (action === "remove") {
        newProjectIds = targetProjectId ? current.filter((id) => id !== targetProjectId) : current;
      } else {
        // "replace"
        newProjectIds = targetProjectId == null || targetProjectId === "" ? [] : [targetProjectId];
      }

      all[idx] = { ...item, projectIds: newProjectIds };
      await writeAll(all);
      await broadcastMediaChanged();
      return { ok: true, data: { moved: true } };
    }

    case "MEDIA_CHANGED": {
      // SW-to-content broadcast type — ack silently if received as inbound
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown media message type: ${String(type)}` };
  }
}

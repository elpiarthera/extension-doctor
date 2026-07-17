// FIXTURE PROVENANCE: verbatim copy of src/background/messaging.ts
// from gptpowerups-extension @ origin/chi/d137-backlog-fixes-v2 (guarded)

/**
 * chrome.runtime messaging relay for GPTPowerUps extension.
 * Provides typed wrappers around chrome.runtime.sendMessage and onMessage.
 *
 * Usage:
 *   import { sendMessage, onMessage } from "./messaging";
 *   const response = await sendMessage<ExtensionResponse>({ type: "GET_POWER_UPS" });
 *
 * Sprint 1 discriminated union (ChromeMessage) added below for strongly-typed
 * per-message-type routing introduced in B15/T11 background wiring phase.
 */

import type { HostId } from "../../adapters/types";
import type { PowerUp } from "../core/catalog-browser/catalog-types";
import type { ExtensionMessage } from "../shared/types";
import type { AuthState } from "./auth";

// ---------------------------------------------------------------------------
// Sprint 1 discriminated union — ChromeMessage
// ---------------------------------------------------------------------------

/**
 * Exhaustive discriminated union of all Sprint 1 chrome.runtime message shapes.
 * Use this type for strongly-typed routing in background handlers (T11+).
 * The legacy ExtensionMessage type is preserved for backward compat with T2 code.
 */
export type ChromeMessage =
  | { type: "PROMPT_INSERT"; promptId: string; hydrated: string }
  | { type: "CATALOG_SYNC_REQUEST" }
  | { type: "CATALOG_SYNC_RESPONSE"; data: PowerUp[] }
  | { type: "OPEN_POPUP_TO"; slug?: string }
  | { type: "SESSION_START"; host: HostId; url: string; ts: number }
  | { type: "SESSION_END"; sessionId: string; ts: number }
  | { type: "LOCALE_CHANGE"; locale: "en" | "fr" }
  | { type: "AUTH_STATUS_REQUEST" }
  | { type: "AUTH_STATUS_RESPONSE"; state: AuthState };

// ---------------------------------------------------------------------------
// Extension context invalidated guard (D137 backlog fix 2)
// ---------------------------------------------------------------------------

/**
 * Returns false once the extension context has been invalidated — happens
 * to every content script already injected into an open tab whenever the
 * extension reloads/updates. chrome.runtime.id becomes undefined on the
 * orphaned global; any chrome.runtime.sendMessage call from that context
 * throws "Extension context invalidated" synchronously or rejects.
 *
 * This is a routine, expected event (ships with every extension update
 * while a ChatGPT/Claude/Grok tab stays open) — not an error to surface to
 * the host page's console.
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && chrome.runtime != null && chrome.runtime.id != null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Generic helpers — preserve T2 backward-compat signature
// ---------------------------------------------------------------------------

/**
 * Send a message to the background service worker and await the response.
 * Resolves with the typed response payload T.
 *
 * Overload 1 (Sprint 1+): typed ChromeMessage input.
 * Overload 2 (T2 compat): legacy ExtensionMessage input.
 *
 * D137 backlog fix 2: if the extension context is already invalidated
 * (orphaned content script after an extension reload/update), this resolves
 * to `undefined` silently instead of throwing/rejecting into the host page.
 */
export async function sendMessage<T extends ChromeMessage>(message: T): Promise<unknown>;
export async function sendMessage<T>(message: ExtensionMessage): Promise<T>;
export async function sendMessage(message: ChromeMessage | ExtensionMessage): Promise<unknown> {
  if (!isExtensionContextValid()) {
    return undefined;
  }
  return chrome.runtime.sendMessage(message);
}

/**
 * Register a handler for messages received from content scripts or popup.
 * Accepts ChromeMessage union — use a switch on msg.type to narrow.
 *
 * The handler may return a value (sync or async) to reply to sendMessage callers.
 *
 * Backward compat: ExtensionMessage handlers registered before Sprint 1 continue
 * to work because chrome.runtime.onMessage is untyped at runtime.
 */
export function onMessage(
  handler: (msg: ChromeMessage, sender: chrome.runtime.MessageSender) => unknown | Promise<unknown>
): void {
  chrome.runtime.onMessage.addListener(handler as never);
}

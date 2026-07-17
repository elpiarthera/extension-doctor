// FIXTURE PROVENANCE: verbatim copy of src/background/broadcast.ts
// from gptpowerups-extension @ origin/chi/d137-backlog-fixes-v2

/**
 * Cross-tab broadcast helper — scoped to the supported hosts only.
 *
 * D137 backlog fix 1: previously conversations-handler.ts, media-handler.ts,
 * and projects-handler.ts each called chrome.tabs.query({}) — which returns
 * EVERY open tab in the browser, not just GPTPowerUps hosts. Under
 * local-first-strict doctrine this is a leak: state-change events
 * (CONVERSATIONS_CHANGED / PROJECTS_CHANGED / MEDIA_CHANGED) have no reason
 * to reach a banking tab or a webmail tab.
 *
 * The host set is DERIVED from adapters/index.ts (getSupportedTabUrlPatterns),
 * never typed here — HOST_FEATURE_MATRIX doctrine (CLAUDE.md EXTENSIONS #7).
 * Adding a 4th host = 1 ADAPTERS entry in adapters/index.ts. Zero touch here.
 */

import { getSupportedTabUrlPatterns } from "../../adapters/index";

/**
 * Broadcast a typed message to every tab currently open on a supported host
 * (chatgpt.com / claude.ai / grok.com — derived from the adapters registry).
 *
 * Fire-and-forget per tab: a tab without the content script loaded yet
 * (or mid-navigation) simply drops the message — no crash, no retry.
 */
export async function broadcastToSupportedHosts(type: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: getSupportedTabUrlPatterns() });
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

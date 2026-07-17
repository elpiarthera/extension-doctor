// FIXTURE — plausible correct pattern, not extracted from real gptpowerups-extension code.

const ALLOWED_EXTERNAL_SENDER_IDS = new Set(["companion-app-extension-id"]);

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!sender.id || !ALLOWED_EXTERNAL_SENDER_IDS.has(sender.id)) {
    sendResponse({ ok: false, error: "unauthorized sender" });
    return false;
  }
  if (message.type === "PING") {
    sendResponse({ ok: true, version: "0.9.1.0" });
    return true;
  }
  if (message.type === "SYNC") {
    void syncFromCompanionApp(message.payload);
    sendResponse({ ok: true });
  }
  return false;
});

async function syncFromCompanionApp(payload: unknown): Promise<void> {
  console.log("syncing", payload);
}

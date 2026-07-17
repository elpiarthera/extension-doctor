// FIXTURE — plausible regression, not extracted from real gptpowerups-extension code.

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
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

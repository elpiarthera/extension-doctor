// FIXTURE PROVENANCE: synthetic, labeled — models the well-known MV3
// anti-pattern of using setInterval to keep the service worker alive
// instead of chrome.alarms. Per docs/analysis
// extension-doctor-state-of-the-art §1.2 rule 30, dot-skills DÉJÀ-COUVERT,
// no confirmed real gptpowerups occurrence today — fixture is the
// canonical mutation this rule is calibrated against.
export function keepAlive(): void {
  setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // no-op ping to keep the event loop busy
    });
  }, 5000);
}

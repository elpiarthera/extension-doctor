// FIXTURE PROVENANCE: synthetic, labeled — models the well-known MV3
// anti-pattern of registering chrome.* listeners after an await inside an
// async IIFE, instead of synchronously at module top-level. Per
// docs/analysis extension-doctor-state-of-the-art §1.2 rule 30, dot-skills
// DÉJÀ-COUVERT, fixture is the canonical mutation this rule is calibrated
// against.
async function init(): Promise<void> {
  const config = await loadConfig();
  chrome.runtime.onMessage.addListener((msg) => {
    console.log(config, msg);
  });
}

async function loadConfig(): Promise<{ ready: boolean }> {
  return { ready: true };
}

init();

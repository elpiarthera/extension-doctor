// Cas tordu: url filter present but its VALUE comes from a function call,
// not a literal. Contract requires the presence of the `url` key alone —
// never a literal requirement, or this legitimate pattern would be flagged.
function getSupportedTabUrlPatterns(): string[] {
  return ["*://chatgpt.com/*"];
}

export async function broadcast(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: getSupportedTabUrlPatterns() });
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "X" });
    }
  }
}

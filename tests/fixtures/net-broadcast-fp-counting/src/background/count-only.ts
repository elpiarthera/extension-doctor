// Faux positif redouté: query({}) with no sendMessage in scope — just
// counting open tabs for local telemetry. MUST NOT be flagged.
export async function countOpenTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({});
  return tabs.length;
}

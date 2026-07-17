// FIXTURE PROVENANCE: trimmed stand-in for adapters/index.ts from
// gptpowerups-extension @ origin/chi/d137-backlog-fixes-v2 — only the
// exported getSupportedTabUrlPatterns() signature matters to the rule under
// test (net-broadcast-unfiltered only checks for a `url:` key, never the
// literal value), so the full ADAPTERS registry is NOT reproduced here.
// Real implementation at that ref (line 145-146):
//   export function getSupportedTabUrlPatterns(): string[] {
//     return Object.keys(ADAPTERS).map((hostname) => `https://${hostname}/*`);
//   }
export function getSupportedTabUrlPatterns(): string[] {
  return ["https://chatgpt.com/*", "https://claude.ai/*", "https://grok.com/*"];
}

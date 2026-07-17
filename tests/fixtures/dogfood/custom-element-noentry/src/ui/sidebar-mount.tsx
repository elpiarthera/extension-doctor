// FIXTURE PROVENANCE: synthetic — deliberately no manifest.json and no
// vite.config.* anywhere under this fixture root, to exercise
// buildExportGraph's unresolvedEntryReason path (tripolar inconclusive
// contract, never read reachableFiles as meaningful when this fires).
export function mountSidebar(host: HTMLElement): void {
  host.innerHTML = "<gptu-icon-button label=\"open\"></gptu-icon-button>";
}

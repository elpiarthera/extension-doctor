// FIXTURE PROVENANCE: shape mirrors the REAL gptpowerups-extension defect
// reported by the react-doctor audit (VD SIGNAL FORT, docs/analysis
// extension-doctor-state-of-the-art-2026-07-17.md §1.2 rule 4): the content
// script renders <gptu-icon-button> but never imports
// ui/lit-ui-register.ts, so customElements.define("gptu-icon-button", ...)
// never runs in the shipped bundle. Rewritten as a minimal fixture (not a
// verbatim file copy — the original sidebar-mount.tsx is much larger).
export function mountSidebar(host: HTMLElement): void {
  host.innerHTML = "<gptu-icon-button label=\"open\"></gptu-icon-button>";
}

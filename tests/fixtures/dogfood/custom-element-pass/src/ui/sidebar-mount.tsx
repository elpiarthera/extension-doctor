// FIXTURE PROVENANCE: synthetic — same shape as custom-element-fail's
// sidebar-mount.tsx, but with the fix applied: importing ui/lit-ui-register
// makes customElements.define("gptu-icon-button", ...) run before the tag
// is ever rendered, closing the orphan-registration gap for this rule.
import "./lit-ui-register";

export function mountSidebar(host: HTMLElement): void {
  host.innerHTML = "<gptu-icon-button label=\"open\"></gptu-icon-button>";
}

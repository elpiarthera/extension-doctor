// FIXTURE PROVENANCE: synthetic, labeled — models a common content-script
// leak pattern (mount/unmount pair that adds a mousemove listener on the
// host document but never removes it), not a verbatim copy of any real
// gptpowerups file. Per docs/analysis extension-doctor-state-of-the-art
// §1.2 rule 13, no confirmed real VD exists today for this rule — fixture
// calibrated by mutation, honestly labeled as synthetic.
export function mountHoverCard(): void {
  function onMove(event: MouseEvent): void {
    console.log(event.clientX, event.clientY);
  }
  document.addEventListener("mousemove", onMove);
}

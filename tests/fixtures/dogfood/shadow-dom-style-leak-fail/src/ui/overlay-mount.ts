// FIXTURE PROVENANCE: synthetic, labeled — models an overlay mount that
// creates a <style> element for the Shadow DOM overlay but appends it to
// the host document instead of the shadow root, leaking styling scope onto
// the host page. Not a verbatim copy of any real gptpowerups file.
export function mountOverlay(): void {
  const style = document.createElement("style");
  style.textContent = ".gptu-overlay { color: red; }";
  document.head.appendChild(style);
}

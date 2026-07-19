// FIXTURE PROVENANCE: synthetic, labeled — same shape as
// shadow-dom-style-leak-fail/src/ui/overlay-mount.ts, fixed by appending the
// <style> element to the shadow root instead of the host document, and by
// adopting a constructed stylesheet on the shadow root.
export function mountOverlay(host: HTMLElement): void {
  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = ".gptu-overlay { color: red; }";
  shadowRoot.appendChild(style);
}

export function mountToast(host: HTMLElement): void {
  const shadowRoot = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(".gptu-toast { opacity: 1; }");
  shadowRoot.adoptedStyleSheets = [sheet];
}

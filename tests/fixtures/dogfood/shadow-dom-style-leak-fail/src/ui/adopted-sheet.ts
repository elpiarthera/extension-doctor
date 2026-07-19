// FIXTURE PROVENANCE: synthetic, labeled — a constructed stylesheet is
// adopted directly on `document` instead of the shadow root that hosts the
// overlay markup, leaking the sheet's rules onto the entire host page.
const sheet = new CSSStyleSheet();
sheet.replaceSync(".gptu-toast { opacity: 1; }");
document.adoptedStyleSheets = [sheet];

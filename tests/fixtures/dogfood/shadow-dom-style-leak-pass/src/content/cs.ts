// FIXTURE PROVENANCE: synthetic, labeled — regression for the
// executable-position-vs-quoted-literal defect class (same class already
// closed in hook-deps-incomplete). The trigger pattern
// "document.adoptedStyleSheets = sheets" appears here ONLY inside a quoted
// string literal (a log message / doc string) — nothing executes. This must
// never be reported as a real leak.
export function logDeprecatedPattern(): void {
  console.log("document.adoptedStyleSheets = sheets");
}

// FIXTURE PROVENANCE: synthetic, labeled — regression for the
// executable-position-vs-quoted-literal defect class (same class already
// closed in hook-deps-incomplete). The trigger shape
// `useEffect(() => { window.addEventListener("resize", r); }, [])` appears
// here ONLY inside a quoted string literal (documentation copy shown in a
// help panel) — nothing executes. This must never be reported as a real
// missing-cleanup effect.
export const HELP_SNIPPET =
  "useEffect(() => { window.addEventListener(\"resize\", r); }, [])";

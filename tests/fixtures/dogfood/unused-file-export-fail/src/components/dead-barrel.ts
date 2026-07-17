// FIXTURE PROVENANCE: synthetic dead barrel, labeled synthetic — never
// imported from any entry point, generalized from the react-doctor audit
// pattern cited in docs/analysis §1.4 §2 rule 5 (5 real dead
// barrels/components found; this fixture reproduces the class, not the
// verbatim file).
export function neverCalled(): string {
  return "dead";
}

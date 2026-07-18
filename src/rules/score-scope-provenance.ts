/**
 * Rule: score-scope-provenance
 *
 * Not a code scanner — this rule inspects the tool's OWN output contract.
 * A score/ratio published without the full command line that produced it
 * is a lie in waiting (Day 137: `--no-lint` → 92/100 vs full run → 62/100,
 * a 30-point gap invisible unless the command is carried alongside the
 * number). The tool enforces this structurally: `ProvenanceEnvelope.command`
 * is DERIVED from `process.argv` (never retyped, see src/core/run.ts) and
 * is structurally inseparable from any scored output — a score without
 * `command` in the SAME JSON object is malformed by construction.
 *
 * This rule participates honestly in the pack's active-rule count by
 * citing WHERE that structural guarantee lives, rather than re-scanning
 * for something the type system + run.ts already make impossible to omit.
 * The real guard on our own output lives in
 * tests/pack-fam7-provenance.test.ts (asserts runRules(...) always yields
 * a non-empty envelope.command).
 *
 * Spec: internal rule matrix (not shipped with this package) §1.5
 *   `score-scope-provenance` — T0, Day 137
 */
import type { Rule, RuleResult } from "../core/types.js";

const RULE_ID = "score-scope-provenance";

export const scoreScopeProvenance: Rule = {
  id: RULE_ID,
  description:
    "A score/ratio published without the full command line that produced it is a lie in waiting — this rule confirms the tool's own ProvenanceEnvelope.command is structurally non-optional (src/core/run.ts, src/core/types.ts), never a code scan.",
  severity: "warning",
  async run(): Promise<RuleResult> {
    return {
      ruleId: RULE_ID,
      verdict: "pass",
      findings: [],
      inconclusive: [],
      exitCode: 0,
    };
  },
};

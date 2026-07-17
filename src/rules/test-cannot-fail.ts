/**
 * Rule stub: test-cannot-fail (documented impossible — v0.1, PARTIAL)
 *
 * NOT definitively detectable at v0.1: a test whose assertion can
 * structurally never go red. Real incidents: T0 friction VP
 * `j57fgja727z6acje743k3gm4d98ajxaq` (Day 131-132).
 *
 * Why static analysis is insufficient alone (matrix §4/§1.5, T0 Day 137):
 *   A syntactic scan over jsdom/chrome.* mocks + DOM stubs is mechanical
 *   but produces both false positives (a legitimate jsdom test on a pure
 *   function — RULE #8 in CLAUDE.md explicitly authorizes this) and false
 *   negatives (an assertion that CAN fail syntactically but never will at
 *   runtime because the mock always returns the asserted value). The only
 *   definitive proof is a bipolar mutation probe: inject a real defect
 *   into the code under test and confirm the test goes red — mutation-
 *   testing infrastructure over third-party/host code does not exist in
 *   this pipeline yet.
 *
 * This rule NEVER silently passes. It always returns "inconclusive" naming
 * precisely what would be required to lift the limitation.
 *
 * See docs/not-statically-detectable.md for the full demonstration.
 */
import type { Rule, RuleResult, InconclusiveReason } from "../core/types.js";

const RULE_ID = "test-cannot-fail";

export const testCannotFail: Rule = {
  id: RULE_ID,
  description:
    "Documented impossible at v0.1 (PARTIAL): a test whose assertion structurally can never go red. Static scan alone is insufficient — definitive proof requires a bipolar mutation probe on third-party/host code, infrastructure that does not exist yet.",
  severity: "warning",
  async run(): Promise<RuleResult> {
    const reason: InconclusiveReason = {
      ruleId: RULE_ID,
      reason:
        "test-cannot-fail is NOT definitively detectable at v0.1: a syntactic scan for jsdom+chrome.*/DOM mocks is mechanical but insufficient alone — it produces false positives on legitimate jsdom tests over pure functions (RULE #8 exempts these) and false negatives on assertions that are syntactically capable of failing but never will given the mock's fixed return value. The only definitive proof is a bipolar mutation probe (inject a real defect into the code under test, confirm the test goes red) — mutation-testing infrastructure over third-party/host code does not exist in this pipeline. See docs/not-statically-detectable.md.",
    };
    return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
  },
};

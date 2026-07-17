/**
 * Rule stub: coexistence-collision (documented impossible — v0.1)
 *
 * NOT statically detectable at v0.1: two contradictory tests on the same
 * logical element, at different dates, where the most recent silently wins
 * (the older, still-valid assertion is never re-checked against the new
 * code path). Real incident: D92-T5 checkbox→button refactor re-broke a
 * fix from D67, 5 weeks of consistent green regressed without any red.
 *
 * Why static analysis is insufficient (matrix §4, T0 Day 137):
 *   Deciding "these two tests target the same logical element" requires
 *   semantic cross-file matching (not textual — a checkbox and a button
 *   assertion share no literal string), PLUS calibration data to keep the
 *   false-positive/false-negative rate acceptable (a component with two
 *   legitimate render modes, e.g. desktop/mobile, looks identical to a
 *   collision without render-context disambiguation). No such calibration
 *   corpus exists yet.
 *
 * This rule NEVER silently passes. It always returns "inconclusive" naming
 * precisely what would be required to lift the limitation.
 *
 * See docs/not-statically-detectable.md for the full demonstration.
 */
import type { Rule, RuleResult, InconclusiveReason } from "../core/types.js";

const RULE_ID = "coexistence-collision";

export const coexistenceCollision: Rule = {
  id: RULE_ID,
  description:
    "Documented impossible at v0.1: two contradictory tests on the same logical element at different dates, most recent silently winning. Requires semantic cross-file matching + a calibration corpus that does not exist yet.",
  severity: "warning",
  async run(): Promise<RuleResult> {
    const reason: InconclusiveReason = {
      ruleId: RULE_ID,
      reason:
        "coexistence-collision is NOT statically detectable at v0.1: deciding two tests target the same logical element requires semantic cross-file matching (textual matching fails — a checkbox test and a button test share no literal string), plus a calibration corpus to bound false positives against components with legitimate multiple render modes (e.g. desktop/mobile). No such matching engine or calibration corpus exists in this pipeline. See docs/not-statically-detectable.md.",
    };
    return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
  },
};

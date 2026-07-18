/**
 * Rule stub: verified-not-activated (documented impossible — v0.1, blocked
 * on a missing pipeline convention)
 *
 * NOT detectable at v0.1: a "shipped" correctif with no proof that the
 * version carrying it is the one actually served. Real incident: T0
 * friction VP `j576qsh9vj8903d79wm0kv97cx89sw5s` (Day 119) — a fix commit
 * merged and reported "shipped" while the served bundle still ran the
 * prior build. Cross-ref `derive-never-type.md` corollary "publié ≠
 * livré" (Day 129 Gamma npm dist-tag incident).
 *
 * Why static analysis is insufficient (matrix §4/§1.5, T0 Day 137):
 *   Deciding "the fix that shipped in this commit is the one currently
 *   served" is mechanical IN PRINCIPLE (compare a build-hash embedded at
 *   build time against the build-hash actually served/loaded) but requires
 *   a build-hash convention that does not exist in this pipeline's
 *   `vite.config.ts` today (not verified as re-added — see matrix §7). A
 *   legitimate deploy propagation window also requires a documented
 *   temporal tolerance, absent today. Without both, any verdict here would
 *   be a guess dressed as a measurement.
 *
 * This rule NEVER silently passes. It always returns "inconclusive" naming
 * precisely what would be required to lift the limitation.
 *
 * See README.md ("Not statically detectable") for the full demonstration.
 */
import type { Rule, RuleResult, InconclusiveReason } from "../core/types.js";

const RULE_ID = "verified-not-activated";

export const verifiedNotActivated: Rule = {
  id: RULE_ID,
  description:
    "Documented impossible at v0.1: a correctif reported 'shipped' with no proof the version carrying it is the one actually served. Mechanical in principle via a build-hash convention that does not exist in this pipeline yet.",
  severity: "warning",
  async run(): Promise<RuleResult> {
    const reason: InconclusiveReason = {
      ruleId: RULE_ID,
      reason:
        "verified-not-activated is NOT detectable at v0.1: comparing 'the fix that shipped in this commit' against 'the build actually served' requires a build-hash convention embedded at build time and re-read from the served artifact — no such convention exists in this pipeline's vite.config.ts today, and no documented temporal tolerance exists for a legitimate deploy-propagation window. Without both, any verdict here would be a guess dressed as a measurement.",
    };
    return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
  },
};

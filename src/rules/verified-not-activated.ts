/**
 * Rule stub: verified-not-activated (documented impossible — v0.1, blocked
 * on a missing pipeline convention)
 *
 * NOT detectable at v0.1: a fix reported "shipped" with no proof that the
 * version carrying it is the one actually served. This class of failure is
 * well documented in the wild: a fix commit merges and gets reported as
 * shipped while the served bundle still runs the prior build, or a package
 * gets published without the registry's "latest" tag moving to point at
 * it, so consumers keep resolving the old version.
 *
 * Why static analysis is insufficient:
 *   Deciding "the fix that shipped in this commit is the one currently
 *   served" is mechanical IN PRINCIPLE (compare a build-hash embedded at
 *   build time against the build-hash actually served/loaded) but requires
 *   a build-hash convention that does not exist in this pipeline's
 *   `vite.config.ts` today. A legitimate deploy propagation window also
 *   requires a documented temporal tolerance, absent today. Without both,
 *   any verdict here would be a guess dressed as a measurement.
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
    "Documented impossible at v0.1: a fix reported 'shipped' with no proof the version carrying it is the one actually served. Mechanical in principle via a build-hash convention that does not exist in this pipeline yet.",
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

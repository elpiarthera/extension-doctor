import type { Rule, RuleResult, ProvenanceEnvelope } from "./types.js";
import { walk } from "./walk.js";

export interface RunOptions {
  extensionRoot: string;
  rules: Rule[];
  rulesRequested: number;
  /** Full argv-derived command string, DERIVED from process.argv, never retyped. */
  command: string;
}

export interface RunOutcome {
  envelope: ProvenanceEnvelope;
  /**
   * Process exit code contract:
   *   0 = nothing found across all active rules
   *   1 = at least one rule found a real defect (fail)
   *   2 = at least one rule could not measure (inconclusive), and no rule failed
   * A "fail" always wins over an "inconclusive" for the top-level exit code,
   * because a confirmed defect is a stronger signal than an unresolved one —
   * but both are always visible in the envelope regardless of which wins.
   */
  exitCode: 0 | 1 | 2;
}

export async function runRules(options: RunOptions): Promise<RunOutcome> {
  const { extensionRoot, rules, rulesRequested, command } = options;

  const results: RuleResult[] = [];
  for (const rule of rules) {
    results.push(await rule.run(extensionRoot));
  }

  const findings = results.flatMap((r) => r.findings);
  const inconclusive = results.flatMap((r) => r.inconclusive);

  const perRule: ProvenanceEnvelope["perRule"] = {};
  for (const r of results) {
    perRule[r.ruleId] = { verdict: r.verdict, exitCode: r.exitCode };
  }

  const filesScanned = walk(extensionRoot, {
    extraIgnore: [],
  }).length;

  const hasFail = results.some((r) => r.verdict === "fail");
  const hasInconclusive = results.some((r) => r.verdict === "inconclusive");

  // Score: percentage of active rules that returned "pass". Rules that are
  // "inconclusive" count against the denominator visibility (rulesActive vs
  // rulesRequested) but are excluded from the pass-ratio numerator/denominator
  // itself so an unresolved rule never silently inflates or deflates the
  // score — its absence from the ratio is instead visible via scope.
  const measured = results.filter((r) => r.verdict !== "inconclusive");
  const passed = measured.filter((r) => r.verdict === "pass").length;
  const score = measured.length === 0 ? 0 : Math.round((passed / measured.length) * 100);

  const envelope: ProvenanceEnvelope = {
    command,
    scope: {
      filesScanned,
      rulesActive: rules.length,
      rulesRequested,
    },
    score,
    findings,
    inconclusive,
    perRule,
  };

  let exitCode: 0 | 1 | 2 = 0;
  if (hasFail) exitCode = 1;
  else if (hasInconclusive) exitCode = 2;

  return { envelope, exitCode };
}

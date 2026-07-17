/**
 * Rule: unused-file-export
 *
 * A source file never reached by the transitive import closure from
 * manifest.json / vite.config entry points (per core/export-graph
 * buildExportGraph), i.e. a dead barrel or component. qa/, scripts/, and
 * tests/ are excluded by construction (core/walk.ts DEFAULT_IGNORE already
 * skips them when building allSourceFiles) plus an explicit belt-and-braces
 * path-segment check here, since a file only *referenced from a comment*
 * inside a qa/ script must never count as "reachable".
 *
 * Per core/export-graph.ts contract: when unresolvedEntryReason is non-null,
 * reachableFiles is EMPTY BY CONSTRUCTION and MUST NOT be read as "nothing
 * reachable" (that would flag every source file as dead — the exact
 * fail-open trap banned by derive-never-type.md). This rule surfaces that
 * case as INCONCLUSIVE, never as a pass/fail verdict.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md §1.4,
 * §2 rule 5 — MUST_BLOCK RÉEL: 5 barrels/composants morts prouvés par
 * l'audit react-doctor.
 */
import { join } from "node:path";
import type { Rule, RuleResult, Finding } from "../core/types.js";
import { buildExportGraph } from "../core/export-graph.js";

const RULE_ID = "unused-file-export";
const EXCLUDED_SEGMENTS = ["qa", "scripts", "tests"];

function isExcluded(relPath: string): boolean {
  const segments = relPath.split("/");
  return segments.some((seg) => EXCLUDED_SEGMENTS.includes(seg));
}

export const unusedFileExport: Rule = {
  id: RULE_ID,
  description:
    "A source file not transitively reachable from any resolved manifest.json/vite.config entry point (a dead barrel or component), excluding qa/, scripts/, tests/.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const graph = buildExportGraph(extensionRoot);

    if (graph.unresolvedEntryReason !== null) {
      return {
        ruleId: RULE_ID,
        verdict: "inconclusive",
        findings: [],
        inconclusive: [{ ruleId: RULE_ID, reason: graph.unresolvedEntryReason }],
        exitCode: 2,
      };
    }

    const findings: Finding[] = [];
    for (const rel of graph.allSourceFiles) {
      if (isExcluded(rel)) continue;
      if (graph.reachableFiles.has(rel)) continue;
      findings.push({
        ruleId: RULE_ID,
        severity: "warning",
        message: `${join(rel)} is not reachable from any resolved entry point (manifest.json background/content_scripts/popup, or vite.config declared input) — likely a dead file`,
        file: rel,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

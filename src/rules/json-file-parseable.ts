/**
 * Rule: json-file-parseable
 *
 * Every ".json" file in the built bundle (manifest.json, locale message
 * files, any bundled JSON asset) must be valid, parseable JSON. A trailing
 * comma or a build step that emits malformed JSON fails silently at
 * install/load time in the browser — this rule catches it before shipping.
 */
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";
import { readBundleFile } from "../core/bundle-scan.js";

const RULE_ID = "json-file-parseable";

export const jsonFileParseable: Rule = {
  id: RULE_ID,
  description: "A .json file in the built bundle does not parse as valid JSON.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir, { extensions: [".json"] });
    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    for (const relPath of relPaths) {
      let raw: string;
      try {
        raw = readBundleFile({ relPath, absPath: join(build.buildDir, relPath) });
      } catch (err) {
        inconclusive.push({ ruleId: RULE_ID, reason: `could not read bundle file: ${String(err)}`, file: relPath });
        continue;
      }
      try {
        JSON.parse(raw);
      } catch (err) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${relPath} does not parse as valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          file: relPath,
        });
      }
    }

    if (inconclusive.length > 0 && findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive, exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
  },
};

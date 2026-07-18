/**
 * Rule: manifest-type-no-json
 *
 * Detects a delivered extension root whose `manifest.json` is missing at
 * the top level (e.g. a ZIP zipped from one directory too deep, so the
 * manifest ends up under a subfolder instead of the archive root).
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.1 row `manifest-type-no-json`, §2 item 15.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `TYPE_NO_MANIFEST_JSON` (MPL-2.0, confirmed `addError` src/linter.js:327).
 */
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "manifest-type-no-json";

export const manifestTypeNoJson: Rule = {
  id: RULE_ID,
  description:
    "manifest.json absent at the delivered extension root (e.g. zipped one directory too deep) — the browser store cannot locate it.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    if (!dirExists(extensionRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `extension root ${extensionRoot} does not exist — cannot check for manifest.json presence`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const manifestPath = join(extensionRoot, "manifest.json");
    if (fileExists(manifestPath)) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    const finding: Finding = {
      ruleId: RULE_ID,
      severity: "error",
      message:
        "manifest.json not found at the delivered extension root — the archive was likely zipped one directory too deep (manifest lives under a subfolder), which the browser store cannot load.",
    };
    return { ruleId: RULE_ID, verdict: "fail", findings: [finding], inconclusive: [], exitCode: 1 };
  },
};

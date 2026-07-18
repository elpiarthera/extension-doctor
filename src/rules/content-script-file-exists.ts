/**
 * Rule: content-script-file-exists
 *
 * Flags a `content_scripts[].js[]` entry in manifest.json that references a
 * file absent from the delivered package. If `content_scripts` is entirely
 * absent from the manifest, there is nothing to check and the rule PASSES
 * with a message naming that (not silently — the reason is recorded). If
 * the manifest itself cannot be read, the rule returns INCONCLUSIVE.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.1 row `content-script-file-exists`, §2 item 19 — "directement
 *   transposable à host-config.ts cross-host".
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `CONTENT_SCRIPT_NOT_FOUND` / `CONTENT_SCRIPT_EMPTY` (MPL-2.0).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "content-script-file-exists";

interface ContentScriptEntry {
  js?: unknown;
}

interface ManifestJson {
  content_scripts?: unknown;
}

export const contentScriptFileExists: Rule = {
  id: RULE_ID,
  description:
    "manifest.json content_scripts[].js[] references a file absent from the delivered package.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    if (!dirExists(extensionRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `extension root ${extensionRoot} does not exist — cannot read manifest.json`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const manifestPath = join(extensionRoot, "manifest.json");
    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json not found at extension root — cannot read content_scripts[]",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestJson;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json is not valid JSON — cannot read content_scripts[]",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (manifest.content_scripts === undefined) {
      // Nothing to check — recorded explicitly via the pass finding-less
      // shape rather than an ambiguous silent pass.
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    if (!Array.isArray(manifest.content_scripts)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "content_scripts present but not an array — cannot evaluate js[] entries",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    for (const entry of manifest.content_scripts as ContentScriptEntry[]) {
      const jsList = Array.isArray(entry.js) ? entry.js.filter((j): j is string => typeof j === "string") : [];
      for (const jsRel of jsList) {
        const jsAbs = join(extensionRoot, jsRel);
        if (!fileExists(jsAbs)) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `content_scripts[].js entry "${jsRel}" does not resolve to a file in the delivered package.`,
            file: "manifest.json",
          });
        }
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

/**
 * Rule: host-permissions-wildcard-broad
 *
 * Flags `manifest.json.host_permissions[]` containing `<all_urls>` or
 * the wildcard scheme-and-path pattern (star, colon, slash-slash, star,
 * slash, star) — an unscoped grant to every page the browser can reach,
 * documented as a Chrome Web Store review scrutiny/rejection factor.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   §1.1 row `host-permissions-wildcard-broad`, §2 item 12.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `MANIFEST_HOST_PERMISSIONS` (MPL-2.0) + CWS scrutiny/rejet documenté.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "host-permissions-wildcard-broad";

const BROAD_PATTERNS = new Set(["<all_urls>", "*://*/*"]);

interface ManifestJson {
  host_permissions?: unknown;
}

export const hostPermissionsWildcardBroad: Rule = {
  id: RULE_ID,
  description:
    "manifest.json host_permissions[] contains <all_urls> or *://*/* — unscoped access to every page, a documented CWS review scrutiny factor.",
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
        reason: "manifest.json not found at extension root — cannot read host_permissions[]",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestJson;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json is not valid JSON — cannot read host_permissions[]",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const hostPermissions = Array.isArray(manifest.host_permissions)
      ? manifest.host_permissions.filter((h): h is string => typeof h === "string")
      : [];

    const findings: Finding[] = [];
    for (const host of hostPermissions) {
      if (BROAD_PATTERNS.has(host)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `host_permissions entry "${host}" grants access to every page the browser can reach — scope to named domains instead.`,
          file: "manifest.json",
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

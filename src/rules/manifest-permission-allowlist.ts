/**
 * Rule: manifest-permission-allowlist
 *
 * Flags any entry of `manifest.json.permissions[]` that is not present in
 * a product-declared allowlist (`.extension-doctor.json` -> permissionAllowlist[]
 * at the audited root). If that allowlist file is absent, the rule cannot
 * determine an answer and returns INCONCLUSIVE, naming the missing file —
 * it never passes by default in the absence of a declared allowlist.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.1 row `manifest-permission-allowlist`, §2 item 8.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `MANIFEST_BAD_PERMISSION` / `MANIFEST_PERMISSIONS` (MPL-2.0) + dot-skills
 * `net-request-minimal-permissions` (MIT) + CWS policy (permission
 * allowlist review factor).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "manifest-permission-allowlist";

interface ManifestJson {
  permissions?: unknown;
}

interface AllowlistConfig {
  permissionAllowlist?: unknown;
}

export const manifestPermissionAllowlist: Rule = {
  id: RULE_ID,
  description:
    "manifest.json permissions[] contains an entry absent from the product-declared allowlist (.extension-doctor.json permissionAllowlist[]).",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    if (!dirExists(extensionRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `extension root ${extensionRoot} does not exist — cannot read manifest.json or .extension-doctor.json`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const manifestPath = join(extensionRoot, "manifest.json");
    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json not found at extension root — cannot read permissions[]",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestJson;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json is not valid JSON — cannot read permissions[]",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const allowlistPath = join(extensionRoot, ".extension-doctor.json");
    if (!fileExists(allowlistPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason:
          "no .extension-doctor.json with a permissionAllowlist[] declared at extension root — cannot determine which permissions are approved; NOT assumed clean",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let config: AllowlistConfig;
    try {
      config = JSON.parse(readFileSync(allowlistPath, "utf8")) as AllowlistConfig;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: ".extension-doctor.json is not valid JSON — cannot read permissionAllowlist[]",
        file: ".extension-doctor.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (!Array.isArray(config.permissionAllowlist)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: ".extension-doctor.json present but permissionAllowlist[] is missing or not an array",
        file: ".extension-doctor.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const allowlist = new Set(config.permissionAllowlist.filter((p): p is string => typeof p === "string"));
    const permissions = Array.isArray(manifest.permissions)
      ? manifest.permissions.filter((p): p is string => typeof p === "string")
      : [];

    const findings: Finding[] = [];
    for (const permission of permissions) {
      if (!allowlist.has(permission)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `permission "${permission}" in manifest.json permissions[] is not present in the declared allowlist (.extension-doctor.json permissionAllowlist[]).`,
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

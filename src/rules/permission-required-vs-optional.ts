/**
 * Rule: permission-required-vs-optional
 *
 * Detects a sensitive permission (tabs, downloads, cookies, history) declared
 * in the mandatory `permissions[]` array instead of `optional_permissions[]`.
 * Sensitive permissions requested unconditionally at install time widen the
 * Chrome Web Store review consent surface and the user-facing permission
 * prompt for a capability that is very often only needed for one opt-in
 * feature.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   item 23 "permission-required-vs-optional"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "permission-required-vs-optional";
const MANIFEST_REL = "manifest.json";

const SENSITIVE_PERMISSIONS = new Set(["tabs", "downloads", "cookies", "history"]);

interface ManifestShape {
  permissions?: unknown;
  optional_permissions?: unknown;
}

export const permissionRequiredVsOptional: Rule = {
  id: RULE_ID,
  description:
    "A sensitive permission (tabs, downloads, cookies, history) is declared in the mandatory permissions[] array instead of optional_permissions[].",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST_REL);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json not found at extension root (expected ${MANIFEST_REL}) — cannot inspect permissions`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestShape;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestShape;
    } catch (err) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json could not be parsed as JSON (${(err as Error).message}) — cannot inspect permissions`,
        file: MANIFEST_REL,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];

    const findings: Finding[] = [];
    for (const perm of permissions) {
      if (typeof perm === "string" && SENSITIVE_PERMISSIONS.has(perm)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `Sensitive permission "${perm}" is declared in the mandatory permissions[] array — move it to optional_permissions[] unless it is required for the extension's baseline function.`,
          file: MANIFEST_REL,
          snippet: JSON.stringify(manifest.permissions),
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

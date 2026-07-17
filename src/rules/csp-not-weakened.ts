/**
 * Rule: csp-not-weakened
 *
 * Flags `manifest.json.content_security_policy.extension_pages` if it
 * reintroduces `unsafe-eval` or a remote (http/https) script source. The
 * ABSENCE of a custom content_security_policy key is treated as a MUST_PASS
 * — MV3's implicit default CSP already forbids these — and that default is
 * documented explicitly here rather than silently assumed.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   §1.1 row `csp-not-weakened`, §2 item 9.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `MANIFEST_CSP` / `MANIFEST_CSP_UNSAFE_EVAL` (MPL-2.0) + CWS validator
 * rejects an invalid CSP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "csp-not-weakened";

interface ManifestJson {
  content_security_policy?: {
    extension_pages?: unknown;
  };
}

const REMOTE_SRC_RE = /(https?:)?\/\/[^\s'";]+/i;

export const cspNotWeakened: Rule = {
  id: RULE_ID,
  description:
    "manifest.json content_security_policy.extension_pages reintroduces unsafe-eval or a remote script source — weakens the MV3 implicit-default CSP.",
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
        reason: "manifest.json not found at extension root — cannot read content_security_policy",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestJson;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json is not valid JSON — cannot read content_security_policy",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const extensionPages = manifest.content_security_policy?.extension_pages;
    if (extensionPages === undefined) {
      // No custom CSP key at all — MV3's implicit default CSP
      // ("script-src 'self'; object-src 'self'") already forbids unsafe-eval
      // and remote sources. Documented explicitly, never silently assumed.
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    if (typeof extensionPages !== "string") {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "content_security_policy.extension_pages present but not a string — cannot evaluate",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    if (/unsafe-eval/.test(extensionPages)) {
      findings.push({
        ruleId: RULE_ID,
        severity: "error",
        message: "content_security_policy.extension_pages reintroduces 'unsafe-eval' — weakens the MV3 default CSP.",
        file: "manifest.json",
        snippet: extensionPages,
      });
    }
    if (REMOTE_SRC_RE.test(extensionPages)) {
      findings.push({
        ruleId: RULE_ID,
        severity: "error",
        message:
          "content_security_policy.extension_pages references a remote (http/https) script source — MV3 requires all extension_pages script sources to be bundled locally.",
        file: "manifest.json",
        snippet: extensionPages,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

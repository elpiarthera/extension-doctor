/**
 * Rule: description-permission-mismatch
 *
 * Detects a KNOWN host/product name (ChatGPT, Claude, Grok, Cursor, Gemini,
 * Copilot, Perplexity, Bing) mentioned in manifest.description without a
 * matching entry in host_permissions. Only a closed, curated list of known
 * host names is matched — generic marketing copy ("AI superpowers",
 * "assistant") never triggers this rule.
 *
 * Real defect this rule was built to catch: gptpowerups-extension's
 * manifest.description named "Cursor" while host_permissions never granted
 * any Cursor origin (Blocker B-2, fixed commit b2805d2 on
 * origin/chi/d137-baseline-green).
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   item 10 "description-permission-mismatch"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "description-permission-mismatch";
const MANIFEST_REL = "manifest.json";

/**
 * Known host/product names mapped to the host_permissions origin substring
 * that must be present for the name to be considered backed by a real
 * permission. Only names in this closed list are matched — this rule never
 * scans description text for arbitrary generic marketing words.
 */
const KNOWN_HOSTS: Array<{ name: string; hostSubstring: string }> = [
  { name: "ChatGPT", hostSubstring: "chatgpt.com" },
  { name: "Claude", hostSubstring: "claude.ai" },
  { name: "Grok", hostSubstring: "grok.com" },
  { name: "Cursor", hostSubstring: "cursor.com" },
  { name: "Gemini", hostSubstring: "gemini.google.com" },
  { name: "Copilot", hostSubstring: "copilot.microsoft.com" },
  { name: "Perplexity", hostSubstring: "perplexity.ai" },
  { name: "Bing", hostSubstring: "bing.com" },
];

interface ManifestShape {
  description?: unknown;
  host_permissions?: unknown;
}

export const descriptionPermissionMismatch: Rule = {
  id: RULE_ID,
  description:
    "A known host/product name in manifest.description (ChatGPT, Claude, Grok, Cursor, Gemini, Copilot, Perplexity, Bing) has no matching host_permissions entry.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST_REL);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json not found at extension root (expected ${MANIFEST_REL}) — cannot compare description and host_permissions`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestShape;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestShape;
    } catch (err) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json could not be parsed as JSON (${(err as Error).message})`,
        file: MANIFEST_REL,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (typeof manifest.description !== "string") {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json has no string \"description\" field — cannot check for host name mentions",
        file: MANIFEST_REL,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const description = manifest.description;
    const hostPermissions = (
      Array.isArray(manifest.host_permissions) ? manifest.host_permissions : []
    ).filter((h): h is string => typeof h === "string");

    const findings: Finding[] = [];
    for (const { name, hostSubstring } of KNOWN_HOSTS) {
      const nameRe = new RegExp(`\\b${name}\\b`, "i");
      if (!nameRe.test(description)) continue;
      const hasPermission = hostPermissions.some((h) => h.includes(hostSubstring));
      if (hasPermission) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "error",
        message: `manifest.description names "${name}" but host_permissions has no entry matching "${hostSubstring}" — the extension advertises a host it cannot actually reach.`,
        file: MANIFEST_REL,
        snippet: description,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

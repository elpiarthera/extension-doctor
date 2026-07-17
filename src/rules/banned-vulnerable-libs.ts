/**
 * Rule: banned-vulnerable-libs
 *
 * Flags a dependency declared in package.json whose name+version matches a
 * small, shipped blocklist of known-bad releases. This is NOT a CVE
 * database and does not attempt to be one — see the honest-scope note
 * below. It only catches the handful of entries in BLOCKLIST.
 *
 * Spec ref: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   §1.1 + §2 rule 18 (banned/vulnerable dependency versions).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "banned-vulnerable-libs";
const MANIFEST = "package.json";

/**
 * Honest-scope note: this table is a TINY, manually-sourced blocklist of
 * historically well-known malicious/vulnerable releases. It is not a
 * substitute for `npm audit` / a real CVE feed — extension-doctor does not
 * claim full vulnerability coverage. Sources:
 *   - event-stream@3.3.6: npm advisory GHSA-r6vp-fgpj-hyy8 (2018 supply
 *     chain compromise, flatmap-stream backdoor).
 *   - lodash<4.17.21: GHSA-35jh-r3h4-6jhm (prototype pollution).
 *   - jquery<3.5.0: GHSA-gxr4-xjj5-5px2 (XSS via htmlPrefilter).
 */
const BLOCKLIST: Array<{ name: string; versions: string[]; reason: string }> = [
  { name: "event-stream", versions: ["3.3.6"], reason: "known supply-chain backdoor (flatmap-stream), GHSA-r6vp-fgpj-hyy8" },
  { name: "lodash", versions: ["4.17.20", "4.17.19", "4.17.18", "4.17.17"], reason: "prototype pollution, GHSA-35jh-r3h4-6jhm — upgrade to >=4.17.21" },
  { name: "jquery", versions: ["3.4.1", "3.4.0", "3.3.1", "3.3.0"], reason: "XSS via htmlPrefilter, GHSA-gxr4-xjj5-5px2 — upgrade to >=3.5.0" },
];

function normalizeVersion(raw: string): string {
  return raw.replace(/^[\^~>=<]+/, "").trim();
}

export const bannedVulnerableLibs: Rule = {
  id: RULE_ID,
  description:
    "A dependency in package.json matches a small shipped blocklist of known-bad name+version pairs (e.g. event-stream@3.3.6, old lodash/jquery). Not a full CVE scanner — see in-file honest-scope note.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${MANIFEST} not found at extension root — cannot resolve declared dependency versions`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${MANIFEST} could not be parsed as JSON — cannot resolve declared dependency versions`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const depFields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
    const findings: Finding[] = [];

    for (const field of depFields) {
      const deps = pkg[field];
      if (!deps || typeof deps !== "object") continue;
      for (const [name, versionRaw] of Object.entries(deps as Record<string, string>)) {
        const entry = BLOCKLIST.find((b) => b.name === name);
        if (!entry) continue;
        const version = normalizeVersion(String(versionRaw));
        if (!entry.versions.includes(version)) continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${field}["${name}"] = "${versionRaw}" is a known-bad release: ${entry.reason}`,
          file: MANIFEST,
          snippet: `"${name}": "${versionRaw}"`,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

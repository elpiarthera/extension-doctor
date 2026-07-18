/**
 * Rule: deprecated-removed-api
 *
 * Detects usage of MV2-era / removed WebExtension APIs that have a documented
 * MV3 replacement. The lookup table below is INTENTIONALLY PARTIAL — see the
 * matrix false-positive note below. Unknown/uncatalogued APIs are never
 * flagged; this rule only fires on the exact entries it knows about.
 *
 * Spec ref: internal rule matrix (not shipped with this package)
 *   §1.1 + §2 rule 17 (deprecated/removed API usage).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, stripComments } from "../core/text.js";

const RULE_ID = "deprecated-removed-api";
const SCAN_DIR = "src";

/**
 * Matrix false-positive note (cross-browser table incompleteness): this
 * table is a small, deliberately-scoped set of MV2/removed API surfaces.
 * It does NOT attempt to be an exhaustive MDN/Chrome changelog scan. Any
 * API not listed here is silently ignored by design — extending the table
 * is a documented follow-up, not a silent gap.
 */
const DEPRECATED_APIS: Array<{ pattern: RegExp; api: string; replacement: string }> = [
  { pattern: /\bchrome\.browserAction\b/g, api: "chrome.browserAction", replacement: "chrome.action" },
  { pattern: /\bchrome\.pageAction\b/g, api: "chrome.pageAction", replacement: "chrome.action" },
  {
    pattern: /\bchrome\.extension\.sendRequest\b/g,
    api: "chrome.extension.sendRequest",
    replacement: "chrome.runtime.sendMessage",
  },
  {
    pattern: /\bchrome\.extension\.onRequest\b/g,
    api: "chrome.extension.onRequest",
    replacement: "chrome.runtime.onMessage",
  },
  { pattern: /\bchrome\.tabs\.getSelected\b/g, api: "chrome.tabs.getSelected", replacement: "chrome.tabs.query({active: true, currentWindow: true})" },
  {
    pattern: /webRequest\s*\.\s*onBeforeRequest[\s\S]{0,200}?\bblocking\b/g,
    api: "webRequest onBeforeRequest with 'blocking'",
    replacement: "declarativeNetRequest",
  },
];

export const deprecatedRemovedApi: Rule = {
  id: RULE_ID,
  description:
    "Usage of an MV2/removed WebExtension API (chrome.browserAction, chrome.pageAction, chrome.extension.sendRequest, tabs.getSelected, blocking webRequest) with a known MV3 replacement. The lookup table is intentionally partial — unknown APIs are never flagged.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);

    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `source directory not found, cannot scan for deprecated API usage (expected ${SCAN_DIR})`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const files = walk(scanRoot, { extensions: [".ts", ".tsx"] });
    const findings: Finding[] = [];

    for (const rel of files) {
      const abs = join(scanRoot, rel);
      const relForReport = join(SCAN_DIR, rel);
      let content: string;
      try {
        content = stripComments(readFileSync(abs, "utf8"));
      } catch {
        continue;
      }

      for (const entry of DEPRECATED_APIS) {
        const re = new RegExp(entry.pattern.source, entry.pattern.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${entry.api} is a removed/deprecated WebExtension API — use ${entry.replacement} instead.`,
            file: relForReport,
            line: lineAt(content, m.index),
            snippet: content.slice(m.index, Math.min(content.length, m.index + entry.api.length + 20)),
          });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

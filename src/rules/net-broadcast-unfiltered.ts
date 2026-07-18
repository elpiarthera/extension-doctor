/**
 * Rule: net-broadcast-unfiltered
 *
 * Detects `chrome.tabs.query(...)` calls whose argument has NO `url:` key
 * (i.e. matches every open tab in the browser), when the same enclosing
 * function later loops the result into `chrome.tabs.sendMessage(...)`.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §net-broadcast-unfiltered
 *
 * Source d'inspiration (idea only, zero line copied):
 *   - dot-skills (MIT) msg-avoid-broadcast-to-all-tabs.md
 *   - dot-skills (MIT) api-query-tabs-efficiently.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { matchBracket, lineAt, enclosingBlock, stripComments } from "../core/text.js";

const RULE_ID = "net-broadcast-unfiltered";
const SCAN_DIR = "src/background";

export const netBroadcastUnfiltered: Rule = {
  id: RULE_ID,
  description:
    "chrome.tabs.query({}) (no url filter) feeding chrome.tabs.sendMessage broadcasts to every open tab, not just supported hosts.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);

    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `background source directory not found, cannot scan for chrome.tabs.query patterns (expected ${SCAN_DIR})`,
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
        // Comments stripped so a fix-commit's own doc comment quoting the
        // buggy pattern it replaced never counts as a live call site.
        // Line numbers stay accurate (comment bodies blanked, not removed).
        content = stripComments(readFileSync(abs, "utf8"));
      } catch {
        continue;
      }

      const queryRe = /chrome\.tabs\.query\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = queryRe.exec(content)) !== null) {
        const parenOpen = content.indexOf("(", m.index);
        const parenClose = matchBracket(content, parenOpen);
        if (parenClose === -1) continue;
        const argText = content.slice(parenOpen + 1, parenClose);

        const hasUrlKey = /\burl\s*:/.test(argText);
        if (hasUrlKey) continue; // filtered — not this rule's concern

        const block = enclosingBlock(content, m.index);
        // Search window: enclosing function block if resolvable, else the
        // remainder of the file from the query call forward (best-effort).
        const windowText = block ? content.slice(block.start, block.end + 1) : content.slice(m.index);

        if (!/chrome\.tabs\.sendMessage\s*\(/.test(windowText)) {
          // query({}) with no url filter but no sendMessage in scope —
          // not this rule (e.g. counting tabs). Explicitly not a defect here.
          continue;
        }

        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message:
            "chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.",
          file: relForReport,
          line: lineAt(content, m.index),
          snippet: content.slice(m.index, Math.min(content.length, parenClose + 1)),
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

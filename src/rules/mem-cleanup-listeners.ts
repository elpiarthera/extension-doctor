/**
 * Rule: mem-cleanup-listeners
 *
 * Detects `addEventListener` on a host DOM element (document, window, or a
 * queried/created element) inside a content script, with no traceable
 * `removeEventListener` for the same (target, event, handler-name) tuple in
 * the enclosing function scope, and no declared permanent-listener
 * exception comment.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.2 rule 13 "mem-cleanup-listeners"
 *
 * Source d'inspiration (idea only, zero line copied):
 *   - dot-skills (MIT) mem-cleanup-event-listeners.md
 *   - dot-skills (MIT) comp-content-script-structure.md
 *
 * Declared-permanent exception: a comment `// ed-permanent-listener:
 * <reason>` on the same line as, or the line immediately above, the
 * addEventListener call marks it as intentionally never removed (e.g. a
 * document-level SPA navigation observer that must live for the page's
 * whole lifetime). This is the ONLY accepted opt-out — never a silent skip.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, enclosingBlock, stripComments } from "../core/text.js";

const RULE_ID = "mem-cleanup-listeners";
const SCAN_DIRS = ["src/content", "src/ui", "ui"];

const ADD_RE = /([a-zA-Z0-9_.]+)\.addEventListener\s*\(\s*["'`]([a-zA-Z]+)["'`]\s*,\s*([a-zA-Z0-9_.]+)/g;
const PERMANENT_MARK_RE = /\/\/\s*ed-permanent-listener:\s*\S+/;

export const memCleanupListeners: Rule = {
  id: RULE_ID,
  description:
    "addEventListener on a host DOM element inside a content script with no traceable removeEventListener and no declared // ed-permanent-listener: exception.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const roots = SCAN_DIRS.filter((d) => dirExists(join(extensionRoot, d)));
    if (roots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no content-script source directory found (checked ${SCAN_DIRS.join(", ")})`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    let anyFile = false;

    for (const root of roots) {
      const abs = join(extensionRoot, root);
      const files = walk(abs, { extensions: [".ts", ".tsx"] });
      for (const rel of files) {
        anyFile = true;
        const fileAbs = join(abs, rel);
        const relForReport = join(root, rel);
        let raw: string;
        try {
          raw = readFileSync(fileAbs, "utf8");
        } catch {
          continue;
        }
        // Comments are needed to detect the ed-permanent-listener exception
        // marker, so we scan raw text for the marker but use stripped text
        // for the structural add/remove matching to avoid false positives
        // from a doc comment quoting a call pattern.
        const content = stripComments(raw);
        const rawLines = raw.split("\n");

        ADD_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = ADD_RE.exec(content)) !== null) {
          const target = m[1]!;
          const event = m[2]!;
          const handler = m[3]!;
          const callIndex = m.index;
          const line = lineAt(content, callIndex);

          // Check declared-permanent exception on this line or the line above (raw text).
          const thisLine = rawLines[line - 1] ?? "";
          const prevLine = rawLines[line - 2] ?? "";
          if (PERMANENT_MARK_RE.test(thisLine) || PERMANENT_MARK_RE.test(prevLine)) {
            continue;
          }

          const block = enclosingBlock(content, callIndex);
          const scopeText = block ? content.slice(block.start, block.end + 1) : content;

          const removeRe = new RegExp(
            `${escapeRe(target)}\\.removeEventListener\\s*\\(\\s*["'\`]${escapeRe(event)}["'\`]\\s*,\\s*${escapeRe(handler)}\\b`
          );

          if (removeRe.test(scopeText)) continue;

          findings.push({
            ruleId: RULE_ID,
            severity: "warning",
            message: `${target}.addEventListener("${event}", ${handler}) has no traceable ${target}.removeEventListener("${event}", ${handler}) in the enclosing scope, and no // ed-permanent-listener: exception comment.`,
            file: relForReport,
            line,
            snippet: content.slice(callIndex, Math.min(content.length, callIndex + 60)),
          });
        }
      }
    }

    if (!anyFile) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `content-script directories found (${roots.join(", ")}) but contained no .ts/.tsx files`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

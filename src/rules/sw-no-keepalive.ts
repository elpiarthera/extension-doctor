/**
 * Rule: sw-no-keepalive
 *
 * Detects setInterval/setTimeout with a delay literal < 30000ms used inside
 * background/* to keep an MV3 service worker alive, instead of
 * chrome.alarms (the only reliable keepalive mechanism — MV3 service
 * workers are killed by the browser after ~30s of inactivity regardless of
 * a pending setInterval/setTimeout).
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.2 rule 30 "sw-no-keepalive" / "sw-listeners-toplevel" (fusion,
 *   basse priorité, dot-skills DÉJÀ-COUVERT).
 *
 * Source d'inspiration (idea only, zero line copied):
 *   - dot-skills (MIT) sw-avoid-keepalive.md
 *   - dot-skills (MIT) sw-use-alarms-api.md
 *
 * False-positive guard: only flags inside background/* context — a <30s
 * debounce/throttle in UI code (ui/, src/content) is legitimate and out of
 * scope for this rule.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, matchBracket, stripComments } from "../core/text.js";

const RULE_ID = "sw-no-keepalive";
const SCAN_DIR = "src/background";
const THRESHOLD_MS = 30000;

const TIMER_RE = /\b(setInterval|setTimeout)\s*\(/g;

export const swNoKeepalive: Rule = {
  id: RULE_ID,
  description:
    "setInterval/setTimeout with delay < 30s inside background/* used to keep the MV3 service worker alive — use chrome.alarms instead, since the browser kills the SW regardless of pending timers.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);
    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `background source directory not found, cannot scan for setInterval/setTimeout keepalive patterns (expected ${SCAN_DIR})`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const files = walk(scanRoot, { extensions: [".ts", ".tsx"] });
    if (files.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${SCAN_DIR} exists but contains no .ts/.tsx files`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

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

      TIMER_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TIMER_RE.exec(content)) !== null) {
        const fnName = m[1]!;
        const parenOpen = content.indexOf("(", m.index);
        const parenClose = matchBracket(content, parenOpen);
        if (parenClose === -1) continue;
        const argText = content.slice(parenOpen + 1, parenClose);

        // Top-level (depth-0) comma split so a nested callback's own commas
        // (e.g. inside a further function call) never get mistaken for the
        // delay-argument separator.
        const topLevelArgs = splitTopLevelArgs(argText);
        const delayLiteral = topLevelArgs[topLevelArgs.length - 1]?.trim();
        if (!delayLiteral || !/^\d+$/.test(delayLiteral)) continue; // dynamic/non-literal delay — out of scope
        const delayMs = Number(delayLiteral);
        if (delayMs >= THRESHOLD_MS) continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `${fnName}(fn, ${delayMs}) in background/* used as a keepalive mechanism — MV3 kills the service worker after ~30s of inactivity regardless of pending timers; use chrome.alarms.create(...) + chrome.alarms.onAlarm instead.`,
          file: relForReport,
          line: lineAt(content, m.index),
          snippet: content.slice(m.index, Math.min(content.length, m.index + 50)),
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

/** Split a call's argument-list text on top-level (depth-0) commas only. */
function splitTopLevelArgs(argText: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argText.length; i++) {
    const ch = argText[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      args.push(argText.slice(start, i));
      start = i + 1;
    }
  }
  args.push(argText.slice(start));
  return args;
}

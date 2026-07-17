/**
 * Rule: runtime-external-messaging-exposure
 *
 * Detects a `chrome.runtime.onMessageExternal.addListener(...)` or
 * `chrome.runtime.onConnectExternal.addListener(...)` handler whose body
 * contains no `sender.id` / `sender.origin` guard. Without validating the
 * caller, ANY other installed extension (or, for onConnectExternal, any web
 * page listed in externally_connectable) can invoke the handler.
 *
 * Detection walks the enclosing listener-callback block (matched via
 * matchBracket from the callback's opening "{") and looks for a reference to
 * `sender.id` or `sender.origin` anywhere inside it.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   item 25 "runtime-external-messaging-exposure"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { matchBracket, lineAt, stripComments } from "../core/text.js";

const RULE_ID = "runtime-external-messaging-exposure";
const SCAN_DIR = "src/background";

const LISTENER_RE = /chrome\.runtime\.(onMessageExternal|onConnectExternal)\.addListener\s*\(/g;
const GUARD_RE = /\bsender\s*(\.\s*(id|origin)|\[\s*["'](id|origin)["']\s*\])/;

export const runtimeExternalMessagingExposure: Rule = {
  id: RULE_ID,
  description:
    "chrome.runtime.onMessageExternal / onConnectExternal handler has no sender.id / sender.origin validation, exposing it to any external caller.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);

    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `background source directory not found, cannot scan for onMessageExternal/onConnectExternal handlers (expected ${SCAN_DIR})`,
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

      let m: RegExpExecArray | null;
      LISTENER_RE.lastIndex = 0;
      while ((m = LISTENER_RE.exec(content)) !== null) {
        const parenOpen = content.indexOf("(", m.index);
        const parenClose = matchBracket(content, parenOpen);
        if (parenClose === -1) continue;

        // Find the callback body: first "{" after parenOpen, within the arg list.
        const bodyOpen = content.indexOf("{", parenOpen);
        if (bodyOpen === -1 || bodyOpen > parenClose) {
          // Arrow function with no braces (implicit return) — no block to
          // hold a guard, and no sendResponse/side-effect body either.
          // Treat as guarded-by-construction (nothing to validate against).
          continue;
        }
        const bodyClose = matchBracket(content, bodyOpen);
        if (bodyClose === -1) continue;
        const bodyText = content.slice(bodyOpen, bodyClose + 1);

        if (GUARD_RE.test(bodyText)) continue;

        const apiName = m[1];
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `chrome.runtime.${apiName}.addListener handler has no sender.id / sender.origin check — any external caller can invoke it.`,
          file: relForReport,
          line: lineAt(content, m.index),
          snippet: content.slice(m.index, Math.min(content.length, bodyOpen + 1)),
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

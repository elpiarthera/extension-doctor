/**
 * Rule: sw-listeners-toplevel
 *
 * Detects `chrome.<namespace>.addListener(...)` registered inside a nested
 * function body (including an async callback) rather than at module
 * top-level. MV3 requires event listeners to be registered synchronously
 * during the service worker's initial evaluation — registering them inside
 * an async callback (e.g. after an `await` in an IIFE, or inside a
 * `.then()`) means the listener may not be attached by the time the event
 * fires after a service worker wake-up, silently dropping the event.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   §1.2 rule 30 "sw-no-keepalive" / "sw-listeners-toplevel" (fusion,
 *   basse priorité, dot-skills DÉJÀ-COUVERT).
 *
 * Source d'inspiration (idea only, zero line copied):
 *   - dot-skills (MIT) sw-register-listeners-toplevel.md
 *
 * False-positive guard: a conditional top-level registration
 * (`if (cond) chrome.x.addListener(...)`) is NOT nested inside a function
 * body — only `if`/`for`/`while`/`switch`/`catch`/`else` control blocks are
 * walked through and do not count as nesting for this rule.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, matchBracket, stripComments } from "../core/text.js";

const RULE_ID = "sw-listeners-toplevel";
const SCAN_DIR = "src/background";

const LISTENER_RE = /chrome\.[a-zA-Z0-9_.]+\.addListener\s*\(/g;
const CONTROL_KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "else"]);

export const swListenersToplevel: Rule = {
  id: RULE_ID,
  description:
    "chrome.*.addListener(...) registered inside a nested function body (incl. an async callback) instead of at module top-level — the listener may not be attached synchronously on service worker wake-up.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);
    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `background source directory not found, cannot scan for chrome.*.addListener patterns (expected ${SCAN_DIR})`,
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

      LISTENER_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LISTENER_RE.exec(content)) !== null) {
        const callIndex = m.index;
        const nestedIn = findNestingFunctionBlock(content, callIndex);

        if (nestedIn) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message:
              "chrome.*.addListener(...) is registered inside a nested function body rather than at module top-level — on service worker wake-up the listener may not be re-attached synchronously, silently dropping the triggering event.",
            file: relForReport,
            line: lineAt(content, callIndex),
            snippet: content.slice(callIndex, Math.min(content.length, callIndex + 50)),
          });
        }
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

/**
 * Walk outward from `index`, finding each enclosing "{...}" block. For each
 * one, determine whether it is a FUNCTION body (nesting that matters for
 * this rule) or a control-flow block (if/for/while/switch/catch/else — does
 * NOT count as nesting; the call stays effectively top-level). Returns true
 * (well, a truthy marker) as soon as a function-body ancestor is found;
 * returns null if we reach module scope (no enclosing block at all) without
 * crossing a function boundary.
 */
function findNestingFunctionBlock(content: string, index: number): boolean {
  let cursor = index;
  while (true) {
    const block = enclosingBlockFrom(content, cursor);
    if (!block) return false; // reached module top-level, no function crossed
    if (isFunctionBodyBrace(content, block.start)) return true;
    // Control-flow block (or unrecognized) — keep walking outward from just
    // before this block's opening brace.
    cursor = block.start - 1;
    if (cursor < 0) return false;
  }
}

/** Same walk-outward-then-match logic as core/text.ts enclosingBlock, duplicated
 * locally so we can restart the search from an arbitrary cursor without
 * re-deriving from the original call index each time. */
function enclosingBlockFrom(text: string, index: number): { start: number; end: number } | null {
  let depth = 0;
  for (let i = index; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      if (depth === 0) {
        const end = matchBracket(text, i);
        if (end === -1) return null;
        return { start: i, end };
      }
      depth--;
    }
  }
  return null;
}

/**
 * Given the index of an opening "{", determine whether it opens a FUNCTION
 * body. Grabs the "header" text between the nearest preceding statement
 * boundary (";", "{", "}", or start of file) and the brace, so a TypeScript
 * return-type annotation between the parameter list ")" and the brace
 * (e.g. "async function init(): Promise<void> {") does not defeat the
 * ")"-adjacency check.
 */
function isFunctionBodyBrace(content: string, braceIndex: number): boolean {
  let boundary = braceIndex - 1;
  while (boundary >= 0 && content[boundary] !== ";" && content[boundary] !== "{" && content[boundary] !== "}") {
    boundary--;
  }
  const header = content.slice(boundary + 1, braceIndex).trim();
  if (header.length === 0) return false;

  if (header.endsWith("=>")) return true; // arrow function body

  if (/^(export\s+)?(default\s+)?(async\s+)?function\b/.test(header)) return true; // function declaration/expression

  // Header shaped like "<ident>(<params>)" or "<ident>(<params>): <ReturnType>"
  // (covers class/object methods, and "async function name(...): T" whose
  // ")" is followed by a return-type annotation instead of directly by "{").
  const parenIdx = header.indexOf("(");
  if (parenIdx > 0) {
    const word = header.slice(0, parenIdx).replace(/^async\s+/, "").trim();
    const identOnly = /^[a-zA-Z_$][\w$]*$/;
    if (identOnly.test(word) && !CONTROL_KEYWORDS.has(word)) return true;
    if (CONTROL_KEYWORDS.has(word)) return false;
  }

  return false;
}

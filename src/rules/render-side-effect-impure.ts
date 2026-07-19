/**
 * Rule: render-side-effect-impure
 *
 * Detects a side-effecting call (localStorage/sessionStorage writes,
 * `document.title = ...`, `fetch(...)`, `window.location = ...`) performed
 * directly in a component function's top-level body — i.e. during render —
 * rather than inside a `useEffect`/`useCallback`/`useMemo` callback or an
 * event-handler function (`handleX` / `onX`). A side effect at render time
 * re-runs on every render pass (including renders discarded by
 * concurrent-mode-style scheduling), not on mount/update as intended.
 *
 * Declared exception: a comment `// ed-render-effect-intentional: <reason>`
 * on the line immediately preceding the call marks it as a deliberate,
 * reviewed exception. This is the ONLY accepted opt-out — never a silent
 * skip.
 *
 * The hard part named rather than papered over: distinguishing "inside a
 * hook callback" from "directly in render" requires scope resolution, not
 * a single-line pattern. This rule resolves it by first BLANKING every
 * nested `useEffect`/`useCallback`/`useMemo` callback body and every
 * `handleX`/`onX`-named function body found inside the component, then
 * scanning only what remains. A false negative this accepts: a side effect
 * nested inside a plain (non-hook, non-handler-named) inline function
 * expression invoked immediately at render time is NOT specifically
 * unwrapped — it is treated the same as any other nested scope only if it
 * happens to match the hook/handler-name patterns; an anonymously-named
 * IIFE side effect at top level, while rare, is a documented gap rather
 * than a guess.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, matchBracket, stripComments } from "../core/text.js";

const RULE_ID = "render-side-effect-impure";
const SCAN_DIRS = ["src/ui", "ui", "src/content"];

const COMPONENT_FUNC_RE =
  /\bexport\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*[a-zA-Z0-9_<>[\].| ]+)?\s*\{/g;
const COMPONENT_ARROW_RE =
  /\bexport\s+const\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*(?::\s*[a-zA-Z0-9_<>[\].| ]+)?\s*=>\s*\{/g;

const HOOK_CALL_RE = /\b(?:useEffect|useCallback|useMemo)\s*\(/g;
const HANDLER_FUNC_RE =
  /\bfunction\s+(?:handle|on)[A-Za-z0-9_]*\s*\([^)]*\)\s*(?::\s*[a-zA-Z0-9_<>[\].| ]+)?\s*\{/g;
const HANDLER_ARROW_RE =
  /\b(?:const|let)\s+(?:handle|on)[A-Za-z0-9_]*\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[a-zA-Z0-9_<>[\].| ]+)?\s*=>\s*\{/g;

const SIDE_EFFECT_RE =
  /\blocalStorage\.setItem\s*\(|\bsessionStorage\.setItem\s*\(|\bdocument\.title\s*=|\bfetch\s*\(|\bwindow\.location\s*=/g;

const EXCEPTION_MARK_RE = /\/\/\s*ed-render-effect-intentional:\s*\S+/;

/** Blank (replace with spaces, preserving newlines) every nested hook/handler scope inside `body`. */
function blankNestedSafeScopes(body: string): string {
  let out = body;

  for (const re of [HOOK_CALL_RE, HANDLER_FUNC_RE, HANDLER_ARROW_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const matchEnd = m.index + m[0]!.length;
      // For HOOK_CALL_RE the match ends right after "(" — find the arrow
      // function body's opening brace after it. For the other two the
      // match already ends on "{".
      const braceIndex = m[0]!.endsWith("{") ? matchEnd - 1 : body.indexOf("{", matchEnd);
      if (braceIndex === -1) continue;
      const bodyEnd = matchBracket(body, braceIndex);
      if (bodyEnd === -1) continue;
      const span = out.slice(braceIndex, bodyEnd + 1).replace(/[^\n]/g, " ");
      out = out.slice(0, braceIndex) + span + out.slice(bodyEnd + 1);
    }
  }

  return out;
}

export const renderSideEffectImpure: Rule = {
  id: RULE_ID,
  description:
    "A side-effecting call (storage write, document.title, fetch, window.location) is performed directly in a component's render body instead of inside useEffect/useCallback/useMemo or an event handler.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const roots = SCAN_DIRS.filter((d) => dirExists(join(extensionRoot, d)));
    if (roots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no UI component source directory found (checked ${SCAN_DIRS.join(", ")})`,
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
        const content = stripComments(raw);
        const rawLines = raw.split("\n");

        for (const re of [COMPONENT_FUNC_RE, COMPONENT_ARROW_RE]) {
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            const braceIndex = m.index + m[0]!.length - 1;
            const bodyEnd = matchBracket(content, braceIndex);
            if (bodyEnd === -1) continue;
            const body = content.slice(braceIndex + 1, bodyEnd);
            const scrubbed = blankNestedSafeScopes(body);

            SIDE_EFFECT_RE.lastIndex = 0;
            let sm: RegExpExecArray | null;
            while ((sm = SIDE_EFFECT_RE.exec(scrubbed)) !== null) {
              const callIndexInContent = braceIndex + 1 + sm.index;
              const line = lineAt(content, callIndexInContent);
              const thisLine = rawLines[line - 1] ?? "";
              const prevLine = rawLines[line - 2] ?? "";
              if (EXCEPTION_MARK_RE.test(thisLine) || EXCEPTION_MARK_RE.test(prevLine)) continue;

              const snippet = content
                .slice(callIndexInContent, Math.min(content.length, callIndexInContent + 50))
                .trim();
              findings.push({
                ruleId: RULE_ID,
                severity: "warning",
                message: `component "${m[1]}" performs a side effect (${snippet.split("(")[0]}...) directly in its render body — move it into useEffect (mount/update) or an event handler (user interaction), not the top-level render.`,
                file: relForReport,
                line,
                snippet,
              });
            }
          }
        }
      }
    }

    if (!anyFile) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `UI component directories found (${roots.join(", ")}) but contained no .ts/.tsx files`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

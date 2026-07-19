/**
 * Rule: hook-effect-cleanup-missing
 *
 * Detects a `useEffect(() => { ... }, deps)` callback that acquires a
 * resource requiring teardown (addEventListener, setInterval, setTimeout,
 * .subscribe(, .on() browser extension messaging listeners) but whose
 * callback body never `return`s a cleanup function.
 *
 * Declared exception: a comment `// ed-effect-no-cleanup: <reason>` on the
 * line immediately preceding the resource-acquiring call marks it as
 * intentionally uncleaned (e.g. a listener the host page tears down
 * itself). This is the ONLY accepted opt-out — never a silent skip.
 *
 * The hard part named rather than papered over: a `useEffect` callback with
 * NO resource-acquiring call at all (e.g. `useEffect(() => console.log("mounted"), [])`)
 * genuinely needs no cleanup — flagging every effect without a `return`
 * would be a false positive on the common, correct case and would train
 * users to ignore the tool. This rule only fires when a resource
 * acquisition is present AND unmatched by any `return` in the callback
 * body — a false negative (a subtler leak this regex-based scan misses) is
 * accepted in trade for never crying wolf on pure effects.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, matchBracket, stripComments, stripStrings } from "../core/text.js";

const RULE_ID = "hook-effect-cleanup-missing";
const SCAN_DIRS = ["src/ui", "ui", "src/content"];

const USE_EFFECT_RE = /\buseEffect\s*\(\s*(?:\(\s*\)|async\s*\(\s*\))?\s*=>\s*\{/g;
const RESOURCE_ACQUIRE_RE =
  /\.addEventListener\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(|\.subscribe\s*\(|\.addListener\s*\(/;
const RETURN_CLEANUP_RE = /\breturn\s*(?:\(\s*\)\s*=>|function\b|async\s*\(\s*\)\s*=>)/;
const EXCEPTION_MARK_RE = /\/\/\s*ed-effect-no-cleanup:\s*\S+/;

export const hookEffectCleanupMissing: Rule = {
  id: RULE_ID,
  description:
    "A useEffect callback acquires a resource (listener/interval/timeout/subscription) but never returns a cleanup function, with no declared // ed-effect-no-cleanup: exception.",
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
        // Executable-position view: string/template literal bodies are
        // blanked so a trigger shape (e.g. a full useEffect(...) snippet
        // quoted as documentation/help copy) is never mistaken for code
        // that actually runs. Same technique already proven in
        // hook-deps-incomplete — reused via stripStrings(), not
        // reimplemented. stripStrings() preserves length/newlines, so
        // offsets found in codeOnly map 1:1 onto `content` for lineAt()
        // and snippet extraction.
        const codeOnly = stripStrings(content);
        const rawLines = raw.split("\n");

        USE_EFFECT_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = USE_EFFECT_RE.exec(codeOnly)) !== null) {
          const braceIndex = codeOnly.indexOf("{", m.index);
          if (braceIndex === -1) continue;
          const bodyEnd = matchBracket(codeOnly, braceIndex);
          if (bodyEnd === -1) continue;
          const body = codeOnly.slice(braceIndex + 1, bodyEnd);

          if (!RESOURCE_ACQUIRE_RE.test(body)) continue;
          if (RETURN_CLEANUP_RE.test(body)) continue;

          const acquireMatch = RESOURCE_ACQUIRE_RE.exec(body);
          const acquireOffset = acquireMatch ? acquireMatch.index : 0;
          const acquireIndex = braceIndex + 1 + acquireOffset;
          const line = lineAt(content, acquireIndex);

          const thisLine = rawLines[line - 1] ?? "";
          const prevLine = rawLines[line - 2] ?? "";
          if (EXCEPTION_MARK_RE.test(thisLine) || EXCEPTION_MARK_RE.test(prevLine)) continue;

          const snippet = content.slice(acquireIndex, Math.min(content.length, acquireIndex + 60)).trim();
          findings.push({
            ruleId: RULE_ID,
            severity: "warning",
            message: `useEffect callback calls ${snippet.split("(")[0]}(...) but never returns a cleanup function, and has no // ed-effect-no-cleanup: exception comment.`,
            file: relForReport,
            line,
            snippet,
          });
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

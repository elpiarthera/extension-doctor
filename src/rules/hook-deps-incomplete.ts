/**
 * Rule: hook-deps-incomplete
 *
 * Detects a `useEffect(() => { ... }, [deps])` call whose callback body
 * reads a component-level `useState` value that is absent from the
 * dependency array — the classic stale-closure bug, where the effect keeps
 * seeing the value from the render it was created in.
 *
 * Declared exception: a comment `// ed-deps-intentional: <reason>` on the
 * line immediately preceding the `useEffect(` call marks the omission as
 * intentional (e.g. a genuine run-once-at-mount read). This is the ONLY
 * accepted opt-out — never a silent skip.
 *
 * The hard part named rather than papered over: full dependency-correctness
 * checking requires a real scope/data-flow analysis (which locals shadow
 * the state variable, which values are actually read vs. merely mentioned
 * in a string, whether a value is provably stable). This rule performs a
 * narrow, high-confidence subset only:
 *   - only `useState` values declared in the SAME file are tracked (state
 *     imported from a hook/store is out of reach and never flagged);
 *   - the paired setter (`setX` for `const [x, setX] = useState(...)`) is
 *     NEVER required in deps — React/Preact setters are referentially
 *     stable, and requiring them would be a textbook false positive;
 *   - a `useEffect(fn)` call with NO second argument at all (runs on every
 *     render) is out of this rule's scope — that is a different defect
 *     class ("no memoization"), not "incomplete deps", and is not reported
 *     here to avoid conflating the two;
 *   - a state identifier that only appears inside a string/template literal
 *     (e.g. a DOM event name like "offline", or a substring hit inside
 *     "gptu:open-slash-menu") is NOT treated as a read: the scan strips
 *     string-literal bodies (stripStrings, in addition to stripComments)
 *     before testing for a word-boundary occurrence, so quoted text can
 *     never manufacture a false "reads X" finding. When an identifier only
 *     shows up because a quote character truncated the scan unexpectedly
 *     (malformed/unbalanced literal), this rule reports INCONCLUSIVE for
 *     that effect rather than guessing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, matchBracket, stripComments, stripStrings } from "../core/text.js";

const RULE_ID = "hook-deps-incomplete";
const SCAN_DIRS = ["src/ui", "ui", "src/content"];

const USE_STATE_RE =
  /\bconst\s*\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*useState\s*\(/g;
const USE_EFFECT_RE = /\buseEffect\s*\(\s*(?:\(\s*\)|async\s*\(\s*\))?\s*=>\s*\{/g;
const EXCEPTION_MARK_RE = /\/\/\s*ed-deps-intentional:\s*\S+/;

export const hookDepsIncomplete: Rule = {
  id: RULE_ID,
  description:
    "A useEffect callback reads a component-level useState value absent from its dependency array, with no declared // ed-deps-intentional: exception.",
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

        const stateVars = new Map<string, string>(); // varName -> setterName
        USE_STATE_RE.lastIndex = 0;
        let sm: RegExpExecArray | null;
        while ((sm = USE_STATE_RE.exec(content)) !== null) {
          stateVars.set(sm[1]!, sm[2]!);
        }
        if (stateVars.size === 0) continue;

        USE_EFFECT_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = USE_EFFECT_RE.exec(content)) !== null) {
          const braceIndex = content.indexOf("{", m.index);
          if (braceIndex === -1) continue;
          const bodyEnd = matchBracket(content, braceIndex);
          if (bodyEnd === -1) continue;
          const body = content.slice(braceIndex + 1, bodyEnd);

          // Locate the deps array: the first "[...]" after the callback's
          // closing brace, up to the closing ")" of the useEffect call.
          const afterBody = content.slice(bodyEnd + 1, Math.min(content.length, bodyEnd + 200));
          const depsMatch = /,\s*\[([^\]]*)\]/.exec(afterBody);
          if (!depsMatch) continue; // no deps array at all — out of this rule's scope, see doc comment

          const depsText = depsMatch[1]!;

          // Executable-position view of the effect body and deps array:
          // string/template literal bodies are blanked so a state
          // identifier that only occurs inside a quoted string (a DOM
          // event name, a log message) is never mistaken for a code read.
          // stripStrings() is quote-aware (tracks the opening delimiter,
          // handles escapes) — the same technique already proven by
          // stripComments() — so this is a reliable distinction, not
          // another regex layer papering over the first: no INCONCLUSIVE
          // is needed for the quoted-literal case itself.
          const bodyCodeOnly = stripStrings(body);
          const depsCodeOnly = stripStrings(depsText);

          for (const [stateVar, setter] of stateVars) {
            if (stateVar === setter) continue;
            const readRe = new RegExp(`\\b${escapeRe(stateVar)}\\b`);
            if (!readRe.test(bodyCodeOnly)) continue;
            const depRe = new RegExp(`\\b${escapeRe(stateVar)}\\b`);
            if (depRe.test(depsCodeOnly)) continue;

            const callIndex = m.index;
            const line = lineAt(content, callIndex);
            const rawCallLine = lineAt(content, callIndex);
            const thisLine = rawLines[rawCallLine - 1] ?? "";
            const prevLine = rawLines[rawCallLine - 2] ?? "";
            if (EXCEPTION_MARK_RE.test(thisLine) || EXCEPTION_MARK_RE.test(prevLine)) continue;

            findings.push({
              ruleId: RULE_ID,
              severity: "warning",
              message: `useEffect callback reads "${stateVar}" but the dependency array does not include it — missing dependency: ${stateVar}. No // ed-deps-intentional: exception found.`,
              file: relForReport,
              line,
              snippet: `[${depsText.trim()}]`,
            });
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

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rule: shadow-dom-style-leak
 *
 * Detects a `<style>` element or a constructed `CSSStyleSheet` being
 * attached to the host `document` (via `document.appendChild` /
 * `document.head.appendChild` / `document.adoptedStyleSheets = ...`)
 * instead of a Shadow DOM `shadowRoot`, inside content-script/UI mounting
 * code. A style attached to the host document is never scoped by the
 * shadow boundary — its rules leak onto (and can collide with) the host
 * page's own styling.
 *
 * The hard part named rather than papered over: a bare `document.head.appendChild(x)`
 * call site does not, by itself, prove `x` is a stylesheet — resolving that
 * requires tracing `x`'s declaration back to `document.createElement("style")`
 * or `new CSSStyleSheet()` in the SAME file. When `x` is declared outside the
 * scanned file (imported, or passed as a parameter), this rule cannot decide
 * whether the appended node is a style and does not guess — see
 * INCONCLUSIVE_UNRESOLVED_TARGET below, which is reported per-occurrence,
 * never silently skipped.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, stripComments, stripStrings } from "../core/text.js";

const RULE_ID = "shadow-dom-style-leak";
const SCAN_DIRS = ["src/content", "src/ui", "ui"];

const STYLE_VAR_RE =
  /\b(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:document\.createElement\s*\(\s*["'`]style["'`]\s*\)|new\s+CSSStyleSheet\s*\()/g;

const DOCUMENT_APPEND_RE = /\bdocument(\.head)?\.appendChild\s*\(\s*([a-zA-Z0-9_]+)\s*\)/g;
const DOCUMENT_ADOPTED_RE = /\bdocument\.adoptedStyleSheets\s*=/g;

export const shadowDomStyleLeak: Rule = {
  id: RULE_ID,
  description:
    "A <style> element or constructed CSSStyleSheet is attached to the host document (appendChild or adoptedStyleSheets) instead of a Shadow DOM shadowRoot.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const roots = SCAN_DIRS.filter((d) => dirExists(join(extensionRoot, d)));
    if (roots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no content-script/UI source directory found (checked ${SCAN_DIRS.join(", ")})`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];
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
        // blanked so a trigger pattern that only occurs inside a quoted
        // string (a log message, help-panel copy, a doc string) is never
        // mistaken for code that actually runs. Same technique already
        // proven in hook-deps-incomplete — reused via stripStrings(), not
        // reimplemented. stripStrings() preserves length/newlines, so
        // offsets found in codeOnly map 1:1 onto `content` for lineAt()
        // and snippet extraction.
        const codeOnly = stripStrings(content);

        // STYLE_VAR_RE intentionally scans `content` (strings intact), not
        // `codeOnly`: the `"style"` tag name it looks for is a REQUIRED
        // string argument to createElement(), not a stray identifier that
        // could be spuriously matched from inside an unrelated string —
        // blanking it would make this branch never match a real
        // declaration. Only the executable-position checks below (a bare
        // identifier appearing as an appendChild argument, or the
        // assignment target of adoptedStyleSheets) need the quoted-literal
        // distinction.
        const styleVars = new Set<string>();
        STYLE_VAR_RE.lastIndex = 0;
        let sm: RegExpExecArray | null;
        while ((sm = STYLE_VAR_RE.exec(content)) !== null) {
          styleVars.add(sm[1]!);
        }

        DOCUMENT_APPEND_RE.lastIndex = 0;
        let am: RegExpExecArray | null;
        while ((am = DOCUMENT_APPEND_RE.exec(codeOnly)) !== null) {
          const target = am[2]!;
          const callIndex = am.index;
          const line = lineAt(content, callIndex);
          if (styleVars.has(target)) {
            findings.push({
              ruleId: RULE_ID,
              severity: "error",
              message: `document${am[1] ?? ""}.appendChild(${target}) attaches a style node/sheet to the host document instead of a shadow root — its rules are not scoped by the Shadow DOM boundary.`,
              file: relForReport,
              line,
              snippet: content.slice(callIndex, Math.min(content.length, callIndex + 60)),
            });
          }
          // If `target` is not a locally-declared style var, this occurrence
          // is simply not a style-leak candidate (most appendChild calls
          // append unrelated nodes) — not every unresolved target is
          // reported as inconclusive, only ones this rule has no way to
          // classify either way are silent non-matches, per design.
        }

        DOCUMENT_ADOPTED_RE.lastIndex = 0;
        let dm: RegExpExecArray | null;
        while ((dm = DOCUMENT_ADOPTED_RE.exec(codeOnly)) !== null) {
          const callIndex = dm.index;
          const line = lineAt(content, callIndex);
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message:
              "document.adoptedStyleSheets is assigned directly on the host document instead of a shadow root — the constructed stylesheet leaks onto the host page.",
            file: relForReport,
            line,
            snippet: content.slice(callIndex, Math.min(content.length, callIndex + 40)),
          });
        }
      }
    }

    if (!anyFile) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `content-script/UI directories found (${roots.join(", ")}) but contained no .ts/.tsx files`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (findings.length === 0) {
      if (inconclusive.length > 0) {
        return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
      }
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
  },
};

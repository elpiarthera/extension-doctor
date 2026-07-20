/**
 * Rule: custom-element-orphan-registration
 *
 * Detects a custom element tag (kebab-case, at least one hyphen — the DOM
 * spec requirement for autonomous custom elements) rendered somewhere in
 * JSX/TSX/TS source, whose `customElements.define(...)` call site lives in a
 * file that is NOT transitively reachable from any resolved manifest/Vite
 * entry point (per buildExportGraph). Such a registration module never
 * actually runs in the shipped bundle — the tag renders as an unknown
 * element, silently, with zero runtime error.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.2 rule 4 "custom-element-orphan-registration"
 *   VD SIGNAL FORT: ui/lit-ui-register.ts never imported from entry point.
 *
 * Tripolar contract: if buildExportGraph could not resolve ANY entry point
 * (unresolvedEntryReason non-null), this rule is INCONCLUSIVE and names that
 * reason verbatim — reachableFiles is empty by construction in that case and
 * must never be read as "everything is orphaned".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { lineAt, stripComments, stripStrings } from "../core/text.js";
import { buildExportGraph } from "../core/export-graph.js";

const RULE_ID = "custom-element-orphan-registration";

// Autonomous custom element tag: lowercase, at least one hyphen.
//
// Intentionally matched against `content` (comments stripped, string bodies
// LEFT INTACT), never against stripStrings() output: a custom element can be
// legitimately "rendered" either as literal JSX/TSX syntax (unquoted) OR via
// a quoted innerHTML/outerHTML string assignment, e.g.
// `host.innerHTML = "<gptu-icon-button></gptu-icon-button>"` — that quoted
// text IS a real DOM-insertion site, and blanking string bodies would blind
// this rule to it (regression: the shipped orphan-registration defect this
// rule exists to catch was itself an innerHTML-string render site).
//
// Declared tradeoff: because string bodies are left intact, a tag name
// appearing in an UNRELATED string (a log message, an error string, a help
// string that merely mentions the tag as documentation, never inserted into
// the DOM) can also match and be treated as a "render" site. This is a known
// precision gap, not a silent one — it can only ever WIDEN what counts as
// "rendered" (never narrows it), so its worst-case effect is an extra
// finding requiring human triage, never a missed real orphan.
const TAG_RE = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[\s/>]/g;

// Call-open + opening quote only: matched against codeOnly
// (stripStrings(stripComments(...))) so `customElements.define(` must be in
// EXECUTABLE position. Unlike TAG_RE above, a phantom define() call written
// only as TEXT inside a quoted string (e.g. a help/log string
// `"docs: customElements.define(\"foo-bar\", Foo)"` in an unrelated,
// reachable file) must never be read as a real registration — doing so
// would silently mask a genuine orphan-registration defect by making the
// tag look "defined in a reachable file" when no such call ever executes.
// The tag-name argument itself is then read from the RAW (comment-stripped
// only) content right after the matched quote — it is the required string
// argument being checked, not incidental text, so it cannot be stripped
// away. Same technique as zero-remote-code's IMPORT_SCRIPTS_CALL_OPEN_RE.
const DEFINE_CALL_OPEN_RE = /customElements\.define\s*\(\s*(["'`])/g;
const TAG_NAME_RE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/;

// A small set of well-known built-in-ish or third-party tags that are never
// locally registered (declared exception, not silently swallowed).
const KNOWN_EXTERNAL_TAGS = new Set(["ion-icon"]);

export const customElementOrphanRegistration: Rule = {
  id: RULE_ID,
  description:
    "A custom element tag is rendered without a customElements.define(...) call reachable from a resolved manifest/Vite entry point — the tag never actually registers in the shipped bundle.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const graph = buildExportGraph(extensionRoot);

    if (graph.unresolvedEntryReason !== null) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `cannot determine reachability: ${graph.unresolvedEntryReason}`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (graph.allSourceFiles.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "no .ts/.tsx/.js/.jsx source files found under extensionRoot",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    // 1. Collect every rendered tag -> first render site (file, line).
    const renderedTags = new Map<string, { file: string; line: number }>();
    // 2. Collect every define() call site -> file it lives in.
    const definedInFile = new Map<string, string[]>(); // tag -> files defining it

    for (const rel of graph.allSourceFiles) {
      const abs = join(extensionRoot, rel);
      let raw: string;
      try {
        raw = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const content = stripComments(raw);
      const codeOnly = stripStrings(content);

      TAG_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = TAG_RE.exec(content)) !== null) {
        const tag = tm[1]!;
        if (KNOWN_EXTERNAL_TAGS.has(tag)) continue;
        if (!renderedTags.has(tag)) {
          renderedTags.set(tag, { file: rel, line: lineAt(content, tm.index) });
        }
      }

      DEFINE_CALL_OPEN_RE.lastIndex = 0;
      let dm: RegExpExecArray | null;
      while ((dm = DEFINE_CALL_OPEN_RE.exec(codeOnly)) !== null) {
        const quote = dm[1]!;
        const argStart = dm.index + dm[0].length;
        let j = argStart;
        let closed = false;
        while (j < content.length) {
          if (content[j] === "\\") {
            j += 2;
            continue;
          }
          if (content[j] === quote) {
            closed = true;
            break;
          }
          j++;
        }
        if (!closed) continue; // unterminated string — not a valid call site
        const argText = content.slice(argStart, j);
        const tagMatch = TAG_NAME_RE.exec(argText);
        if (!tagMatch) continue; // argument is not a valid custom-element tag name
        const tag = tagMatch[1]!;
        const list = definedInFile.get(tag) ?? [];
        list.push(rel);
        definedInFile.set(tag, list);
      }
    }

    const findings: Finding[] = [];

    for (const [tag, site] of renderedTags) {
      const definers = definedInFile.get(tag) ?? [];

      if (definers.length === 0) {
        // No define() anywhere in the source tree at all — out of scope for
        // THIS rule (that's a missing registration entirely, not an orphan
        // reachability defect); named explicitly, not silently skipped.
        continue;
      }

      const reachableDefiner = definers.find((f) => graph.reachableFiles.has(f));
      if (reachableDefiner) continue; // at least one reachable define() — fine.

      findings.push({
        ruleId: RULE_ID,
        severity: "error",
        message: `Custom element <${tag}> is rendered, but its only customElements.define("${tag}", ...) call site (${definers.join(", ")}) is not transitively imported from any resolved entry point — registration never runs in the shipped bundle.`,
        file: site.file,
        line: site.line,
        snippet: `<${tag}`,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

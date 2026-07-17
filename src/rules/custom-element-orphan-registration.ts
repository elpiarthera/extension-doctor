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
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
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
import { lineAt, stripComments } from "../core/text.js";
import { buildExportGraph } from "../core/export-graph.js";

const RULE_ID = "custom-element-orphan-registration";

// Autonomous custom element tag: lowercase, at least one hyphen.
const TAG_RE = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[\s/>]/g;
const DEFINE_RE = /customElements\.define\s*\(\s*["'`]([a-z][a-z0-9]*(?:-[a-z0-9]+)+)["'`]/g;

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

      TAG_RE.lastIndex = 0;
      let tm: RegExpExecArray | null;
      while ((tm = TAG_RE.exec(content)) !== null) {
        const tag = tm[1]!;
        if (KNOWN_EXTERNAL_TAGS.has(tag)) continue;
        if (!renderedTags.has(tag)) {
          renderedTags.set(tag, { file: rel, line: lineAt(content, tm.index) });
        }
      }

      DEFINE_RE.lastIndex = 0;
      let dm: RegExpExecArray | null;
      while ((dm = DEFINE_RE.exec(content)) !== null) {
        const tag = dm[1]!;
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

/**
 * Rule: inline-script-in-html
 *
 * Flags inline <script> blocks (no "src" attribute, non-empty body) inside
 * extension HTML files shipped in the built bundle. Manifest V3's default
 * Content Security Policy forbids inline script execution outright — an
 * inline <script> in a popup/options/new-tab page silently fails to run at
 * install time, and store review rejects it independently.
 *
 * <script> tags carrying a non-executable "type" (application/json,
 * application/ld+json, or an explicit importmap/template convention) are
 * data blocks, not code — the browser never executes them, so they are
 * deliberately NOT flagged.
 */
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";
import { readBundleFile } from "../core/bundle-scan.js";
import { lineAt } from "../core/text.js";

const RULE_ID = "inline-script-in-html";

const NON_EXECUTABLE_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "text/template",
  "text/x-template",
  "importmap",
]);

const SCRIPT_TAG_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const SRC_ATTR_RE = /\bsrc\s*=/i;
const TYPE_ATTR_RE = /\btype\s*=\s*["']?([^"'\s>]+)/i;

export const inlineScriptInHtml: Rule = {
  id: RULE_ID,
  description:
    "An extension HTML file in the built bundle contains an inline <script> block — Manifest V3's default CSP forbids inline script execution.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir, { extensions: [".html", ".htm"] });
    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    for (const relPath of relPaths) {
      let raw: string;
      try {
        raw = readBundleFile({ relPath, absPath: join(build.buildDir, relPath) });
      } catch (err) {
        inconclusive.push({ ruleId: RULE_ID, reason: `could not read bundle file: ${String(err)}`, file: relPath });
        continue;
      }

      SCRIPT_TAG_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SCRIPT_TAG_RE.exec(raw)) !== null) {
        const attrs = m[1] ?? "";
        const body = m[2] ?? "";

        if (SRC_ATTR_RE.test(attrs)) continue; // external script, not inline

        const typeMatch = TYPE_ATTR_RE.exec(attrs);
        const type = typeMatch?.[1]?.toLowerCase();
        if (type !== undefined && NON_EXECUTABLE_TYPES.has(type)) continue; // data block, not code

        if (body.trim().length === 0) continue; // empty tag, nothing to execute

        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${relPath} contains an inline <script> block, forbidden under Manifest V3's default CSP.`,
          file: relPath,
          line: lineAt(raw, m.index),
          snippet: raw.slice(m.index, Math.min(raw.length, m.index + 80)),
        });
      }
    }

    if (inconclusive.length > 0 && findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive, exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
  },
};

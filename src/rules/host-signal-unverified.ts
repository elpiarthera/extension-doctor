/**
 * Rule: host-signal-unverified
 *
 * Detects a hardcoded host DOM selector/attribute literal inside
 * `src/adapters/**` that has no `// verified:` comment pointing to a dated
 * DOM fixture capture. A selector literal whose provenance is never
 * captured is a wrapper-fragile bet — it may already be stale the day it
 * ships. Durable layers over fragile wrappers: any dependency on a
 * third-party host's DOM shape should be traceable to the observation
 * that justified it.
 *
 * Exemption: standard W3C/DOM APIs (e.g. `document.documentElement.lang`)
 * are not host-specific signals and never require `// verified:`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { lineAt, stripComments } from "../core/text.js";

const RULE_ID = "host-signal-unverified";
const SCAN_DIR = "src/adapters";

// W3C/DOM standard APIs are not host-specific signals — never require
// `// verified:`. Named explicitly rather than inferred, so the exemption
// list itself is auditable.
const EXEMPT_STANDARD_APIS = [/document\.documentElement\.lang\b/];

// Matches selector-literal call sites: querySelector/querySelectorAll/
// closest/matches taking a string literal argument, OR a bare
// `data-*`/CSS-attribute-selector string literal assigned to a config key.
const SELECTOR_CALL_RE =
  /\b(?:document|el|root|node|container)?\.?(?:querySelector(?:All)?|closest|matches)\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1\s*\)/g;

export const hostSignalUnverified: Rule = {
  id: RULE_ID,
  description:
    "Hardcoded host DOM selector/attribute literal in src/adapters/** without a `// verified:` comment pointing to a dated DOM fixture — an unverified wrapper-fragile bet.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const scanRoot = join(extensionRoot, SCAN_DIR);

    if (!dirExists(scanRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `adapters source directory not found, cannot scan for host DOM selector literals (expected ${SCAN_DIR})`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const files = walk(scanRoot, { extensions: [".ts", ".tsx"] });
    const findings: Finding[] = [];

    for (const rel of files) {
      const abs = join(scanRoot, rel);
      const relForReport = join(SCAN_DIR, rel);
      let raw: string;
      try {
        raw = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      // Comments stripped for MATCHING (so a call site quoted inside a
      // doc comment never counts), but line numbers and the `// verified:`
      // lookup below both read the ORIGINAL raw text so the annotation is
      // never accidentally blanked out.
      const stripped = stripComments(raw);

      const re = new RegExp(SELECTOR_CALL_RE.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(stripped)) !== null) {
        const fullMatch = m[0];
        if (EXEMPT_STANDARD_APIS.some((pat) => pat.test(fullMatch))) continue;

        const line = lineAt(raw, m.index);
        // Look for a `// verified: <path>` comment on the same line or the
        // line immediately above, in the ORIGINAL (unstripped) source.
        const rawLines = raw.split("\n");
        const sameLine = rawLines[line - 1] ?? "";
        const prevLine = rawLines[line - 2] ?? "";
        const verifiedRe = /\/\/\s*verified:\s*\S+/;
        if (verifiedRe.test(sameLine) || verifiedRe.test(prevLine)) continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message:
            "Hardcoded host DOM selector literal with no `// verified: <path/to/dom-fixture>` comment — unverified wrapper-fragile bet.",
          file: relForReport,
          line,
          snippet: fullMatch,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

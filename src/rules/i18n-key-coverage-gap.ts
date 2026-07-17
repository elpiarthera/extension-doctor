/**
 * Rule: i18n-key-coverage-gap
 *
 * Detects an i18n key consumed via t('x') (or via a `labelKey: 'x'` object
 * property later passed to t(tab.labelKey)) that is absent from at least one
 * of the two bundled locale files (_locales/en/messages.json,
 * _locales/fr/messages.json).
 *
 * Spec: docs/analysis/extension-doctor-rulepack-v0.1-2026-07-17.md
 *   §i18n-key-coverage-gap
 *
 * Source d'inspiration: our own tests/unit/i18n-coverage.test.ts (generalized
 * into a reusable rule, not an external source).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, fileExists } from "../core/walk.js";
import { lineAt, stripComments } from "../core/text.js";

const RULE_ID = "i18n-key-coverage-gap";

const CALL_RE = /\bt\(\s*['"]([a-z][a-z0-9_]*)['"]\s*\)/g;
const LABEL_KEY_RE = /labelKey:\s*["']([a-z][a-z0-9_]*)["']/g;
// Dynamic template-literal call: t(`prefix_${...}`) — cannot be resolved
// statically. Must be surfaced as INCONCLUSIVE, never silently dropped.
const DYNAMIC_CALL_RE = /\bt\(\s*`[^`]*\$\{[^}]*\}[^`]*`\s*\)/g;

// Known regex false-positives that match the key shape but are not i18n
// keys (borrowed convention from tests/unit/i18n-coverage.test.ts).
const FALSE_POSITIVES = new Set(["div", "form", "style", "preact"]);

interface LocaleJson {
  [key: string]: unknown;
}

function loadLocale(path: string): { keys: Set<string> } | { error: string } {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { error: `locale file ${path} missing or invalid JSON — cannot compute coverage, NOT assumed clean` };
  }
  let json: LocaleJson;
  try {
    json = JSON.parse(raw) as LocaleJson;
  } catch {
    return { error: `locale file ${path} missing or invalid JSON — cannot compute coverage, NOT assumed clean` };
  }
  return { keys: new Set(Object.keys(json)) };
}

export const i18nKeyCoverageGap: Rule = {
  id: RULE_ID,
  description:
    "An i18n key consumed via t('x') in code is absent from at least one bundled locale file.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const enPath = join(extensionRoot, "_locales/en/messages.json");
    const frPath = join(extensionRoot, "_locales/fr/messages.json");

    if (!fileExists(enPath) || !fileExists(frPath)) {
      const missing = !fileExists(enPath) ? enPath : frPath;
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `locale file ${missing.replace(extensionRoot + "/", "")} missing or invalid JSON — cannot compute coverage, NOT assumed clean`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const en = loadLocale(enPath);
    const fr = loadLocale(frPath);
    const inconclusive: InconclusiveReason[] = [];

    if ("error" in en) inconclusive.push({ ruleId: RULE_ID, reason: en.error });
    if ("error" in fr) inconclusive.push({ ruleId: RULE_ID, reason: fr.error });
    if (inconclusive.length > 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    // Type narrowing: both loads succeeded past this point.
    const enKeys = (en as { keys: Set<string> }).keys;
    const frKeys = (fr as { keys: Set<string> }).keys;

    const srcRoots = ["src", "ui"].map((d) => join(extensionRoot, d));
    const existingRoots = srcRoots.filter((d) => fileExists(d) || walk(d).length >= 0);
    if (existingRoots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "no src/ or ui/ source root found — cannot scan for t() call sites",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    // key -> first file:line where consumed (for reporting)
    const usedKeys = new Map<string, { file: string; line: number }>();

    for (const root of ["src", "ui"]) {
      const abs = join(extensionRoot, root);
      const files = walk(abs, { extensions: [".ts", ".tsx"] });
      for (const rel of files) {
        const fileAbs = join(abs, rel);
        const relForReport = join(root, rel);
        let content: string;
        try {
          // Comments stripped (strings kept intact — t('key') content must
          // survive) so a t('x') mentioned only in a comment never counts.
          content = stripComments(readFileSync(fileAbs, "utf8"));
        } catch {
          continue;
        }

        for (const re of [CALL_RE, LABEL_KEY_RE]) {
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            const key = m[1];
            if (key === undefined || FALSE_POSITIVES.has(key)) continue;
            if (!usedKeys.has(key)) {
              usedKeys.set(key, { file: relForReport, line: lineAt(content, m.index) });
            }
          }
        }

        // Cas tordu #1 — dynamic template-literal t(`...${...}`) calls: MUST
        // be surfaced as INCONCLUSIVE, never silently dropped and never
        // counted as pass or fail.
        DYNAMIC_CALL_RE.lastIndex = 0;
        let dm: RegExpExecArray | null;
        while ((dm = DYNAMIC_CALL_RE.exec(content)) !== null) {
          inconclusive.push({
            ruleId: RULE_ID,
            reason: "dynamic i18n key (template literal with interpolation) not resolvable statically",
            file: relForReport,
            line: lineAt(content, dm.index),
          });
        }
      }
    }

    const findings: Finding[] = [];
    for (const [key, loc] of usedKeys) {
      const missingFromEn = !enKeys.has(key);
      const missingFromFr = !frKeys.has(key);
      if (missingFromEn || missingFromFr) {
        const missingIn = [missingFromEn ? "en" : null, missingFromFr ? "fr" : null].filter(Boolean).join(", ");
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `i18n key "${key}" consumed in code but absent from locale(s): ${missingIn}`,
          file: loc.file,
          line: loc.line,
        });
      }
    }

    if (findings.length === 0 && inconclusive.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    if (findings.length > 0) {
      return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
    }
    // Only dynamic-key inconclusive entries, zero hard failures — still
    // surfaced loudly (never treated as a clean pass by omission).
    return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
  },
};

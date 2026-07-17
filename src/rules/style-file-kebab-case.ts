/**
 * Rule: style-file-kebab-case
 *
 * A .ts/.tsx file whose basename is camelCase or PascalCase outside a
 * declared per-directory convention. Preact component directories are
 * routinely PascalCase by team convention (Button.tsx), so a directory can
 * be exempted via `.extension-doctor.json`:
 *   { "pascalCaseDirs": ["ui/components"] }
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md §1.4,
 * §2 rule 6 — MUST_BLOCK RÉEL identique prouvé par dot-skills:
 * waitForHostResponseDone.ts, MultiStepOrchestrator.ts,
 * setNativeValueAndDispatch.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists, walk } from "../core/walk.js";

const RULE_ID = "style-file-kebab-case";
const SOURCE_ROOTS = ["src", "ui"];
const CONFIG_FILE = ".extension-doctor.json";

// kebab-case: lowercase, digits, hyphens only (plus a leading dot for
// dotfiles like .something, which are out of scope for .ts/.tsx anyway).
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// camelCase or PascalCase: contains an uppercase letter.
const HAS_UPPER_RE = /[A-Z]/;

function loadPascalCaseDirs(extensionRoot: string): string[] {
  const configPath = join(extensionRoot, CONFIG_FILE);
  if (!fileExists(configPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as { pascalCaseDirs?: string[] };
    return Array.isArray(raw.pascalCaseDirs) ? raw.pascalCaseDirs : [];
  } catch {
    return [];
  }
}

function isExemptDir(relForReport: string, pascalCaseDirs: string[]): boolean {
  return pascalCaseDirs.some((dir) => relForReport === dir || relForReport.startsWith(`${dir}/`));
}

function baseNameNoExt(relPath: string): string {
  const file = relPath.split("/").pop() ?? relPath;
  return file.replace(/\.(ts|tsx)$/, "");
}

export const styleFileKebabCase: Rule = {
  id: RULE_ID,
  description:
    "A .ts/.tsx file in camelCase or PascalCase outside a directory declared as PascalCase-exempt in .extension-doctor.json pascalCaseDirs.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const existingRoots = SOURCE_ROOTS.map((d) => join(extensionRoot, d)).filter((d) => dirExists(d));
    if (existingRoots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no ${SOURCE_ROOTS.join(" or ")} source root found under extension root — cannot scan file names`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const pascalCaseDirs = loadPascalCaseDirs(extensionRoot);
    const findings: Finding[] = [];

    for (const root of SOURCE_ROOTS) {
      const abs = join(extensionRoot, root);
      if (!dirExists(abs)) continue;
      const files = walk(abs, { extensions: [".ts", ".tsx"] });
      for (const rel of files) {
        const relForReport = join(root, rel);
        // index.ts / index.tsx is a fixed conventional name, never flagged.
        const base = baseNameNoExt(rel);
        if (base === "index") continue;

        if (isExemptDir(relForReport, pascalCaseDirs)) continue;

        if (KEBAB_RE.test(base)) continue;
        if (!HAS_UPPER_RE.test(base)) continue; // e.g. contains underscore only — not this rule's concern

        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `file name "${base}" is camelCase/PascalCase, not kebab-case, and is not under a declared pascalCaseDirs directory in .extension-doctor.json`,
          file: relForReport,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

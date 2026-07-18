/**
 * Rule: no-giant-component
 *
 * A UI component file (.tsx under ui/ or src/**\/components/**) exceeding a
 * configurable line-count threshold (default 300). v1 is a line-count
 * check with the threshold explicitly stated in the finding message —
 * weighting by cyclomatic complexity is a documented future refinement,
 * not attempted here — a v2 note, not a v1 requirement.
 *
 * Threshold is configurable via `.extension-doctor.json`:
 *   { "noGiantComponent": { "maxLines": 300 } }
 *
 * Validated against a real-world regression that reintroduced multiple
 * components over the line-count threshold after an earlier cleanup.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists, walk } from "../core/walk.js";

const RULE_ID = "no-giant-component";
const DEFAULT_MAX_LINES = 300;
const COMPONENT_DIRS = ["ui", "src"];
const CONFIG_FILE = ".extension-doctor.json";

interface RuleConfig {
  maxLines: number;
}

function loadConfig(extensionRoot: string): RuleConfig {
  const configPath = join(extensionRoot, CONFIG_FILE);
  if (!fileExists(configPath)) return { maxLines: DEFAULT_MAX_LINES };
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as {
      noGiantComponent?: { maxLines?: number };
    };
    const configured = raw.noGiantComponent?.maxLines;
    if (typeof configured === "number" && configured > 0) return { maxLines: configured };
    return { maxLines: DEFAULT_MAX_LINES };
  } catch {
    // Malformed config file — fall back to default, do not treat as an
    // inconclusive precondition (the rule can still run meaningfully).
    return { maxLines: DEFAULT_MAX_LINES };
  }
}

function isComponentFile(relPath: string): boolean {
  return relPath.endsWith(".tsx");
}

export const noGiantComponent: Rule = {
  id: RULE_ID,
  description: `A UI component (.tsx) file exceeding the configured line threshold (default ${DEFAULT_MAX_LINES}).`,
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const roots = COMPONENT_DIRS.map((d) => join(extensionRoot, d)).filter((d) => dirExists(d));

    if (roots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no ${COMPONENT_DIRS.join(" or ")} source root found under extension root — cannot scan for component files`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const { maxLines } = loadConfig(extensionRoot);
    const findings: Finding[] = [];
    const seen = new Set<string>();

    for (const root of COMPONENT_DIRS) {
      const abs = join(extensionRoot, root);
      if (!dirExists(abs)) continue;
      const files = walk(abs, { extensions: [".tsx"] }).filter(isComponentFile);
      for (const rel of files) {
        const relForReport = join(root, rel);
        if (seen.has(relForReport)) continue;
        seen.add(relForReport);
        const fileAbs = join(abs, rel);
        let content: string;
        try {
          content = readFileSync(fileAbs, "utf8");
        } catch {
          continue;
        }
        const lineCount = content.split("\n").length;
        if (lineCount > maxLines) {
          findings.push({
            ruleId: RULE_ID,
            severity: "warning",
            message: `component file has ${lineCount} lines, exceeding the configured threshold of ${maxLines} (weighting by cyclomatic complexity is a documented v2 refinement, not applied here)`,
            file: relForReport,
            line: maxLines + 1,
          });
        }
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

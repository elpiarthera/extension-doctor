/**
 * Rule: no-barrel-import
 *
 * Detects an import from an index.ts/index.tsx barrel file when a direct
 * module path exists on disk, instead of importing the module directly.
 * A per-project allowlist of intentional barrels (stable public API of an
 * internal package) can be declared via `.extension-doctor.json`:
 *   { "allowedBarrels": ["src/core/index"] }
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md §1.4,
 * §2 rule 27 — "11 occurrences réelles dans notre propre audit" (react-doctor).
 */
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists, walk } from "../core/walk.js";
import { lineAt, stripComments } from "../core/text.js";

const RULE_ID = "no-barrel-import";
const SOURCE_ROOTS = ["src", "ui"];
const CONFIG_FILE = ".extension-doctor.json";

// import { x } from "../foo/index" | "../foo/index.js" | "../foo" (dir with index.ts)
const IMPORT_RE = /\bimport\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/g;

function loadAllowedBarrels(extensionRoot: string): Set<string> {
  const configPath = join(extensionRoot, CONFIG_FILE);
  if (!fileExists(configPath)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as { allowedBarrels?: string[] };
    if (Array.isArray(raw.allowedBarrels)) {
      return new Set(raw.allowedBarrels.map((p) => p.replace(/\.(ts|tsx|js|jsx)$/, "")));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function normalizeNoExt(relToRoot: string): string {
  return relToRoot.replace(/\.(ts|tsx|js|jsx)$/, "");
}

/**
 * Determine whether the import specifier resolves to a barrel (index.*)
 * file AND a sibling direct module of the same base name exists.
 */
function resolveBarrelTarget(
  extensionRoot: string,
  fromFileAbs: string,
  spec: string,
): { barrelRelToRoot: string; isExplicitIndexSpec: boolean } | null {
  const fromDir = dirname(fromFileAbs);
  const specAbs = resolve(fromDir, spec);

  const explicitIndexMatch = /\/index(\.tsx?|\.jsx?)?$/.test(spec) || /^index(\.tsx?|\.jsx?)?$/.test(spec);

  // Case A: spec explicitly names "…/index" or "…/index.ts". A source
  // specifier may carry a compiled-output extension (e.g. "./index.js"
  // pointing at an authored "index.ts" — the standard NodeNext ESM
  // import-extension convention) — strip any known extension from specAbs
  // BEFORE re-appending candidate extensions, or "index.js" would become
  // the invalid candidate "index.js.ts".
  if (explicitIndexMatch) {
    const specAbsNoExt = specAbs.replace(/\.(ts|tsx|js|jsx)$/, "");
    const candidates = [specAbs, `${specAbsNoExt}.ts`, `${specAbsNoExt}.tsx`, `${specAbsNoExt}.js`, `${specAbsNoExt}.jsx`];
    for (const c of candidates) {
      if (fileExists(c)) {
        return { barrelRelToRoot: normalizeNoExt(relative(extensionRoot, c)), isExplicitIndexSpec: true };
      }
    }
    return null;
  }

  // Case B: spec names a directory that resolves to that directory's index.*
  // (e.g. import from "../components" where components/index.ts exists),
  // when no direct file "components.ts" exists alongside it (that would be
  // an ordinary direct-file import, not a barrel).
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (fileExists(specAbs + ext)) return null; // direct file import, not a barrel
  }
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    const indexCandidate = join(specAbs, `index${ext}`);
    if (fileExists(indexCandidate)) {
      return { barrelRelToRoot: normalizeNoExt(relative(extensionRoot, indexCandidate)), isExplicitIndexSpec: false };
    }
  }
  return null;
}

export const noBarrelImport: Rule = {
  id: RULE_ID,
  description:
    "An import resolves to an index.ts/index.tsx barrel file instead of the direct module path, and is not declared in .extension-doctor.json allowedBarrels.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const existingRoots = SOURCE_ROOTS.map((d) => join(extensionRoot, d)).filter((d) => dirExists(d));
    if (existingRoots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no ${SOURCE_ROOTS.join(" or ")} source root found under extension root — cannot scan imports`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const allowed = loadAllowedBarrels(extensionRoot);
    const findings: Finding[] = [];

    for (const root of SOURCE_ROOTS) {
      const abs = join(extensionRoot, root);
      if (!dirExists(abs)) continue;
      const files = walk(abs, { extensions: [".ts", ".tsx"] });
      for (const rel of files) {
        const fileAbs = join(abs, rel);
        const relForReport = join(root, rel);
        let content: string;
        try {
          content = stripComments(readFileSync(fileAbs, "utf8"));
        } catch {
          continue;
        }

        IMPORT_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = IMPORT_RE.exec(content)) !== null) {
          const spec = m[1];
          if (spec === undefined) continue;
          if (!spec.startsWith(".") && !spec.startsWith("/")) continue; // bare/node-module specifier, out of scope

          const target = resolveBarrelTarget(extensionRoot, fileAbs, spec);
          if (!target) continue;
          if (allowed.has(target.barrelRelToRoot)) continue;

          findings.push({
            ruleId: RULE_ID,
            severity: "warning",
            message: `import "${spec}" resolves to barrel ${target.barrelRelToRoot}.ts — import the direct module instead, or add it to .extension-doctor.json allowedBarrels`,
            file: relForReport,
            line: lineAt(content, m.index),
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

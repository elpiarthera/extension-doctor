/**
 * Rule: permission-diff-between-releases
 *
 * Compares TWO manifest snapshots — the current root `manifest.json` and an
 * optional prior snapshot at `.extension-doctor/prev-manifest.json` — and
 * flags any permission (permissions[] or host_permissions[]) gained by the
 * current snapshot that is not mentioned anywhere in CHANGELOG.md. A silent
 * permission escalation between releases is exactly the kind of change a
 * reviewer or a store audit should never have to discover by diffing JSON
 * by hand.
 *
 * Tripolar by construction: when no prior snapshot exists, the rule cannot
 * compute a diff at all and reports INCONCLUSIVE — it NEVER reports "pass"
 * for a diff it could not compute (silent-pass on missing precondition is
 * banned, see core/types.ts InconclusiveReason contract).
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   item 29 "permission-diff-between-releases"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "permission-diff-between-releases";
const MANIFEST_REL = "manifest.json";
const PREV_MANIFEST_REL = ".extension-doctor/prev-manifest.json";
const CHANGELOG_REL = "CHANGELOG.md";

interface ManifestShape {
  permissions?: unknown;
  host_permissions?: unknown;
}

function permsOf(manifest: ManifestShape): Set<string> {
  const out = new Set<string>();
  for (const key of ["permissions", "host_permissions"] as const) {
    const arr = manifest[key];
    if (Array.isArray(arr)) {
      for (const p of arr) if (typeof p === "string") out.add(p);
    }
  }
  return out;
}

function readManifest(path: string, ruleId: string): { manifest: ManifestShape } | { reason: InconclusiveReason } {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    return { reason: { ruleId, reason: `could not read ${path} (${(err as Error).message})` } };
  }
  try {
    return { manifest: JSON.parse(raw) as ManifestShape };
  } catch (err) {
    return { reason: { ruleId, reason: `${path} could not be parsed as JSON (${(err as Error).message})` } };
  }
}

export const permissionDiffBetweenReleases: Rule = {
  id: RULE_ID,
  description:
    "A permission gained between the previous manifest snapshot and the current one is not mentioned in CHANGELOG.md.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST_REL);
    const prevPath = join(extensionRoot, PREV_MANIFEST_REL);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json not found at extension root (expected ${MANIFEST_REL}) — cannot compute permission diff`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (!fileExists(prevPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `no prior snapshot at ${PREV_MANIFEST_REL} — cannot compute a permission diff, this is NOT a pass`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const current = readManifest(manifestPath, RULE_ID);
    if ("reason" in current) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [current.reason], exitCode: 2 };
    }
    const prev = readManifest(prevPath, RULE_ID);
    if ("reason" in prev) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [prev.reason], exitCode: 2 };
    }

    const currentPerms = permsOf(current.manifest);
    const prevPerms = permsOf(prev.manifest);
    const gained = [...currentPerms].filter((p) => !prevPerms.has(p));

    if (gained.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    const changelogPath = join(extensionRoot, CHANGELOG_REL);
    let changelog = "";
    if (fileExists(changelogPath)) {
      try {
        changelog = readFileSync(changelogPath, "utf8");
      } catch {
        changelog = "";
      }
    }

    const findings: Finding[] = [];
    for (const perm of gained) {
      const mentioned = changelog.includes(perm);
      if (mentioned) continue;
      findings.push({
        ruleId: RULE_ID,
        severity: "error",
        message: `Permission "${perm}" was gained versus the previous manifest snapshot but is not mentioned in ${CHANGELOG_REL} — document the escalation.`,
        file: MANIFEST_REL,
        snippet: perm,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

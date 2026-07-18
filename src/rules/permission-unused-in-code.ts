/**
 * Rule: permission-unused-in-code
 *
 * Flags a manifest `permissions` entry with no detectable use of its
 * corresponding chrome.<api> namespace anywhere in the built bundle.
 * `storage`/`tabs`/etc-style dotted access (`chrome.alarms.create(...)`) is
 * the only form grepped for directly. Bracket-notation access
 * (`chrome["alarms"]` or `chrome['alarms']`) that would escape a naive
 * dotted-access grep is checked separately and, if present, counts as
 * "used" too — but if NEITHER dotted NOR bracket form is found, the
 * permission is reported "unused" only when the bundle text gives us no
 * ambiguous signal; any minified/aliased indirection we cannot see (e.g.
 * `const a = chrome; a.alarms...`) is a known blind spot named explicitly
 * in the per-permission inconclusive note rather than silently assumed
 * either way — a silent escape hatch that quietly resolves ambiguity as
 * a pass or fail is banned; ambiguity must be reported as INCONCLUSIVE.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { listBundleFiles, readBundleFile } from "../core/bundle-scan.js";
import { stripComments } from "../core/text.js";

const RULE_ID = "permission-unused-in-code";

const MANIFEST_CANDIDATES = ["manifest.json", "public/manifest.json", "src/manifest.json"];

// Permissions that are declarative/manifest-only and have no corresponding
// chrome.<api> call surface to grep for — never flagged as "unused".
const NON_CODE_PERMISSIONS = new Set(["host_permissions"]);

function readManifestPermissions(buildDir: string, extensionRoot: string): { permissions: string[] | null; reason?: string } {
  const candidates = [join(buildDir, "manifest.json"), ...MANIFEST_CANDIDATES.map((c) => join(extensionRoot, c))];
  for (const abs of candidates) {
    try {
      const raw = readFileSync(abs, "utf8");
      const parsed = JSON.parse(raw) as { permissions?: unknown };
      const perms = Array.isArray(parsed.permissions) ? parsed.permissions.filter((x): x is string => typeof x === "string") : [];
      return { permissions: perms };
    } catch {
      continue;
    }
  }
  return { permissions: null, reason: `no readable manifest.json found (checked ${candidates.length} candidates)` };
}

export const permissionUnusedInCode: Rule = {
  id: RULE_ID,
  description:
    "A declared manifest permission with no detectable chrome.<api> use in the built bundle is likely dead weight (or a privacy/review-risk over-declaration).",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const { permissions, reason: manifestReason } = readManifestPermissions(build.buildDir, extensionRoot);
    if (permissions === null) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: manifestReason! };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }
    if (permissions.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    const files = listBundleFiles(build.buildDir);
    const inconclusive: InconclusiveReason[] = [];
    let bundleText = "";
    for (const file of files) {
      try {
        bundleText += stripComments(readBundleFile(file)) + "\n";
      } catch (err) {
        inconclusive.push({ ruleId: RULE_ID, reason: `could not read bundle file: ${String(err)}`, file: file.relPath });
      }
    }

    const findings: Finding[] = [];

    for (const perm of permissions) {
      if (NON_CODE_PERMISSIONS.has(perm)) continue;

      const dottedRe = new RegExp("\\bchrome\\." + escapeRegExp(perm) + "\\b");
      const bracketRe = new RegExp("\\bchrome\\s*\\[\\s*[\"'`]" + escapeRegExp(perm) + "[\"'`]\\s*\\]");

      const dottedUsed = dottedRe.test(bundleText);
      const bracketUsed = bracketRe.test(bundleText);

      if (dottedUsed || bracketUsed) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "warning",
        message: `Manifest declares permission "${perm}" but no chrome.${perm} (dotted) or chrome["${perm}"] (bracket) use was found in the built bundle. Note: aliased/indirect access (e.g. "const a = chrome; a.${perm}") is a known blind spot of this static grep and would NOT be detected — verify manually before removing the permission.`,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive, exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
  },
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

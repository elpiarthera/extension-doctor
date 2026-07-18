/**
 * Rule: postinstall-script-audit
 *
 * A dependency (declared in package.json) that ships a non-trivial
 * `postinstall` script is a supply-chain risk surface. Since node_modules
 * may legitimately be absent at audit time (fresh clone, CI cache miss),
 * this rule reads the DECLARED dependency list from package.json and, for
 * each dep that IS present under node_modules/<pkg>/package.json, reads its
 * scripts.postinstall and classifies it:
 *   - on ALLOWLIST (known native-build tool)             -> not flagged
 *   - present but NOT on allowlist                        -> flagged (fail)
 *   - node_modules entirely absent AND no lockfile either  -> inconclusive
 *     (loud, never a silent pass — this rule never claims "clean" without
 *     having actually looked at anything)
 *
 * Spec ref: internal rule matrix (not shipped with this package)
 *   §1.1 + §2 rule 21 (postinstall script audit). The blocked-postinstall
 *   signal this rule mirrors is the same one bun/npm itself surfaces at
 *   install time (matrix §7 item 11, e.g. "Blocked 1 postinstall").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "postinstall-script-audit";
const MANIFEST = "package.json";
const NODE_MODULES = "node_modules";
const LOCKFILES = ["bun.lock", "bun.lockb", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

/**
 * Known native-build / well-understood postinstall tools. Intentionally
 * small — extending this list is a documented follow-up, not a silent gap.
 * Anything a declared dependency's postinstall does that is NOT recognized
 * as one of these download-native-binary patterns is flagged as unknown.
 */
const ALLOWLIST_PATTERNS: RegExp[] = [
  /\besbuild\/install\.js\b/,
  /\bnode\s+install\.js\b/,
  /\bplaywright\s+install\b/,
  /\bpuppeteer\s.*install\b/,
  /\bprebuild-install\b/,
  /\bnode-gyp\s+rebuild\b/,
  /\bsharp\/install\//,
];

function isAllowlisted(script: string): boolean {
  return ALLOWLIST_PATTERNS.some((re) => re.test(script));
}

export const postinstallScriptAudit: Rule = {
  id: RULE_ID,
  description:
    "A declared dependency ships a non-trivial postinstall script not on the known-native-build allowlist (esbuild, playwright, sharp, node-gyp, ...). Inconclusive (never silently pass) when node_modules AND lockfile are both absent.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${MANIFEST} not found at extension root — cannot resolve declared dependencies`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${MANIFEST} could not be parsed as JSON — cannot resolve declared dependencies`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const nodeModulesPath = join(extensionRoot, NODE_MODULES);
    const nodeModulesPresent = dirExists(nodeModulesPath);
    const lockfilePresent = LOCKFILES.some((f) => fileExists(join(extensionRoot, f)));

    if (!nodeModulesPresent && !lockfilePresent) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `neither ${NODE_MODULES} nor a lockfile (${LOCKFILES.join(", ")}) present — cannot read installed postinstall scripts, refusing to silently pass`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const depFields = ["dependencies", "devDependencies"] as const;
    const declaredNames = new Set<string>();
    for (const field of depFields) {
      const deps = pkg[field];
      if (!deps || typeof deps !== "object") continue;
      for (const name of Object.keys(deps as Record<string, string>)) declaredNames.add(name);
    }

    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    if (!nodeModulesPresent && lockfilePresent) {
      inconclusive.push({
        ruleId: RULE_ID,
        reason: `${NODE_MODULES} absent (lockfile present) — cannot read installed postinstall scripts for any declared dependency`,
      });
    } else {
      for (const name of declaredNames) {
        const depPkgPath = join(nodeModulesPath, name, "package.json");
        if (!fileExists(depPkgPath)) continue; // declared but not installed under this root — not this rule's concern
        let depPkg: Record<string, unknown>;
        try {
          depPkg = JSON.parse(readFileSync(depPkgPath, "utf8"));
        } catch {
          inconclusive.push({
            ruleId: RULE_ID,
            reason: `node_modules/${name}/package.json could not be parsed as JSON — cannot read its postinstall script`,
            file: join(NODE_MODULES, name, "package.json"),
          });
          continue;
        }
        const scripts = depPkg.scripts as Record<string, string> | undefined;
        const postinstall = scripts?.postinstall;
        if (!postinstall || postinstall.trim().length === 0) continue;
        if (isAllowlisted(postinstall)) continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `Dependency "${name}" declares a postinstall script not on the known-native-build allowlist: ${postinstall}`,
          file: join(NODE_MODULES, name, "package.json"),
          snippet: postinstall,
        });
      }
    }

    if (findings.length > 0) {
      return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
    }
    if (inconclusive.length > 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
  },
};

/**
 * Rule: host-permissions-content-scripts-mismatch
 *
 * Detects a domain granted in `host_permissions` that has NO corresponding
 * entry in any `content_scripts[].matches` pattern, and is not explicitly
 * documented as an intentional exception (e.g. an API-only host reached via
 * fetch() from the service worker, never injected into).
 *
 * A host_permission with no content_scripts match is not automatically a
 * defect (a background-only API host is legitimate), so an undocumented
 * mismatch is reported as a WARNING finding, not blocked as an error — the
 * remedy is either to document it or to add the missing content_scripts
 * entry.
 *
 * Documented exceptions live in `.extension-doctor.json` at the extension
 * root:
 *   { "documentedHosts": ["https://*.x.ai/*"] }
 * Each entry must be the exact host_permissions string it exempts.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   item 22 "host-permissions-content-scripts-mismatch"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "host-permissions-content-scripts-mismatch";
const MANIFEST_REL = "manifest.json";
const CONFIG_REL = ".extension-doctor.json";

interface ContentScriptEntry {
  matches?: unknown;
}

interface ManifestShape {
  host_permissions?: unknown;
  content_scripts?: unknown;
}

interface DoctorConfig {
  documentedHosts?: unknown;
}

/**
 * Convert a Chrome match pattern (scheme://host/path) into a bare host
 * pattern (scheme://host/*) for comparison — host_permissions entries are
 * always host-scoped (no meaningful path segment), while content_scripts
 * matches sometimes narrow the path. We only compare the origin part.
 */
function originOf(pattern: string): string | null {
  const m = /^([a-z-]+:\/\/[^/]+)\//.exec(pattern);
  return m ? (m[1] ?? null) : null;
}

export const hostPermissionsContentScriptsMismatch: Rule = {
  id: RULE_ID,
  description:
    "A domain granted in host_permissions has no corresponding content_scripts.matches entry and is not documented as an intentional exception.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST_REL);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json not found at extension root (expected ${MANIFEST_REL}) — cannot compare host_permissions and content_scripts`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestShape;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestShape;
    } catch (err) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json could not be parsed as JSON (${(err as Error).message})`,
        file: MANIFEST_REL,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let documentedHosts = new Set<string>();
    const configPath = join(extensionRoot, CONFIG_REL);
    if (fileExists(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf8")) as DoctorConfig;
        if (Array.isArray(config.documentedHosts)) {
          documentedHosts = new Set(config.documentedHosts.filter((h): h is string => typeof h === "string"));
        }
      } catch (err) {
        const reason: InconclusiveReason = {
          ruleId: RULE_ID,
          reason: `${CONFIG_REL} exists but could not be parsed as JSON (${(err as Error).message}) — cannot resolve documented exceptions`,
          file: CONFIG_REL,
        };
        return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
      }
    }

    const hostPermissions = Array.isArray(manifest.host_permissions)
      ? manifest.host_permissions.filter((h): h is string => typeof h === "string")
      : [];
    const contentScripts = Array.isArray(manifest.content_scripts)
      ? (manifest.content_scripts as ContentScriptEntry[])
      : [];

    const matchOrigins = new Set<string>();
    for (const entry of contentScripts) {
      if (!Array.isArray(entry.matches)) continue;
      for (const pattern of entry.matches) {
        if (typeof pattern !== "string") continue;
        const origin = originOf(pattern);
        if (origin) matchOrigins.add(origin);
      }
    }

    const findings: Finding[] = [];
    for (const hostPerm of hostPermissions) {
      if (documentedHosts.has(hostPerm)) continue;
      const origin = originOf(hostPerm);
      if (origin === null) continue; // e.g. <all_urls> — not this rule's shape
      if (matchOrigins.has(origin)) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "warning",
        message: `host_permissions entry "${hostPerm}" has no matching content_scripts.matches entry and is not listed in ${CONFIG_REL} documentedHosts — either add the content_scripts match or document the exception.`,
        file: MANIFEST_REL,
        snippet: hostPerm,
      });
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

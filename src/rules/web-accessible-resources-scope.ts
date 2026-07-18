/**
 * Rule: web-accessible-resources-scope
 *
 * Detects a `web_accessible_resources[].matches` pattern broader than the
 * union of all `content_scripts[].matches` patterns — most commonly
 * `<all_urls>` or a wildcard scheme+host match, which makes bundled
 * extension resources (scripts, images, fonts) fetchable and
 * fingerprintable by ANY website, not just the hosts the extension
 * actually operates on.
 *
 * A WAR match pattern is considered "broader" when it is `<all_urls>`, or
 * when it uses a wildcard scheme/host not present verbatim among the
 * content_scripts origins.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   item 24 "web-accessible-resources-scope"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { fileExists } from "../core/walk.js";

const RULE_ID = "web-accessible-resources-scope";
const MANIFEST_REL = "manifest.json";

const OVERBROAD_PATTERNS = new Set(["<all_urls>", "*://*/*", "http://*/*", "https://*/*", "*://*.*/*"]);

interface ContentScriptEntry {
  matches?: unknown;
}
interface WarEntry {
  matches?: unknown;
  resources?: unknown;
}
interface ManifestShape {
  content_scripts?: unknown;
  web_accessible_resources?: unknown;
}

function originOf(pattern: string): string | null {
  const m = /^([a-z*-]+:\/\/[^/]+)\//.exec(pattern);
  return m ? (m[1] ?? null) : null;
}

export const webAccessibleResourcesScope: Rule = {
  id: RULE_ID,
  description:
    "web_accessible_resources.matches is broader than the union of content_scripts.matches, exposing bundled resources to sites the extension does not operate on.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const manifestPath = join(extensionRoot, MANIFEST_REL);

    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `manifest.json not found at extension root (expected ${MANIFEST_REL}) — cannot compare web_accessible_resources and content_scripts scope`,
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

    const war = manifest.web_accessible_resources;
    if (war === undefined) {
      // No WAR block at all — nothing to be broad. Legitimate pass, not an
      // exemption of a check that ran: the check ran and found zero entries.
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    if (!Array.isArray(war)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json web_accessible_resources is present but not an array — cannot resolve MV3 shape",
        file: MANIFEST_REL,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const contentScripts = Array.isArray(manifest.content_scripts)
      ? (manifest.content_scripts as ContentScriptEntry[])
      : [];
    const csOrigins = new Set<string>();
    for (const entry of contentScripts) {
      if (!Array.isArray(entry.matches)) continue;
      for (const pattern of entry.matches) {
        if (typeof pattern !== "string") continue;
        const origin = originOf(pattern);
        if (origin) csOrigins.add(origin);
      }
    }

    const findings: Finding[] = [];
    for (const entry of war as WarEntry[]) {
      if (!Array.isArray(entry.matches)) continue;
      for (const pattern of entry.matches) {
        if (typeof pattern !== "string") continue;
        const origin = originOf(pattern);
        const isOverbroad = OVERBROAD_PATTERNS.has(pattern) || origin === null;
        const isUnbackedOrigin = origin !== null && !csOrigins.has(origin) && !OVERBROAD_PATTERNS.has(pattern) && origin.includes("*");
        if (!isOverbroad && !isUnbackedOrigin) continue;

        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `web_accessible_resources.matches entry "${pattern}" is broader than content_scripts.matches (${
            csOrigins.size > 0 ? [...csOrigins].join(", ") : "none declared"
          }) — narrow it or document the exception explicitly in the resource comment.`,
          file: MANIFEST_REL,
          snippet: pattern,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

/**
 * Rule: network-destination-inventory
 *
 * Inventories literal fetch()/XMLHttpRequest/WebSocket URL destinations
 * found in the BUILT bundle and flags any literal http(s)/wss destination
 * not covered by the manifest's host_permissions. A DYNAMIC url argument
 * (anything that isn't a plain string/template literal with no
 * interpolation) can NOT be resolved statically — an unresolved dynamic
 * arg is reported as an INDICATIVE inconclusive entry, never silently
 * counted toward a clean "pass".
 *
 * Manifest lookup mirrors export-graph.ts's MANIFEST_CANDIDATES precedence
 * (buildDir/manifest.json first — the actually-shipped manifest — then the
 * extensionRoot source candidates as fallback), without importing that
 * module (kept disjoint per brief).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { listBundleFiles, readBundleFile } from "../core/bundle-scan.js";
import { stripComments, lineAt } from "../core/text.js";

const RULE_ID = "network-destination-inventory";

const MANIFEST_CANDIDATES = ["manifest.json", "public/manifest.json", "src/manifest.json"];

// Matches fetch(...), new XMLHttpRequest().open(method, url), new WebSocket(url)
// with the URL argument captured as group 1 (only literal string/template
// forms, with NO ${...} interpolation, are treated as resolvable).
const CALL_RE = /\b(fetch|WebSocket)\s*\(\s*(["'`])((?:(?!\2).)*)\2/g;
const XHR_OPEN_RE = /\.open\s*\(\s*["'`][A-Za-z]+["'`]\s*,\s*(["'`])((?:(?!\1).)*)\1/g;
// A call whose first argument is clearly non-literal (identifier, member
// expression, template literal WITH interpolation, concatenation) — used to
// surface dynamic destinations as indicative inconclusive entries.
const DYNAMIC_CALL_RE = /\b(fetch|WebSocket)\s*\(\s*([^"'`)][^)]*)\)/g;

function readManifestPermissions(buildDir: string, extensionRoot: string): { hostPermissions: string[] | null; reason?: string } {
  const candidates = [join(buildDir, "manifest.json"), ...MANIFEST_CANDIDATES.map((c) => join(extensionRoot, c))];
  for (const abs of candidates) {
    try {
      const raw = readFileSync(abs, "utf8");
      const parsed = JSON.parse(raw) as { host_permissions?: unknown };
      const hp = Array.isArray(parsed.host_permissions) ? parsed.host_permissions.filter((x): x is string => typeof x === "string") : [];
      return { hostPermissions: hp };
    } catch {
      continue;
    }
  }
  return { hostPermissions: null, reason: `no readable manifest.json found (checked ${candidates.length} candidates)` };
}

function originCoveredByPermissions(url: string, hostPermissions: string[]): boolean {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  for (const perm of hostPermissions) {
    if (perm === "<all_urls>") return true;
    // Convert an MV3 match pattern (scheme://host/path*) into a regex
    // anchored on scheme+host only (path is irrelevant to origin coverage).
    const m = /^(\*|https?):\/\/([^/]+)\//.exec(perm) ?? /^(\*|https?):\/\/([^/]+)$/.exec(perm);
    if (!m) continue;
    const scheme = m[1];
    const hostPattern = m[2];
    if (!scheme || !hostPattern) continue;
    const hostRe = new RegExp("^" + hostPattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    try {
      const originUrl = new URL(url);
      const schemeOk = scheme === "*" || originUrl.protocol === scheme + ":";
      if (schemeOk && hostRe.test(originUrl.hostname)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export const networkDestinationInventory: Rule = {
  id: RULE_ID,
  description:
    "Literal fetch()/XMLHttpRequest/WebSocket destination URLs in the built bundle must be covered by manifest host_permissions; dynamic destinations are reported indicative, never silently treated as clean.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const { hostPermissions, reason: manifestReason } = readManifestPermissions(build.buildDir, extensionRoot);
    if (hostPermissions === null) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: manifestReason! };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const files = listBundleFiles(build.buildDir);
    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    for (const file of files) {
      let raw: string;
      try {
        raw = readBundleFile(file);
      } catch (err) {
        inconclusive.push({ ruleId: RULE_ID, reason: `could not read bundle file: ${String(err)}`, file: file.relPath });
        continue;
      }
      const content = stripComments(raw);

      const literalUrls = new Set<number>();

      for (const re of [CALL_RE, XHR_OPEN_RE]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          const url = re === CALL_RE ? m[3] : m[2];
          if (!url) continue;
          if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url)) continue; // relative/local — not a remote destination
          literalUrls.add(m.index);
          const normalizedForOrigin = url.replace(/^wss?:\/\//, "https://");
          if (!originCoveredByPermissions(normalizedForOrigin, hostPermissions)) {
            findings.push({
              ruleId: RULE_ID,
              severity: "error",
              message: `Literal network destination "${url}" is not covered by any manifest host_permissions entry.`,
              file: file.relPath,
              line: lineAt(content, m.index),
              snippet: content.slice(m.index, Math.min(content.length, m.index + 100)),
            });
          }
        }
      }

      DYNAMIC_CALL_RE.lastIndex = 0;
      let dm: RegExpExecArray | null;
      while ((dm = DYNAMIC_CALL_RE.exec(content)) !== null) {
        if (literalUrls.has(dm.index)) continue; // already resolved as a literal above
        const argPreview = (dm[2] ?? "").trim().slice(0, 60);
        inconclusive.push({
          ruleId: RULE_ID,
          reason: `dynamic (non-literal) network destination argument "${argPreview}" could not be resolved statically — not counted as clean`,
          file: file.relPath,
          line: lineAt(content, dm.index),
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

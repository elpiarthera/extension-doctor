/**
 * Rule: csp-not-weakened
 *
 * Flags `manifest.json.content_security_policy.extension_pages` if it
 * reintroduces `unsafe-eval`, `unsafe-inline`, or a remote (http/https)
 * source under a directive that governs CODE EXECUTION. The ABSENCE of a
 * custom content_security_policy key is treated as a MUST_PASS — MV3's
 * implicit default CSP already forbids these — and that default is
 * documented explicitly here rather than silently assumed.
 *
 * Directive scoping (the point of this rule): a CSP is a set of directives,
 * each governing a distinct resource class. `script-src` / `script-src-elem`
 * / `worker-src` / `object-src` govern what may EXECUTE — a remote origin or
 * an unsafe-* keyword there is a real weakening. `connect-src`, `img-src`,
 * `style-src`, `font-src`, `media-src`, `frame-src` govern DATA/asset
 * fetching or embedding, not code execution — a remote origin there is
 * normal and not evaluated by this rule. A directive absent from the policy
 * inherits `default-src` per the CSP spec, so `default-src` is checked as
 * the fallback for each governed directive that is not itself present.
 *
 * Spec: internal rule matrix (not shipped with this package)
 *   §1.1 row `csp-not-weakened`, §2 item 9.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `MANIFEST_CSP` / `MANIFEST_CSP_UNSAFE_EVAL` (MPL-2.0) + CWS validator
 * rejects an invalid CSP.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists } from "../core/walk.js";

const RULE_ID = "csp-not-weakened";

interface ManifestJson {
  content_security_policy?: {
    extension_pages?: unknown;
  };
}

/** Directives that govern where/how executable code may originate. */
const CODE_EXECUTION_DIRECTIVES = new Set(["script-src", "script-src-elem", "worker-src", "object-src"]);

const REMOTE_SRC_RE = /^(https?:)?\/\/\S+$/i;

interface ParsedCsp {
  /** directive name (lowercased) -> array of source tokens (as-written) */
  directives: Map<string, string[]>;
}

/**
 * Parses a CSP header string into a directive -> sources map. Returns null
 * if the string yields no parseable directive at all (malformed input),
 * so the caller can surface an inconclusive verdict instead of a silent
 * pass or a silent fail.
 */
function parseCsp(csp: string): ParsedCsp | null {
  const directives = new Map<string, string[]>();
  const segments = csp
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const segment of segments) {
    const tokens = segment.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) continue;
    const [rawName, ...sources] = tokens;
    if (rawName === undefined) continue;
    const name = rawName.toLowerCase();
    if (!/^[a-z-]+$/.test(name)) {
      // Not a recognizable directive token — treat as malformed rather
      // than silently skip it.
      return null;
    }
    directives.set(name, sources);
  }

  if (directives.size === 0) {
    return null;
  }

  return { directives };
}

/** Resolves the effective source list for a directive, applying default-src fallback. */
function effectiveSources(parsed: ParsedCsp, directive: string): string[] {
  if (parsed.directives.has(directive)) {
    return parsed.directives.get(directive) ?? [];
  }
  return parsed.directives.get("default-src") ?? [];
}

export const cspNotWeakened: Rule = {
  id: RULE_ID,
  description:
    "manifest.json content_security_policy.extension_pages reintroduces unsafe-eval, unsafe-inline, or a remote source under a code-execution directive (script-src, script-src-elem, worker-src, object-src) — weakens the MV3 implicit-default CSP.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    if (!dirExists(extensionRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `extension root ${extensionRoot} does not exist — cannot read manifest.json`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const manifestPath = join(extensionRoot, "manifest.json");
    if (!fileExists(manifestPath)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json not found at extension root — cannot read content_security_policy",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let manifest: ManifestJson;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestJson;
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "manifest.json is not valid JSON — cannot read content_security_policy",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const extensionPages = manifest.content_security_policy?.extension_pages;
    if (extensionPages === undefined) {
      // No custom CSP key at all — MV3's implicit default CSP
      // ("script-src 'self'; object-src 'self'") already forbids unsafe-eval
      // and remote sources. Documented explicitly, never silently assumed.
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }

    if (typeof extensionPages !== "string") {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "content_security_policy.extension_pages present but not a string — cannot evaluate",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    if (extensionPages.trim().length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "content_security_policy.extension_pages is an empty string — no directives to evaluate",
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const parsed = parseCsp(extensionPages);
    if (parsed === null) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `content_security_policy.extension_pages could not be parsed into directives: "${extensionPages}"`,
        file: "manifest.json",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    const flaggedUnsafeEval = new Set<string>();
    const flaggedUnsafeInline = new Set<string>();
    const flaggedRemote = new Set<string>();

    for (const directive of CODE_EXECUTION_DIRECTIVES) {
      const sources = effectiveSources(parsed, directive);
      const isExplicit = parsed.directives.has(directive);
      const effectiveDirectiveLabel = isExplicit ? directive : `default-src (inherited by ${directive})`;

      for (const source of sources) {
        const normalized = source.replace(/^["']|["']$/g, "").toLowerCase();

        if (normalized === "unsafe-eval" && !flaggedUnsafeEval.has(directive)) {
          flaggedUnsafeEval.add(directive);
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `content_security_policy.extension_pages reintroduces 'unsafe-eval' under ${effectiveDirectiveLabel} — weakens the MV3 default CSP.`,
            file: "manifest.json",
            snippet: extensionPages,
          });
        }

        if (normalized === "unsafe-inline" && !flaggedUnsafeInline.has(directive)) {
          flaggedUnsafeInline.add(directive);
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `content_security_policy.extension_pages reintroduces 'unsafe-inline' under ${effectiveDirectiveLabel} — weakens the MV3 default CSP.`,
            file: "manifest.json",
            snippet: extensionPages,
          });
        }

        if (REMOTE_SRC_RE.test(source) && !flaggedRemote.has(directive)) {
          flaggedRemote.add(directive);
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `content_security_policy.extension_pages references a remote (http/https) source under ${effectiveDirectiveLabel} — MV3 requires all code-execution sources to be bundled locally.`,
            file: "manifest.json",
            snippet: extensionPages,
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

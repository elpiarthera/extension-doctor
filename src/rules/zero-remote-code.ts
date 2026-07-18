/**
 * Rule: zero-remote-code
 *
 * Scans the BUILT bundle (dist/chrome/**\/*.js|mjs) for remote-code-execution
 * patterns forbidden by MV3 policy: eval(), new Function(), importScripts()
 * pointed at an http(s) URL, dynamic import() of an http(s) URL, and a
 * remote <script src=http...> string literal.
 *
 * MUST scan the built bundle, not source — requireFreshBuild() first; an
 * absent/empty build converts to inconclusive (exitCode 2), never a silent
 * "pass". See internal rule matrix (not shipped with this package)
 * §1.1 + §2 rule 7.
 */
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { listBundleFiles, readBundleFile } from "../core/bundle-scan.js";
import { stripComments, lineAt } from "../core/text.js";

const RULE_ID = "zero-remote-code";

// Word-boundary anchored so an identifier like `evaluate` or a business
// field named `eval` (e.g. `config.eval`) is never matched. Requires the
// literal call-open-paren right after the token.
const EVAL_RE = /\beval\s*\(/g;
const NEW_FUNCTION_RE = /\bnew\s+Function\s*\(/g;
const IMPORT_SCRIPTS_HTTP_RE = /\bimportScripts\s*\(\s*["'`]https?:\/\//g;
const DYNAMIC_IMPORT_HTTP_RE = /\bimport\s*\(\s*["'`]https?:\/\//g;
const REMOTE_SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*["']https?:\/\/[^"']+["']/gi;

export const zeroRemoteCode: Rule = {
  id: RULE_ID,
  description:
    "Built bundle contains eval(), new Function(), importScripts()/import() of a remote http(s) URL, or a remote <script src=http...> — remote code execution forbidden under MV3.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
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
        inconclusive.push({
          ruleId: RULE_ID,
          reason: `could not read bundle file: ${String(err)}`,
          file: file.relPath,
        });
        continue;
      }
      const content = stripComments(raw);

      const patterns: Array<{ re: RegExp; msg: string }> = [
        { re: EVAL_RE, msg: "eval(...) call found in built bundle — remote/dynamic code execution risk." },
        { re: NEW_FUNCTION_RE, msg: "new Function(...) found in built bundle — dynamic code execution risk." },
        {
          re: IMPORT_SCRIPTS_HTTP_RE,
          msg: "importScripts() targeting a remote http(s) URL — fetches and executes code outside the packaged bundle.",
        },
        {
          re: DYNAMIC_IMPORT_HTTP_RE,
          msg: "dynamic import() targeting a remote http(s) URL — fetches and executes code outside the packaged bundle.",
        },
        {
          re: REMOTE_SCRIPT_SRC_RE,
          msg: "<script src=http(s)://...> string literal in bundle — remote script injection pattern.",
        },
      ];

      for (const { re, msg } of patterns) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: msg,
            file: file.relPath,
            line: lineAt(content, m.index),
            snippet: content.slice(m.index, Math.min(content.length, m.index + 120)),
          });
        }
      }
    }

    if (inconclusive.length > 0 && findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive, exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
  },
};

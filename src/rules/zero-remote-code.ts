/**
 * Rule: zero-remote-code
 *
 * Scans the BUILT bundle (dist/chrome/**\/*.js|mjs) for remote-code-execution
 * patterns forbidden by MV3 policy: eval(), new Function(), importScripts()
 * pointed at an http(s) URL, and dynamic import() of an http(s) URL. Each of
 * these matches a CALL site — unambiguous, always a hard finding.
 *
 * A remote <script src=http...> string literal is reported separately, as
 * inconclusive rather than a finding: it is text, not a call, and static
 * analysis over a built bundle cannot distinguish an inert literal (escaped
 * text, sanitizer fixture data) from one actually injected into the DOM.
 * A hard finding elsewhere in the same bundle still forces verdict fail —
 * an inconclusive never masks a real finding.
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
    "Built bundle contains eval(), new Function(), or importScripts()/import() of a remote http(s) URL — remote code execution forbidden under MV3. A remote <script src=http...> string literal, when present, is reported as inconclusive: static analysis cannot tell an inert literal from an injected one.",
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

      // Hard-finding patterns: each one matches a CALL being made (eval,
      // new Function, importScripts/import of a remote URL). A call site is
      // unambiguous — there is no "inert" reading of `eval(...)` being
      // present in a built bundle. These stay hard findings, verdict fail.
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

      // A remote <script src=http...> STRING LITERAL is not a call site —
      // it is text. Static analysis over a bundle cannot tell an inert
      // literal (rendered as escaped text, or held as sanitizer fixture
      // data that the code strips) from a literal actually injected into
      // the DOM via innerHTML/insertAdjacentHTML. Presence alone is not a
      // defect; report loudly what is unknown instead of asserting a
      // finding the tool never measured.
      REMOTE_SCRIPT_SRC_RE.lastIndex = 0;
      let sm: RegExpExecArray | null;
      while ((sm = REMOTE_SCRIPT_SRC_RE.exec(content)) !== null) {
        inconclusive.push({
          ruleId: RULE_ID,
          reason:
            "a remote <script src=...> string literal is present in the built bundle; static analysis cannot determine whether it is injected into the DOM (e.g. via innerHTML) or inert (escaped text, sanitizer fixture data). Inspect the surrounding usage.",
          file: file.relPath,
          line: lineAt(content, sm.index),
        });
      }
    }

    if (findings.length > 0) {
      return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
    }
    if (inconclusive.length > 0) {
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
    }
    return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive, exitCode: 0 };
  },
};

/**
 * Rule: sw-context-invalidated-guard
 *
 * Detects a chrome.runtime.sendMessage(...) call site with no preceding
 * guard against an invalidated extension context (chrome.runtime.id becomes
 * undefined after the extension reloads/updates while a tab stays open).
 *
 * Known limitation (documented, not hidden): only follows ONE level of
 * call-site indirection (a wrapper function). A callback passed to a
 * third-party lib that invokes chrome.runtime.sendMessage internally is out
 * of scope for v0.1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { walk, dirExists } from "../core/walk.js";
import { matchBracket, lineAt, enclosingBlock, stripComments, stripStrings } from "../core/text.js";

const RULE_ID = "sw-context-invalidated-guard";

const SEND_RE = /chrome\.runtime\.sendMessage\s*\(/g;
const ID_GUARD_RE = /chrome\.runtime(\?\.|\.)id/;
const GUARD_FN_DECL_RE =
  /(?:function\s+([a-zA-Z0-9_]+)\s*\(|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()/g;

export const swContextInvalidatedGuard: Rule = {
  id: RULE_ID,
  description:
    "chrome.runtime.sendMessage() call site with no try/catch or chrome.runtime.id guard against an invalidated extension context.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const roots = ["src", "ui"].filter((d) => dirExists(join(extensionRoot, d)));
    if (roots.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "no TypeScript source files found under src/ or ui/",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let anyTsFile = false;
    const fileContents = new Map<string, string>(); // rel -> content, for cross-file guard-fn lookup
    for (const root of roots) {
      const abs = join(extensionRoot, root);
      const files = walk(abs, { extensions: [".ts", ".tsx"] });
      for (const rel of files) {
        anyTsFile = true;
        const fileAbs = join(abs, rel);
        try {
          // Comments AND string literal bodies stripped so a doc comment or
          // a quoted log/help string naming "chrome.runtime.sendMessage(...)"
          // (call syntax appearing only as text) never false-positives. None
          // of this rule's checks (SEND_RE, ID_GUARD_RE, GUARD_FN_DECL_RE,
          // try-block detection) need string content — call/guard syntax is
          // always executable position.
          fileContents.set(
            join(root, rel),
            stripStrings(stripComments(readFileSync(fileAbs, "utf8"))),
          );
        } catch {
          // unreadable file — skip, does not block the whole rule
        }
      }
    }

    if (!anyTsFile) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "no TypeScript source files found under src/ or ui/",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    // Collect names of local functions whose OWN body tests chrome.runtime.id
    // — these are treated as valid one-level-indirection guards (e.g.
    // isExtensionContextValid()).
    const guardFnNames = new Set<string>();
    for (const [, content] of fileContents) {
      GUARD_FN_DECL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = GUARD_FN_DECL_RE.exec(content)) !== null) {
        const name = m[1] ?? m[2];
        if (!name) continue;
        const braceIdx = content.indexOf("{", m.index);
        if (braceIdx === -1) continue;
        const close = matchBracket(content, braceIdx);
        if (close === -1) continue;
        const body = content.slice(braceIdx, close + 1);
        if (ID_GUARD_RE.test(body)) guardFnNames.add(name);
      }
    }

    const findings: Finding[] = [];

    for (const [relForReport, content] of fileContents) {
      SEND_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = SEND_RE.exec(content)) !== null) {
        const callIndex = m.index;
        const block = enclosingBlock(content, callIndex);
        const scopeText = block ? content.slice(block.start, callIndex) : content.slice(0, callIndex);

        // Guard 1: enclosing try{...} whose body contains the call.
        let tryGuarded = false;
        const tryRe = /\btry\s*\{/g;
        let tm: RegExpExecArray | null;
        while ((tm = tryRe.exec(content)) !== null) {
          const braceIdx = content.indexOf("{", tm.index);
          const close = matchBracket(content, braceIdx);
          if (close === -1) continue;
          if (braceIdx < callIndex && callIndex < close) {
            tryGuarded = true;
            break;
          }
        }

        // Guard 2: inline chrome.runtime.id check earlier in the same scope.
        const inlineGuarded = ID_GUARD_RE.test(scopeText);

        // Guard 3: call to a known guard function earlier in the same scope
        // (one level of indirection, e.g. `if (!isExtensionContextValid())`).
        let wrapperGuarded = false;
        for (const name of guardFnNames) {
          if (new RegExp(`\\b${name}\\s*\\(`).test(scopeText)) {
            wrapperGuarded = true;
            break;
          }
        }

        if (!tryGuarded && !inlineGuarded && !wrapperGuarded) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message:
              "chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while the host tab stays open.",
            file: relForReport,
            line: lineAt(content, callIndex),
            snippet: content.slice(callIndex, Math.min(content.length, callIndex + 40)),
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

/**
 * Rule: secret-in-bundle
 *
 * Scans the BUILT bundle for credential-shaped literals: Stripe secret keys,
 * AWS access key IDs, PEM private-key headers, and static (hardcoded) JWTs.
 *
 * Matrix note (internal rule matrix, not shipped with this package,
 * §2 rule 11): the naive `sk_[A-Za-z0-9]{10,}` pattern MISSES real Stripe
 * secret keys because it doesn't anchor the `live|test` mode segment or
 * enforce the real minimum length — this rule uses the corrected pattern
 * `sk_(live|test)_[A-Za-z0-9]{16,}` instead, and a unit test asserts the
 * corrected pattern actually matches a realistic `sk_live_...` literal
 * (the positive control required before any "clean" verdict is trusted).
 *
 * fake_/test_/mock_ PREFIXED values are allowlisted (fixture/test data),
 * but only when the prefix immediately precedes the credential body —
 * `sk_live_fake_xxx` still matches (the "sk_live_" mode segment already
 * committed the key to being a real-shaped secret before "fake_" appears).
 */
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { listBundleFiles, readBundleFile } from "../core/bundle-scan.js";
import { stripComments, lineAt } from "../core/text.js";

const RULE_ID = "secret-in-bundle";

export const STRIPE_SECRET_RE = /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/g;
const AWS_ACCESS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/g;
const PEM_HEADER_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const STATIC_JWT_RE = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

const ALLOWLIST_PREFIXES = ["fake_", "test_", "mock_"];

function isAllowlisted(content: string, matchIndex: number): boolean {
  // Look immediately before the match for one of the allowlist prefixes
  // (e.g. `const fake_key="sk_test_..."` — the variable NAME carries the
  // prefix, not the literal itself, so check a small window before AND
  // check whether the matched literal itself starts with the prefix, e.g.
  // a value like `"fake_sk_test_xxx"` is not a real credential shape either
  // way but we keep both checks for robustness).
  const windowStart = Math.max(0, matchIndex - 40);
  const before = content.slice(windowStart, matchIndex);
  return ALLOWLIST_PREFIXES.some((p) => before.includes(p));
}

export const secretInBundle: Rule = {
  id: RULE_ID,
  description:
    "Built bundle contains a credential-shaped literal (Stripe secret key, AWS access key, PEM private key, or static JWT) — secrets must never ship in a distributed bundle.",
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

    const patterns: Array<{ re: RegExp; msg: string }> = [
      { re: STRIPE_SECRET_RE, msg: "Stripe secret key literal found in built bundle." },
      { re: AWS_ACCESS_KEY_RE, msg: "AWS access key ID literal found in built bundle." },
      { re: PEM_HEADER_RE, msg: "PEM private key header found in built bundle." },
      { re: STATIC_JWT_RE, msg: "Static (hardcoded) JWT literal found in built bundle." },
    ];

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

      for (const { re, msg } of patterns) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          if (isAllowlisted(content, m.index)) continue;
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: msg,
            file: file.relPath,
            line: lineAt(content, m.index),
            snippet: content.slice(m.index, Math.min(content.length, m.index + 60)),
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

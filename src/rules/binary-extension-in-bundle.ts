/**
 * Rule: binary-extension-in-bundle
 *
 * Flags unexpected binary/executable extensions shipped inside the packaged
 * bundle (.exe, .dll, .so, .dylib, .sh, .bat, .app, .dmg, .msi, .bin, .msix,
 * .apk). A browser extension bundle never legitimately ships a native
 * executable — its presence is either an accidental inclusion or a
 * deliberate attempt to smuggle code past store review.
 */
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";

const RULE_ID = "binary-extension-in-bundle";

/**
 * OUR own deny-list, not a list published or maintained by any browser
 * store — no store enumerates "the" set of forbidden binary extensions
 * this was read from. Exported so a consumer can extend or replace it for
 * their own bundle profile.
 */
export const BANNED_BINARY_EXTENSIONS = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sh",
  ".bat",
  ".cmd",
  ".app",
  ".dmg",
  ".msi",
  ".msix",
  ".bin",
  ".apk",
  ".deb",
  ".rpm",
];

function extOf(relPath: string): string {
  const name = relPath.slice(relPath.lastIndexOf("/") + 1);
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

export const binaryExtensionInBundle: Rule = {
  id: RULE_ID,
  description:
    "The built bundle contains a file with a native executable/binary extension (.exe, .dll, .so, .sh, ...) — a browser extension never legitimately ships one.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir);
    const findings: Finding[] = [];
    const banned = new Set(BANNED_BINARY_EXTENSIONS);

    for (const relPath of relPaths) {
      const ext = extOf(relPath);
      if (banned.has(ext)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${relPath} carries a native binary/executable extension (${ext}), which must never ship inside an extension bundle.`,
          file: relPath,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

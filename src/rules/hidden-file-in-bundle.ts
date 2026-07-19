/**
 * Rule: hidden-file-in-bundle
 *
 * Flags dotfiles (basename starting with ".") shipped inside the packaged
 * bundle — editor/OS artifacts (.DS_Store, .env, .vscode/settings.json)
 * leaking into a distributed extension. This is a broad, name-shape-only
 * check; the narrower store/OS *reserved name* list (thumbs.db, leading
 * underscore, Windows device names, the specific .DS_Store class) is the
 * separate concern of reserved-filename-in-bundle — the two overlap on
 * .DS_Store by design, each for its own reason.
 */
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";

const RULE_ID = "hidden-file-in-bundle";

function basename(relPath: string): string {
  const idx = relPath.lastIndexOf("/");
  return idx === -1 ? relPath : relPath.slice(idx + 1);
}

export const hiddenFileInBundle: Rule = {
  id: RULE_ID,
  description:
    "A dotfile (editor/OS artifact such as .DS_Store, .env, or .git*) is present inside the built bundle — it should never ship in the distributed extension.",
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir);
    const findings: Finding[] = [];

    for (const relPath of relPaths) {
      const name = basename(relPath);
      if (name.startsWith(".") && name !== "." && name !== "..") {
        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `${relPath} is a hidden dotfile shipped inside the built bundle.`,
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

/**
 * Rule: bundle-file-size-cap
 *
 * Flags any single file inside the built bundle whose size exceeds
 * SIZE_CAP_BYTES. A single oversized file (an accidentally bundled source
 * map, an unminified vendor blob, a debug asset) inflates the packaged
 * extension and is a common review-rejection cause on every store.
 *
 * Uses requireFreshBuild() like every other bundle-scanning rule in this
 * pack — no built bundle means no measurement, and the rule reports
 * inconclusive rather than silently passing.
 */
import { statSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";

const RULE_ID = "bundle-file-size-cap";

/**
 * 4 MiB. This is OUR chosen default, not a limit derived from any store
 * policy — no browser store publishes a documented per-file size cap this
 * value was read from. Exported so a consumer can override it for their
 * own bundle profile.
 */
export const SIZE_CAP_BYTES = 4 * 1024 * 1024;

export const bundleFileSizeCap: Rule = {
  id: RULE_ID,
  description: `A single file in the built bundle exceeds the ${SIZE_CAP_BYTES} byte size cap — likely an accidentally bundled source map, unminified vendor blob, or debug asset.`,
  severity: "warning",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir);
    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    for (const relPath of relPaths) {
      const absPath = join(build.buildDir, relPath);
      let size: number;
      try {
        size = statSync(absPath).size;
      } catch (err) {
        inconclusive.push({ ruleId: RULE_ID, reason: `could not stat bundle file: ${String(err)}`, file: relPath });
        continue;
      }
      if (size > SIZE_CAP_BYTES) {
        findings.push({
          ruleId: RULE_ID,
          severity: "warning",
          message: `${relPath} is ${size} bytes, exceeding the ${SIZE_CAP_BYTES} byte cap.`,
          file: relPath,
        });
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

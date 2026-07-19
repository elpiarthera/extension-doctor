/**
 * Rule: reserved-filename-in-bundle
 *
 * Flags filenames reserved by browser stores or by the host OS, shipped
 * inside the built bundle:
 *   - a basename starting with "_" (Chrome Web Store reserves the leading
 *     underscore namespace for its own metadata), EXCEPT the well-known
 *     "_locales" directory component, which is a required, store-legitimate
 *     name for i18n message trees.
 *   - Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9),
 *     case-insensitive, with or without an extension — these fail to
 *     extract or open on Windows.
 *   - "thumbs.db" and ".DS_Store" (case-insensitive), OS-generated cache
 *     files that should never be part of a distributed bundle.
 */
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { requireFreshBuild } from "../core/build-precondition.js";
import { walk } from "../core/walk.js";

const RULE_ID = "reserved-filename-in-bundle";

const WINDOWS_DEVICE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const EXACT_RESERVED_NAMES = new Set(["thumbs.db", ".ds_store"]);

function pathParts(relPath: string): string[] {
  return relPath.split("/");
}

function stemWithoutExtension(basename: string): string {
  const idx = basename.lastIndexOf(".");
  return idx <= 0 ? basename : basename.slice(0, idx);
}

function reservedReason(relPath: string): string | null {
  const parts = pathParts(relPath);
  const basename = parts[parts.length - 1] ?? relPath;
  const lower = basename.toLowerCase();

  if (EXACT_RESERVED_NAMES.has(lower)) {
    return `"${basename}" is an OS-generated cache file reserved by the operating system.`;
  }

  if (WINDOWS_DEVICE_NAMES.has(stemWithoutExtension(lower))) {
    return `"${basename}" collides with a reserved Windows device name and will fail to extract or open on Windows.`;
  }

  for (const part of parts) {
    if (part === "_locales") continue;
    if (part.startsWith("_")) {
      return `"${relPath}" starts with "_", a namespace reserved by the browser store for its own metadata.`;
    }
  }

  return null;
}

export const reservedFilenameInBundle: Rule = {
  id: RULE_ID,
  description:
    'A file or directory in the built bundle collides with a name reserved by the browser store or the host OS (leading "_" outside "_locales", Windows device names, thumbs.db, .DS_Store).',
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const build = requireFreshBuild(extensionRoot);
    if (!build.ok) {
      const reason: InconclusiveReason = { ruleId: RULE_ID, reason: build.reason };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const relPaths = walk(build.buildDir);
    const findings: Finding[] = [];

    for (const relPath of relPaths) {
      const reason = reservedReason(relPath);
      if (reason !== null) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: reason,
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

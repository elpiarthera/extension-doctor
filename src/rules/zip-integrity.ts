/**
 * Rule: zip-integrity
 *
 * If a `.zip` is present at the audited root, parses its central directory
 * (minimal inline reader, zero heavy dependency) and flags duplicate or
 * unreadable entries. If no `.zip` is present at root, the rule cannot run
 * and returns INCONCLUSIVE (never a silent pass) — the rule pack never
 * assumes an un-audited artifact is clean.
 *
 * Spec: docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md
 *   §1.1 row `zip-integrity`, §2 item 16 — same defect class as our own
 *   release zip incident referenced by commit `5d8b775`.
 * Source d'inspiration (idea only, zero line copied): addons-linter
 * `DUPLICATE_XPI_ENTRY` / `INVALID_XPI_ENTRY` / `BAD_ZIPFILE` (MPL-2.0,
 * confirmed `addError` src/linter.js:118,126).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists } from "../core/walk.js";

const RULE_ID = "zip-integrity";

const EOCD_SIG = 0x06054b50;
const CENTRAL_DIR_SIG = 0x02014b50;

interface ParsedEntry {
  name: string;
}

/** Returns entry names read from the ZIP central directory, or a string error. */
function parseCentralDirectory(buf: Buffer): ParsedEntry[] | string {
  // Locate End Of Central Directory record by scanning backward for its
  // signature (handles an optional trailing comment of arbitrary length).
  const maxCommentScan = Math.min(buf.length, 65557);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= buf.length - maxCommentScan && i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return "no End Of Central Directory record found — not a valid ZIP file";

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries: ParsedEntry[] = [];
  let cursor = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > buf.length) return `central directory truncated while reading entry ${i + 1}/${totalEntries}`;
    const sig = buf.readUInt32LE(cursor);
    if (sig !== CENTRAL_DIR_SIG) return `invalid central directory entry signature at offset ${cursor}`;
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buf.length) return `central directory entry ${i + 1}/${totalEntries} name field truncated`;
    const name = buf.subarray(nameStart, nameEnd).toString("utf8");
    entries.push({ name });
    cursor = nameEnd + extraLen + commentLen;
  }
  return entries;
}

export const zipIntegrity: Rule = {
  id: RULE_ID,
  description:
    "A .zip present at the audited root has duplicate or unreadable central-directory entries — corrupt or double-packaged archive.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    if (!dirExists(extensionRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `extension root ${extensionRoot} does not exist — cannot look for a .zip to check`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    let entries: string[];
    try {
      entries = readdirSync(extensionRoot);
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `cannot list ${extensionRoot} — cannot look for a .zip to check`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const zipName = entries.find((e) => {
      if (!e.toLowerCase().endsWith(".zip")) return false;
      try {
        return statSync(join(extensionRoot, e)).isFile();
      } catch {
        return false;
      }
    });

    if (zipName === undefined) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: "no .zip at root, cannot check archive integrity",
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const zipPath = join(extensionRoot, zipName);
    let buf: Buffer;
    try {
      buf = readFileSync(zipPath);
    } catch {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `cannot read ${zipName} — cannot check archive integrity`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const parsed = parseCentralDirectory(buf);
    if (typeof parsed === "string") {
      const finding: Finding = {
        ruleId: RULE_ID,
        severity: "error",
        message: `${zipName} is not a valid ZIP archive: ${parsed}`,
        file: zipName,
      };
      return { ruleId: RULE_ID, verdict: "fail", findings: [finding], inconclusive: [], exitCode: 1 };
    }

    const seen = new Map<string, number>();
    for (const entry of parsed) {
      seen.set(entry.name, (seen.get(entry.name) ?? 0) + 1);
    }
    const findings: Finding[] = [];
    for (const [name, count] of seen) {
      if (count > 1) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `duplicate ZIP entry "${name}" appears ${count} times in the central directory — corrupt or double-packaged archive.`,
          file: zipName,
        });
      }
    }

    if (findings.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive: [], exitCode: 1 };
  },
};

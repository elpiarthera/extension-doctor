/**
 * Rule: i18n-locale-json-validity
 *
 * Validates the syntactic/naming correctness of _locales/*\/messages.json
 * files — reserved `@@` names, a placeholder referenced from `message` but
 * absent from `placeholders`, an invalid placeholder/message key shape,
 * and empty/missing message content.
 *
 * This is DISTINCT from i18n-key-coverage-gap: that rule validates
 * code↔locale coverage (a t('x') call with no matching key). This rule
 * validates the internal syntax of the locale files themselves, regardless
 * of whether any code consumes the key. Kept separate deliberately despite
 * the shared i18n domain.
 *
 * Inspired by (idea only, zero line copied) the addons-linter (MPL-2.0)
 * family NO_MESSAGE / PREDEFINED_MESSAGE_NAME / INVALID_MESSAGE_NAME /
 * MISSING_PLACEHOLDER / INVALID_PLACEHOLDER_NAME / NO_PLACEHOLDER_CONTENT.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rule, RuleResult, Finding, InconclusiveReason } from "../core/types.js";
import { dirExists, fileExists, walk } from "../core/walk.js";

const RULE_ID = "i18n-locale-json-validity";
const LOCALES_DIR = "_locales";

// $NAME$ tokens referenced from a message string.
const PLACEHOLDER_REF_RE = /\$([a-zA-Z0-9_@]+)\$/g;
// Reserved key prefix per chrome.i18n contract (@@extension_id etc are
// runtime-substituted, never author-defined message keys).
const RESERVED_PREFIX = "@@";
// Message/placeholder key naming: letters, digits, underscore, must not
// start with a digit.
const VALID_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface MessageEntry {
  message?: unknown;
  description?: unknown;
  placeholders?: Record<string, unknown>;
}

export const i18nLocaleJsonValidity: Rule = {
  id: RULE_ID,
  description:
    "A _locales/*/messages.json file with invalid JSON syntax, a reserved @@ key, an undefined placeholder reference, an invalid message/placeholder name, or empty message content.",
  severity: "error",
  async run(extensionRoot: string): Promise<RuleResult> {
    const localesRoot = join(extensionRoot, LOCALES_DIR);

    if (!dirExists(localesRoot)) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${LOCALES_DIR}/ directory not found under extension root — cannot validate locale JSON`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const messagesFiles = walk(localesRoot, { extensions: [".json"] }).filter((rel) =>
      rel.endsWith("messages.json"),
    );

    if (messagesFiles.length === 0) {
      const reason: InconclusiveReason = {
        ruleId: RULE_ID,
        reason: `${LOCALES_DIR}/ directory exists but contains no <lang>/messages.json file — cannot validate locale JSON`,
      };
      return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive: [reason], exitCode: 2 };
    }

    const findings: Finding[] = [];
    const inconclusive: InconclusiveReason[] = [];

    for (const rel of messagesFiles) {
      const abs = join(localesRoot, rel);
      const relForReport = join(LOCALES_DIR, rel);

      if (!fileExists(abs)) continue;

      let raw: string;
      try {
        raw = readFileSync(abs, "utf8");
      } catch {
        inconclusive.push({
          ruleId: RULE_ID,
          reason: `${relForReport} could not be read — cannot validate`,
          file: relForReport,
        });
        continue;
      }

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (err) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${relForReport} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          file: relForReport,
        });
        continue;
      }

      if (typeof json !== "object" || json === null || Array.isArray(json)) {
        findings.push({
          ruleId: RULE_ID,
          severity: "error",
          message: `${relForReport} top-level value must be a JSON object of message keys`,
          file: relForReport,
        });
        continue;
      }

      for (const [key, entryRaw] of Object.entries(json as Record<string, unknown>)) {
        if (key.startsWith(RESERVED_PREFIX)) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${relForReport}: message key "${key}" uses reserved "@@" prefix, which is runtime-substituted and never author-definable`,
            file: relForReport,
          });
          continue;
        }

        if (!VALID_NAME_RE.test(key)) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${relForReport}: message key "${key}" is not a valid i18n message name (must match [A-Za-z_][A-Za-z0-9_]*)`,
            file: relForReport,
          });
          continue;
        }

        if (typeof entryRaw !== "object" || entryRaw === null) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${relForReport}: message key "${key}" must map to an object with a "message" field`,
            file: relForReport,
          });
          continue;
        }

        const entry = entryRaw as MessageEntry;

        if (typeof entry.message !== "string" || entry.message.trim().length === 0) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${relForReport}: message key "${key}" has missing or empty "message" content`,
            file: relForReport,
          });
          continue;
        }

        const placeholders = entry.placeholders ?? {};
        if (typeof placeholders !== "object" || placeholders === null || Array.isArray(placeholders)) {
          findings.push({
            ruleId: RULE_ID,
            severity: "error",
            message: `${relForReport}: message key "${key}" has a "placeholders" field that is not an object`,
            file: relForReport,
          });
          continue;
        }

        for (const phName of Object.keys(placeholders)) {
          if (!VALID_NAME_RE.test(phName)) {
            findings.push({
              ruleId: RULE_ID,
              severity: "error",
              message: `${relForReport}: message key "${key}" declares invalid placeholder name "${phName}"`,
              file: relForReport,
            });
          }
          const phEntry = (placeholders as Record<string, unknown>)[phName];
          if (
            typeof phEntry !== "object" ||
            phEntry === null ||
            typeof (phEntry as { content?: unknown }).content !== "string" ||
            (phEntry as { content: string }).content.trim().length === 0
          ) {
            findings.push({
              ruleId: RULE_ID,
              severity: "error",
              message: `${relForReport}: message key "${key}" placeholder "${phName}" has no non-empty "content" field`,
              file: relForReport,
            });
          }
        }

        // Referenced-but-undefined placeholder ($SCORE$ used in message but
        // never declared in placeholders{}).
        PLACEHOLDER_REF_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = PLACEHOLDER_REF_RE.exec(entry.message)) !== null) {
          const ref = m[1];
          if (ref === undefined) continue;
          // "$1" positional numeric refs (content field convention) are not
          // placeholder-name references — only bare $NAME$ (non-numeric).
          if (/^\d+$/.test(ref)) continue;
          const refLower = ref.toLowerCase();
          const declaredLower = new Set(Object.keys(placeholders).map((k) => k.toLowerCase()));
          if (!declaredLower.has(refLower)) {
            findings.push({
              ruleId: RULE_ID,
              severity: "error",
              message: `${relForReport}: message key "${key}" references placeholder "$${ref}$" not defined in "placeholders"`,
              file: relForReport,
            });
          }
        }
      }
    }

    if (findings.length === 0 && inconclusive.length === 0) {
      return { ruleId: RULE_ID, verdict: "pass", findings: [], inconclusive: [], exitCode: 0 };
    }
    if (findings.length > 0) {
      return { ruleId: RULE_ID, verdict: "fail", findings, inconclusive, exitCode: 1 };
    }
    return { ruleId: RULE_ID, verdict: "inconclusive", findings: [], inconclusive, exitCode: 2 };
  },
};

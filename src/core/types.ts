/**
 * Core types shared by every rule and by the CLI serializer.
 *
 * Verdict vocabulary is intentionally three-valued (never a silent binary):
 *   - "pass"         : rule ran, found nothing to report
 *   - "fail"         : rule ran, found a real defect (severity carries error|warning)
 *   - "inconclusive" : rule COULD NOT determine the answer (missing precondition,
 *                      unresolvable dynamic value, etc.) — this is loud, never silent.
 *
 * Design principle: a rule that cannot determine an answer must fail
 * loudly (inconclusive), never resolve silently to an empty pass/fail
 * result that masks the fact nothing was actually checked.
 */

export type Severity = "error" | "warning";

export interface Finding {
  ruleId: string;
  severity: Severity;
  /** Human-readable one-line summary. */
  message: string;
  /** File path relative to the audited extension root, if applicable. */
  file?: string;
  line?: number;
  /** Verbatim snippet backing the finding, when available. */
  snippet?: string;
}

export interface InconclusiveReason {
  ruleId: string;
  /** MUST name precisely what could not be read — never a generic "internal error". */
  reason: string;
  file?: string;
  line?: number;
}

export type RuleVerdict = "pass" | "fail" | "inconclusive";

export interface RuleResult {
  ruleId: string;
  verdict: RuleVerdict;
  findings: Finding[];
  inconclusive: InconclusiveReason[];
  /** Exit-code contribution: 0 = nothing found, 1 = defects found, 2 = could not measure. */
  exitCode: 0 | 1 | 2;
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  run(extensionRoot: string): Promise<RuleResult>;
}

/**
 * Provenance object — structurally inseparable from any scored output.
 * Spec ref: "§Provenance de la mesure" — a score without `command` in the
 * SAME JSON object is malformed by construction, never a valid shape.
 */
export interface ProvenanceEnvelope {
  command: string;
  scope: {
    filesScanned: number;
    rulesActive: number;
    rulesRequested: number;
  };
  score: number;
  findings: Finding[];
  inconclusive: InconclusiveReason[];
  perRule: Record<string, { verdict: RuleVerdict; exitCode: number }>;
}

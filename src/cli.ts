#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveRules, ALL_RULES } from "./rules/index.js";
import { runRules } from "./core/run.js";
import type { ProvenanceEnvelope } from "./core/types.js";

const USAGE = `extension-doctor <path-to-extension> [--rules id1,id2,...] [--format human|json]

  <path-to-extension>   Directory to scan (default: .)
  --rules id1,id2,...   Restrict the scan to a comma-separated rule id list
  --format human|json   Output format (default: human)
  --json                Shorthand for --format json
  -h, --help            Show this help and exit
  -v, --version         Show the installed version and exit

Exit codes: 0 nothing found, 1 defects found, 2 could not measure.`;

// Version is DERIVED from package.json at read time, never retyped by hand.
function readPackageVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.join(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

function parseArgs(argv: string[]): {
  extensionPath: string;
  rules: string[] | null;
  format: "human" | "json";
  help: boolean;
  version: boolean;
} {
  const positional: string[] = [];
  let rules: string[] | null = null;
  let format: "human" | "json" = "human";
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--version" || arg === "-v") {
      version = true;
    } else if (arg === "--rules") {
      const next = argv[++i];
      rules = next ? next.split(",").map((s) => s.trim()) : [];
    } else if (arg === "--format") {
      const next = argv[++i];
      format = next === "json" ? "json" : "human";
    } else if (arg === "--json") {
      format = "json";
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  return { extensionPath: positional[0] ?? ".", rules, format, help, version };
}

function renderHuman(envelope: ProvenanceEnvelope): string {
  const lines: string[] = [];
  lines.push(`extension-doctor — command: ${envelope.command}`);
  lines.push(
    `scope: ${envelope.scope.filesScanned} files scanned, rules ${envelope.scope.rulesActive}/${envelope.scope.rulesRequested} active`,
  );
  lines.push(`score: ${envelope.score}/100`);
  lines.push("");

  for (const [ruleId, r] of Object.entries(envelope.perRule)) {
    lines.push(`[${r.verdict.toUpperCase()}] ${ruleId} (exit ${r.exitCode})`);
  }
  lines.push("");

  if (envelope.findings.length > 0) {
    lines.push("Findings:");
    for (const f of envelope.findings) {
      const loc = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : "(no location)";
      lines.push(`  [${f.severity}] ${f.ruleId} — ${loc}`);
      lines.push(`    ${f.message}`);
      if (f.snippet) lines.push(`    > ${f.snippet.trim()}`);
    }
    lines.push("");
  }

  if (envelope.inconclusive.length > 0) {
    lines.push("Inconclusive:");
    for (const i of envelope.inconclusive) {
      const loc = i.file ? `${i.file}${i.line ? ":" + i.line : ""}` : "(no location)";
      lines.push(`  ${i.ruleId} — ${loc} — ${i.reason}`);
    }
  }

  return lines.join("\n");
}

export async function main(argv: string[]): Promise<number> {
  const { extensionPath, rules: requested, format, help, version } = parseArgs(argv);

  if (help) {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  if (version) {
    process.stdout.write(readPackageVersion() + "\n");
    return 0;
  }

  const { active, unknown } = resolveRules(requested);

  if (unknown.length > 0) {
    process.stderr.write(`extension-doctor: unknown rule id(s): ${unknown.join(", ")}\n`);
    process.stderr.write(`known rules: ${ALL_RULES.map((r) => r.id).join(", ")}\n`);
    return 2;
  }

  // command is DERIVED from process.argv, never retyped by hand.
  const command = ["extension-doctor", ...argv].join(" ");

  const { envelope, exitCode } = await runRules({
    extensionRoot: extensionPath,
    rules: active,
    rulesRequested: requested === null ? ALL_RULES.length : requested.length,
    command,
  });

  if (format === "json") {
    process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
  } else {
    process.stdout.write(renderHuman(envelope) + "\n");
  }

  return exitCode;
}

// Only auto-run when THIS module is the one Node was invoked on directly
// (e.g. `node dist/cli.js`), never when imported by bin/extension-doctor.js
// or by tests — those callers own the single main() invocation themselves.
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

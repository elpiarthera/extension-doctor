#!/usr/bin/env node
// Throwaway generator: derives the README rules table from ALL_RULES so the
// table can never hand-drift from the actual registered rule set.
// Requires `npm run build` first (imports the compiled dist/ output).
import { ALL_RULES } from "../dist/rules/index.js";

console.log(`## Rules (${ALL_RULES.length})`);
console.log("");
console.log("| id | detects | severity |");
console.log("|---|---|---|");
for (const rule of [...ALL_RULES].sort((a, b) => a.id.localeCompare(b.id))) {
  const detects = rule.description.replace(/\|/g, "\\|");
  console.log(`| \`${rule.id}\` | ${detects} | ${rule.severity} |`);
}

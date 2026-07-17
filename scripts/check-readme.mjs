#!/usr/bin/env node
// Mechanical verification of README.md publication-readiness.
// Every failing check names exactly what is missing — no silent booleans.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readme = readFileSync(path.join(root, "README.md"), "utf8");
const notice = readFileSync(path.join(root, "NOTICE"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

// 1. WHAT — the opening (title + first descriptive line) describes an extension linter
const nonEmptyLines = readme.split("\n").filter((l) => l.trim().length > 0);
const opening = nonEmptyLines.slice(0, 2).join(" ");
check(
  "WHAT: opening (title + first line) describes a browser extension linter",
  /extension/i.test(opening) && /(linter|lint|health|audit)/i.test(opening),
  `opening was: "${opening}"`,
);

// 2. WHY — cites at least 2 of the 3 real file:line paths
const realPaths = [
  "conversations-handler.ts:66",
  "media-handler.ts:135",
  "projects-handler.ts:67",
];
const citedPaths = realPaths.filter((p) => readme.includes(p));
check(
  "WHY: cites >= 2 of the 3 real incident file:line paths",
  citedPaths.length >= 2,
  `found ${citedPaths.length}/3: [${citedPaths.join(", ")}] — missing: [${realPaths.filter((p) => !citedPaths.includes(p)).join(", ")}]`,
);

// 3. HOW — install command present
check(
  "HOW: install/run command present (npx extension-doctor or npm i -D extension-doctor)",
  /npx extension-doctor/.test(readme) || /npm i(nstall)? -D extension-doctor/.test(readme),
  "no `npx extension-doctor` or `npm i -D extension-doctor` string found",
);

// 4. Example output — both a FAIL and a PASS shown verbatim for net-broadcast-unfiltered
check(
  "OUTPUT: shows both [FAIL] and [PASS] for net-broadcast-unfiltered",
  readme.includes("[FAIL] net-broadcast-unfiltered") && readme.includes("[PASS] net-broadcast-unfiltered"),
  `has [FAIL]: ${readme.includes("[FAIL] net-broadcast-unfiltered")}, has [PASS]: ${readme.includes("[PASS] net-broadcast-unfiltered")}`,
);

// 5. Exit codes documented, and 2 != 0 stated
const hasExit0 = /`0`.*nothing found/i.test(readme) || /`0`\s*—\s*nothing found/i.test(readme);
const hasExit1 = /`1`.*(defect|found)/i.test(readme);
const hasExit2 = /`2`.*(inconclusive|could not measure|not conclusive)/i.test(readme);
const hasNeverEqual = /2.{0,20}(≠|!=|never).{0,40}0|never.{0,40}treat.{0,40}(exit )?`?2`?.{0,40}(as|like).{0,40}`?0`?/i.test(readme);
check(
  "EXIT CODES: 0/1/2 documented and 2 != 0 stated explicitly",
  hasExit0 && hasExit1 && hasExit2 && hasNeverEqual,
  `exit0=${hasExit0} exit1=${hasExit1} exit2=${hasExit2} neverEqual=${hasNeverEqual}`,
);

// 6. package.json keywords >= 12
const kwCount = Array.isArray(pkg.keywords) ? pkg.keywords.length : 0;
check(
  "KEYWORDS: package.json.keywords has >= 12 entries",
  kwCount >= 12,
  `found ${kwCount}: [${(pkg.keywords ?? []).join(", ")}]`,
);

// 7. >= 5 keywords appear in README body
const domainKeywords = [
  "browser extension",
  "chrome extension",
  "manifest v3",
  "mv3",
  "extension linter",
  "extension audit",
  "chrome web store",
  "web store review",
  "firefox add-on",
  "static analysis",
  "i18n",
  "permissions",
  "service worker",
  "content script",
  "doctor",
  "cli",
];
const readmeLower = readme.toLowerCase();
const presentKeywords = domainKeywords.filter((k) => readmeLower.includes(k.toLowerCase()));
check(
  "KEYWORDS: >= 5 domain keywords present in README body",
  presentKeywords.length >= 5,
  `found ${presentKeywords.length}: [${presentKeywords.join(", ")}]`,
);

// 8. Prior art formula present
check(
  "PRIOR ART: exact formula 'studied as prior art, no code derived' present",
  readme.includes("studied as prior art, no code derived"),
  "exact string 'studied as prior art, no code derived' not found in README",
);

// 9. Zero "wesbos", zero "ElPi" in public copy (README + NOTICE)
const wesbosHits = (readme + notice).toLowerCase().split("wesbos").length - 1;
const elpiHits = (readme.match(/elpi(?!arthera)/gi) ?? []).length + (notice.match(/elpi(?!arthera)/gi) ?? []).length;
check(
  "BRAND: zero 'wesbos' occurrences in README + NOTICE",
  wesbosHits === 0,
  `found ${wesbosHits} occurrence(s) of 'wesbos'`,
);
check(
  "BRAND: zero 'ElPi' (outside 'elpiarthera' org slug) in README + NOTICE",
  elpiHits === 0,
  `found ${elpiHits} occurrence(s) of 'ElPi' outside the 'elpiarthera' GitHub org slug`,
);

// 10. Honest scope — "3 of 5 rules" (or equivalent) stated
check(
  "SCOPE: '3 of 5 rules' (or equivalent) stated",
  /3 of 5 rules/i.test(readme) || (/3\/5/.test(readme) && /rules/i.test(readme)),
  "no '3 of 5 rules' (or '3/5 ... rules') phrasing found",
);

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} — ${c.name}${c.pass ? "" : `\n       missing: ${c.detail}`}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);

if (failed.length > 0) {
  process.exit(1);
}

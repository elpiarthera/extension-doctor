#!/usr/bin/env node
/**
 * foreign-bite-probe — proves 8 sampled rules bite on FOREIGN material:
 * real files from a third-party extension (mem0-chrome-extension, MIT,
 * pinned commit — see FOREIGN_PROVENANCE below) that were never chosen as
 * any rule's own fixture.
 *
 * The foreign material is FETCHED AT RUNTIME from the upstream repo, pinned
 * to a single immutable commit SHA — never `main`/`HEAD`/`latest`. This repo
 * does not vendor another project's source: hosting a third-party's files
 * inside this tree without shipping its LICENSE + a NOTICE entry is exactly
 * the class of defect this probe exists to catch in OTHER extensions, so it
 * may not commit that defect itself.
 *
 * For each sampled rule this script:
 *   0. fetches the 5 pinned foreign files into a fresh OS tmpdir, verifying
 *      each against a committed SHA-256 (FOREIGN_FILES below). Any network
 *      failure, non-200 response, or hash mismatch is a LOUD, named,
 *      non-zero-exit failure — never a silent skip or a "pass because there
 *      was nothing to check" (derive-never-type.md / measurement-integrity.md:
 *      an unavailable network is never read as good news).
 *   1. copies the pristine fetched foreign file(s) into a second fresh OS
 *      tmpdir
 *   2. injects ONE violation in a VARIANT surface form (never the literal
 *      string any rule's existing fixture/test carries)
 *   3. greps the tmp copy to assert the injection LANDED before reading any
 *      verdict (derive-never-type.md: a mutation that didn't land proves
 *      nothing)
 *   4. runs the BUILT rule (dist/rules/*.js) against the tmp root, asserts
 *      verdict === "fail" and prints the finding's file:line
 *   5. runs the same rule against a second tmp root missing the rule's
 *      precondition, asserts verdict === "inconclusive" with a non-empty
 *      reason (the refusal pole)
 *   6. diffs the tmp copy's ORIGINAL (pre-injection) bytes against the
 *      freshly-fetched pristine foreign file, and re-verifies that fetched
 *      file's SHA-256 has not drifted since step 0, to prove the fetched
 *      original was never touched (restoration proof) — nothing under the
 *      fetch tmpdir is ever written to by the injection step.
 *
 * Exit code: 0 iff every rule passes all 4 poles (MUTATION-LANDED, RED,
 * INCONCLUSIVE, RESTORED). Any failure is loud (named), never silent.
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Foreign material provenance — this repo hosts ZERO bytes of this project.
// ---------------------------------------------------------------------------
//
// Source repo:    https://github.com/mem0ai/mem0-chrome-extension (MIT)
// Commit pinned:  54a882ab6f2534006431c5e6b5c5c597db2a0236 (2026-03-24)
// Copyright:      (c) 2024 Deshraj Yadav
// Relationship:   `scripts/foreign-bite-probe.mjs` fetches these 5 files at
//   runtime, verbatim, into a fresh OS tmpdir per run, as "material the rule
//   author did not choose as this rule's fixture" — per Eta's PR #1 REVISE
//   ("prove the rules read their fixtures, not the class"). None of these
//   files are, or were ever, a fixture for any rule's own unit test in this
//   repo (`tests/fixtures/**`, `tests/*.test.ts` inline strings).
// Immutability:   fetched via raw.githubusercontent.com pinned to the exact
//   commit SHA above (never a branch ref) and verified byte-for-byte against
//   the SHA-256 hashes below before any injection or rule run touches them.
//   A hash mismatch is a loud, named failure — the probe never silently
//   treats an unexpected upstream change as a pass or a skip.
// Read-only:      the fetched files are never edited to "fix" a probe — if a
//   probe fails against them, the rule (or the probe's injection), not the
//   foreign material, is what's wrong.
const FOREIGN_REPO = "mem0ai/mem0-chrome-extension";
const FOREIGN_COMMIT = "54a882ab6f2534006431c5e6b5c5c597db2a0236";
const FOREIGN_FILES = [
  { rel: "manifest.json", sha256: "0908bc6a7d39ef068175043da476cda62d4e371c312fddcae7df569a8c336af3" },
  { rel: "src/background.ts", sha256: "ce463763eaa3b5bf32ccb6c5c75c437eb8a20c1fde9c433bf7f795d45d7c8427" },
  { rel: "src/popup.ts", sha256: "cc3a231296c3ec6c3a191ffa0bceefea39b91a0303b1cbee81707b987fc19a37" },
  { rel: "src/sidebar.ts", sha256: "67e4da656ebba05fbfe394b99193604cb2dc7be638730590feaf84587acefd7b" },
  { rel: "src/selection_context.ts", sha256: "1944734761fd109f18b6e7cca5e47ff92daad40c4efdb35204f94ced4151aaf0" },
];

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Fetches the pinned foreign files into a fresh OS tmpdir, verifying each
 * against its committed SHA-256. Throws a named, loud error on ANY failure
 * (network error, non-200 status, hash mismatch). NEVER returns a partial
 * or empty result silently — an unfetchable file aborts the whole probe.
 *
 * Env override for the loud-fail demonstration: FOREIGN_BITE_PROBE_BAD_SHA=1
 * points the fetch at a deliberately wrong commit SHA so the mismatch/404
 * path can be exercised on demand without touching network conditions.
 */
async function fetchForeignMaterial() {
  const commit = process.env.FOREIGN_BITE_PROBE_BAD_SHA === "1" ? "0000000000000000000000000000000000dead" : FOREIGN_COMMIT;
  const dir = mkdtempSync(join(tmpdir(), "ed-fbp-foreign-fetch-"));
  const fetched = {};
  for (const { rel, sha256 } of FOREIGN_FILES) {
    const url = `https://raw.githubusercontent.com/${FOREIGN_REPO}/${commit}/${rel}`;
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error(
        `FOREIGN-FETCH-FAILED: could not read "${rel}" from ${url}: ${err.message} — refusing to proceed with a probe missing its foreign material (this is never treated as a pass).`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `FOREIGN-FETCH-FAILED: "${rel}" from ${url} returned HTTP ${res.status} ${res.statusText} — refusing to proceed with a probe missing its foreign material (this is never treated as a pass).`,
      );
    }
    const text = await res.text();
    const actualHash = sha256Hex(text);
    if (actualHash !== sha256) {
      throw new Error(
        `FOREIGN-HASH-MISMATCH: "${rel}" fetched from ${url} has sha256 ${actualHash}, expected ${sha256} — upstream content diverged from the pinned commit or was tampered with. Refusing to proceed (never treated as a pass or a silent skip).`,
      );
    }
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text, "utf8");
    fetched[rel] = dest;
    console.log(`  FOREIGN-FETCHED: ${rel} <- ${url} (sha256 ${actualHash.slice(0, 12)}… verified)`);
  }
  return { dir, fetched };
}

const { netBroadcastUnfiltered } = await import(join(REPO_ROOT, "dist/rules/net-broadcast-unfiltered.js"));
const { descriptionPermissionMismatch } = await import(join(REPO_ROOT, "dist/rules/description-permission-mismatch.js"));
const { cspNotWeakened } = await import(join(REPO_ROOT, "dist/rules/csp-not-weakened.js"));
const { swListenersToplevel } = await import(join(REPO_ROOT, "dist/rules/sw-listeners-toplevel.js"));
const { secretInBundle } = await import(join(REPO_ROOT, "dist/rules/secret-in-bundle.js"));
const { hostPermissionsWildcardBroad } = await import(join(REPO_ROOT, "dist/rules/host-permissions-wildcard-broad.js"));
const { i18nKeyCoverageGap } = await import(join(REPO_ROOT, "dist/rules/i18n-key-coverage-gap.js"));
const { unusedFileExport } = await import(join(REPO_ROOT, "dist/rules/unused-file-export.js"));

console.log(`=== fetching foreign material @ ${FOREIGN_COMMIT.slice(0, 8)} from ${FOREIGN_REPO} ===`);
let FOREIGN;
let FOREIGN_PATHS;
try {
  ({ dir: FOREIGN, fetched: FOREIGN_PATHS } = await fetchForeignMaterial());
} catch (err) {
  console.error(`\nforeign-bite-probe: ABORTED — could not obtain foreign material.\n${err.message}`);
  process.exit(1);
}
console.log(`=== all ${FOREIGN_FILES.length} foreign files fetched + hash-verified into ${FOREIGN} ===\n`);

let failures = 0;
const report = [];

function log(line) {
  console.log(line);
  report.push(line);
}

function freshTmp(prefix) {
  return mkdtempSync(join(tmpdir(), `ed-fbp-${prefix}-`));
}

function assertGrepLanded(file, needle, label) {
  const content = readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`MUTATION-DID-NOT-LAND: "${needle}" not found in ${file} (${label})`);
  }
  log(`  MUTATION-LANDED: "${needle.slice(0, 60)}${needle.length > 60 ? "…" : ""}" found in ${file}`);
}

function assertRestored(tmpFileOriginalCopy, foreignFetchedFile, expectedSha256, label) {
  const tmpBytes = readFileSync(tmpFileOriginalCopy, "utf8");
  const fetchedBytes = readFileSync(foreignFetchedFile, "utf8");
  if (tmpBytes !== fetchedBytes) {
    throw new Error(`RESTORE-MISMATCH: ${label} tmp pre-injection copy diverges from fetched foreign original`);
  }
  // Also prove the fetched original itself was never written to by the injection step.
  const actualHash = sha256Hex(fetchedBytes);
  if (actualHash !== expectedSha256) {
    throw new Error(
      `RESTORE-MISMATCH: fetched foreign file ${foreignFetchedFile} sha256 drifted to ${actualHash}, expected ${expectedSha256} — injection leaked into the fetch tmpdir`,
    );
  }
  log(`  RESTORED: ${foreignFetchedFile} byte-identical to pre-injection copy, sha256 unchanged (${actualHash.slice(0, 12)}…)`);
}

async function runRule(label, ruleModule, root) {
  const result = await ruleModule.run(root);
  return result;
}

async function probe(spec) {
  log(`\n=== ${spec.id} ===`);
  log(`  fixture-string (existing, NOT reused here): ${spec.fixtureString}`);
  log(`  foreign-file: ${spec.foreignFileRel} (source: mem0-chrome-extension @ 54a882a, MIT, fetched at runtime)`);
  log(`  injected-variant: ${spec.variantDescription}`);

  // --- RED pole: fresh copy of foreign material + injected variant ---
  const tmpFail = freshTmp(`${spec.id}-fail`);
  spec.setupFail(tmpFail);
  assertGrepLanded(spec.grepFile(tmpFail), spec.grepNeedle, spec.id);
  const failResult = await runRule(spec.id, spec.rule, tmpFail);
  if (failResult.verdict !== "fail") {
    throw new Error(`${spec.id}: expected verdict "fail" on foreign+variant material, got "${failResult.verdict}" (${JSON.stringify(failResult.inconclusive)})`);
  }
  const expectedFile = spec.expectedFindingFile;
  const finding = expectedFile
    ? failResult.findings.find((f) => f.file === expectedFile)
    : failResult.findings[0];
  if (!finding) {
    throw new Error(
      `${spec.id}: verdict fail but no finding named ${expectedFile ?? "(any)"} (got: ${failResult.findings.map((f) => f.file).join(", ")})`,
    );
  }
  log(`  RED(${finding.file}:${finding.line ?? "?"}): ${finding.message}`);

  // --- INCONCLUSIVE pole: precondition removed ---
  const tmpInc = freshTmp(`${spec.id}-inc`);
  spec.setupInconclusive(tmpInc);
  const incResult = await runRule(spec.id, spec.rule, tmpInc);
  if (incResult.verdict !== "inconclusive") {
    throw new Error(`${spec.id}: expected verdict "inconclusive" on missing-precondition tree, got "${incResult.verdict}"`);
  }
  const reason = incResult.inconclusive[0];
  if (!reason || reason.reason.length === 0) {
    throw new Error(`${spec.id}: inconclusive verdict but empty/missing reason`);
  }
  log(`  INCONCLUSIVE(${reason.reason})`);

  // --- RESTORED pole ---
  assertRestored(spec.preInjectionCopy(tmpFail), spec.foreignFetchedFile, spec.foreignFetchedSha256, spec.id);

  const preInjectionPath = spec.preInjectionCopy(tmpFail);
  if (!preInjectionPath.startsWith(tmpFail)) {
    rmSync(dirname(preInjectionPath), { recursive: true, force: true });
  }
  rmSync(tmpFail, { recursive: true, force: true });
  rmSync(tmpInc, { recursive: true, force: true });
  log(`  ${spec.id}: ALL POLES OK`);
}

// ---------------------------------------------------------------------------
// Rule specs
// ---------------------------------------------------------------------------

function copyForeignFile(rel, destAbs) {
  mkdirSync(dirname(destAbs), { recursive: true });
  cpSync(FOREIGN_PATHS[rel], destAbs);
  return readFileSync(destAbs, "utf8"); // return original bytes for pre-injection snapshot
}

function foreignEntry(rel) {
  const entry = FOREIGN_FILES.find((f) => f.rel === rel);
  if (!entry) throw new Error(`no FOREIGN_FILES entry for ${rel}`);
  return entry;
}

const specs = [];

// 1. net-broadcast-unfiltered ------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("src/background.ts");
  const variantSnippet = `
function relayToOpenTabs(payload) {
  chrome.tabs.query(  {  }  ).then((openTabs) => {
    for (const ot of openTabs) {
      chrome.tabs.sendMessage(ot.id, payload);
    }
  });
}
relayToOpenTabs({ kind: 'sync' });
`;
  specs.push({
    id: "net-broadcast-unfiltered",
    rule: netBroadcastUnfiltered,
    fixtureString: `await chrome.tabs.query({}); for (const tab of tabs) { chrome.tabs.sendMessage(tab.id, { type }).catch(() => {}) }  (tests/fixtures/dogfood/net-broadcast-fail, async/await + try/catch + .catch() suppression)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `promise .then() chain (not await), odd inner spacing "query(  {  }  )", different names (relayToOpenTabs/openTabs/ot), no try/catch — appended to real mem0-chrome-extension background.ts (which as fetched has zero broadcast bug)`,
    grepNeedle: "function relayToOpenTabs(payload) {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-background.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      const preInjection = copyForeignFile(foreignFileRel, dest);
      writeFileSync(join(root, ".pre-injection-background.ts"), preInjection);
      writeFileSync(dest, preInjection + variantSnippet, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no src/background dir at all
    },
  });
}

// 2. description-permission-mismatch -----------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("manifest.json");
  specs.push({
    id: "description-permission-mismatch",
    rule: descriptionPermissionMismatch,
    fixtureString: `"description": "Give your ChatGPT, Claude, Cursor super powers..." with NO cursor.com in host_permissions (tests/fixtures/pack-fam2/description-permission-mismatch-fail/manifest.json — real gptpowerups-extension Blocker B-2)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `mutated the REAL mem0-chrome-extension manifest.json description field to name "Grok" (a different KNOWN_HOSTS entry than "Cursor") in different marketing phrasing, while host_permissions (verbatim: api.mem0.ai, app.mem0.ai, claude.ai) never grants grok.com/x.ai`,
    grepNeedle: "conversations in sync across Grok",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile(foreignFileRel, join(root, ".pre-injection-manifest.json"));
      const manifest = JSON.parse(pre);
      manifest.description =
        "🧠 OpenMemory keeps your conversations in sync across Grok and other AI assistants. 🔄 No more repeating yourself!";
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json
    },
  });
}

// 3. csp-not-weakened ----------------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("manifest.json");
  specs.push({
    id: "csp-not-weakened",
    rule: cspNotWeakened,
    fixtureString: `"content_security_policy": { "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'" } (tests/fixtures/dogfood/csp-not-weakened-fail/manifest.json, synthetic)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension manifest.json (verbatim, ships with NO content_security_policy key at all — currently passes by MV3 implicit default) mutated to ADD the key with directives reordered: "object-src 'self'; script-src 'unsafe-eval' 'self'" (unsafe-eval first, object-src first overall — different directive order than the fixture)`,
    grepNeedle: "object-src 'self'; script-src 'unsafe-eval' 'self'",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile(foreignFileRel, join(root, ".pre-injection-manifest.json"));
      const manifest = JSON.parse(pre);
      manifest.content_security_policy = { extension_pages: "object-src 'self'; script-src 'unsafe-eval' 'self'" };
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      // extensionRoot itself does not exist
    },
  });
}

// 4. sw-listeners-toplevel -----------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("src/background.ts");
  const variantSnippet = `
async function bootstrapAlarmWatchers() {
  await chrome.storage.sync.get(['x']);
  chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('fired', alarm.name);
  });
}
bootstrapAlarmWatchers();
`;
  specs.push({
    id: "sw-listeners-toplevel",
    rule: swListenersToplevel,
    fixtureString: `addListener registered inside an async init() body (tests/pack-fam5.test.ts "MUST_BLOCK: flags addListener registered inside an async init() body", src/background/service-worker.ts)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension background.ts (verbatim, 3 top-level addListener calls, currently PASS) mutated by appending a DIFFERENTLY-named async wrapper "bootstrapAlarmWatchers" (not "init") that calls itself top-level, nesting chrome.alarms.onAlarm.addListener (different chrome namespace than the fixture) inside its body`,
    grepNeedle: "async function bootstrapAlarmWatchers() {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-background.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      const pre = copyForeignFile(foreignFileRel, dest);
      writeFileSync(join(root, ".pre-injection-background.ts"), pre);
      writeFileSync(dest, pre + variantSnippet, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no src/background dir
    },
  });
}

// 5. secret-in-bundle -----------------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("src/sidebar.ts");
  specs.push({
    id: "secret-in-bundle",
    rule: secretInBundle,
    fixtureString: `const key = "sk_live_ABCDEFGHIJKLMNOP1234"; (tests/pack-fam3.test.ts positive control + MUST_BLOCK synthetic sw.js fixture — Stripe secret key shape)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension sidebar.ts (verbatim, 1705 lines, treated as a built dist/*.js bundle file) mutated by inserting an AWS access-key-shaped literal (not a Stripe key — a DIFFERENT of the rule's 4 patterns) in a different comment/variable context: "const awsIngestKeyId = ... // legacy ingest credential, unused post-migration"`,
    grepNeedle: "const awsIngestKeyId",
    grepFile: (root) => join(root, "dist/sidebar.js"),
    preInjectionCopy: (root) => join(root, ".pre-injection-sidebar.js"),
    setupFail: (root) => {
      const dest = join(root, "dist/sidebar.js");
      const pre = copyForeignFile(foreignFileRel, dest);
      writeFileSync(join(root, ".pre-injection-sidebar.js"), pre);
      writeFileSync(
        dest,
        pre + `\nconst awsIngestKeyId = "AKIA2ZQP7X9F4M1CQRST"; // legacy ingest credential, unused post-migration\n`,
        "utf8",
      );
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no dist/ or build/ dir at all
    },
  });
}

// 6. host-permissions-wildcard-broad --------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("manifest.json");
  specs.push({
    id: "host-permissions-wildcard-broad",
    rule: hostPermissionsWildcardBroad,
    fixtureString: `"host_permissions": ["<all_urls>"] (tests/fixtures/dogfood/host-permissions-wildcard-broad-fail/manifest.json, synthetic)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension manifest.json (verbatim host_permissions: api.mem0.ai, app.mem0.ai, claude.ai — none broad) mutated by APPENDING "*://*/*" (the OTHER member of BROAD_PATTERNS, never "<all_urls>") to host_permissions[]`,
    grepNeedle: '"*://*/*"',
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile(foreignFileRel, join(root, ".pre-injection-manifest.json"));
      const manifest = JSON.parse(pre);
      manifest.host_permissions = [...manifest.host_permissions, "*://*/*"];
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json
    },
  });
}

// 7. i18n-key-coverage-gap -------------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("src/popup.ts");
  const variantSnippet = `\nconst TABS = [{ id: 'sync', labelKey: 'openmemory_sync_status_v2' }];\n`;
  specs.push({
    id: "i18n-key-coverage-gap",
    rule: i18nKeyCoverageGap,
    fixtureString: `t('x') plain call-site form used across tests/unit/i18n-coverage.test.ts and dogfood I18N_FAIL fixture (6 missing keys via direct t('key') calls, CardContextMenu.tsx)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension popup.ts (verbatim, 35 lines, zero t()/labelKey usage as fetched) mutated by appending an object literal using the OTHER call-site shape the rule matches — "labelKey: 'openmemory_sync_status_v2'" (not a direct t('x') call) — key absent from both locale files`,
    grepNeedle: "labelKey: 'openmemory_sync_status_v2'",
    grepFile: (root) => join(root, "ui/popup.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-popup.ts"),
    setupFail: (root) => {
      const dest = join(root, "ui/popup.ts");
      const pre = copyForeignFile(foreignFileRel, dest);
      writeFileSync(join(root, ".pre-injection-popup.ts"), pre);
      writeFileSync(dest, pre + variantSnippet, "utf8");
      mkdirSync(join(root, "_locales/en"), { recursive: true });
      mkdirSync(join(root, "_locales/fr"), { recursive: true });
      writeFileSync(join(root, "_locales/en/messages.json"), JSON.stringify({ ext_name: { message: "OpenMemory" } }), "utf8");
      writeFileSync(join(root, "_locales/fr/messages.json"), JSON.stringify({ ext_name: { message: "OpenMemory" } }), "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(join(root, "ui"), { recursive: true }); // no _locales at all
      writeFileSync(join(root, "ui/popup.ts"), "// no locales present\n", "utf8");
    },
  });
}

// 8. unused-file-export -----------------------------------------------------------
{
  const { rel: foreignFileRel, sha256 } = foreignEntry("src/selection_context.ts");
  specs.push({
    id: "unused-file-export",
    rule: unusedFileExport,
    fixtureString: `src/components/dead-barrel.ts, unreferenced stub file under src/components (tests/fixtures/dogfood/unused-file-export-fail)`,
    foreignFileRel,
    foreignFetchedFile: FOREIGN_PATHS[foreignFileRel],
    foreignFetchedSha256: sha256,
    variantDescription: `real mem0-chrome-extension selection_context.ts (verbatim, 2113 bytes, a genuine feature file — not an authored stub) copied to a DIFFERENT unreferenced path "src/features/selection_context.ts" under a resolvable manifest.json entry graph (background.service_worker -> src/background/entry.ts, which has zero imports and never reaches selection_context.ts)`,
    grepNeedle: "chrome.runtime.onMessage.addListener",
    grepFile: (root) => join(root, "src/features/selection_context.ts"),
    expectedFindingFile: "src/features/selection_context.ts",
    // NOTE: the pre-injection snapshot is written OUTSIDE the scanned
    // extensionRoot (sibling tmpdir) — unused-file-export's buildExportGraph
    // walks the ENTIRE extensionRoot tree, so a snapshot dotfile left inside
    // root would itself show up as a second (spurious) dead file and could
    // shadow the intended finding.
    preInjectionCopy: (root) => join(root, "..", `${root.split("/").pop()}-pre-injection`, "selection_context.ts"),
    setupFail: (root) => {
      mkdirSync(join(root, "src/background"), { recursive: true });
      writeFileSync(join(root, "src/background/entry.ts"), "// trivial resolvable entry, zero imports\nexport {};\n", "utf8");
      writeFileSync(
        join(root, "manifest.json"),
        JSON.stringify({ manifest_version: 3, name: "probe", version: "1.0.0", background: { service_worker: "src/background/entry.ts", type: "module" } }, null, 2),
        "utf8",
      );
      const dest = join(root, "src/features/selection_context.ts");
      const pre = copyForeignFile(foreignFileRel, dest);
      const snapshotDir = join(root, "..", `${root.split("/").pop()}-pre-injection`);
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, "selection_context.ts"), pre, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json, no vite config -> unresolvedEntryReason
    },
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let anyFailed = false;
for (const spec of specs) {
  try {
    await probe(spec);
  } catch (err) {
    anyFailed = true;
    failures++;
    log(`\n  !!! ${spec.id}: PROBE FAILED: ${err.message}`);
  }
}

log(`\n=== SUMMARY: ${specs.length - failures}/${specs.length} rules RED+INCONCLUSIVE+RESTORED on foreign material ===`);

rmSync(FOREIGN, { recursive: true, force: true });

if (anyFailed) {
  console.error(`\nforeign-bite-probe: ${failures} rule(s) FAILED — see !!! lines above.`);
  process.exit(1);
}

// Write the committed run log with the actual HEAD short SHA in the filename.
const sha = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: REPO_ROOT }).toString().trim();
const outDir = join(REPO_ROOT, "analysis");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `foreign-bite-proof-${sha}.md`);
writeFileSync(
  outFile,
  `# foreign-bite-probe run log — HEAD ${sha}\n\n\`\`\`\n${report.join("\n")}\n\`\`\`\n`,
  "utf8",
);
console.log(`\nRun log written to ${outFile.replace(REPO_ROOT + "/", "")}`);
process.exit(0);

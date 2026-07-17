#!/usr/bin/env node
/**
 * foreign-bite-probe — proves 8 sampled rules bite on FOREIGN material:
 * real files from a third-party extension (mem0-chrome-extension, MIT,
 * pinned commit — see scripts/foreign-material/mem0-chrome-extension/
 * PROVENANCE.md) that were never chosen as any rule's own fixture.
 *
 * For each sampled rule this script:
 *   1. copies the pristine committed foreign file(s) into a fresh OS tmpdir
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
 *      committed pristine foreign file to prove the committed original was
 *      never touched (restoration proof) — nothing under
 *      scripts/foreign-material/ is ever written to.
 *
 * Exit code: 0 iff every rule passes all 4 poles (MUTATION-LANDED, RED,
 * INCONCLUSIVE, RESTORED). Any failure is loud (named), never silent.
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FOREIGN = join(REPO_ROOT, "scripts/foreign-material/mem0-chrome-extension");

const { netBroadcastUnfiltered } = await import(join(REPO_ROOT, "dist/rules/net-broadcast-unfiltered.js"));
const { descriptionPermissionMismatch } = await import(join(REPO_ROOT, "dist/rules/description-permission-mismatch.js"));
const { cspNotWeakened } = await import(join(REPO_ROOT, "dist/rules/csp-not-weakened.js"));
const { swListenersToplevel } = await import(join(REPO_ROOT, "dist/rules/sw-listeners-toplevel.js"));
const { secretInBundle } = await import(join(REPO_ROOT, "dist/rules/secret-in-bundle.js"));
const { hostPermissionsWildcardBroad } = await import(join(REPO_ROOT, "dist/rules/host-permissions-wildcard-broad.js"));
const { i18nKeyCoverageGap } = await import(join(REPO_ROOT, "dist/rules/i18n-key-coverage-gap.js"));
const { unusedFileExport } = await import(join(REPO_ROOT, "dist/rules/unused-file-export.js"));

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

function assertRestored(tmpFileOriginalCopy, committedFile, label) {
  const tmpBytes = readFileSync(tmpFileOriginalCopy, "utf8");
  const committedBytes = readFileSync(committedFile, "utf8");
  if (tmpBytes !== committedBytes) {
    throw new Error(`RESTORE-MISMATCH: ${label} tmp pre-injection copy diverges from committed original`);
  }
  // Also prove the committed original itself was never written to by git.
  const diff = execFileSync("git", ["diff", "--stat", "--", committedFile], { cwd: REPO_ROOT }).toString().trim();
  if (diff.length > 0) {
    throw new Error(`RESTORE-MISMATCH: committed foreign file has uncommitted diff: ${diff}`);
  }
  log(`  RESTORED: ${committedFile} byte-identical to pre-injection copy, git diff --stat empty`);
}

async function runRule(label, ruleModule, root) {
  const result = await ruleModule.run(root);
  return result;
}

async function probe(spec) {
  log(`\n=== ${spec.id} ===`);
  log(`  fixture-string (existing, NOT reused here): ${spec.fixtureString}`);
  log(`  foreign-file: ${spec.foreignFileRel} (source: mem0-chrome-extension @ 54a882a, MIT)`);
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
  assertRestored(spec.preInjectionCopy(tmpFail), spec.committedFile, spec.id);

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
  cpSync(join(FOREIGN, rel), destAbs);
  return readFileSync(destAbs, "utf8"); // return original bytes for pre-injection snapshot
}

const specs = [];

// 1. net-broadcast-unfiltered ------------------------------------------------
{
  const committedFile = join(FOREIGN, "src/background.ts");
  let preInjection;
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
    foreignFileRel: "src/background.ts",
    variantDescription: `promise .then() chain (not await), odd inner spacing "query(  {  }  )", different names (relayToOpenTabs/openTabs/ot), no try/catch — appended to real mem0-chrome-extension background.ts (which as committed has zero broadcast bug)`,
    committedFile,
    grepNeedle: "function relayToOpenTabs(payload) {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-background.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      preInjection = copyForeignFile("src/background.ts", dest);
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
  const committedFile = join(FOREIGN, "manifest.json");
  specs.push({
    id: "description-permission-mismatch",
    rule: descriptionPermissionMismatch,
    fixtureString: `"description": "Give your ChatGPT, Claude, Cursor super powers..." with NO cursor.com in host_permissions (tests/fixtures/pack-fam2/description-permission-mismatch-fail/manifest.json — real gptpowerups-extension Blocker B-2)`,
    foreignFileRel: "manifest.json",
    variantDescription: `mutated the REAL mem0-chrome-extension manifest.json description field to name "Grok" (a different KNOWN_HOSTS entry than "Cursor") in different marketing phrasing, while host_permissions (verbatim: api.mem0.ai, app.mem0.ai, claude.ai) never grants grok.com/x.ai`,
    committedFile,
    grepNeedle: "conversations in sync across Grok",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile("manifest.json", join(root, ".pre-injection-manifest.json"));
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
  const committedFile = join(FOREIGN, "manifest.json");
  specs.push({
    id: "csp-not-weakened",
    rule: cspNotWeakened,
    fixtureString: `"content_security_policy": { "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'" } (tests/fixtures/dogfood/csp-not-weakened-fail/manifest.json, synthetic)`,
    foreignFileRel: "manifest.json",
    variantDescription: `real mem0-chrome-extension manifest.json (verbatim, ships with NO content_security_policy key at all — currently passes by MV3 implicit default) mutated to ADD the key with directives reordered: "object-src 'self'; script-src 'unsafe-eval' 'self'" (unsafe-eval first, object-src first overall — different directive order than the fixture)`,
    committedFile,
    grepNeedle: "object-src 'self'; script-src 'unsafe-eval' 'self'",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile("manifest.json", join(root, ".pre-injection-manifest.json"));
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
  const committedFile = join(FOREIGN, "src/background.ts");
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
    foreignFileRel: "src/background.ts",
    variantDescription: `real mem0-chrome-extension background.ts (verbatim, 3 top-level addListener calls, currently PASS) mutated by appending a DIFFERENTLY-named async wrapper "bootstrapAlarmWatchers" (not "init") that calls itself top-level, nesting chrome.alarms.onAlarm.addListener (different chrome namespace than the fixture) inside its body`,
    committedFile,
    grepNeedle: "async function bootstrapAlarmWatchers() {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-background.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      const pre = copyForeignFile("src/background.ts", dest);
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
  const committedFile = join(FOREIGN, "src/sidebar.ts");
  specs.push({
    id: "secret-in-bundle",
    rule: secretInBundle,
    fixtureString: `const key = "sk_live_ABCDEFGHIJKLMNOP1234"; (tests/pack-fam3.test.ts positive control + MUST_BLOCK synthetic sw.js fixture — Stripe secret key shape)`,
    foreignFileRel: "src/sidebar.ts",
    variantDescription: `real mem0-chrome-extension sidebar.ts (verbatim, 1705 lines, treated as a built dist/*.js bundle file) mutated by inserting an AWS access-key-shaped literal (not a Stripe key — a DIFFERENT of the rule's 4 patterns) in a different comment/variable context: "const awsIngestKeyId = ... // legacy ingest credential, unused post-migration"`,
    committedFile,
    grepNeedle: "const awsIngestKeyId",
    grepFile: (root) => join(root, "dist/sidebar.js"),
    preInjectionCopy: (root) => join(root, ".pre-injection-sidebar.js"),
    setupFail: (root) => {
      const dest = join(root, "dist/sidebar.js");
      const pre = copyForeignFile("src/sidebar.ts", dest);
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
  const committedFile = join(FOREIGN, "manifest.json");
  specs.push({
    id: "host-permissions-wildcard-broad",
    rule: hostPermissionsWildcardBroad,
    fixtureString: `"host_permissions": ["<all_urls>"] (tests/fixtures/dogfood/host-permissions-wildcard-broad-fail/manifest.json, synthetic)`,
    foreignFileRel: "manifest.json",
    variantDescription: `real mem0-chrome-extension manifest.json (verbatim host_permissions: api.mem0.ai, app.mem0.ai, claude.ai — none broad) mutated by APPENDING "*://*/*" (the OTHER member of BROAD_PATTERNS, never "<all_urls>") to host_permissions[]`,
    committedFile,
    grepNeedle: '"*://*/*"',
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection-manifest.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = copyForeignFile("manifest.json", join(root, ".pre-injection-manifest.json"));
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
  const committedFile = join(FOREIGN, "src/popup.ts");
  const variantSnippet = `\nconst TABS = [{ id: 'sync', labelKey: 'openmemory_sync_status_v2' }];\n`;
  specs.push({
    id: "i18n-key-coverage-gap",
    rule: i18nKeyCoverageGap,
    fixtureString: `t('x') plain call-site form used across tests/unit/i18n-coverage.test.ts and dogfood I18N_FAIL fixture (6 missing keys via direct t('key') calls, CardContextMenu.tsx)`,
    foreignFileRel: "src/popup.ts",
    variantDescription: `real mem0-chrome-extension popup.ts (verbatim, 35 lines, zero t()/labelKey usage as committed) mutated by appending an object literal using the OTHER call-site shape the rule matches — "labelKey: 'openmemory_sync_status_v2'" (not a direct t('x') call) — key absent from both locale files`,
    committedFile,
    grepNeedle: "labelKey: 'openmemory_sync_status_v2'",
    grepFile: (root) => join(root, "ui/popup.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection-popup.ts"),
    setupFail: (root) => {
      const dest = join(root, "ui/popup.ts");
      const pre = copyForeignFile("src/popup.ts", dest);
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
  const committedFile = join(FOREIGN, "src/selection_context.ts");
  specs.push({
    id: "unused-file-export",
    rule: unusedFileExport,
    fixtureString: `src/components/dead-barrel.ts, unreferenced stub file under src/components (tests/fixtures/dogfood/unused-file-export-fail)`,
    foreignFileRel: "src/selection_context.ts",
    variantDescription: `real mem0-chrome-extension selection_context.ts (verbatim, 2113 bytes, a genuine feature file — not an authored stub) copied to a DIFFERENT unreferenced path "src/features/selection_context.ts" under a resolvable manifest.json entry graph (background.service_worker -> src/background/entry.ts, which has zero imports and never reaches selection_context.ts)`,
    committedFile,
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
      const pre = copyForeignFile("src/selection_context.ts", dest);
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

#!/usr/bin/env node
/**
 * foreign-bite-probe — proves 8 sampled rules bite on FOREIGN material drawn
 * from 4 DIVERSE, independently-licensed third-party browser extensions.
 *
 * A single-source probe proves a rule bites on THAT project's code, not on
 * "foreign code" in general — the single-formulation-matcher failure
 * transposed to material instead of regex. Four sources cut from the same
 * cloth (same license, same manifest version, same build tooling) would be
 * one source wearing four hats, so each source below is chosen to vary a
 * concrete axis a rule actually reads: manifest version, JSON strictness,
 * presence/absence of a custom CSP, license family, build tooling.
 *
 * ZERO bytes of any of the 4 sources are vendored into this tree. Every
 * file is FETCHED AT RUNTIME, each pinned to that source's OWN immutable
 * commit SHA (never a branch, tag, `main`, `HEAD`, or `latest`), verified
 * against a SHA-256 captured once from that pinned commit. Any network
 * failure, non-200 response, or hash mismatch is a LOUD, named, non-zero-
 * exit failure, per source, per file — never a silent skip, never "passed
 * because a source was unreachable."
 *
 * For each of the 8 sampled rules this script proves BOTH poles across the
 * 4 sources:
 *   - BITE: at least one source, with ONE variant-form violation injected,
 *     goes RED (a rule that reddens nowhere guards nothing)
 *   - RESTRAINT: at least one OTHER, unmodified source's real baseline file
 *     is left to PASS (a rule that reddens everywhere over-blocks)
 * plus the refusal pole (INCONCLUSIVE with a named reason on a tree missing
 * the rule's precondition) and the restoration pole (the fetched original
 * is provably byte-identical and hash-identical after every run).
 *
 * Where a rule's behavior on real material surfaced something worth
 * reporting beyond the formal poles (a natural, uninjected violation in a
 * genuine open-source extension, or a rule limitation such as an over-broad
 * match), it is logged explicitly under "BONUS FINDING" — never hidden,
 * never silently smoothed over into a false green.
 *
 * Exit code: 0 iff every rule passes all required poles. Any failure is
 * loud (named), never silent.
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Foreign material provenance — this repo hosts ZERO bytes of any of these
// 4 projects. Each is fetched at runtime, pinned to its own immutable
// commit SHA, and verified byte-for-byte against a SHA-256 captured once
// from that pinned commit before any injection or rule run touches it.
// ---------------------------------------------------------------------------
//
// Licenses verified AT SOURCE (`gh api repos/<owner>/<repo> --jq
// .license.spdx_id` + the LICENSE file read at the pinned ref), never from
// a README badge:
//   - darkreader/darkreader  -> spdx_id "MIT",  LICENSE @ pinned ref: "MIT License / Copyright (c) 2026 Dark Reader Ltd."
//   - philc/vimium           -> spdx_id "MIT",  MIT-LICENSE.txt @ pinned ref: "Copyright (c) 2010 Phil Crosby, Ilya Sukhar."
//   - GoogleChrome/web-vitals-extension -> spdx_id "Apache-2.0", LICENSE @ pinned ref: Apache License Version 2.0
//   - fregante/GhostText     -> spdx_id "MIT",  license @ pinned ref: "The MIT License (MIT) / Copyright (c) Federico Brigante"
//
// Diversity axis each source contributes (a rule that only ever sees one
// axis proves nothing about "foreign code" in general):
//   - darkreader: MANIFEST V2, persistent background page (not a service
//     worker), TypeScript + webpack build, no content_security_policy key
//     at all (implicit MV3-shape default not even applicable — MV2).
//   - vimium: MANIFEST V3 but with JSON5-style `//` comments in
//     manifest.json (non-strict JSON — a real-world edge case), plain
//     hand-written JS with zero bundler (Deno-based tooling), background
//     service worker, host_permissions natively `<all_urls>`.
//   - web-vitals-extension: Apache-2.0 (a DIFFERENT license family than the
//     other 3, still permissive), minimal/small MV3 extension, ships a
//     custom content_security_policy key, host_permissions natively
//     `*://*/*` (a real broad-permission extension, not synthetic).
//   - GhostText: strict, clean JSON manifest, narrow host_permissions,
//     ships a compliant custom CSP, Parcel-bundled UI but plain committed
//     source files for background/options.
const FOREIGN_SOURCES = {
  darkreader: {
    repo: "darkreader/darkreader",
    commit: "24bb6005dac3ab9b657adadfb56061c319488d0e",
    license: "MIT",
    axis: "MV2 manifest, persistent background page, TS + webpack build, no content_security_policy key",
  },
  vimium: {
    repo: "philc/vimium",
    commit: "7067bc768fc1c7ef9310e295c5782149fab73980",
    license: "MIT",
    axis: "MV3 manifest.json with JSON5-style // comments (non-strict JSON), plain hand-written JS, no bundler, host_permissions natively <all_urls>",
  },
  webvitals: {
    repo: "GoogleChrome/web-vitals-extension",
    commit: "b0e745a68228bb0a84f6909d679436f8cca22849",
    license: "Apache-2.0",
    axis: "Apache-2.0 license family, minimal MV3 extension, ships a custom CSP, host_permissions natively *://*/*",
  },
  ghosttext: {
    repo: "fregante/GhostText",
    commit: "7a54c5ff585dc8ca419e1ff48393bdc8e6217f48",
    license: "MIT",
    axis: "strict clean-JSON MV3 manifest, narrow host_permissions, compliant custom CSP, Parcel-bundled UI with plain committed background source",
  },
};

// Files fetched per source. `key` is the identifier used by the rule specs
// below; `rel` is the path inside that source's repo at its pinned commit;
// `sha256` was captured once (2026-07-18) from that exact pinned commit —
// stated here as a comment per derive-never-type.md, since we can no
// longer derive it from a vendored copy.
const FOREIGN_FILES = [
  { key: "darkreader:manifest", source: "darkreader", rel: "src/manifest.json", sha256: "bc3ae5404f904dc3184127868c601a2d25653973ff7270efbf99370007a94166" },
  { key: "darkreader:background", source: "darkreader", rel: "src/background/tab-manager.ts", sha256: "3ae33637ba08b7018b34328eb8037f0fe116d864e966a22268620a5633557b2c" },
  { key: "vimium:manifest", source: "vimium", rel: "manifest.json", sha256: "a10ffad33410d2d3d032ba6f2276b7204157ef0039e25ecd871d9150942c6700" },
  { key: "vimium:background", source: "vimium", rel: "background_scripts/main.js", sha256: "887d503221f124e2bc608cbee527b75e1f70697bfe9b14b53544a49ff3523be5" },
  { key: "webvitals:manifest", source: "webvitals", rel: "manifest.json", sha256: "78dd316a08a25bc7460b4e6bf3d3ea83b3be2770755cf4bfd6452504bc75a1c4" },
  { key: "webvitals:background", source: "webvitals", rel: "service_worker.js", sha256: "eb9f3f2fae160921a25aebde6ed8897d76d98277b6a26275161023d64c80a13c" },
  { key: "ghosttext:manifest", source: "ghosttext", rel: "source/manifest.json", sha256: "5b8800c03136576ef06482e5e0d2e18f0c90dd72fd4346aee429aff77ce34ce4" },
  { key: "ghosttext:background", source: "ghosttext", rel: "source/background.js", sha256: "51f99441d56d47f61ed9666261d3bde4d45cb515be701009410344e9b6e5ae0e" },
  { key: "ghosttext:options", source: "ghosttext", rel: "source/options.js", sha256: "b2cfd7c7a426cad09f67b892c314857ebaf6d2c26fd9a7d3d8c384ec90f92ae5" },
];

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Fetches every file in FOREIGN_FILES into a fresh OS tmpdir, verifying
 * each against its committed SHA-256. Throws a named, loud error on ANY
 * failure (network error, non-200 status, hash mismatch), naming the
 * source, the file, and the reason. NEVER returns a partial result
 * silently — one unfetchable file aborts the whole probe.
 *
 * Env overrides for the loud-fail demonstration (never used in normal
 * runs):
 *   FOREIGN_BITE_PROBE_BAD_SHA=1        -> every source pinned to a
 *     deliberately wrong commit SHA (exercises the 404/unreachable path)
 *   FOREIGN_BITE_PROBE_BAD_HASH=<key>   -> the named file's expected hash
 *     is corrupted before comparison (exercises the hash-mismatch path)
 */
async function fetchForeignMaterial() {
  const badSha = process.env.FOREIGN_BITE_PROBE_BAD_SHA === "1";
  const badHashKey = process.env.FOREIGN_BITE_PROBE_BAD_HASH ?? null;
  const dir = mkdtempSync(join(tmpdir(), "ed-fbp-foreign-fetch-"));
  const fetched = {};
  for (const { key, source, rel, sha256 } of FOREIGN_FILES) {
    const src = FOREIGN_SOURCES[source];
    const commit = badSha ? "0000000000000000000000000000000000dead" : src.commit;
    const url = `https://raw.githubusercontent.com/${src.repo}/${commit}/${rel}`;
    const expectedHash = badHashKey === key ? "0".repeat(64) : sha256;
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error(
        `FOREIGN-FETCH-FAILED: source "${source}" (${src.repo}) file "${rel}" [${key}] from ${url}: ${err.message} — refusing to proceed with a probe missing its foreign material (this is never treated as a pass).`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `FOREIGN-FETCH-FAILED: source "${source}" (${src.repo}) file "${rel}" [${key}] from ${url} returned HTTP ${res.status} ${res.statusText} — refusing to proceed with a probe missing its foreign material (this is never treated as a pass).`,
      );
    }
    const text = await res.text();
    const actualHash = sha256Hex(text);
    if (actualHash !== expectedHash) {
      throw new Error(
        `FOREIGN-HASH-MISMATCH: source "${source}" (${src.repo}) file "${rel}" [${key}] fetched from ${url} has sha256 ${actualHash}, expected ${expectedHash} — upstream content diverged from the pinned commit or was tampered with. Refusing to proceed (never treated as a pass or a silent skip).`,
      );
    }
    const dest = join(dir, key.replace(":", "__"));
    writeFileSync(dest, text, "utf8");
    fetched[key] = dest;
    console.log(`  FOREIGN-FETCHED: [${key}] ${source}:${rel} <- ${url} (sha256 ${actualHash.slice(0, 12)}… verified)`);
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

console.log(`=== fetching foreign material from ${Object.keys(FOREIGN_SOURCES).length} independently-licensed sources ===`);
let FETCH_DIR;
let FETCHED;
try {
  ({ dir: FETCH_DIR, fetched: FETCHED } = await fetchForeignMaterial());
} catch (err) {
  console.error(`\nforeign-bite-probe: ABORTED — could not obtain foreign material.\n${err.message}`);
  process.exit(1);
}
console.log(`=== all ${FOREIGN_FILES.length} foreign files fetched + hash-verified into ${FETCH_DIR} ===\n`);

function readForeign(key) {
  return readFileSync(FETCHED[key], "utf8");
}

let failures = 0;
const report = [];
const matrix = []; // { ruleId, sourceId, pole: "RED"|"PASS"|"INCONCLUSIVE"|"BONUS", verdict, note }

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

function assertRestored(tmpFileOriginalCopy, foreignKey, label) {
  const entry = FOREIGN_FILES.find((f) => f.key === foreignKey);
  const tmpBytes = readFileSync(tmpFileOriginalCopy, "utf8");
  const fetchedBytes = readForeign(foreignKey);
  if (tmpBytes !== fetchedBytes) {
    throw new Error(`RESTORE-MISMATCH: ${label} tmp pre-injection copy diverges from fetched foreign original [${foreignKey}]`);
  }
  const actualHash = sha256Hex(fetchedBytes);
  if (actualHash !== entry.sha256) {
    throw new Error(
      `RESTORE-MISMATCH: fetched foreign file [${foreignKey}] sha256 drifted to ${actualHash}, expected ${entry.sha256} — injection leaked into the fetch tmpdir`,
    );
  }
  log(`  RESTORED: [${foreignKey}] byte-identical to pre-injection copy, sha256 unchanged (${actualHash.slice(0, 12)}…)`);
}

async function runRule(ruleModule, root) {
  return ruleModule.run(root);
}

// ---------------------------------------------------------------------------
// Per-rule probe: RED pole (inject on one source) + INCONCLUSIVE pole +
// RESTORED pole + PASS pole(s) on baseline, unmodified, DIFFERENT sources.
// ---------------------------------------------------------------------------

async function probe(spec) {
  log(`\n=== ${spec.id} ===`);
  log(`  RED source: ${spec.redSourceId} (${FOREIGN_SOURCES[spec.redSourceId].repo}) — ${spec.variantDescription}`);

  // --- RED pole ---
  const tmpFail = freshTmp(`${spec.id}-fail`);
  spec.setupFail(tmpFail);
  assertGrepLanded(spec.grepFile(tmpFail), spec.grepNeedle, spec.id);
  const failResult = await runRule(spec.rule, tmpFail);
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
  matrix.push({ ruleId: spec.id, sourceId: spec.redSourceId, pole: "RED", verdict: "fail" });

  // --- RESTORED pole ---
  assertRestored(spec.preInjectionCopy(tmpFail), spec.redForeignKey, spec.id);
  const preInjectionPath = spec.preInjectionCopy(tmpFail);
  if (!preInjectionPath.startsWith(tmpFail)) {
    rmSync(dirname(preInjectionPath), { recursive: true, force: true });
  }
  rmSync(tmpFail, { recursive: true, force: true });

  // --- INCONCLUSIVE pole ---
  const tmpInc = freshTmp(`${spec.id}-inc`);
  spec.setupInconclusive(tmpInc);
  const incResult = await runRule(spec.rule, tmpInc);
  if (incResult.verdict !== "inconclusive") {
    throw new Error(`${spec.id}: expected verdict "inconclusive" on missing-precondition tree, got "${incResult.verdict}"`);
  }
  const reason = incResult.inconclusive[0];
  if (!reason || reason.reason.length === 0) {
    throw new Error(`${spec.id}: inconclusive verdict but empty/missing reason`);
  }
  log(`  INCONCLUSIVE(${reason.reason})`);
  rmSync(tmpInc, { recursive: true, force: true });

  // --- PASS pole(s): baseline, unmodified, DIFFERENT source(s) ---
  for (const passCase of spec.passCases) {
    const tmpPass = freshTmp(`${spec.id}-pass-${passCase.sourceId}`);
    passCase.setup(tmpPass);
    const passResult = await runRule(spec.rule, tmpPass);
    if (passResult.verdict !== "pass") {
      throw new Error(
        `${spec.id}: expected verdict "pass" on baseline unmodified source "${passCase.sourceId}", got "${passResult.verdict}" (${JSON.stringify(passResult.findings ?? passResult.inconclusive)})`,
      );
    }
    log(`  PASS(${passCase.sourceId}, ${FOREIGN_SOURCES[passCase.sourceId].repo}): baseline unmodified real file, verdict pass`);
    matrix.push({ ruleId: spec.id, sourceId: passCase.sourceId, pole: "PASS", verdict: "pass" });
    rmSync(tmpPass, { recursive: true, force: true });
  }

  // --- BONUS findings: logged, never gating ---
  for (const bonus of spec.bonusChecks ?? []) {
    const tmpBonus = freshTmp(`${spec.id}-bonus-${bonus.sourceId}`);
    bonus.setup(tmpBonus);
    const bonusResult = await runRule(spec.rule, tmpBonus);
    log(`  BONUS FINDING(${bonus.sourceId}, ${FOREIGN_SOURCES[bonus.sourceId].repo}): ${bonus.label} -> verdict ${bonusResult.verdict}${bonusResult.findings?.length ? " — " + bonusResult.findings.map((f) => f.message).join("; ") : ""}${bonusResult.inconclusive?.length ? " — " + bonusResult.inconclusive.map((r) => r.reason).join("; ") : ""}`);
    matrix.push({ ruleId: spec.id, sourceId: bonus.sourceId, pole: "BONUS", verdict: bonusResult.verdict, note: bonus.label });
    rmSync(tmpBonus, { recursive: true, force: true });
  }

  log(`  ${spec.id}: ALL POLES OK`);
}

// ---------------------------------------------------------------------------
// Rule specs
// ---------------------------------------------------------------------------

const specs = [];

// 1. net-broadcast-unfiltered ------------------------------------------------
{
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
    redSourceId: "darkreader",
    redForeignKey: "darkreader:background",
    variantDescription: `real darkreader/darkreader src/background/tab-manager.ts (verbatim, currently zero broadcast bug) mutated by appending a promise .then() chain (not await), odd inner spacing "query(  {  }  )", different names (relayToOpenTabs/openTabs/ot), no try/catch`,
    grepNeedle: "function relayToOpenTabs(payload) {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      mkdirSync(dirname(dest), { recursive: true });
      const base = readForeign("darkreader:background");
      writeFileSync(join(root, ".pre-injection.ts"), base);
      writeFileSync(dest, base + variantSnippet, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no src/background dir at all
    },
    passCases: [
      {
        sourceId: "ghosttext",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("ghosttext:background"), "utf8");
        },
      },
      {
        sourceId: "webvitals",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("webvitals:background"), "utf8");
        },
      },
    ],
    bonusChecks: [
      {
        sourceId: "vimium",
        label: "vimium/vimium background_scripts/main.js NATURALLY fires this rule with zero injection (real chrome.tabs.query(...).then + chrome.tabs.sendMessage in the same scope) — a genuine finding, not synthetic",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("vimium:background"), "utf8");
        },
      },
    ],
  });
}

// 2. sw-listeners-toplevel -----------------------------------------------------
{
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
    redSourceId: "webvitals",
    redForeignKey: "webvitals:background",
    variantDescription: `real GoogleChrome/web-vitals-extension service_worker.js (verbatim, currently zero nested-listener bug) mutated by appending a DIFFERENTLY-named async wrapper "bootstrapAlarmWatchers" that calls itself top-level, nesting chrome.alarms.onAlarm.addListener inside its body`,
    grepNeedle: "async function bootstrapAlarmWatchers() {",
    grepFile: (root) => join(root, "src/background/background.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection.ts"),
    setupFail: (root) => {
      const dest = join(root, "src/background/background.ts");
      mkdirSync(dirname(dest), { recursive: true });
      const base = readForeign("webvitals:background");
      writeFileSync(join(root, ".pre-injection.ts"), base);
      writeFileSync(dest, base + variantSnippet, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no src/background dir
    },
    passCases: [
      {
        sourceId: "darkreader",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("darkreader:background"), "utf8");
        },
      },
    ],
    bonusChecks: [
      {
        sourceId: "vimium",
        label: "philc/vimium background_scripts/main.js NATURALLY fires this rule (real addListener nested inside a function body) with zero injection",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("vimium:background"), "utf8");
        },
      },
      {
        sourceId: "ghosttext",
        label: "fregante/GhostText source/background.js NATURALLY fires this rule (4 real addListener calls nested inside function bodies) with zero injection",
        setup: (root) => {
          const dest = join(root, "src/background/background.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("ghosttext:background"), "utf8");
        },
      },
    ],
  });
}

// 3. secret-in-bundle -----------------------------------------------------------
{
  specs.push({
    id: "secret-in-bundle",
    rule: secretInBundle,
    redSourceId: "ghosttext",
    redForeignKey: "ghosttext:background",
    variantDescription: `real fregante/GhostText source/background.js (verbatim, treated as a built dist/*.js bundle file) mutated by inserting an AWS access-key-shaped literal in a distinct comment/variable context: "const awsIngestKeyId = ... // legacy ingest credential, unused post-migration"`,
    grepNeedle: "const awsIngestKeyId",
    grepFile: (root) => join(root, "dist/bundle.js"),
    preInjectionCopy: (root) => join(root, ".pre-injection.js"),
    setupFail: (root) => {
      const dest = join(root, "dist/bundle.js");
      mkdirSync(dirname(dest), { recursive: true });
      const base = readForeign("ghosttext:background");
      writeFileSync(join(root, ".pre-injection.js"), base);
      writeFileSync(dest, base + `\nconst awsIngestKeyId = "AKIAIOSFODNN7EXAMPLE"; // legacy ingest credential, unused post-migration\n`, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no dist/ or build/ dir at all
    },
    passCases: [
      {
        sourceId: "darkreader",
        setup: (root) => {
          const dest = join(root, "dist/bundle.js");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("darkreader:background"), "utf8");
        },
      },
      {
        sourceId: "vimium",
        setup: (root) => {
          const dest = join(root, "dist/bundle.js");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("vimium:background"), "utf8");
        },
      },
      {
        sourceId: "webvitals",
        setup: (root) => {
          const dest = join(root, "dist/bundle.js");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("webvitals:background"), "utf8");
        },
      },
    ],
  });
}

// 4. description-permission-mismatch -----------------------------------------
{
  specs.push({
    id: "description-permission-mismatch",
    rule: descriptionPermissionMismatch,
    redSourceId: "darkreader",
    redForeignKey: "darkreader:manifest",
    variantDescription: `real darkreader/darkreader src/manifest.json mutated: description field replaced to name "Grok" (a KNOWN_HOSTS entry) while host_permissions/permissions never grant grok.com/x.ai`,
    grepNeedle: "Sync your conversations across Grok",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = readForeign("darkreader:manifest");
      writeFileSync(join(root, ".pre-injection.json"), pre);
      const manifest = JSON.parse(pre);
      manifest.description = "Sync your conversations across Grok and other AI assistants instantly.";
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json
    },
    passCases: [
      {
        sourceId: "webvitals",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("webvitals:manifest"), "utf8");
        },
      },
      {
        sourceId: "ghosttext",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("ghosttext:manifest"), "utf8");
        },
      },
    ],
    bonusChecks: [
      {
        sourceId: "vimium",
        label: "philc/vimium manifest.json is NOT strict JSON (JSON5-style // comments) — a real-world edge case that surfaces as inconclusive, never a silent pass/fail",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("vimium:manifest"), "utf8");
        },
      },
    ],
  });
}

// 5. csp-not-weakened ----------------------------------------------------------
{
  specs.push({
    id: "csp-not-weakened",
    rule: cspNotWeakened,
    redSourceId: "darkreader",
    redForeignKey: "darkreader:manifest",
    variantDescription: `real darkreader/darkreader src/manifest.json (verbatim, ships with NO content_security_policy key at all — MV2, currently passes) mutated to ADD the key: "object-src 'self'; script-src 'unsafe-eval' 'self'"`,
    grepNeedle: "object-src 'self'; script-src 'unsafe-eval' 'self'",
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = readForeign("darkreader:manifest");
      writeFileSync(join(root, ".pre-injection.json"), pre);
      const manifest = JSON.parse(pre);
      manifest.content_security_policy = { extension_pages: "object-src 'self'; script-src 'unsafe-eval' 'self'" };
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      // extensionRoot itself does not exist
    },
    // NOTE (honest reporting, not smoothed over): among the 4 sources, only
    // darkreader's OWN pre-injection baseline cleanly passes this rule.
    // web-vitals-extension and GhostText both NATURALLY fail — not because
    // their CSP is unsafe, but because csp-not-weakened's REMOTE_SRC_RE
    // (`/(https?:)?\/\/[^\s'";]+/i`) matches ANY `//...` substring in
    // extension_pages regardless of WHICH directive it appears under. Both
    // sources' compliant connect-src entries (a directive MV3 explicitly
    // permits to reference remote hosts) trip the same regex meant for
    // script-src. This is a genuine RULE LIMITATION discovered via real
    // material — logged as a bonus finding below, not hidden, and NOT
    // counted as a formal PASS case (it would be dishonest to do so: the
    // rule really does fire on these 2 sources, just for the wrong reason).
    // vimium is excluded from this rule's poles entirely: its manifest.json
    // is not strict JSON (see bonus below).
    passCases: [
      {
        sourceId: "darkreader",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("darkreader:manifest"), "utf8");
        },
      },
    ],
    bonusChecks: [
      {
        sourceId: "webvitals",
        label: "RULE LIMITATION: GoogleChrome/web-vitals-extension's compliant CSP (connect-src references a remote host, script-src is untouched) is flagged anyway — REMOTE_SRC_RE does not distinguish which CSP directive the remote reference belongs to",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("webvitals:manifest"), "utf8");
        },
      },
      {
        sourceId: "ghosttext",
        label: "RULE LIMITATION: fregante/GhostText's compliant CSP (connect-src references http://localhost for its local dev bridge, script-src is 'self') is flagged anyway — same REMOTE_SRC_RE over-match",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("ghosttext:manifest"), "utf8");
        },
      },
      {
        sourceId: "vimium",
        label: "philc/vimium manifest.json is NOT strict JSON (JSON5-style // comments) — surfaces as inconclusive",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("vimium:manifest"), "utf8");
        },
      },
    ],
  });
}

// 6. host-permissions-wildcard-broad --------------------------------------------
{
  specs.push({
    id: "host-permissions-wildcard-broad",
    rule: hostPermissionsWildcardBroad,
    redSourceId: "darkreader",
    redForeignKey: "darkreader:manifest",
    variantDescription: `real darkreader/darkreader src/manifest.json (verbatim, MV2, has no host_permissions field at all) mutated by ADDING host_permissions: ["*://*/*"] (a plausible MV3-migration mistake)`,
    grepNeedle: '"*://*/*"',
    grepFile: (root) => join(root, "manifest.json"),
    preInjectionCopy: (root) => join(root, ".pre-injection.json"),
    setupFail: (root) => {
      mkdirSync(root, { recursive: true });
      const pre = readForeign("darkreader:manifest");
      writeFileSync(join(root, ".pre-injection.json"), pre);
      const manifest = JSON.parse(pre);
      manifest.host_permissions = ["*://*/*"];
      writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json
    },
    passCases: [
      {
        sourceId: "ghosttext",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("ghosttext:manifest"), "utf8");
        },
      },
    ],
    bonusChecks: [
      {
        sourceId: "webvitals",
        label: "GoogleChrome/web-vitals-extension NATURALLY fires this rule with zero injection (real host_permissions: [\"*://*/*\"])",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("webvitals:manifest"), "utf8");
        },
      },
      {
        sourceId: "vimium",
        label: "philc/vimium manifest.json is NOT strict JSON (JSON5-style // comments) — surfaces as inconclusive rather than reading its real host_permissions: [\"<all_urls>\"]",
        setup: (root) => {
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, "manifest.json"), readForeign("vimium:manifest"), "utf8");
        },
      },
    ],
  });
}

// 7. i18n-key-coverage-gap -------------------------------------------------------
{
  const variantSnippet = `\nconst TABS = [{ id: 'sync', labelKey: 'ghosttext_sync_status_v2' }];\n`;
  const locales = (root) => {
    mkdirSync(join(root, "_locales/en"), { recursive: true });
    mkdirSync(join(root, "_locales/fr"), { recursive: true });
    writeFileSync(join(root, "_locales/en/messages.json"), JSON.stringify({ ext_name: { message: "x" } }), "utf8");
    writeFileSync(join(root, "_locales/fr/messages.json"), JSON.stringify({ ext_name: { message: "x" } }), "utf8");
  };
  specs.push({
    id: "i18n-key-coverage-gap",
    rule: i18nKeyCoverageGap,
    redSourceId: "ghosttext",
    redForeignKey: "ghosttext:options",
    variantDescription: `real fregante/GhostText source/options.js (verbatim, zero t()/labelKey usage as fetched) mutated by appending "labelKey: 'ghosttext_sync_status_v2'" (the OTHER call-site shape the rule matches) — key absent from both locale files`,
    grepNeedle: "labelKey: 'ghosttext_sync_status_v2'",
    grepFile: (root) => join(root, "ui/popup.ts"),
    preInjectionCopy: (root) => join(root, ".pre-injection.ts"),
    setupFail: (root) => {
      const dest = join(root, "ui/popup.ts");
      mkdirSync(dirname(dest), { recursive: true });
      const base = readForeign("ghosttext:options");
      writeFileSync(join(root, ".pre-injection.ts"), base);
      writeFileSync(dest, base + variantSnippet, "utf8");
      locales(root);
    },
    setupInconclusive: (root) => {
      mkdirSync(join(root, "ui"), { recursive: true }); // no _locales at all
      writeFileSync(join(root, "ui/popup.ts"), "// no locales present\n", "utf8");
    },
    passCases: [
      {
        sourceId: "darkreader",
        setup: (root) => {
          const dest = join(root, "ui/popup.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("darkreader:background"), "utf8");
          locales(root);
        },
      },
      {
        sourceId: "webvitals",
        setup: (root) => {
          const dest = join(root, "ui/popup.ts");
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, readForeign("webvitals:background"), "utf8");
          locales(root);
        },
      },
    ],
  });
}

// 8. unused-file-export -----------------------------------------------------------
{
  specs.push({
    id: "unused-file-export",
    rule: unusedFileExport,
    redSourceId: "webvitals",
    redForeignKey: "webvitals:background",
    variantDescription: `real GoogleChrome/web-vitals-extension service_worker.js (verbatim, a genuine feature file — not an authored stub) copied to an UNREFERENCED path "src/features/orphan.ts" under a resolvable manifest.json entry graph (background.service_worker -> src/background/entry.ts, zero imports, never reaches orphan.ts)`,
    grepNeedle: "chrome.storage.sync.get",
    grepFile: (root) => join(root, "src/features/orphan.ts"),
    expectedFindingFile: "src/features/orphan.ts",
    preInjectionCopy: (root) => join(root, "..", `${root.split("/").pop()}-pre-injection`, "orphan.ts"),
    setupFail: (root) => {
      mkdirSync(join(root, "src/background"), { recursive: true });
      writeFileSync(join(root, "src/background/entry.ts"), "// trivial resolvable entry, zero imports\nexport {};\n", "utf8");
      writeFileSync(
        join(root, "manifest.json"),
        JSON.stringify({ manifest_version: 3, name: "probe", version: "1.0.0", background: { service_worker: "src/background/entry.ts", type: "module" } }, null, 2),
        "utf8",
      );
      const dest = join(root, "src/features/orphan.ts");
      mkdirSync(dirname(dest), { recursive: true });
      const pre = readForeign("webvitals:background");
      writeFileSync(dest, pre, "utf8");
      const snapshotDir = join(root, "..", `${root.split("/").pop()}-pre-injection`);
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(join(snapshotDir, "orphan.ts"), pre, "utf8");
    },
    setupInconclusive: (root) => {
      mkdirSync(root, { recursive: true }); // no manifest.json, no vite config -> unresolvedEntryReason
    },
    passCases: [
      {
        // Healthy case: the foreign file IS the manifest-declared entry
        // point itself (trivially reachable by construction), from a
        // DIFFERENT source than the RED case.
        sourceId: "ghosttext",
        setup: (root) => {
          mkdirSync(join(root, "src/background"), { recursive: true });
          writeFileSync(join(root, "src/background/entry.ts"), readForeign("ghosttext:background"), "utf8");
          writeFileSync(
            join(root, "manifest.json"),
            JSON.stringify({ manifest_version: 3, name: "probe", version: "1.0.0", background: { service_worker: "src/background/entry.ts", type: "module" } }, null, 2),
            "utf8",
          );
        },
      },
    ],
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

// RULE x SOURCE matrix
log("\n=== RULE x SOURCE MATRIX (both verdicts per cell) ===");
const ruleIds = specs.map((s) => s.id);
const sourceIds = Object.keys(FOREIGN_SOURCES);
for (const ruleId of ruleIds) {
  log(`\n${ruleId}:`);
  for (const sourceId of sourceIds) {
    const cells = matrix.filter((m) => m.ruleId === ruleId && m.sourceId === sourceId);
    if (cells.length === 0) {
      log(`  ${sourceId}: (not exercised for this rule)`);
      continue;
    }
    for (const cell of cells) {
      log(`  ${sourceId}: ${cell.pole} -> ${cell.verdict}${cell.note ? " (" + cell.note + ")" : ""}`);
    }
  }
}

log(`\n=== SUMMARY: ${specs.length - failures}/${specs.length} rules RED+INCONCLUSIVE+PASS+RESTORED across ${sourceIds.length} independently-licensed sources ===`);

rmSync(FETCH_DIR, { recursive: true, force: true });

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

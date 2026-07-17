/**
 * Family 1 — manifest-static rules proof (pure manifest.json / ZIP reads,
 * no build needed). Each rule: MUST_BLOCK (fail), MUST_PASS (pass),
 * MUST_REFUSE (inconclusive, non-empty specific reason).
 *
 * Fixtures under tests/fixtures/dogfood/<id>-{fail,pass,inconclusive,...}/
 * are synthetic — labeled honestly via FIXTURE PROVENANCE headers, no real
 * gptpowerups product defect claimed for this family as of D137.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { manifestTypeNoJson } from "../src/rules/manifest-type-no-json.js";
import { zipIntegrity } from "../src/rules/zip-integrity.js";
import { manifestPermissionAllowlist } from "../src/rules/manifest-permission-allowlist.js";
import { hostPermissionsWildcardBroad } from "../src/rules/host-permissions-wildcard-broad.js";
import { cspNotWeakened } from "../src/rules/csp-not-weakened.js";
import { contentScriptFileExists } from "../src/rules/content-script-file-exists.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/dogfood");
const f = (name: string) => join(FIXTURES, name);

function expectNonEmptyReason(reasons: { reason: string }[]) {
  expect(reasons.length).toBeGreaterThan(0);
  for (const r of reasons) {
    expect(r.reason.length).toBeGreaterThan(0);
  }
}

describe("manifest-type-no-json", () => {
  it("MUST_BLOCK: manifest.json under a subfolder, not at root", async () => {
    const result = await manifestTypeNoJson.run(f("manifest-type-no-json-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("MUST_PASS: manifest.json at root", async () => {
    const result = await manifestTypeNoJson.run(f("manifest-type-no-json-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: extension root does not exist at all", async () => {
    const result = await manifestTypeNoJson.run(f("manifest-type-no-json-DOES-NOT-EXIST"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
  });
});

describe("zip-integrity", () => {
  it("MUST_BLOCK: zip with a duplicated central-directory entry", async () => {
    const result = await zipIntegrity.run(f("zip-integrity-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((x) => /duplicate/i.test(x.message))).toBe(true);
  });

  it("MUST_PASS: clean zip, no duplicates", async () => {
    const result = await zipIntegrity.run(f("zip-integrity-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no .zip present at root", async () => {
    const result = await zipIntegrity.run(f("zip-integrity-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
    expect(result.inconclusive[0]?.reason).toMatch(/no \.zip at root/i);
  });
});

describe("manifest-permission-allowlist", () => {
  it("MUST_BLOCK: debugger permission absent from declared allowlist", async () => {
    const result = await manifestPermissionAllowlist.run(f("manifest-permission-allowlist-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((x) => /"debugger"/.test(x.message))).toBe(true);
  });

  it("MUST_PASS: storage/scripting/alarms all in allowlist", async () => {
    const result = await manifestPermissionAllowlist.run(f("manifest-permission-allowlist-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no .extension-doctor.json allowlist declared — never a silent pass", async () => {
    const result = await manifestPermissionAllowlist.run(f("manifest-permission-allowlist-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
    expect(result.inconclusive[0]?.reason).toMatch(/\.extension-doctor\.json/);
  });
});

describe("host-permissions-wildcard-broad", () => {
  it('MUST_BLOCK: host_permissions ["<all_urls>"]', async () => {
    const result = await hostPermissionsWildcardBroad.run(f("host-permissions-wildcard-broad-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((x) => x.message.includes("<all_urls>"))).toBe(true);
  });

  it("MUST_PASS: 6 named domains", async () => {
    const result = await hostPermissionsWildcardBroad.run(f("host-permissions-wildcard-broad-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing at root", async () => {
    const result = await hostPermissionsWildcardBroad.run(f("host-permissions-wildcard-broad-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
  });
});

describe("csp-not-weakened", () => {
  it("MUST_BLOCK: CSP with unsafe-eval", async () => {
    const result = await cspNotWeakened.run(f("csp-not-weakened-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((x) => /unsafe-eval/.test(x.message))).toBe(true);
  });

  it("MUST_PASS: no custom CSP key (MV3 default, documented explicitly)", async () => {
    const result = await cspNotWeakened.run(f("csp-not-weakened-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing at root", async () => {
    const result = await cspNotWeakened.run(f("csp-not-weakened-inconclusive"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
  });
});

describe("content-script-file-exists", () => {
  it("MUST_BLOCK: ui/missing.js referenced but absent from package", async () => {
    const result = await contentScriptFileExists.run(f("content-script-file-exists-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((x) => x.message.includes("ui/missing.js"))).toBe(true);
  });

  it("MUST_PASS: every listed js resolves", async () => {
    const result = await contentScriptFileExists.run(f("content-script-file-exists-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json unreadable (invalid JSON)", async () => {
    const result = await contentScriptFileExists.run(f("content-script-file-exists-badjson"));
    expect(result.verdict).toBe("inconclusive");
    expectNonEmptyReason(result.inconclusive);
  });

  it("tripolar bonus: no content_scripts key at all -> pass, nothing to check", async () => {
    const result = await contentScriptFileExists.run(f("content-script-file-exists-nocs"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

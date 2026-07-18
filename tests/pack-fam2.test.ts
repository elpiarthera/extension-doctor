/**
 * Pack fam2 proof — permission/manifest-relational rules.
 *
 * Every fixture directory carries a PROVENANCE.md naming its origin (real
 * gptpowerups-extension git history where a real defect exists, synthetic
 * where the rule is preventive and no real defect has been observed yet —
 * see internal rule matrix (not shipped with this package) items
 * 10, 22, 23, 24, 25, 29).
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { permissionRequiredVsOptional } from "../src/rules/permission-required-vs-optional.js";
import { hostPermissionsContentScriptsMismatch } from "../src/rules/host-permissions-content-scripts-mismatch.js";
import { descriptionPermissionMismatch } from "../src/rules/description-permission-mismatch.js";
import { webAccessibleResourcesScope } from "../src/rules/web-accessible-resources-scope.js";
import { permissionDiffBetweenReleases } from "../src/rules/permission-diff-between-releases.js";
import { runtimeExternalMessagingExposure } from "../src/rules/runtime-external-messaging-exposure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/pack-fam2");
const f = (name: string) => join(FIXTURES, name);

describe("pack-fam2: permission-required-vs-optional", () => {
  it("MUST_BLOCK: tabs in mandatory permissions[] (REAL gptpowerups-extension pre-fix)", async () => {
    const result = await permissionRequiredVsOptional.run(f("permission-required-vs-optional-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((fnd) => fnd.message.includes('"tabs"'))).toBe(true);
  });

  it("MUST_PASS: tabs in optional_permissions[] (REAL gptpowerups-extension post-fix)", async () => {
    const result = await permissionRequiredVsOptional.run(f("permission-required-vs-optional-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing -> non-empty inconclusive reason", async () => {
    const result = await permissionRequiredVsOptional.run(f("does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
  });
});

describe("pack-fam2: host-permissions-content-scripts-mismatch", () => {
  it("MUST_BLOCK: *.x.ai + files.oaiusercontent.com with no content_scripts match (REAL current gptpowerups-extension)", async () => {
    const result = await hostPermissionsContentScriptsMismatch.run(f("host-permissions-content-scripts-mismatch-fail"));
    expect(result.verdict).toBe("fail");
    const snippets = result.findings.map((fnd) => fnd.snippet);
    expect(snippets).toContain("https://*.x.ai/*");
    expect(snippets).toContain("https://files.oaiusercontent.com/*");
  });

  it("MUST_PASS: chatgpt/claude/grok matched + convex documented in .extension-doctor.json", async () => {
    const result = await hostPermissionsContentScriptsMismatch.run(f("host-permissions-content-scripts-mismatch-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing -> non-empty inconclusive reason", async () => {
    const result = await hostPermissionsContentScriptsMismatch.run(f("does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
  });
});

describe("pack-fam2: description-permission-mismatch", () => {
  it('MUST_BLOCK: description names "Cursor" with zero Cursor host_permission (REAL gptpowerups-extension pre-fix)', async () => {
    const result = await descriptionPermissionMismatch.run(f("description-permission-mismatch-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((fnd) => fnd.message.includes("Cursor"))).toBe(true);
  });

  it("MUST_PASS: description names only ChatGPT/Claude/Grok, all backed by host_permissions (REAL post-fix)", async () => {
    const result = await descriptionPermissionMismatch.run(f("description-permission-mismatch-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing -> non-empty inconclusive reason", async () => {
    const result = await descriptionPermissionMismatch.run(f("does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
  });
});

describe("pack-fam2: web-accessible-resources-scope", () => {
  it("MUST_BLOCK: WAR matches <all_urls> while content_scripts scoped to 3 hosts", async () => {
    const result = await webAccessibleResourcesScope.run(f("web-accessible-resources-scope-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((fnd) => fnd.snippet === "<all_urls>")).toBe(true);
  });

  it("MUST_PASS: WAR matches subset of content_scripts.matches (REAL gptpowerups-extension)", async () => {
    const result = await webAccessibleResourcesScope.run(f("web-accessible-resources-scope-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: manifest.json missing -> non-empty inconclusive reason", async () => {
    const result = await webAccessibleResourcesScope.run(f("does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
  });
});

describe("pack-fam2: permission-diff-between-releases", () => {
  it("MUST_BLOCK: cookies gained vs prev snapshot, CHANGELOG silent", async () => {
    const result = await permissionDiffBetweenReleases.run(f("permission-diff-between-releases-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((fnd) => fnd.message.includes('"cookies"'))).toBe(true);
  });

  it("MUST_PASS: cookies gained vs prev snapshot, CHANGELOG documents it", async () => {
    const result = await permissionDiffBetweenReleases.run(f("permission-diff-between-releases-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE (tripolar): no prev snapshot -> inconclusive, never a silent pass", async () => {
    const result = await permissionDiffBetweenReleases.run(f("permission-diff-between-releases-noprev"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive.length).toBeGreaterThan(0);
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
    expect(result.inconclusive[0].reason).toContain("prev-manifest.json");
  });
});

describe("pack-fam2: runtime-external-messaging-exposure", () => {
  it("MUST_BLOCK: onMessageExternal handler with no sender.id check", async () => {
    const result = await runtimeExternalMessagingExposure.run(f("runtime-external-messaging-exposure-fail"));
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((fnd) => fnd.file === "src/background/service-worker.ts")).toBe(true);
  });

  it("MUST_PASS: onMessageExternal handler validating sender.id first", async () => {
    const result = await runtimeExternalMessagingExposure.run(f("runtime-external-messaging-exposure-pass"));
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: src/background missing -> non-empty inconclusive reason", async () => {
    const result = await runtimeExternalMessagingExposure.run(f("does-not-exist"));
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive[0].reason.length).toBeGreaterThan(0);
  });
});

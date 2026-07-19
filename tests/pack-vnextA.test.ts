/**
 * Family vnextA — 6 new bundle/HTML rules: bundle-file-size-cap,
 * hidden-file-in-bundle, binary-extension-in-bundle,
 * reserved-filename-in-bundle, json-file-parseable, inline-script-in-html.
 *
 * All 6 scan the BUILT bundle (dist/**), which is swallowed by the root
 * .gitignore's `dist/` rule — every fixture here is therefore built at
 * RUNTIME under a fresh os.tmpdir() mkdtemp directory, mirroring the
 * makeBuildPresentFixture() pattern in tests/core-infra.test.ts and
 * tests/pack-fam4.test.ts. Proves identically on a dirty working dir and a
 * fresh clone.
 */
import { describe, it, expect, afterAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { bundleFileSizeCap, SIZE_CAP_BYTES } from "../src/rules/bundle-file-size-cap.js";
import { hiddenFileInBundle } from "../src/rules/hidden-file-in-bundle.js";
import { binaryExtensionInBundle } from "../src/rules/binary-extension-in-bundle.js";
import { reservedFilenameInBundle } from "../src/rules/reserved-filename-in-bundle.js";
import { jsonFileParseable } from "../src/rules/json-file-parseable.js";
import { inlineScriptInHtml } from "../src/rules/inline-script-in-html.js";

const tmpRoots: string[] = [];

function makeBundleFixture(files: Record<string, string | Buffer>): string {
  const root = mkdtempSync(join(tmpdir(), "ed-pack-vnextA-"));
  tmpRoots.push(root);
  const buildDir = join(root, "dist", "chrome");
  mkdirSync(buildDir, { recursive: true });
  // requireFreshBuild() needs at least one .js/.mjs file present to accept
  // the build directory as "fresh" — every fixture below includes one.
  for (const [relPath, content] of Object.entries(files)) {
    const abs = join(buildDir, relPath);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

afterAll(() => {
  for (const root of tmpRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("bundle-file-size-cap", () => {
  it("MUST_BLOCK: a single file exceeding the size cap is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "vendor-blob.js": "x".repeat(SIZE_CAP_BYTES + 1),
    });
    const result = await bundleFileSizeCap.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.file).toBe("vendor-blob.js");
    expect(result.findings[0]?.message).toMatch(/exceeding the/);
  });

  it("MUST_PASS: every file under the cap is not flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "small-asset.js": "x".repeat(1024),
    });
    const result = await bundleFileSizeCap.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_REFUSE: no built bundle at all — inconclusive, exit code 2", async () => {
    const root = mkdtempSync(join(tmpdir(), "ed-pack-vnextA-nobundle-"));
    tmpRoots.push(root);
    const result = await bundleFileSizeCap.run(root);
    expect(result.verdict).toBe("inconclusive");
    expect(result.exitCode).toBe(2);
  });
});

describe("hidden-file-in-bundle", () => {
  it("MUST_BLOCK: .DS_Store shipped inside the bundle is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      ".DS_Store": "binary junk",
    });
    const result = await hiddenFileInBundle.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.file === ".DS_Store")).toBe(true);
  });

  it("MUST_PASS: no dotfile in the bundle is not flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "popup.html": "<!doctype html><html><body>hi</body></html>",
    });
    const result = await hiddenFileInBundle.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("binary-extension-in-bundle", () => {
  it("MUST_BLOCK: a .exe shipped inside the bundle is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "helper.exe": "MZ...",
    });
    const result = await binaryExtensionInBundle.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.file === "helper.exe")).toBe(true);
  });

  it("MUST_PASS: an ordinary .png asset is not flagged (image, not an executable extension)", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "icon.png": "\x89PNG fake bytes",
    });
    const result = await binaryExtensionInBundle.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("reserved-filename-in-bundle", () => {
  it("MUST_BLOCK: a leading-underscore file outside _locales is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "_metadata/verified_contents.json": "{}",
    });
    const result = await reservedFilenameInBundle.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.file?.startsWith("_metadata/"))).toBe(true);
  });

  it("MUST_BLOCK: thumbs.db is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "assets/Thumbs.db": "junk",
    });
    const result = await reservedFilenameInBundle.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings.some((f) => f.file === "assets/Thumbs.db")).toBe(true);
  });

  it("MUST_PASS: _locales/en/messages.json (the required i18n tree) is NOT flagged despite the leading underscore", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "_locales/en/messages.json": '{"appName":{"message":"x"}}',
    });
    const result = await reservedFilenameInBundle.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("json-file-parseable", () => {
  it("MUST_BLOCK: a .json with a trailing comma does not parse", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "_locales/en/messages.json": '{"appName":{"message":"x"},}',
    });
    const result = await jsonFileParseable.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings[0]?.file).toBe("_locales/en/messages.json");
  });

  it("MUST_PASS: valid JSON files are not flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "manifest.json": '{"manifest_version":3}',
    });
    const result = await jsonFileParseable.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

describe("inline-script-in-html", () => {
  it("MUST_BLOCK: an inline <script> with executable code is flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "popup.html": '<!doctype html><html><body><script>document.write("hi")</script></body></html>',
    });
    const result = await inlineScriptInHtml.run(root);
    expect(result.verdict).toBe("fail");
    expect(result.findings[0]?.file).toBe("popup.html");
  });

  it("MUST_PASS: a <script src=...> external reference is not flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "popup.html": '<!doctype html><html><body><script src="popup.js"></script></body></html>',
    });
    const result = await inlineScriptInHtml.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });

  it("MUST_PASS (cas tordu): an inline <script type=\"application/json\"> data block is not flagged", async () => {
    const root = makeBundleFixture({
      "background.js": "export const x = 1;\n",
      "popup.html":
        '<!doctype html><html><body><script type="application/json">{"a":1}</script></body></html>',
    });
    const result = await inlineScriptInHtml.run(root);
    expect(result.verdict).toBe("pass");
    expect(result.findings).toEqual([]);
  });
});

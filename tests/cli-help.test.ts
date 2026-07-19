/**
 * Regression for the published 0.1.0 defect: `--help` was treated as a scan
 * PATH instead of a flag, so it printed a score report instead of usage.
 * Also covers `--version`, which is DERIVED from package.json, never typed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { main } from "../src/cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

function captureStdout(): { restore: () => string } {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = original;
      return chunks.join("");
    },
  };
}

describe("cli --help / --version", () => {
  it("MUST_PASS: --help exits 0 and prints usage, never a score report", async () => {
    const capture = captureStdout();
    const code = await main(["--help"]);
    const output = capture.restore();

    expect(code).toBe(0);
    expect(output).toContain("extension-doctor <path-to-extension>");
    expect(output).not.toContain("score:");
    expect(output).not.toContain("/100");
  });

  it("MUST_PASS: -h is the same as --help", async () => {
    const capture = captureStdout();
    const code = await main(["-h"]);
    const output = capture.restore();

    expect(code).toBe(0);
    expect(output).toContain("extension-doctor <path-to-extension>");
  });

  it("MUST_PASS: --version prints the version DERIVED from package.json, never a hand-typed literal", async () => {
    const capture = captureStdout();
    const code = await main(["--version"]);
    const output = capture.restore();

    expect(code).toBe(0);
    expect(output.trim()).toBe(pkg.version);
  });

  it("MUST_PASS: -v is the same as --version", async () => {
    const capture = captureStdout();
    const code = await main(["-v"]);
    const output = capture.restore();

    expect(code).toBe(0);
    expect(output.trim()).toBe(pkg.version);
  });
});

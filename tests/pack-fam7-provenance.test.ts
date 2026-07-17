import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { runRules } from "../src/core/run.js";
import { netBroadcastUnfiltered } from "../src/rules/net-broadcast-unfiltered.js";
import { hostSignalUnverified } from "../src/rules/host-signal-unverified.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("ProvenanceEnvelope.command — structural guard on our own output", () => {
  it("always yields a non-empty command, on a passing run", async () => {
    const outcome = await runRules({
      extensionRoot: join(FIXTURES, "host-signal-pass"),
      rules: [netBroadcastUnfiltered, hostSignalUnverified],
      rulesRequested: 2,
      command: "extension-doctor run --rules net-broadcast-unfiltered,host-signal-unverified",
    });
    expect(outcome.envelope.command).toBeTypeOf("string");
    expect(outcome.envelope.command.length).toBeGreaterThan(0);
  });

  it("always yields a non-empty command, on a failing/inconclusive run", async () => {
    const outcome = await runRules({
      extensionRoot: join(FIXTURES, "host-signal-block"),
      rules: [hostSignalUnverified],
      rulesRequested: 1,
      command: "extension-doctor run --rules host-signal-unverified",
    });
    expect(outcome.envelope.command).toBeTypeOf("string");
    expect(outcome.envelope.command.length).toBeGreaterThan(0);
    // findings/inconclusive/perRule/score all travel in the SAME object as
    // command — never a separate call that could omit provenance.
    expect(outcome.envelope).toHaveProperty("score");
    expect(outcome.envelope).toHaveProperty("command");
  });
});

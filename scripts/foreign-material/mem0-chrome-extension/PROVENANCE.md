# Foreign material provenance

Verbatim copies (byte-for-byte, zero edits) of real files from a third-party
Chrome extension, used ONLY by `scripts/foreign-bite-probe.mjs` as "material
the rule author did not choose as this rule's fixture" — per Eta's PR #1
REVISE ("prouve que les règles lisent leurs fixtures, pas la classe").

- Source repo: https://github.com/mem0ai/mem0-chrome-extension (MIT)
- Commit pinned: `54a882ab6f2534006431c5e6b5c5c597db2a0236` (2026-03-24)
- Files copied verbatim, unmodified:
  - `manifest.json`
  - `src/background.ts`
  - `src/popup.ts`
  - `src/sidebar.ts`
  - `src/selection_context.ts`

None of these files are, or were ever, a fixture for any rule's own unit
test in this repo (`tests/fixtures/**`, `tests/*.test.ts` inline strings).
`scripts/foreign-bite-probe.mjs` copies them into a fresh OS tmpdir per rule,
injects exactly one variant-form violation, greps to assert the injection
landed, runs the built rule, then diffs the tmp copy against THIS committed
copy to prove the committed original was never touched (restoration proof).

This directory is read-only input. Never edit these 5 files to "fix" a
probe — if a probe fails against them, the rule (or the probe's injection),
not the foreign material, is what's wrong.

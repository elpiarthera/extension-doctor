# extension-doctor

A health linter for browser extensions (Manifest V3) — Chrome, Edge, Firefox, Brave.

## Why

Manifest V3 extensions fail in ways that never show up in a demo: a
`chrome.tabs.query({})` with no `url:` filter that quietly broadcasts to
every open tab in the browser instead of just the hosts the extension
supports; an i18n key consumed via `t('key')` in the UI but never added to
`_locales/en/messages.json` or `_locales/fr/messages.json`, so the user
sees the raw key string instead of a translated label; a
`chrome.runtime.sendMessage(...)` call with no guard against an invalidated
extension context, throwing on the host page's console after every reload
or update while the tab stays open and looks fine. None of these break the
build. All three are common causes of Chrome Web Store review rejections
and silent production breakage.

**The thesis: one production friction resolved = one rule added.** No rule
in this pack is speculative — each was written after a real bug shipped,
not before one was imagined.

Concretely, extension-doctor found these three real bugs in our own shipped
extension, at these exact lines:

- `src/background/conversations-handler.ts:66` — `chrome.tabs.query({})`
  with no url filter feeding `chrome.tabs.sendMessage`
- `src/background/media-handler.ts:135` — same pattern
- `src/background/projects-handler.ts:67` — same pattern
- `src/background/messaging.ts:52` — `chrome.runtime.sendMessage(message)`
  with no try/catch and no `chrome.runtime.id` guard

## Proof, not promise

A linter that fails on everything proves nothing. This one is measured
bipolar, against real git history of a shipped extension — not a synthetic
fixture built to flatter the matcher.

**Before the fix**, run against the commit that shipped the bugs:

```
extension-doctor — command: extension-doctor /tmp/r-before
scope: 338 files scanned, rules 3/3 active
score: 0/100

[FAIL] net-broadcast-unfiltered (exit 1)
[INCONCLUSIVE] i18n-key-coverage-gap (exit 2)
[FAIL] sw-context-invalidated-guard (exit 1)

Findings:
  [error] net-broadcast-unfiltered — src/background/conversations-handler.ts:66
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] net-broadcast-unfiltered — src/background/media-handler.ts:135
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] net-broadcast-unfiltered — src/background/projects-handler.ts:67
    chrome.tabs.query(...) with no url filter feeds chrome.tabs.sendMessage — broadcasts to every open tab in the browser, not just supported hosts.
    > chrome.tabs.query({})
  [error] sw-context-invalidated-guard — src/background/messaging.ts:52
    chrome.runtime.sendMessage(...) called with no try/catch and no chrome.runtime.id guard — throws/rejects after every extension reload while the host tab stays open.
    > chrome.runtime.sendMessage(message);
```

**After the fix**, same tool, same rules, the commit that fixed
`net-broadcast-unfiltered`:

```
extension-doctor — command: extension-doctor /tmp/r-after
scope: 340 files scanned, rules 3/3 active
score: 50/100

[PASS] net-broadcast-unfiltered (exit 0)
[INCONCLUSIVE] i18n-key-coverage-gap (exit 2)
[FAIL] sw-context-invalidated-guard (exit 1)
```

Read that after-block carefully — this is the honesty this tool is built
around, not a marketing cut of it:

- `net-broadcast-unfiltered` goes from FAIL to PASS: the three unfiltered
  `chrome.tabs.query({})` call sites were fixed.
- `sw-context-invalidated-guard` **stays FAIL**. The fix that landed
  covered the messaging layer (`messaging.ts:52`), but other unguarded
  `chrome.runtime.sendMessage` call sites still exist elsewhere in the
  codebase. The score is 50/100, not 100/100, because the tool reports
  what is actually still broken, not what got fixed.
- `i18n-key-coverage-gap` stays **INCONCLUSIVE on both runs**, not PASS.
  One key is built dynamically — `` t(`media_type_${media.type}`) `` — and
  the rule cannot statically resolve the interpolated value to a literal
  key. Rather than guess, it reports exit code `2` and says so. A rule
  that silently treated "could not resolve" as "found nothing" would be a
  worse rule than no rule at all.

## Install

```
npm i -D extension-doctor
```

or run it directly without installing:

```
npx extension-doctor <path-to-extension> [--rules id1,id2,...] [--format human|json]
```

A reader can run this in under two minutes without opening a single source
file:

```
npx extension-doctor .
```

## Rules shipped (v0.1 — 3 of 5 rules in the full spec)

| id | detects | severity |
|---|---|---|
| `net-broadcast-unfiltered` | `chrome.tabs.query({})` with no `url:` filter feeding `chrome.tabs.sendMessage` — broadcasts extension state to every open tab in the browser, not just supported hosts | error |
| `i18n-key-coverage-gap` | an i18n key consumed via `t('x')` in code but absent from `_locales/en/messages.json` or `_locales/fr/messages.json` | error |
| `sw-context-invalidated-guard` | `chrome.runtime.sendMessage(...)` with no guard against an invalidated extension context after a reload/update | error |

`--format json` emits the same findings as structured JSON for CI
consumption. Every scored output carries its own provenance (`command`,
`scope`) in the same object as the score — a score without the command
that produced it is treated as malformed by every consumer of this tool.

## Exit codes are three-valued, on purpose

This is a design decision, not a footnote:

- `0` — nothing found
- `1` — real defects found
- `2` — **could not measure**: a missing precondition, an unreadable file,
  or a dynamic value the tool refuses to guess at (see the
  `i18n-key-coverage-gap` example above)

**`2` is never `0`.** "I could not check" and "I checked and found
nothing" are two different claims, and conflating them is a known,
documented failure mode of at least one popular npm linter in this space —
extension-doctor deliberately does not reproduce it. A rule that cannot
measure fails loudly, via exit code `2`; it does not pass silently.

## CI integration

```yaml
- name: Extension health check
  run: npx extension-doctor . --format json
```

A non-zero exit (`1` or `2`) fails the job. Treat `2` as a build-blocking
signal, exactly like `1` — a CI step that only checks `exit === 1` will
let inconclusive scans through unnoticed.

## Honest scope

This pack ships **3 of the 5 rules** in the full spec. Not shipped in this
pass, and not silently dropped:

- `unused-file-export` — requires a cross-file export-usage graph, not yet
  built.
- `custom-element-orphan-registration` — requires a fresh `vite build`
  artifact as its own precondition, not yet wired in.

Every rule that *is* shipped distinguishes "ran and found nothing" from
"could not run at all" — a silent `if (nothing found) return []` fallback
is a banned pattern in this codebase. A rule that cannot measure says so,
loudly, via exit code `2`, and INCONCLUSIVE is never reported as PASS.

## Security

extension-doctor's static scan detects `fetch()` and `XMLHttpRequest` call
sites and cross-checks their host against the extension's declared
`host_permissions`. What that scan actually proves: **no network
destination outside the manifest detected statically**. It does not, and
cannot, prove the extension "doesn't spy on you" — a claim like that would
require dynamic analysis this tool does not do. In this project's own
codebase, three `fetch()` calls build their target URL dynamically at
runtime, which makes them undetectable by static analysis alone. A badge
that overclaims what a static scanner can see is worse than no badge.

## Prior art

This tool is written from scratch. The following were studied as prior art, no code derived — none of them are dependencies and no lines were copied from any of them:

- **[dot-skills](https://github.com/pproenca/dot-skills)** (MIT) — the idea
  behind `net-broadcast-unfiltered` and `sw-context-invalidated-guard` was
  informed by dot-skills' own notes on broadcast-to-all-tabs and
  context-invalidation handling. Studied as prior art, no code derived.
- **[addons-linter](https://github.com/mozilla/addons-linter)** (MPL-2.0) —
  studied as prior art for the general shape of a WebExtension linter.
  MPL-2.0 is copyleft; no code or derivative is included here. Studied as
  prior art, no code derived.
- **[react-doctor](https://www.npmjs.com/package/react-doctor)** — used
  strictly as a published tool (`npx react-doctor`), never read or copied
  as source. Its "Modified MIT" license restricts commercial redistribution
  of the tool itself; that restriction is respected by treating it purely
  as an external product we run, never a source we read. Studied as prior
  art, no code derived.

## License

See [LICENSE](./LICENSE) — MIT body plus a commercial-use clause requiring
prior written authorization. Contact lp@perello.consulting.

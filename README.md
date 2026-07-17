# extension-doctor

A health linter for browser extensions (Manifest V3). It exists to catch a
narrow, specific class of defect: the kind that stays invisible in a demo,
ships to production, and only breaks after the extension has already been
running for a while — a reload, an update, a second tab open.

## What sets it apart

Every rule in this pack was written *after* a real bug shipped, not before
one was imagined. That is the thesis of the tool: **one production friction
resolved = one rule added.** No rule here is speculative.

Concretely, on this very codebase:

- Three `chrome.tabs.query({})` calls with no `url:` filter fed straight
  into `chrome.tabs.sendMessage`, broadcasting extension state to **every
  open tab in the browser**, not just the hosts the extension supports.
- Six i18n keys (`card_menu_open`, `edit`, `duplicate`, `unfavorite`,
  `favorite`, `move_to_project`) were consumed in the UI via `t('key')`
  while missing from both `_locales/en/messages.json` and
  `_locales/fr/messages.json` — the user saw the raw key string in the
  menu, not a translated label.
- A `chrome.runtime.sendMessage(...)` call with no `chrome.runtime.id`
  guard and no try/catch crashed the host page's console on every
  extension reload/update, while the tab stayed open and looked fine.

Each of these was a real incident. Each became a rule. That loop is the
product.

## Proof, not promise

A linter that fails on everything proves nothing. This one is proven
bipolar: it fails loud on the exact commit that shipped the bug, and passes
clean once the fix landed — measured against real git history of a shipped
extension, not a synthetic fixture built to flatter the matcher.

Before the fix (`chi/d137-baseline-green`):

```
$ extension-doctor /tmp/ed-before --rules net-broadcast-unfiltered,sw-context-invalidated-guard
extension-doctor — command: extension-doctor /tmp/ed-before --rules net-broadcast-unfiltered,sw-context-invalidated-guard
scope: 338 files scanned, rules 2/2 active
score: 0/100

[FAIL] net-broadcast-unfiltered (exit 1)
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
  ... (6 more findings, one per unguarded call site)
```

After the fix (`chi/d137-backlog-fixes-v2`):

```
$ extension-doctor /tmp/ed-after --rules net-broadcast-unfiltered
extension-doctor — command: extension-doctor /tmp/ed-after --rules net-broadcast-unfiltered
scope: 340 files scanned, rules 1/1 active
score: 100/100

[PASS] net-broadcast-unfiltered (exit 0)
```

Same shape holds for `i18n-key-coverage-gap` against
`chi/d137-rebuild-zip-v0.9.0.0` (fails, flags all 6 missing keys) versus the
baseline where the same keys are present in both locales (passes). Full
tests in `tests/dogfood.test.ts`, run against real sibling git worktrees.

## Usage

```
npx extension-doctor <path-to-extension> [--rules id1,id2,...] [--format human|json]
```

Rules shipped in this pack (v0.1, 3 of 5 spec'd):

| id | detects | severity |
|---|---|---|
| `net-broadcast-unfiltered` | `chrome.tabs.query({})` with no `url:` filter feeding `chrome.tabs.sendMessage` — broadcasts to every open tab, not just supported hosts | error |
| `i18n-key-coverage-gap` | an i18n key consumed via `t('x')` in code but absent from `_locales/en/messages.json` or `_locales/fr/messages.json` | error |
| `sw-context-invalidated-guard` | `chrome.runtime.sendMessage(...)` with no guard against an invalidated extension context after a reload/update | error |

Every scored output carries its own provenance (`command`, `scope`) in the
same object as the score — a score without the command that produced it is
treated as malformed by every consumer of this tool.

Exit codes are three-valued and never conflated:

- `0` — nothing found
- `1` — real defects found
- `2` — could not measure (missing precondition, unreadable file,
  unresolvable dynamic value). **Never** treat exit `2` as exit `0`: an
  inconclusive scan is not a clean scan.

`--format json` emits the same findings as structured JSON for CI
consumption.

## Honest scope

This pack ships 3 of the 5 rules in the full spec. Not shipped in this
pass, and not silently dropped:

- `unused-file-export` — requires a cross-file export-usage graph, not yet
  built.
- `custom-element-orphan-registration` — requires a fresh `vite build`
  artifact as its own precondition, not yet wired in.

Every rule that *is* shipped distinguishes "ran and found nothing" from
"could not run at all" — `if (nothing found) return []` as a silent
fallback is a banned pattern in this codebase. A rule that cannot measure
says so, loudly, via exit code `2`.

## Prior art

This tool is written from scratch. The following were **studied as prior
art, no code derived** — none of them are dependencies and no lines were
copied from any of them:

- **[dot-skills](https://github.com/wesbos/dot-skills)** (MIT) — the idea
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

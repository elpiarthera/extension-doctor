# extension-doctor

Static-analysis CLI that audits browser extensions (Manifest V3) for durable
architecture defects — the kind that break silently after every browser
update, not the kind a linter already catches.

```
npx extension-doctor <path-to-extension> [--rules id1,id2,...] [--format human|json]
```

Every scored output carries its own provenance (`command`, `scope`) in the
SAME JSON object as the score — a score without the command that produced it
is treated as malformed by every consumer of this tool.

Exit codes are three-valued and never conflated:
- `0` — nothing found
- `1` — real defects found
- `2` — could not measure (missing precondition, unreadable file, unresolvable
  dynamic value) — **never** silently treated as clean.

## Rules shipped in this MVP (v0.1, 3 of 5 in the full rule pack)

| id | detects | severity |
|---|---|---|
| `net-broadcast-unfiltered` | `chrome.tabs.query({})` with no `url:` filter feeding `chrome.tabs.sendMessage` — broadcasts extension state to every open tab, not just supported hosts | error |
| `i18n-key-coverage-gap` | an i18n key consumed via `t('x')` in code but absent from `_locales/en/messages.json` or `_locales/fr/messages.json` | error |
| `sw-context-invalidated-guard` | `chrome.runtime.sendMessage(...)` with no guard against an invalidated extension context after a reload/update | error |

Not shipped in this pass (documented, not silently dropped — see the full
rule pack spec for their contracts):
- `unused-file-export` — requires cross-file export-usage graph analysis
- `custom-element-orphan-registration` — requires a fresh `vite build`
  artifact as its own precondition

Each rule fails LOUD when it cannot measure — see the "§Échec bruyant"
section of the rule pack spec. `if (nothing found) return []` is a banned
implementation pattern in this codebase; every rule distinguishes "ran and
found nothing" from "could not run at all".

## Prior art

This tool is written from scratch. No source code was copied from any of the
following — they are cited as **ideas studied**, not dependencies:

- **[dot-skills](https://github.com/wesbos/dot-skills)** (MIT) — the
  `net-broadcast-unfiltered` and `sw-context-invalidated-guard` rules are
  inspired by the *idea* documented in dot-skills'
  `msg-avoid-broadcast-to-all-tabs.md`, `api-query-tabs-efficiently.md`,
  `api-handle-context-invalidated.md`, and `err-context-invalidation.md`
  notes. Zero lines of dot-skills code are used.
- **[addons-linter](https://github.com/mozilla/addons-linter)** (MPL-2.0) —
  studied as prior art for the general shape of a WebExtension linter.
  MPL-2.0 is copyleft; no code or derivative of addons-linter is included
  here.
- **[react-doctor](https://www.npmjs.com/package/react-doctor)** (Modified
  MIT) — used as a published tool (`npx react-doctor`) to audit our own
  codebase, which surfaced two of the real defects this rule pack's dogfood
  proof relies on (`unused-file-export` and `custom-element-orphan-registration`
  candidates). No react-doctor source code is read or included — normal
  usage of the published product only.

## License

See [LICENSE](./LICENSE) — MIT body plus a commercial-use clause requiring
prior written authorization. Contact lp@perello.consulting.

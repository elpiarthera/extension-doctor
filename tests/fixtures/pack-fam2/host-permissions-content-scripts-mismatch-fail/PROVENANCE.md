# FIXTURE PROVENANCE

`manifest.json` in this directory is a verbatim copy of the CURRENT
`gptpowerups-extension` manifest.json (commit `cd954fc`, v0.9.0.0, HEAD of
`origin/chi/d137-baseline-green` as of 2026-07-17). `host_permissions`
includes `https://*.x.ai/*` and `https://files.oaiusercontent.com/*`, neither
of which has a corresponding `content_scripts.matches` entry — the extension
never injects a content script into either origin. This is the unresolved
"signal à vérifier" for item 22 in
docs/analysis/extension-doctor-state-of-the-art-2026-07-17.md.

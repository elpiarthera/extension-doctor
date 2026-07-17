# FIXTURE PROVENANCE

Synthetic fixture (not extracted from git history). `manifest.json` mirrors
gptpowerups-extension's real content_scripts (3 hosts) but its
`web_accessible_resources[0].matches` is mutated to `["<all_urls>"]` — a
plausible regression (e.g. a copy-paste from a Chrome MV3 boilerplate) that
would expose bundled icons/assets to fetch()/fingerprinting from any website,
not just the 3 supported hosts.

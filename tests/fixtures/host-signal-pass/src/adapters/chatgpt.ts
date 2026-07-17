/**
 * MUST_PASS fixture — one selector annotated with a dated DOM-fixture
 * reference, one W3C-standard API exempt from verification.
 */
export const SITE_CONFIG = {
  // verified: qa/dom-snapshots/chatgpt/2026-07-17.html
  composerSelector: document.querySelector('[data-testid="composer-input"]'),
  htmlLang: document.documentElement.lang,
};

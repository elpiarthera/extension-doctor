// FIXTURE PROVENANCE: synthetic, labeled — same intent as
// sw-toplevel-fail/src/background/service-worker.ts, fixed to register
// listeners synchronously at module top-level, including a conditional
// top-level registration that must NOT be flagged (if(...) is a
// control-flow block, not a function boundary).
const DEBUG = false;

chrome.runtime.onMessage.addListener((msg) => {
  console.log(msg);
});

if (DEBUG) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log("installed, debug mode");
  });
}

// FIXTURE PROVENANCE: synthetic, labeled — same intent as
// sw-keepalive-fail/src/background/keepalive.ts, fixed to use
// chrome.alarms instead of setInterval, plus a >=30s setTimeout debounce
// that should NOT be flagged (delay above threshold).
chrome.alarms.create("sync-data", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-data") {
    console.log("sync tick");
  }
});

export function scheduleLongDelay(): void {
  setTimeout(() => {
    console.log("fires after 60s, not a keepalive concern");
  }, 60000);
}

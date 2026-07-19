// FIXTURE PROVENANCE: synthetic, authored for the literal-vs-code regression
// probe on sw-context-invalidated-guard. The trigger pattern
// "chrome.runtime.sendMessage(...)" appears ONLY inside a quoted string
// literal (a log message / doc comment style string) below — nothing
// executes. A rule that fires here is reading a literal as code.
export function logExampleUsage(): void {
  const example = "chrome.runtime.sendMessage(payload)";
  console.log("call it like this: " + example);
}

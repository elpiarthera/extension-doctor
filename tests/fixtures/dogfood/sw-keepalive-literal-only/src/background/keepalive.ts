// FIXTURE PROVENANCE: synthetic, authored for the literal-vs-code regression
// probe on sw-no-keepalive. The trigger pattern
// "setInterval(keepAlive, 20000)" appears ONLY inside a quoted string
// literal (help/log copy) below — nothing executes. A rule that fires here
// is reading a literal as code.
export function warnAgainstKeepalive(): void {
  const badExample = "setInterval(keepAlive, 20000)";
  console.warn("do not do this: " + badExample);
}

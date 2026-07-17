// FIXTURE PROVENANCE: synthetic, labeled — same shape as
// mem-cleanup-fail/src/content/hover-card.ts, with two accepted fixes: a
// symmetric add/remove pair, and a declared-permanent listener using the
// // ed-permanent-listener: exception comment for a listener that must live
// for the page's entire lifetime.
export function mountHoverCard(): { unmount: () => void } {
  function onMove(event: MouseEvent): void {
    console.log(event.clientX, event.clientY);
  }
  document.addEventListener("mousemove", onMove);
  return {
    unmount(): void {
      document.removeEventListener("mousemove", onMove);
    },
  };
}

export function installSpaNavigationWatcher(): void {
  function onPopState(): void {
    console.log("navigated");
  }
  // ed-permanent-listener: SPA navigation watcher, no unmount hook exists
  window.addEventListener("popstate", onPopState);
}

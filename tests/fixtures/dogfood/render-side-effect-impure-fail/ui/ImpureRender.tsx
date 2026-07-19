// FIXTURE PROVENANCE: synthetic, labeled — a component that writes to
// localStorage directly in its render body (top-level of the component
// function, not inside useEffect/useCallback/an event handler), so the
// write re-runs on every render instead of on mount/update only.
export function ImpureRender(): null {
  localStorage.setItem("gptu-last-open", Date.now().toString());
  return null;
}

// FIXTURE PROVENANCE: synthetic consumer, labeled synthetic —
// imports the barrel instead of "./components/button.js" directly.
import { Button } from "./components/index.js";

export function render(): string {
  return Button();
}

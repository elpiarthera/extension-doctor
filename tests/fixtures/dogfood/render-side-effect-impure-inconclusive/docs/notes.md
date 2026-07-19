# fixture: no ui/ or src/ui root present

This directory intentionally contains no scannable component source root so
that render-side-effect-impure reports "inconclusive" rather than a silent
pass.

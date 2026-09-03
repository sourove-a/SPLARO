# Code Quality & Deep Analysis Rules

## 1. Deep Analysis Before Any Code Change (Strictly Mandatory)
- **Zero Guesswork / No "Hut Hat" Edits:** Never make quick, rushed, or superficial code edits without understanding the full context.
- **Trace Full Lifecycle:** Before writing or changing even a single line of code, trace the entire data flow, state lifecycle, component tree, and API route dependencies.
- **100% Certainty:** Be 100% sure of the root cause, side effects, and exact implementation approach before editing.
- **Clean & Robust Engineering:** Write clean, elegant, readable, and robust code. Adhere strictly to existing architectural patterns, design tokens, and TypeScript types.
- **Verify Thoroughly:** Always run typechecks, lint, unit tests, and port probes locally after making changes.

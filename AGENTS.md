# AGENTS.md

Guidelines for AI agents working in this repository.

## Scope

- Match-3 browser game using TypeScript and ES modules.
- Prefer clarity and simplicity over cleverness or abstraction.

## Structure

- `index.html` — markup and asset links
- `css/` — styles
- `src/` — TypeScript modules
- `dist/` — compiled output

## Code style

- 4-space indentation.
- BEM naming for CSS; keep names consistent across HTML/TS/CSS.
- No new dependencies unless explicitly requested.
- Code should be self-explanatory; avoid decorative patterns.

## Workflow

- Keep `tsconfig.json` strict; do not loosen types.
- Run `tsc` before serving.
- Use a local web server (ES modules required).
- Update `README.md` and use english when structure or run instructions change.

## Design rules

- Apply SOLID pragmatically.
- Prefer class-based design for core game concepts.
- One significant class per file.
- Favor loose coupling; depend on abstractions.
- Use messages/events only when they clearly improve decoupling.
- Avoid architectural patterns without clear benefit.
- Keep cyclomatic complexity low (≤10 paths per function).
- Reduce deep nesting via early returns or helpers.
- Prefer behavior-preserving refactors unless told otherwise.

## Comments

- Comment *why*, not *what*.
- Document non-obvious rules, constraints, and edge cases.
- Do not restate code.
- Remove stale comments during refactors.
- Comment in english.
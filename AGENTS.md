# AGENTS.md

Guidelines for AI agents working in this repository.

## Scope

- Match-3 browser game using TypeScript and ES modules.
- Prefer clarity and simplicity over cleverness or abstraction.

## Structure

- `templates/` — markup. You may not modify `index.html`, because that is a genearted file.
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
- npm is used only for dependency management and scripts
- TypeScript compiler (`tsc`) is the source of truth for builds
- No runtime JavaScript is committed to the repository
- Do not remove npm usage
- Prefer `npm run <script>` over direct tool invocation
- Use a local web server (ES modules required).
- Update `README.md` and use english when structure or run instructions change.

## Design rules

- Apply SOLID pragmatically.
- Prefer class-based design for core game concepts.
- One significant class per file.
- Favor loose coupling; depend on abstractions.
- Use messages/events only when they clearly improve decoupling.
- Keep cyclomatic complexity low (≤10 paths per function).
- Reduce deep nesting via early returns or helpers.
- Prefer behavior-preserving refactors unless told otherwise.

## Game Architecture

- Favor data-oriented logic
- Avoid over-abstracted systems
- ECS-style patterns are acceptable only if clearly beneficial
- Small, composable functions are preferred

## Git Ignore Policy

- Generated files must not be tracked
- `.gitignore` changes require removing files from the index
- Do not re-add ignored files to the repository

## Comments

- Comment *why*, not *what*.
- Document non-obvious rules, constraints, and edge cases.
- Do not restate code.
- Remove stale comments during refactors.
- Comment in english.
- Keep comments updated when the code changes.
- Comment in JSDoc style.

### Comments are allowed only when explaining:
- non-obvious constraints
- performance tradeoffs
- browser / engine quirks
- “why this exists” logic
- something the future me would be confused about without a comment

Example of an acceptable comment:
`// We snapshot input here because the game loop mutates state mid-frame`

### Types are the primary documentation

- Prefer explicit types over comments
- Use meaningful type and interface names
- If types can explain intent, do not add comments
- Avoid any
- Prefer readability over maximal type cleverness

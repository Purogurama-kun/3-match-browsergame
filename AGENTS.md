# AGENTS.md

Guidelines for AI agents working in this repository.

## Scope

- Match-3 browser game with TypeScript and ES modules.
- Keep code simple and readable; prefer small, focused helpers.

## Project structure

- `index.html` for markup and asset links.
- `css/` for styles.
- `src/` for TypeScript modules.
- `dist/` for compiled JavaScript output.

## Conventions

- Use 4-space indentation in all files.
- Keep comments minimal and only where logic is non-obvious.
- Avoid introducing new dependencies unless requested.

## Development

- Use strict TypeScript settings; keep `tsconfig.json` strict and avoid loosening types.
- Use BEM naming for CSS classes; keep class names consistent across HTML/TS/CSS.
- Run `npm run build` to compile TypeScript before serving.
- Use a local web server (ES modules require it), e.g. `python3 -m http.server`.
- Update `README.md` if you change structure or run instructions.

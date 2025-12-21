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

## JSDoc Documentation Guidelines

### 1. Purpose
This project uses JSDoc-style comments to generate HTML documentation.
All public APIs must be documented. Its goal is to ensure consistent, high-quality,
machine-readable and human-friendly documentation.

### 2. Documentation Standard
- Use JSDoc (`/** ... */`)

### 3. Language
- All JsDoc MUST be written in **English**
- Use complete sentences
- Use clear, professional, and neutral language
- Avoid slang, abbreviations, and colloquial expressions

### 4. General Principles

- Documentation describes **what the code does**, not how it is implemented
- Focus on **behavior and intent**, not internal logic
- Avoid repeating names of classes or methods in the description
- Prefer clarity over verbosity
- Documentation MUST remain accurate when implementations change

#### 5. Class Description

Every class MUST include JsDoc that contains:

1. A short summary sentence (mandatory)
2. An optional detailed description (one or more paragraphs)
3. A clear explanation of the class responsibility

##### Rules

- The first sentence MUST be a complete sentence
- Start descriptions with a verb such as:
  - "Represents..."
  - "Provides..."
  - "Defines..."
  - "Manages..."

### 6. What Must Be Documented
Document the following with JSDoc:
- Public classes
- Public functions
- Public methods
- Configuration objects
- Callback signatures

Private functions do not require documentation unless complex.

### 7. Required JSDoc Tags

#### Functions / Methods
- @param (with type and description)
- @returns (if applicable)
- @throws (if errors are possible)

#### Classes
- @class
- @constructor (if non-trivial)

#### Optional Tags
- @example
- @deprecated
- @since
- @see

### 8. Example

```js
/**
 * Calculates the total price including tax.
 *
 * @param {number} netPrice - Net price
 * @param {number} taxRate - Tax rate (e.g. 0.19)
 * @returns {number} Gross price
 *
 * @example
 * calculateTotal(100, 0.19); // 119
 */
function calculateTotal(netPrice, taxRate) {
  return netPrice * (1 + taxRate);
}
```
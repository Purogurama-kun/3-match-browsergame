# 3-Match Browsergame

Small Match-3 browser game with sounds and boosters, written in TypeScript.

## Features

- 4- and 5-tile matches spawn line and radius bombs.
- Cascading matches after drops, with automatic refills.
- Swap modes: free swaps or require a valid match.
- Score, moves, and level targets with level-up/level-fail flow.
- Sound effects and screen shake feedback.

## Run locally

This project uses ES modules and TypeScript, so you need to build it and run a local web server.

```bash
npm install
npm run build
python3 -m http.server
```

Then open `http://localhost:8000` in your browser.

## Project structure

- `index.html` page markup
- `css/styles.css` styles
- `src/main.ts` entry point
- `src/match3-game.ts` game orchestration
- `src/board.ts` board and cell logic
- `src/hud.ts` HUD updates
- `src/sound-manager.ts` sound playback
- `src/constants.ts` shared constants and helpers
- `src/types.ts` shared types
- `dist/` compiled JavaScript output
- `assets/sounds/` sound effects, including match and booster variants

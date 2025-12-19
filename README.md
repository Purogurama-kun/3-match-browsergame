# 3-Match Browsergame

Small Match-3 browser game with sounds and boosters.

## Run locally

This project uses ES modules, so you need a local web server.

```bash
python3 -m http.server
```

Then open `http://localhost:8000` in your browser.

## Project structure

- `index.html` page markup
- `css/styles.css` styles
- `js/main.js` entry point
- `js/match3-game.js` game orchestration
- `js/board.js` board and cell logic
- `js/hud.js` HUD updates
- `js/sound-manager.js` sound playback
- `js/constants.js` shared constants and helpers

# Explosive candy

Small Match-3 browser game with boosters, goals, and sound feedback, written in TypeScript.

## Features

- Match detection for lines, squares, and T/L shapes with chain reactions and refills.
- Boosters: line bombs and small/medium/large burst bombs from special matches.
- Large burst bombs can be triggered directly on click.
- 50 kuratierte Levels mit steigenden Zielen, Boss-ähnlichen Herausforderungen alle zehn Stufen und Layouts mit fehlenden Zellen.
- Levels mit begrenzten Zügen, Zielpunkten und pro-Level-Zielen (Farben zerstören oder Booster aktivieren).
- Harte Bonbons, die erst durch angrenzende Matches oder Bombenexplosionen weich werden und danach matchbar sind.
- Free-swap or require-match swap modes, plus swipe and click controls.
- Combo multiplier scoring with HUD feedback.
- Sound effects, optional audio toggle, and screen shake on impactful actions.

## Known errors

- Speech synthesis is not working on chrome browsers, so firefox is recommended.

## Run locally

This project uses ES modules and TypeScript, so you need to build it and run a local web server.

```bash
tsc -w
python3 -m http.server
```

Then open `http://localhost:5500` in your browser.

## Project structure

- `index.html` page markup
- `css/styles.css` styles
- `src/main.ts` entry point
- `src/match3-game.ts` game orchestration
- `src/board.ts` board and cell logic
- `src/hud.ts` HUD updates
- `src/sound-manager.ts` sound playback
- `src/constants.ts` shared constants and helpers
- `src/levels.ts` fixed level data with targets, goals, and difficulty
- `src/types.ts` shared types
- `dist/` compiled JavaScript output
- `assets/sounds/` sound effects, including match and booster variants

## Google OAuth setup steps

1. https://console.cloud.google.com/auth/overview?project=explosivecandy
2. create project
3. Go to: "Menu > APIs and services > OAuth consent screen"
4. Add a new entry (for external)
5. Create OAuth client ID: choose Web application and add e.g. 'http://localhost' and 'http://localhost:5500' to 'Authorised JavaScript origins' and 'http://localhost:5500' to 'Authorised redirect URIs'

The client ID is the public identifier of the app in Google’s login system. Client-ID: 276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com

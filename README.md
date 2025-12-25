# Explosive candy

Small Match-3 browser game with boosters, goals, and sound feedback, written in TypeScript.

## Features

- Match detection for lines, squares, and T/L shapes with chain reactions and refills.
- Boosters: line bombs and small/medium/large burst bombs from special matches.
- Large burst bombs can be triggered directly on click.
- 50 kuratierte Levels mit steigenden Zielen, Boss-ähnlichen Herausforderungen alle zehn Stufen und Layouts mit fehlenden Zellen.
- Levels mit begrenzten Zügen, Zielpunkten und pro-Level-Zielen (Farben zerstören oder Booster aktivieren).
- Harte Bonbons, die erst durch angrenzende Matches oder Bombenexplosionen weich werden und danach matchbar sind.
- Blocker-Modus mit zunehmender Härte, Highscore-Speicherung und automatischer Niederlage, sobald keine gültigen Züge mehr existieren.
- Zeit-Modus mit Echtzeit-Timer, Geschwindigkeits-Anstieg, Zeitboni durch Matches und Ziele sowie persistenter Bestzeit.
- Require-match swap mode, plus swipe and click controls.
- Combo multiplier scoring with HUD feedback.
- Sound effects, optional audio toggle, and screen shake on impactful actions.
- English and German UI text with a language selector in the options menu.
- 5% chance of bombs falling from above on max multiplier (0% chnace on x0 multiplier)

## Known errors

- Speech synthesis is not working on chrome browsers, so firefox is recommended.

## Run locally

This project uses ES modules and TypeScript, so you need to build it and run a local web server.

```bash
npm init -y
npm install --save-dev typescript
npm install --save-dev jsdoc
npm run build
npm run server
```

Then open `http://localhost:5500` in your browser.

The PHP server exposes `backend/progress.php`, which persists user progress to `backend/progress.sqlite`. The database file is created automatically on first write and now also stores leaderboard runs:

- `action=leaderboard&mode=LevelMode|BlockerMode|TimeMode` (GET) returns paged global entries ordered by best result.
- `action=history&mode=LevelMode|BlockerMode|TimeMode&userId=<id>` (GET) returns the requesting user’s past runs ordered best-first.
- POST requests still accept progress updates and now record completed runs for all modes when supplied.

### NPM run commands

- `npm run build` ➔ `tsc`
- `npm run watch` ➔ `tsc -w`
- `npm run server` ➔ `php -c backend/php.ini -S 0.0.0.0:5500 -t .`
- `npm run docs` ➔ `jsdoc -c jsdoc.json`
- `npm run codex` ➔ `codex --model gpt-5.1-codex-mini` (is very token cheap)
- `npm run codex:exec` ➔ `codex exec --model gpt-5.1-codex-mini`
- `npm run codex:apply` ➔ `codex apply` (modify files after `codex exec` based on the diff. Afterwards you can use `git add .`)

## Setup php

Use `http://127.0.0.1:5500/backend/phpinfo.php` to see the php.ini location.

- php.ini must have: extension=pdo_sqlite, extension=sqlite3.
- `sudo apt-get install php-sqlite3`

## Technical details

The project uses the following concepts:
- BEM in CSS
- JSDoc for javascript commenting
- npm
- typescript

## Login & Fortschritt

- Im Hauptmenü kannst du dich per Google Login anmelden (Client-ID ist bereits hinterlegt) – du kannst aber auch als Gast direkt den Level Modus starten.
- Nach erfolgreicher Anmeldung wird dein Name im Menü angezeigt.
- Der höchste freigeschaltete Level, dein Blocker-Highscore und deine Zeit-Modus-Bestzeit werden serverseitig in einer SQLite-Datenbank gespeichert. Beim Login wird der Fortschritt anhand deiner Google-User-ID geladen, sodass er geräteunabhängig verfügbar ist.
- Fortschritt ohne Login wird lokal gespeichert (localStorage). Meldest du dich später an, wird der lokale Fortschritt inklusive Highscore mit deinem Konto synchronisiert.

## Git workflow

Changes to new branch:
```
git checkout -b my-new-branch
git add .
git commit -m "Description"
git push -u origin my-new-branch (afterwards `git push`)
git checkout main
git pull (needs to be up-to-date)
git merge my-new-branch
```

**Remove unselected changes:**
If codex wrote something you do not like and you haven't used `git add .`, then you can easily restore the current branch state.
```
git restore .
```

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
5. Create OAuth client ID: choose Web application and for local testing add 'http://localhost:5500' and 'http://127.0.0.1:5500' to 'Authorised JavaScript origins' and NOTHING to 'Authorised redirect URIs'. This setting is used with FedCM (is a method to do google auth in javascript).
6. Go to: "Menu > APIs and services > OAuth consent screen > Audience" add here test users. When your project is in the publishing status testing, then only test users can login.

Note that 'http://localhost:5500' ≠ 'http://127.0.0.1:5500'! FedCM is extremly strict.
The client ID is the public identifier of the app in Google’s login system. Client-ID: 276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com

## ChatGPT Codex Token Saving

Use `npm run codex` to be token efficient -e.g.:
- `npm run codex:exec -- "Fix null handling in src/auth/session.ts"`
- `sed -n '40,80p' src/auth/session.ts | npm run codex:exec -- "Fix null handling in src/auth/session.ts"` (with context)

### Token costs

#### Codex Credit Costs

| Task Type     | Unit          | GPT-5.2 & GPT-5.2-Codex | GPT-5.1-Codex-mini |
|--------------|---------------|-------------------------|--------------------|
| Local Tasks  | 1 message     | ~5 credits              | ~1 credit          |
| Cloud Tasks  | 1 message     | ~25 credits             | Not available      |
| Code Review  | 1 pull request| ~25 credits             | Not available      |

Here is a overview freom ChatGPT about their credit costs: https://help.openai.com/en/articles/11481834-chatgpt-rate-card-business-enterpriseedu .

Note that credits aren't tokens. Credit prices do not map 1:1 to token usages. You can buy 1'000 credits for 40€ and pay per action. But the table is still relevant, because it shows internal calculation costs and what uses less tokens.

### Token-Efficient Configuration

| Measure                                      | Description                                               | Typical Token Savings |
| -------------------------------------------- | --------------------------------------------------------- | --------------------- |
| **Local instead of Cloud Agents**            | Local execution prevents repeated repository re-ingestion | **30–50%**            |
| **Do not create PRs via Codex**              | Codex only edits code locally; PRs are created manually   | **25–50%**            |
| **Console instead of VS Code Extension**     | No automatic context expansion                            | **30–60%**            |
| **Disable explanations**                     | No explanatory text in responses                          | **10–30%**            |
| **So not use code reviews**                  | Avoids read-only repository scans (bad:`codex review`)    | **20–40%**            |
| **Use smaller models instead of GPT-5.2**    | Avoids reasoning overkill for standard tasks              | **25–60%**            |
| **Do not run CLI commands via Codex**        | Prevents log ingestion and repeated context growth        | **10–60%**            |

### VS Code

| Measure                                      | Description                                               | Typical Token Savings |
| -------------------------------------------- | --------------------------------------------------------- | --------------------- |
| **Disable auto repository search**           | Prevents silent background context buildup                | **20–50%**            |

### Token-Efficient Prompts

| Measure                                      | Description                                               | Typical Token Savings |
| -------------------------------------------- | --------------------------------------------------------- | --------------------- |
| **Diff only**                                | Return only code changes, not full files                  | **30–70%**            |
| **Explicitly define new classes**            | Avoids pattern mining (e.g. “Implement TimeMode”)         | **10–25%**            |
| **English prompts**                          | More efficient tokenization                               | **5–15%**             |
| **Batch prompts instead of single prompts**  | One shared context for multiple tasks                     | **15–35%**            |
| **Provide context manually**                 | Prevents automatic repository scanning                    | **30–60%**            |
| **Explicit file list**                       | Disables repository-wide search                           | **20–50%**            |
| **Line-range selection**                     | Send only relevant code lines                             | **30–70%**            |

### Glossary

- **“Batch prompts instead of single prompts”**:  
  Combine multiple related tasks into a single prompt (e.g. `Tasks: 1. Fix Bug A; 2. Fix Bug B; …`) so the context is loaded once.

- **“Provide context manually”**:  
  In VS Code, select the relevant lines before invoking Codex; in the console, include context explicitly in the prompt (e.g. `Context: File: src/auth/session.ts (lines 40–80)`).

- **“Explicit file list”**:  
  State exactly which files may be modified (e.g. `Modify only: src/game.ts`).

- **“Do not run CLI commands via Codex”**:  
  Running commands like `tsc` through Codex is expensive because Codex executes the command, reads stdout and stderr, interprets the output, and keeps it as context for follow-up actions. CLI logs can be very large and quickly consume tokens.

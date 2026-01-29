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
- Progressive Web App shell with a manifest and service worker that caches static assets for offline use.
- Combo multiplier scoring with HUD feedback.
- Sound effects, optional audio toggle, and screen shake on impactful actions.
- English and German UI text with a language selector in the options menu.
- 5% chance of bombs falling from above on max multiplier (0% chnace on x0 multiplier)
- Auto shuffle on no possivble moves
- Sugar chest and sugar coins
- Shop with available boosters
- Blocker generator
- silent re-login with Google when a previously consented account exists (initial Google iframe load may log a harmless 403 while the button renders).

## Known errors

- Speech synthesis is not working on chrome browsers, so firefox is recommended.

## Run locally

This project uses ES modules and TypeScript, so you need to build it and run a local web server.

```bash
npm init -y
npm install --save-dev typescript
npm install --save-dev jsdoc
npm install --save-dev pwa-asset-generator
npm run render
npm run build
npm run server
```

`npm run render` compiles the `templates/` files into `index.html`; the build scripts also run it automatically before regenerating the service worker cache list.

Then open `http://localhost:5500` in your browser.

Running the server after `npm run build` lets the manifest and service worker register automatically, so a single visit caches the core shell for offline use.

For a deployable bundle, run `npm run publish`. It rebuilds the project and writes a `public/` folder containing everything that should be uploaded to the server.

## Level editor (local tool)

A lightweight level editor lives in `level-editor/`. It is a standalone, local-only web UI for editing `assets/data/levels.json`.

Run the local server and open `http://localhost:5500/level-editor/` in the browser. The editor auto-loads `/assets/data/levels.json`. Use "Save to project" to write back via the local PHP server, or "Save levels.json" to download a copy.

## Content data (levels + story + modes)

Non-programmer friendly content files live in `assets/data/`:

- `assets/data/levels.json` controls the level list.
- `assets/data/story-acts.json` controls acts and cutscenes.
- `assets/data/blocker-mode.json` controls blocker mode tuning.
- `assets/data/time-mode.json` controls time mode tuning.
- `assets/data/level-mode.json` controls level-mode rewards and bomb drop chances.
- `assets/data/score.json` controls shared scoring rules.
- `assets/data/shop.json` controls shop prices.

### Levels

Each entry in `assets/data/levels.json` supports the same fields as before (`moves`, `targetScore`, `goals`, etc). The array order defines the level number, so `id` is optional and ignored.

You can also define a board layout in plain text instead of cell indices:

```json
{
  "board": {
    "rows": [
      ".1.1.1.1.1.1.1.1",
      ".1.1R1.1.1H1.1.1",
      ".1.1R1.1.1H1.1.1",
      ".1.1R1.1.1H1.1.1",
      ".1.1R1.1.1H1.1.1",
      ".1.1.1.1.1.1.1.1",
      ".1.1.1.1T1.1.1.1",
      ".1.1.1.1X1.1.1.1"
    ]
  }
}
```

Board tokens:

- `.1` any candy (random)
- `X1` blocked / gap cell
- `H1` hard candy (1 hit), `H2` (2 hits), `H3` (3 hits)
- `T1` blocker generator
- `R1` red, `A1` amber, `B1` blue, `P1` purple, `G1` green
- `L1` line bomb (horizontal), `V1` line bomb (vertical)
- `S1` burst small bomb, `M1` burst medium bomb, `U1` burst large bomb
- `C1`, `C2`, `C3` sugar chest stage 1-3

Spaces are optional: `"R1 .1 .1 X1 .1 .1 .1 .1"` works too. If a `board` is provided, it overrides `missingCells`, `hardCandies`, and `blockerGenerators`.

### Story acts

`assets/data/story-acts.json` uses one entry per act:

- `start_level`, `end_level`
- `label` (string or `{ "en": "...", "de": "..." }`)
- `cutscene_image_path`, `cutscene_text` (string or localized object)
- `cutscene_duration_ms` (optional)
- `end_cutscene_*` fields (optional, shown after `end_level`)

The PHP server exposes `backend/progress.php`, which persists user progress to `backend/progress.sqlite`. The schema now relies on two tables (`User` and `GameProgress`) so each account keeps its googleID, username, nationality and aggregated stats (scores, coins, powerups, level) with `GameProgress.userID` referencing `User.id`. New accounts start with the username `Player#[id]` instead of the raw googleID and the SQLite file is created automatically on first write.

### Blocker mode config

`assets/data/blocker-mode.json` lets you tune blocker mode without touching code:

- `targetScoreBase`, `targetScoreStep` control how the next target score is set.
- `hardeningIntervalMoves` controls how often the board hardens.
- `startingHardCandyChance`, `hardCandyChancePerTier`, `maxHardCandyChance` control hard candy spawn chances.
- `hardenBaseCount`, `hardenTierDivisor` control how many cells harden per interval.
- `generatorSlots` is a list of `{ "row": 0, "col": 1 }` entries (0-based, grid is 8x8).
- `difficultyTiers` defines the tier thresholds for `normal`, `hard`, `expert`, `nightmare`.

You can also use `generatorIndices` (0-63) instead of `generatorSlots`.

### Time mode config

`assets/data/time-mode.json` controls time mode tuning:

- `startingTime`, `baseDrainMultiplier`, `accelerationIntervalSeconds`, `accelerationStep` control the timer.
- `scoreTimeFactor` converts score to time gain.
- `goalBonusSeconds` adds time when a goal completes.
- `hardCandyBaseChance`, `hardCandyChancePerTier`, `hardCandyChanceMaxBonus` control hard candy spawns.
- `goalCount`, `colorGoalChance`, `colorGoalBase`, `colorGoalTierStep`, `colorGoalRandomRange` tune goal generation.
- `colorGoalPool` and `boosterGoalPool` define the allowed goal types.
- `difficultyTiers` defines the tier thresholds for `normal`, `hard`, `expert`, `nightmare`.

### Level mode config

`assets/data/level-mode.json` controls shared level mode tuning:

- `firstWinRewardCoins` sets the sugar coin reward for completing a level the first time.
- `maxBombDropChance` sets the maximum chance for bombs to fall on drops at max combo multiplier.

### Score config

`assets/data/score.json` controls scoring without touching code:

- `scoring.baseCellPoints` is the base score per cleared cell.
- `scoring.comboMultiplier.min` / `max` clamp the combo multiplier.
- `scoring.comboMultiplier.steps` defines how base move score changes the multiplier.
- `scoring.boosterScoreValues` adds bonus base points when a booster is activated.
- `scoring.evaluation.tiers` controls the move evaluation labels and Mira speech tiers.

### Shop config

`assets/data/shop.json` controls shop pricing:

- `powerupPrices` is a list of prices per stock (index 0 = first purchase, index 1 = second).
- `extraSlotPrice` sets the price for unlocking the extra powerup slot.

- `action=leaderboard&mode=LevelMode|BlockerMode|TimeMode` (GET) returns paged global entries ordered by best result.
- `action=history&mode=LevelMode|BlockerMode|TimeMode&userId=<id>` (GET) returns the requesting user’s best aggregated result for the requested mode.
- POST requests still accept progress updates and now refresh the aggregated stats that drive the leaderboard entries.

**Run db manager in browser:** http://localhost:5500/backend/db-manager/phpliteadmin.php 

### Service Worker Build

The service worker (`service-worker.js`) is generated by `scripts/build-service-worker.cjs`. This script scans `css/`, `dist/`, `html/`, and `assets/` directories and writes a complete service worker file with the precache URL list inlined. No separate manifest file or TypeScript compilation is needed for the service worker itself.

**Hard reload:** To not only reload the page, but also the service worker use `Ctrl+Shift+R`. Otherwise cached CSS files etc. may prevent a reload of those. 

### NPM run commands

- `npm run build` ➔ compiles TypeScript then generates `service-worker.js`
- `npm run build:sw` ➔ generates `service-worker.js` with inlined precache URLs
- `npm run watch` ➔ generates service worker then `tsc --watch`
- `npm run watch:templates` ➔ watches `templates/` for HTML or Jinja changes and reruns `scripts/render-index.py`; keep it running while editing `templates/` so `index.html` stays in sync.
- `npm run server` ➔ `php -c backend/php.ini -S 0.0.0.0:5500 -t .`
- `npm run dev` ➔ runs `server`, `watch`, and `watch:templates` together with prefixed logs
- `npm run docs` ➔ `jsdoc -c jsdoc.json`
- `npm run publish` ➔ rebuilds and writes a deployable `public/` folder
- `npm run codex` ➔ `codex --model gpt-5.1-codex-mini` (is very token cheap)
- `npm run codex:exec` ➔ `codex exec --model gpt-5.1-codex-mini`
- `npm run codex:apply` ➔ `codex apply` (modify files after `codex exec` based on the diff. Afterwards you can use `git add .`)

**Additionally:**
- `npx pwa-asset-generator <mein-logo.png> <mein-output-pfad>` | Create different icon sizes for your PWA (Progressive Web App)

## Setup php

Use `http://127.0.0.1:5500/backend/phpinfo.php` to see the php.ini location.

- php.ini must have: extension=pdo_sqlite, extension=sqlite3.
- `sudo apt-get install php-sqlite3`

## Setup phpliteadmin

1. Download the "Current development version" from here: https://bitbucket.org/phpliteadmin/public/wiki/DownloadLinks . You have to download the newest unstable version, because the stable version is not compatible with PHP 8 (causes an "MicroTimer" error).
2. Move the extracted directory to your project.
3. `phpliteadmin.php` is the important file and theoretically you can run the program with only this file alone. `phpliteadmin.config.php` this file can be used to set the configuration, but the configuration can also be set by modifying `phpliteadmin.php`.
4. Modify $password, $directory and $databases like needed. Here are some infos to those variables: https://bitbucket.org/phpliteadmin/public/wiki/Installation .
5. Use themes (default theme is ugly). You can copy a CSS file to your phpliteadmin.php file or you can put all your downloaded themes to themes/ and specify which theme you want to use.

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
- Die Seite löst beim Laden automatisch einen stummen Google-Login aus, wenn du bereits autorisiert bist; der Browser kann dabei kurz einen 403 aus dem `gsi/button`-Iframe loggen, aber der Fluss wird intern von Google abgefangen und das Einloggen funktioniert weiterhin.
- The "Delete game progress" button inside the profile/account view removes everything stored in `localStorage` under `match3-progress` and `match3-highest-level` (highest level, Blocker/Time bests, sugar coins, and tactical powerups). It also triggers the backend `DELETE /backend/progress.php` call for your Google ID, which wipes the matching `GameProgress` row in `backend/progress.sqlite`, so your server-side level, score, coin, and powerup records are reset to their defaults.

## .htaccess rules

### subdomain folder rule

This website (https://explosivecandy.fehrenworks.com/) is a subdomain of https://fehrenworks.com/ . The subdomain is in https://fehrenworks.com/subdomain/, but this folder may not be accessed from outside, so the subdomain/ folder has the following htaccess rule:
```
RewriteEngine On

# Deny access to /subdomain/* when accessed through [www.]fehrenworks.com
RewriteCond %{HTTP_HOST} ^(www\.)?fehrenworks\.com$ [NC]
RewriteRule ^ - [F]
```

* `RewriteEngine On`: activate the mod_rewrite module from apache. Without that commands like `RewriteCond` and `RewriteRule` are ignored.
* `RewriteCond %{HTTP_HOST} ^(www\.)?fehrenworks\.com$ [NC]`: If this rewrite condition is `true`, then the following `RewriteRule` will be executed. In a programming language liek PHP that would be like a regex check: `if (preg_match('/^(www\.)?fehrenworks\.com$/i', $_SERVER['HTTP_HOST'])) { http_response_code(403); exit; }` (i for NC).
  * `%{HTTP_HOST}`: hostname like fehrenworks.com, www.fehrenworks.com or explosivecandy.fehrenworks.com
  * `^(www\.)?fehrenworks\.com$`
    * `^`: start string
    * `(www\.)?fehrenworks\.com`: string can optionally start with "www." (and the backslash escapse the dot character) and must follow with "fehrenworks.com".
    * `$`: end string
  * `[NC]`: no case (`FEHRENWORKS.COM` is allowed as well).
* `RewriteRule ^ - [F]`:
  * `^`: Rule is for every request. For example `^admin(/|$)` would match any URL that starts with "admin" (fehrenworks.com/admin, fehrenworks.com/admin/, fehrenworks.com/admin/login), but something like fehrenworks.com/foo/admin would not match.
  * `-`: no rewrite target - do nothing here. Here you could have linked to a different URL like explosivecandy.fehrenworks.com .
  * `[F]`: flag for Forbidden. Apache answers with "HTTP/1.1 403 Forbidden".

### backend rule

The folder backend/ is complete blocked with `Require all denied`.

### password protect subdomain

**1. Create htaccess:**
```
# Deny access to .htpasswd
<Files ".htpasswd">
    Require all denied
</Files>

AuthType Basic
AuthName "Restricted Area"
AuthUserFile /usr/www/users/udhmny/subdomain/jodoc/.htpasswd
Require valid-user
```

Note that the path to `AuthUserFile` must be absolute and to get the real path you have to put a `path.php` file into the directiory where your htpasswd should be and call this file from the browser (<my-path>/path.php). `path.php`: `<?php echo realpath(__DIR__); ?>`.

**2. Create .htpasswd:**

1. Create .htpasswd where your .htaccess is located or somewhere else (may be even outside of public_html/).
2. Create here a username and password: https://www.htaccess.de/ and copy that into .htpasswd .

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
- `src/levels.ts` level helpers and validation
- `src/types.ts` shared types
- `dist/` compiled JavaScript output
- `assets/sounds/` sound effects, including match and booster variants
- `assets/data/levels.json` level definitions (editable without code)
- `assets/data/story-acts.json` story acts and cutscenes (editable without code)
- Use WebP assets for the large hero and background images (`assets/images/main-menu-bg-landscape.webp`, `assets/images/main-menu-background.webp`, etc.) and reference those in `css/match-app.css`; WebP support drastically cuts the LCP refresh cost while keeping the visual fidelity.

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

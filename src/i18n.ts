type Locale = 'en' | 'de';

type TranslationParams = Record<string, string | number>;

const TRANSLATIONS = {
    en: {
        'options.title': 'Options',
        'options.cellShape.label': 'Cell shapes',
        'options.cellShape.square': 'All squares',
        'options.cellShape.shaped': 'Color-specific shapes',
        'options.language.label': 'Language',
        'options.language.english': 'English',
        'options.language.german': 'German',
        'options.audio.label': 'Audio',
        'options.audio.on': 'Audio on',
        'options.audio.off': 'Audio off',
        'options.exit': 'Exit game',
        'mainMenu.lead': 'Welcome to',
        'mainMenu.description':
            'Combine colorful candies, trigger explosions, and beat the level targets. Jump into Level Mode, chase a new high score in Blocker Mode, or test the speeding-up Time Mode.',
        'mainMenu.note': 'High scores are stored along with your level progress. Open the options menu via the top-right button.',
        'button.levelMode': 'Level Mode',
        'button.blockerMode': 'Blocker Mode',
        'button.timeMode': 'Time Mode',
        'button.leaderboard': 'Leaderboard',
        'button.continue': 'Continue',
        'button.restart': 'Restart',
        'mainMenu.start.timeLoading': 'Time Mode is loading...',
        'mainMenu.start.blockerLoading': 'Blocker Mode is loading...',
        'mainMenu.start.timeBest': 'Time Mode (Best: {time})',
        'mainMenu.start.blockerBest': 'Blocker Mode (Best: {score})',
        'mainMenu.start.levelGuest': 'Level Mode (Guest)',
        'mainMenu.start.progressLoading': 'Progress is loading...',
        'mainMenu.start.levelAt': 'Level Mode (Start at Level {level})',
        'auth.label': 'Google Login',
        'auth.status.notSignedIn': 'Not signed in',
        'auth.status.signedIn': 'Signed in as {name}',
        'auth.progress.level': 'Progress: Level {level}',
        'auth.progress.blocker': 'Blocker high score: {score}',
        'auth.progress.time': 'Time mode best: {time}',
        'auth.progress.loading': 'Progress is loading...',
        'auth.progress.blocker.loading': 'Loading blocker high score...',
        'auth.progress.time.loading': 'Loading time mode...',
        'auth.hint': 'Sign in before playing so your progress is tied to your account.',
        'auth.loginButton': 'Sign in with Google',
        'auth.error.loginFailed': 'Login failed. Please try again.',
        'auth.error.progressLoad': 'Progress could not be loaded. Default level 1 will be used.',
        'auth.error.progressSave': 'Progress could not be saved. Please check your connection.',
        'hud.status.ready': 'Ready for combos!',
        'hud.status.powerupCanceled': 'Powerup canceled!',
        'hud.label.time': 'Time',
        'hud.label.moves': 'Moves',
        'hud.label.goals': 'Goals',
        'hud.status.chooseAdjacent': 'Select a neighboring cell',
        'hud.status.targetAdjacent': 'Target must be adjacent',
        'hud.status.powerupActivated': '{powerup} activated!',
        'hud.status.chooseTarget': 'Choose target for {powerup}',
        'hud.status.powerupUnleashed': '{powerup} unleashed!',
        'hud.status.switchExecuted': 'Switch executed!',
        'hud.aria.remainingTime': 'Remaining time {current} of {capacity}',
        'hud.aria.scoreBlocker': 'Score {score} of {target}. Best run: {best}',
        'hud.aria.scoreNormal': 'Score {score} of {target}',
        'hud.goal.remaining': '{description} remaining: {remaining}',
        'hud.timeModeHint': 'Survived: {survived} · Best time: {best}',
        'hud.blockerHighscore': 'Highscore: {score}',
        'hud.audio.on': 'Audio on',
        'hud.audio.off': 'Audio off',
        'renderer.comboIncrease': 'Strong move!',
        'renderer.comboDecrease': 'Momentum lost!',
        'renderer.comboNeutral': 'Multiplier',
        'renderer.points': ' · +{points} points',
        'result.level.winTitle': 'Level {level} complete!',
        'result.level.loseTitle': 'Level failed!',
        'result.level.winNext': 'Next stop is Level {level}.',
        'result.level.winAll': 'You mastered all {count} levels. Keep playing the finale for high scores.',
        'result.level.loseText': 'Try again right away.',
        'result.blocker.newHighscore': 'New high score!',
        'result.blocker.gameOver': 'No moves left!',
        'result.blocker.text': 'Points: {score}. Best run: {best}. Try again?',
        'result.time.newBest': 'New best time!',
        'result.time.timeUp': "Time's up!",
        'result.time.text': 'Survived: {survived}. Best time: {best}. Try again?',
        'blocker.status.started': 'Blocker Mode started. Survive as long as possible.',
        'blocker.status.moreHardCandy': 'More hard candies appear!',
        'blocker.status.newHighscore': 'New high score!',
        'time.status.started': 'Survive as long as possible. Matches and goals reward time.',
        'time.status.goalComplete': 'Goal complete! +{seconds}s',
        'leaderboard.lead': 'Overview',
        'leaderboard.title': 'Leaderboard',
        'leaderboard.back': 'Back to menu',
        'leaderboard.mode.level': 'Level Mode',
        'leaderboard.mode.blocker': 'Blocker Mode',
        'leaderboard.mode.time': 'Time Mode',
        'leaderboard.scope.global': 'Global',
        'leaderboard.scope.personal': 'Personal',
        'leaderboard.loginRequired': 'Please sign in to see personal results.',
        'leaderboard.error.loadFailed': 'Leaderboard could not be loaded.',
        'leaderboard.loading': 'Leaderboard is loading...',
        'leaderboard.empty': 'No entries available.',
        'leaderboard.metric.level': 'Highest level',
        'leaderboard.metric.time': 'Survival time',
        'leaderboard.metric.blocker': 'Blocker score',
        'leaderboard.entry.level': 'Level {level}',
        'leaderboard.entry.points': '{points} points',
        'leaderboard.subtitleTemplate': '{scope} · {mode} · {count} entries',
        'powerup.shuffle.label': 'Shuffle',
        'powerup.shuffle.description': 'Rearrange all candies',
        'powerup.switch.label': 'Switch',
        'powerup.switch.description': 'Swap two adjacent cells without a match',
        'powerup.bomb.label': 'Bomb',
        'powerup.bomb.description': 'Clear a 4×4 area of your choice',
        'goal.destroyColor': 'Destroy {target} {color} tiles',
        'goal.activateBooster': 'Activate {target} {booster}',
        'color.red': 'red',
        'color.amber': 'amber',
        'color.blue': 'blue',
        'color.purple': 'purple',
        'color.green': 'green',
        'booster.LINE': 'line bombs',
        'booster.BURST_SMALL': 'small bombs',
        'booster.BURST_MEDIUM': 'medium bombs',
        'booster.BURST_LARGE': 'large bombs'
    },
    de: {
        'options.title': 'Optionen',
        'options.cellShape.label': 'Zellformen',
        'options.cellShape.square': 'Alle Quadrate',
        'options.cellShape.shaped': 'Farb-spezifische Formen',
        'options.language.label': 'Sprache',
        'options.language.english': 'Englisch',
        'options.language.german': 'Deutsch',
        'options.audio.label': 'Audio',
        'options.audio.on': 'Audio an',
        'options.audio.off': 'Audio aus',
        'options.exit': 'Spiel beenden',
        'mainMenu.lead': 'Willkommen zu',
        'mainMenu.description':
            'Kombiniere farbige Süßigkeiten, löse Explosionen aus und knacke die Levelziele. Starte im Level Modus, sichere dir im Blocker Modus einen neuen Highscore oder teste den neuen Zeit Modus mit stetig schneller werdender Uhr.',
        'mainMenu.note':
            'Highscores werden wie dein Level-Fortschritt gespeichert. Optionen über das Menü oben rechts öffnen.',
        'button.levelMode': 'Level Modus',
        'button.blockerMode': 'Blocker Modus',
        'button.timeMode': 'Zeit Modus',
        'button.leaderboard': 'Bestenliste',
        'button.continue': 'Weiter',
        'button.restart': 'Neu starten',
        'mainMenu.start.timeLoading': 'Zeit Modus wird geladen...',
        'mainMenu.start.blockerLoading': 'Blocker Modus wird geladen...',
        'mainMenu.start.timeBest': 'Zeit Modus (Best: {time})',
        'mainMenu.start.blockerBest': 'Blocker Modus (Best: {score})',
        'mainMenu.start.levelGuest': 'Level Modus (Gast)',
        'mainMenu.start.progressLoading': 'Fortschritt wird geladen...',
        'mainMenu.start.levelAt': 'Level Modus (Start bei Level {level})',
        'auth.label': 'Google Login',
        'auth.status.notSignedIn': 'Nicht angemeldet',
        'auth.status.signedIn': 'Angemeldet als {name}',
        'auth.progress.level': 'Fortschritt: Level {level}',
        'auth.progress.blocker': 'Blocker-Modus-Highscore: {score}',
        'auth.progress.time': 'Zeit-Modus-Bestzeit: {time}',
        'auth.progress.loading': 'Fortschritt wird geladen...',
        'auth.progress.blocker.loading': 'Blocker-Highscore wird geladen...',
        'auth.progress.time.loading': 'Zeit-Modus wird geladen...',
        'auth.hint': 'Vor Spielstart bitte anmelden, damit der Fortschritt deinem Konto zugeordnet wird.',
        'auth.loginButton': 'Mit Google anmelden',
        'auth.error.loginFailed': 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
        'auth.error.progressLoad': 'Fortschritt konnte nicht geladen werden. Standard-Level 1 wird verwendet.',
        'auth.error.progressSave': 'Fortschritt konnte nicht gespeichert werden. Bitte Verbindung prüfen.',
        'hud.status.ready': 'Bereit für Kombos!',
        'hud.label.time': 'Zeit',
        'hud.label.moves': 'Züge',
        'hud.label.goals': 'Ziele',
        'hud.status.chooseAdjacent': 'Wähle ein angrenzendes Feld',
        'hud.status.targetAdjacent': 'Ziel muss angrenzend sein',
        'hud.status.powerupActivated': '{powerup} aktiviert!',
        'hud.status.chooseTarget': 'Wähle Ziel für {powerup}',
        'hud.status.powerupCanceled': 'Powerup abgebrochen!',
        'hud.status.powerupUnleashed': '{powerup} entfesselt!',
        'hud.status.switchExecuted': 'Switch ausgeführt!',
        'hud.aria.remainingTime': 'Verbleibende Zeit {current} von {capacity}',
        'hud.aria.scoreBlocker': 'Punktestand {score} von {target}. Bester Lauf: {best}',
        'hud.aria.scoreNormal': 'Punktestand {score} von {target}',
        'hud.goal.remaining': '{description} verbleibend: {remaining}',
        'hud.timeModeHint': 'Überlebt: {survived} · Bestzeit: {best}',
        'hud.blockerHighscore': 'Highscore: {score}',
        'hud.audio.on': 'Audio an',
        'hud.audio.off': 'Audio aus',
        'renderer.comboIncrease': 'Starker Zug!',
        'renderer.comboDecrease': 'Tempo verloren!',
        'renderer.comboNeutral': 'Multiplikator',
        'renderer.points': ' · +{points} Punkte',
        'result.level.winTitle': 'Level {level} geschafft!',
        'result.level.loseTitle': 'Level verloren!',
        'result.level.winNext': 'Weiter geht es mit Level {level}.',
        'result.level.winAll': 'Du hast alle {count} Level gemeistert. Spiele das Finale weiter für Highscores.',
        'result.level.loseText': 'Versuche es direkt noch einmal.',
        'result.blocker.newHighscore': 'Neuer Highscore!',
        'result.blocker.gameOver': 'Keine Züge mehr!',
        'result.blocker.text': 'Punkte: {score}. Bester Lauf: {best}. Gleich noch einmal?',
        'result.time.newBest': 'Neue Bestzeit!',
        'result.time.timeUp': 'Zeit abgelaufen!',
        'result.time.text': 'Überlebt: {survived}. Bestzeit: {best}. Noch einmal?',
        'blocker.status.started': 'Blocker-Modus gestartet. Überlebe so lange wie möglich.',
        'blocker.status.moreHardCandy': 'Mehr harte Bonbons erscheinen!',
        'blocker.status.newHighscore': 'Neuer Highscore!',
        'time.status.started': 'Überlebe so lange wie möglich. Zeit gibt es für Matches und Ziele.',
        'time.status.goalComplete': 'Ziel geschafft! +{seconds}s',
        'leaderboard.lead': 'Übersicht',
        'leaderboard.title': 'Bestenliste',
        'leaderboard.back': 'Zurück zum Menü',
        'leaderboard.mode.level': 'Level-Modus',
        'leaderboard.mode.blocker': 'Blocker-Modus',
        'leaderboard.mode.time': 'Zeit-Modus',
        'leaderboard.scope.global': 'Global',
        'leaderboard.scope.personal': 'Persönlich',
        'leaderboard.loginRequired': 'Bitte anmelden, um persönliche Ergebnisse zu sehen.',
        'leaderboard.error.loadFailed': 'Bestenliste konnte nicht geladen werden.',
        'leaderboard.loading': 'Bestenliste wird geladen...',
        'leaderboard.empty': 'Keine Einträge vorhanden.',
        'leaderboard.metric.level': 'Erreichtes Level',
        'leaderboard.metric.time': 'Überlebenszeit',
        'leaderboard.metric.blocker': 'Blocker-Score',
        'leaderboard.entry.level': 'Level {level}',
        'leaderboard.entry.points': '{points} Punkte',
        'leaderboard.subtitleTemplate': '{scope} · {mode} · {count} Einträge',
        'powerup.shuffle.label': 'Mischen',
        'powerup.shuffle.description': 'Alle Bonbons neu anordnen',
        'powerup.switch.label': 'Switch',
        'powerup.switch.description': 'Tausche zwei benachbarte Felder ohne Match',
        'powerup.bomb.label': 'Bombe',
        'powerup.bomb.description': 'Sprengt ein 4×4-Feld deiner Wahl',
        'goal.destroyColor': 'Zerstöre {target} {color} Steine',
        'goal.activateBooster': 'Aktiviere {target} {booster}',
        'color.red': 'rote',
        'color.amber': 'gelbe',
        'color.blue': 'blaue',
        'color.purple': 'violette',
        'color.green': 'grüne',
        'booster.LINE': 'Linienbomben',
        'booster.BURST_SMALL': 'kleine Bomben',
        'booster.BURST_MEDIUM': 'mittlere Bomben',
        'booster.BURST_LARGE': 'große Bomben'
    }
} as const;

type TranslationKey = keyof typeof TRANSLATIONS['en'];

const listeners = new Set<(locale: Locale) => void>();

let currentLocale: Locale = 'en';

function formatTranslation(template: string, params?: TranslationParams): string {
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        return value !== undefined ? String(value) : '';
    });
}

function t(key: TranslationKey, params?: TranslationParams): string {
    const localized = TRANSLATIONS[currentLocale][key] ?? TRANSLATIONS['en'][key];
    return formatTranslation(localized, params);
}

function translateDocument(root: ParentNode = document): void {
    const elements = root.querySelectorAll<HTMLElement>('[data-i18n-key]');
    elements.forEach((element) => {
        const key = element.getAttribute('data-i18n-key') as TranslationKey | null;
        if (!key) return;
        element.textContent = t(key);
    });
}

function setLocale(locale: Locale): void {
    if (locale === currentLocale) return;
    currentLocale = locale;
    document.documentElement.lang = locale;
    translateDocument();
    listeners.forEach((listener) => listener(locale));
}

function getLocale(): Locale {
    return currentLocale;
}

function onLocaleChange(handler: (locale: Locale) => void): () => void {
    handler(currentLocale);
    listeners.add(handler);
    return () => {
        listeners.delete(handler);
    };
}

export { Locale, TranslationKey, t, setLocale, getLocale, onLocaleChange, translateDocument };

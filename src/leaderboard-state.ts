import { BoosterType, createFreshPowerupInventory } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import {
    GameMode,
    GameState,
    LeaderboardEntry,
    LeaderboardIdentity,
    LeaderboardMode,
    LeaderboardScope
} from './types.js';
import { getRequiredElement } from './dom.js';
import { LeaderboardStore } from './leaderboard-store.js';
import { LocalAttemptStore, Attempt } from './local-attempt-store.js';
import { t, onLocaleChange } from './i18n.js';

type LocalProgress = {
    highestLevel: number;
    blockerHighScore: number;
    timeSurvival: number;
};

type LeaderboardStateOptions = {
    onExit: () => void;
    identity?: LeaderboardIdentity | null;
    localProgress?: LocalProgress | null;
    guestName?: string | null;
    attemptStore?: LocalAttemptStore | null;
};

class LeaderboardState implements GameModeState {
    readonly id: GameMode = 'leaderboard';
    private root: HTMLElement;
    private list: HTMLUListElement;
    private subtitle: HTMLElement;
    private backButton: HTMLButtonElement;
    private modeButtons: Record<LeaderboardMode, HTMLButtonElement>;
    private scopeSelect: HTMLSelectElement;
    private scopeOptions: Record<LeaderboardScope, HTMLOptionElement>;
    private currentMode: LeaderboardMode = 'level';
    private currentScope: LeaderboardScope = 'global';
    private dataset: Record<LeaderboardMode, Record<LeaderboardScope, LeaderboardEntry[]>>;
    private onExit: () => void;
    private store: LeaderboardStore;
    private identity: LeaderboardIdentity | null;
    private localProgress: LocalProgress | null;
    private guestName: string | null;
    private attemptStore: LocalAttemptStore | null;
    private isLoading = false;
    private error: string | null = null;
    private requestId = 0;

    constructor(options: LeaderboardStateOptions) {
        this.root = getRequiredElement('leaderboard');
        this.list = this.getListElement();
        this.subtitle = getRequiredElement('leaderboard-subtitle');
        this.backButton = this.getButton('leaderboard-back');
        this.modeButtons = {
            level: this.getButton('leaderboard-mode-level'),
            blocker: this.getButton('leaderboard-mode-blocker'),
            time: this.getButton('leaderboard-mode-time')
        };
        this.scopeSelect = this.getSelect('leaderboard-scope-select');
        this.scopeOptions = {
            global: this.getOption('leaderboard-scope-global-option'),
            personal: this.getOption('leaderboard-scope-personal-option')
        };
        this.dataset = {
            level: { global: [], personal: [] },
            blocker: { global: [], personal: [] },
            time: { global: [], personal: [] }
        };
        this.store = new LeaderboardStore();
        this.identity = options.identity ?? null;
        this.localProgress = options.localProgress ?? null;
        this.guestName = options.guestName ?? null;
        this.attemptStore = options.attemptStore ?? null;
        this.onExit = options.onExit;
        this.attachHandlers();
        onLocaleChange(() => this.render());
    }

    enter(_context: ModeContext): GameState {
        this.root.removeAttribute('hidden');
        this.syncActiveButtons();
        this.loadCurrent();
        this.backButton.focus();
        return {
            mode: 'leaderboard',
            selected: null,
            score: 0,
            bestScore: 0,
            level: 0,
            targetScore: 0,
            movesLeft: 0,
            goals: [],
            difficulty: 'easy',
            comboMultiplier: 1,
            powerups: createFreshPowerupInventory()
            ,
            cellShapeMode: 'square'
        };
    }

    exit(_context: ModeContext): void {
        this.root.setAttribute('hidden', 'true');
    }

    canStartMove(_state: GameState): boolean {
        return false;
    }

    consumeMove(_state: GameState): void {
        // Leaderboard view has no moves.
    }

    handleMoveResolved(_state: GameState, _context: ModeContext): void {
        // Leaderboard view has no moves.
    }

    handleBoardSettled(_state: GameState, _context: ModeContext): void {
        // Leaderboard view has no board interactions.
    }

    checkForCompletion(_state: GameState, _context: ModeContext): void {
        // Leaderboard view has nothing to complete.
    }

    handleColorCleared(_state: GameState, _color: string, _context: ModeContext): void {
        // Leaderboard view has no color goals.
    }

    handleBoosterUsed(_state: GameState, _booster: BoosterType, _context: ModeContext): void {
        // Leaderboard view has no boosters.
    }

    handleHardCandyHit(_state: GameState, _context: ModeContext): void {
        // Leaderboard view has no hard candy goals.
    }

    getBoardConfig(): BoardConfig {
        return {};
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return false;
    }

    update(options: LeaderboardStateOptions): void {
        this.onExit = options.onExit;
        this.identity = options.identity ?? null;
        this.localProgress = options.localProgress ?? null;
        this.guestName = options.guestName ?? null;
        this.attemptStore = options.attemptStore ?? null;
        this.loadCurrent();
    }

    private attachHandlers(): void {
        this.modeButtons.level.addEventListener('click', () => {
            this.currentMode = 'level';
            this.syncActiveButtons();
            this.loadCurrent();
        });
        this.modeButtons.blocker.addEventListener('click', () => {
            this.currentMode = 'blocker';
            this.syncActiveButtons();
            this.loadCurrent();
        });
        this.modeButtons.time.addEventListener('click', () => {
            this.currentMode = 'time';
            this.syncActiveButtons();
            this.loadCurrent();
        });
        this.scopeSelect.addEventListener('change', () => {
            this.currentScope = this.scopeSelect.value as LeaderboardScope;
            this.syncActiveButtons();
            this.loadCurrent();
        });
        this.backButton.addEventListener('click', () => this.onExit());
    }

    private loadCurrent(): void {
        if (this.currentScope === 'personal' && !this.identity) {
            this.loadLocalPersonalEntries(this.currentMode);
            return;
        }
        void this.fetchEntries(this.currentMode, this.currentScope);
    }

    private loadLocalPersonalEntries(mode: LeaderboardMode): void {
        this.error = null;
        this.isLoading = false;

        if (!this.attemptStore) {
            this.dataset[mode].personal = [];
            this.render();
            return;
        }

        const attempts = this.attemptStore.load(mode);
        const entries = this.convertAttemptsToEntries(attempts, mode);
        this.dataset[mode].personal = entries;
        this.render();
    }

    private convertAttemptsToEntries(attempts: Attempt[], mode: LeaderboardMode): LeaderboardEntry[] {
        const playerName = this.guestName?.trim() || t('leaderboard.localPlayer');

        return attempts.map((attempt): LeaderboardEntry => {
            const base: LeaderboardEntry = {
                playerName,
                completedAt: attempt.completedAt,
                nationality: null,
                isLocalEntry: true
            };

            if (mode === 'level') {
                return { ...base, level: attempt.value };
            }
            if (mode === 'time') {
                return { ...base, timeSeconds: attempt.value };
            }
            return { ...base, score: attempt.value };
        });
    }

    private async fetchEntries(mode: LeaderboardMode, scope: LeaderboardScope): Promise<void> {
        const requestId = ++this.requestId;
        this.error = null;
        this.isLoading = true;
        this.render();
        try {
            const entries = await this.store.load(mode, scope, this.identity);
            const sorted = this.sortEntries(entries, mode);
            if (requestId !== this.requestId) return;
            const withLocalEntry = this.injectLocalEntry(sorted, mode, scope);
            this.dataset[mode][scope] = withLocalEntry;
        } catch (error) {
            console.error('Failed to load leaderboard', error);
            if (requestId !== this.requestId) return;
            this.error = t('leaderboard.error.loadFailed');
            this.dataset[mode][scope] = [];
        } finally {
            if (requestId !== this.requestId) return;
            this.isLoading = false;
            this.render();
        }
    }

    private injectLocalEntry(
        entries: LeaderboardEntry[],
        mode: LeaderboardMode,
        scope: LeaderboardScope
    ): LeaderboardEntry[] {
        if (scope !== 'global') return entries;
        if (this.identity) return entries;
        if (!this.localProgress) return entries;

        const localEntry = this.createLocalEntry(mode);
        if (!localEntry) return entries;

        const result = [...entries, localEntry];
        result.sort((a, b) => this.compareEntries(a, b, mode));
        return result;
    }

    private createLocalEntry(mode: LeaderboardMode): LeaderboardEntry | null {
        if (!this.localProgress) return null;

        const playerName = this.guestName?.trim() || t('leaderboard.localPlayer');
        const base: LeaderboardEntry = {
            playerName,
            completedAt: new Date().toISOString(),
            nationality: null,
            isLocalEntry: true
        };

        if (mode === 'level') {
            const completedLevel = this.localProgress.highestLevel - 1;
            if (completedLevel < 1) return null;
            return { ...base, level: completedLevel };
        }
        if (mode === 'time') {
            if (this.localProgress.timeSurvival <= 0) return null;
            return { ...base, timeSeconds: this.localProgress.timeSurvival };
        }
        if (this.localProgress.blockerHighScore <= 0) return null;
        return { ...base, score: this.localProgress.blockerHighScore };
    }

    private sortEntries(entries: LeaderboardEntry[], mode: LeaderboardMode): LeaderboardEntry[] {
        const sorted = [...entries];
        sorted.sort((a, b) => this.compareEntries(a, b, mode));
        return sorted;
    }

    private compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, mode: LeaderboardMode): number {
        if (mode === 'level') {
            const levelDiff = (b.level ?? 0) - (a.level ?? 0);
            if (levelDiff !== 0) return levelDiff;
        }
        const metricB = mode === 'time' ? b.timeSeconds ?? b.score ?? 0 : b.score ?? 0;
        const metricA = mode === 'time' ? a.timeSeconds ?? a.score ?? 0 : a.score ?? 0;
        const scoreDiff = metricB - metricA;
        if (scoreDiff !== 0) return scoreDiff;
        const timeDiff = new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        return timeDiff;
    }

    private render(): void {
        this.list.innerHTML = '';
        const entries = this.dataset[this.currentMode][this.currentScope];
        this.updateSubtitle(entries.length);
        if (this.isLoading) {
            this.renderMessage(t('leaderboard.loading'));
            return;
        }
        if (this.error) {
            this.renderMessage(this.error);
            return;
        }
        if (entries.length === 0) {
            this.renderEmptyState();
            return;
        }
        entries.forEach((entry, index) => {
            const item = document.createElement('li');
            item.className = entry.isLocalEntry
                ? 'leaderboard__item leaderboard__item--self'
                : 'leaderboard__item';

            const rank = document.createElement('div');
            rank.className = 'leaderboard__rank';
            rank.textContent = String(index + 1);

            const user = document.createElement('div');
            user.className = 'leaderboard__user';
            const name = document.createElement('div');
            name.className = 'leaderboard__name';
            name.textContent = entry.playerName;
            const meta = document.createElement('div');
            meta.className = 'leaderboard__meta';
            meta.textContent = this.buildMeta(entry);
            user.appendChild(name);
            user.appendChild(meta);

            const metric = document.createElement('div');
            metric.className = 'leaderboard__metric';
            const label = document.createElement('p');
            label.className = 'leaderboard__metric-label';
            label.textContent = this.getMetricLabel(this.currentMode);
            const value = document.createElement('p');
            value.className = 'leaderboard__metric-value';
            value.textContent = this.formatMetricValue(entry, this.currentMode);
            metric.appendChild(label);
            metric.appendChild(value);

            item.appendChild(rank);
            item.appendChild(user);
            item.appendChild(metric);
            this.list.appendChild(item);
        });
    }

    private renderEmptyState(): void {
        this.renderMessage(t('leaderboard.empty'));
    }

    private renderMessage(message: string): void {
        const item = document.createElement('li');
        item.className = 'leaderboard__empty';
        item.textContent = message;
        this.list.appendChild(item);
    }

    private updateSubtitle(count: number): void {
        const scopeLabel =
            this.currentScope === 'global'
                ? t('leaderboard.scope.global')
                : t('leaderboard.scope.personal');
        const modeLabel =
            this.currentMode === 'level'
                ? t('leaderboard.mode.level')
                : this.currentMode === 'blocker'
                    ? t('leaderboard.mode.blocker')
                    : t('leaderboard.mode.time');
        const countLabelKey = count === 1 ? 'leaderboard.subtitle.countOne' : 'leaderboard.subtitle.countOther';
        const countLabel = t(countLabelKey, { count });
        this.subtitle.textContent = t('leaderboard.subtitleTemplate', {
            scope: scopeLabel,
            mode: modeLabel,
            countLabel
        });
    }

    private getMetricLabel(mode: LeaderboardMode): string {
        if (mode === 'level') return t('leaderboard.metric.level');
        if (mode === 'time') return t('leaderboard.metric.time');
        return t('leaderboard.metric.blocker');
    }

    private formatMetricValue(entry: LeaderboardEntry, mode: LeaderboardMode): string {
        if (mode === 'level') {
            const level = entry.level ?? 0;
            return t('leaderboard.entry.level', { level });
        }
        if (mode === 'time') {
            const time = entry.timeSeconds ?? entry.score ?? 0;
            return this.formatTime(time);
        }
        return t('leaderboard.entry.points', { points: entry.score ?? 0 });
    }

    private buildMeta(entry: LeaderboardEntry): string {
        const date = this.formatDate(entry.completedAt);
        if (entry.nationality) {
            return date + ' · ' + entry.nationality;
        }
        return date;
    }

    private formatDate(dateString: string): string {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return dateString;
        const locale = document.documentElement.lang === 'de' ? 'de-DE' : 'en-US';
        return parsed.toLocaleDateString(locale, { dateStyle: 'medium' });
    }

    private formatTime(totalSeconds: number): string {
        const normalized = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
        const minutes = Math.floor(normalized / 60);
        const seconds = normalized % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    private syncActiveButtons(): void {
        this.modeButtons.level.textContent = t('leaderboard.mode.level');
        this.modeButtons.blocker.textContent = t('leaderboard.mode.blocker');
        this.modeButtons.time.textContent = t('leaderboard.mode.time');
        this.scopeSelect.value = this.currentScope;
        this.scopeOptions.global.textContent = t('leaderboard.scope.global');
        this.scopeOptions.personal.textContent = t('leaderboard.scope.personal');
        this.setActive(this.modeButtons.level, this.currentMode === 'level');
        this.setActive(this.modeButtons.blocker, this.currentMode === 'blocker');
        this.setActive(this.modeButtons.time, this.currentMode === 'time');
    }

    private setActive(button: HTMLButtonElement, isActive: boolean): void {
        button.classList.toggle('leaderboard__chip--active', isActive);
        button.classList.toggle('leaderboard__chip--secondary', !isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }

    private getListElement(): HTMLUListElement {
        const element = getRequiredElement('leaderboard-list');
        if (!(element instanceof HTMLUListElement)) {
            throw new Error('Leaderboard list element is not a list');
        }
        return element;
    }

    private getSelect(id: string): HTMLSelectElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error(id + ' is not a select');
        }
        return element;
    }

    private getOption(id: string): HTMLOptionElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLOptionElement)) {
            throw new Error(id + ' is not an option');
        }
        return element;
    }

    private getButton(id: string): HTMLButtonElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error(id + ' is not a button');
        }
        return element;
    }
}

export { LeaderboardState };
export type { LeaderboardStateOptions };

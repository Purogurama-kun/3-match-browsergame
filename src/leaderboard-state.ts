import { BoosterType } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { GameMode, GameState } from './types.js';
import { getRequiredElement } from './dom.js';

type LeaderboardMode = Extract<GameMode, 'level' | 'blocker'>;
type LeaderboardScope = 'global' | 'personal';

type LeaderboardEntry = {
    player: string;
    completedOn: string;
    country?: string;
    level?: number;
    score?: number;
};

type LeaderboardStateOptions = {
    onExit: () => void;
    currentPlayer: string;
    highestLevel: number;
    blockerHighScore: number;
};

class LeaderboardState implements GameModeState {
    readonly id: GameMode = 'leaderboard';
    private root: HTMLElement;
    private list: HTMLUListElement;
    private subtitle: HTMLElement;
    private backButton: HTMLButtonElement;
    private modeButtons: Record<LeaderboardMode, HTMLButtonElement>;
    private scopeButtons: Record<LeaderboardScope, HTMLButtonElement>;
    private currentMode: LeaderboardMode = 'level';
    private currentScope: LeaderboardScope = 'global';
    private dataset: Record<LeaderboardMode, Record<LeaderboardScope, LeaderboardEntry[]>>;
    private onExit: () => void;

    constructor(options: LeaderboardStateOptions) {
        this.root = getRequiredElement('leaderboard');
        this.list = this.getListElement();
        this.subtitle = getRequiredElement('leaderboard-subtitle');
        this.backButton = this.getButton('leaderboard-back');
        this.modeButtons = {
            level: this.getButton('leaderboard-mode-level'),
            blocker: this.getButton('leaderboard-mode-blocker')
        };
        this.scopeButtons = {
            global: this.getButton('leaderboard-scope-global'),
            personal: this.getButton('leaderboard-scope-personal')
        };
        this.dataset = this.buildDataset(
            options.currentPlayer,
            options.highestLevel,
            options.blockerHighScore
        );
        this.onExit = options.onExit;
        this.attachHandlers();
    }

    enter(_context: ModeContext): GameState {
        this.root.removeAttribute('hidden');
        this.syncActiveButtons();
        this.render();
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
            comboMultiplier: 1
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

    getBoardConfig(): BoardConfig {
        return {};
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return false;
    }

    update(options: LeaderboardStateOptions): void {
        this.dataset = this.buildDataset(
            options.currentPlayer,
            options.highestLevel,
            options.blockerHighScore
        );
        this.onExit = options.onExit;
        this.render();
    }

    private attachHandlers(): void {
        this.modeButtons.level.addEventListener('click', () => {
            this.currentMode = 'level';
            this.syncActiveButtons();
            this.render();
        });
        this.modeButtons.blocker.addEventListener('click', () => {
            this.currentMode = 'blocker';
            this.syncActiveButtons();
            this.render();
        });
        this.scopeButtons.global.addEventListener('click', () => {
            this.currentScope = 'global';
            this.syncActiveButtons();
            this.render();
        });
        this.scopeButtons.personal.addEventListener('click', () => {
            this.currentScope = 'personal';
            this.syncActiveButtons();
            this.render();
        });
        this.backButton.addEventListener('click', () => this.onExit());
    }

    private render(): void {
        this.list.innerHTML = '';
        const entries = this.getEntries(this.currentMode, this.currentScope);
        this.updateSubtitle(entries.length);
        if (entries.length === 0) {
            this.renderEmptyState();
            return;
        }
        entries.forEach((entry, index) => {
            const item = document.createElement('li');
            item.className = 'leaderboard__item';

            const rank = document.createElement('div');
            rank.className = 'leaderboard__rank';
            rank.textContent = String(index + 1);

            const user = document.createElement('div');
            user.className = 'leaderboard__user';
            const name = document.createElement('div');
            name.className = 'leaderboard__name';
            name.textContent = entry.player;
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
        const item = document.createElement('li');
        item.className = 'leaderboard__empty';
        item.textContent = 'Keine Einträge vorhanden.';
        this.list.appendChild(item);
    }

    private updateSubtitle(count: number): void {
        const scopeLabel = this.currentScope === 'global' ? 'Global' : 'Persönlich';
        const modeLabel = this.currentMode === 'level' ? 'Level-Modus' : 'Blocker-Modus';
        this.subtitle.textContent = scopeLabel + ' · ' + modeLabel + ' · ' + count + ' Einträge';
    }

    private getEntries(mode: LeaderboardMode, scope: LeaderboardScope): LeaderboardEntry[] {
        const entries = this.dataset[mode][scope];
        const sorted = [...entries];
        sorted.sort((a, b) => this.compareEntries(a, b, mode));
        return sorted;
    }

    private compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, mode: LeaderboardMode): number {
        if (mode === 'level') {
            const levelDiff = (b.level ?? 0) - (a.level ?? 0);
            if (levelDiff !== 0) return levelDiff;
        }
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        const timeDiff =
            new Date(b.completedOn).getTime() - new Date(a.completedOn).getTime();
        return timeDiff;
    }

    private buildDataset(
        currentPlayer: string,
        highestLevel: number,
        blockerHighScore: number
    ): Record<LeaderboardMode, Record<LeaderboardScope, LeaderboardEntry[]>> {
        const today = this.getCurrentDate();
        const personalLevelScore = Math.max(5000, highestLevel * 900);
        const personalBlockerScore = Math.max(2000, blockerHighScore);

        const personalLevelEntries: LeaderboardEntry[] = [
            {
                player: currentPlayer,
                country: 'DE',
                completedOn: today,
                level: Math.max(1, highestLevel),
                score: personalLevelScore
            },
            {
                player: 'Co-Op Partner',
                country: 'SE',
                completedOn: today,
                level: Math.max(1, highestLevel - 1),
                score: personalLevelScore - 450
            }
        ];

        const personalBlockerEntries: LeaderboardEntry[] = [
            {
                player: currentPlayer,
                country: 'DE',
                completedOn: today,
                score: personalBlockerScore
            },
            {
                player: 'Gastlauf',
                country: 'FR',
                completedOn: today,
                score: Math.max(1500, Math.floor(personalBlockerScore * 0.8))
            }
        ];

        const globalLevelEntries: LeaderboardEntry[] = [
            { player: 'Mara', country: 'DE', completedOn: '2024-06-12', level: 42, score: 71200 },
            { player: 'Amir', country: 'AE', completedOn: '2024-06-10', level: 41, score: 64500 },
            { player: 'Lena', country: 'AT', completedOn: '2024-06-08', level: 39, score: 60450 },
            { player: 'Davi', country: 'BR', completedOn: '2024-06-07', level: 37, score: 59800 }
        ];

        const globalBlockerEntries: LeaderboardEntry[] = [
            { player: 'Jia', country: 'CN', completedOn: '2024-06-11', score: 8450 },
            { player: 'Sara', country: 'GB', completedOn: '2024-06-10', score: 8120 },
            { player: 'Noor', country: 'NL', completedOn: '2024-06-09', score: 7850 },
            { player: 'Chris', country: 'US', completedOn: '2024-06-06', score: 7420 }
        ];

        return {
            level: {
                global: globalLevelEntries,
                personal: personalLevelEntries
            },
            blocker: {
                global: globalBlockerEntries,
                personal: personalBlockerEntries
            }
        };
    }

    private getMetricLabel(mode: LeaderboardMode): string {
        return mode === 'level' ? 'Erreichtes Level' : 'Blocker-Score';
    }

    private formatMetricValue(entry: LeaderboardEntry, mode: LeaderboardMode): string {
        if (mode === 'level') {
            const level = entry.level ?? 0;
            const score = entry.score ?? 0;
            return 'Level ' + level + ' · ' + score + ' Punkte';
        }
        return (entry.score ?? 0) + ' Punkte';
    }

    private buildMeta(entry: LeaderboardEntry): string {
        const date = this.formatDate(entry.completedOn);
        if (entry.country) {
            return date + ' · ' + entry.country;
        }
        return date;
    }

    private formatDate(dateString: string): string {
        const parsed = new Date(dateString);
        if (Number.isNaN(parsed.getTime())) return dateString;
        return parsed.toLocaleDateString('de-DE', { dateStyle: 'medium' });
    }

    private getCurrentDate(): string {
        const [datePart] = new Date().toISOString().split('T');
        return datePart ?? new Date().toISOString();
    }

    private syncActiveButtons(): void {
        this.setActive(this.modeButtons.level, this.currentMode === 'level');
        this.setActive(this.modeButtons.blocker, this.currentMode === 'blocker');
        this.setActive(this.scopeButtons.global, this.currentScope === 'global');
        this.setActive(this.scopeButtons.personal, this.currentScope === 'personal');
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

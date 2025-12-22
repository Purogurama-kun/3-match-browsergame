import { BOOSTERS, TACTICAL_POWERUPS, TacticalPowerup, getColorHex } from './constants.js';
import {
    ActivatableBoosterType,
    Difficulty,
    GameMode,
    GameState,
    GoalProgress,
    PowerupInventory,
    SwapMode
} from './types.js';
import { getRequiredElement } from './dom.js';

class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.levelCard = this.getLevelCard();
        this.level = getRequiredElement('level');
        this.movesLabel = this.getMovesLabel();
        this.moves = getRequiredElement('moves');
        this.scoreProgress = getRequiredElement('score-progress');
        this.scoreProgressFill = getRequiredElement('score-progress-fill');
        this.statusText = getRequiredElement('status-text');
        this.statusIcon = getRequiredElement('status-icon');
        this.goalsList = this.getGoalsListElement();
        this.tacticalToolbar = this.getTacticalToolbar();
        this.powerupButtons = {} as Record<TacticalPowerup, HTMLButtonElement>;
        this.powerupCountNodes = {} as Record<TacticalPowerup, HTMLElement>;
        this.initPowerupButtons();
        this.swapModeSelect = this.getSwapModeElement();
        this.optionsToggle = this.getOptionsToggle();
        this.optionsClose = this.getOptionsClose();
        this.optionsModal = this.getOptionsModal();
        this.audioToggle = this.getAudioToggle();
        this.difficultyLabel = this.getDifficultyLabel();
        this.exitButton = this.getExitButton();
        this.setAudioToggleState(true);
        this.hideOptionsModal();
    }

    private score: HTMLElement;
    private levelCard: HTMLElement;
    private level: HTMLElement;
    private movesLabel: HTMLElement;
    private moves: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private statusText: HTMLElement;
    private statusIcon: HTMLElement;
    private goalsList: HTMLUListElement;
    private swapModeSelect: HTMLSelectElement;
    private optionsToggle: HTMLButtonElement;
    private optionsClose: HTMLButtonElement;
    private optionsModal: HTMLElement;
    private audioToggle: HTMLButtonElement;
    private difficultyLabel: HTMLElement;
    private exitButton: HTMLButtonElement;
    private tacticalToolbar: HTMLElement;
    private powerupButtons: Record<TacticalPowerup, HTMLButtonElement>;
    private powerupCountNodes: Record<TacticalPowerup, HTMLElement>;
    private powerupHandler: ((type: TacticalPowerup) => void) | null = null;
    private toolbarBlocked = false;
    private lastPowerupInventory: PowerupInventory | null = null;

    render(state: GameState): void {
        const isTimeMode = state.mode === 'time';
        this.score.textContent = isTimeMode
            ? this.formatTime(state.timeRemaining ?? 0)
            : state.mode === 'blocker'
                ? state.score + ' '
                : state.score + '/' + state.targetScore;
        this.level.textContent = String(state.level);
        this.movesLabel.textContent = isTimeMode ? 'Zeit' : 'Züge';
        this.moves.textContent = isTimeMode
            ? this.formatTime(state.timeRemaining ?? 0)
            : state.mode === 'blocker'
                ? '∞'
                : String(state.movesLeft);
        this.applyDifficultyStyle(state.difficulty);

        this.updateProgress(state);
        this.renderGoals(state.goals, state.mode, state);
        this.updatePowerupButtons(state.powerups);
    }

    getSwapMode(): SwapMode {
        return this.swapModeSelect.value as SwapMode;
    }

    onSwapModeChange(handler: (mode: SwapMode) => void): void {
        this.swapModeSelect.addEventListener('change', () => {
            handler(this.getSwapMode());
        });
    }

    onTacticalPowerup(handler: (type: TacticalPowerup) => void): void {
        this.powerupHandler = handler;
    }

    onAudioToggle(handler: (enabled: boolean) => void): void {
        this.audioToggle.addEventListener('click', () => {
            const nextState = this.audioToggle.getAttribute('aria-pressed') !== 'true';
            this.setAudioToggleState(nextState);
            handler(nextState);
        });
    }

    initOptionsMenu(): void {
        this.optionsToggle.addEventListener('click', () => {
            const isExpanded = this.optionsToggle.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                this.hideOptionsModal();
            } else {
                this.showOptionsModal();
            }
        });

        this.optionsClose.addEventListener('click', () => this.hideOptionsModal());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideOptionsModal();
            }
        });

        this.optionsModal.addEventListener('click', (event) => {
            if (event.target === this.optionsModal) {
                this.hideOptionsModal();
            }
        });
    }

    setAudioEnabled(enabled: boolean): void {
        this.setAudioToggleState(enabled);
    }

    setPowerupToolbarBlocked(blocked: boolean): void {
        if (this.toolbarBlocked === blocked) return;
        this.toolbarBlocked = blocked;
        if (this.lastPowerupInventory) {
            this.updatePowerupButtons(this.lastPowerupInventory);
            return;
        }
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const button = this.powerupButtons[type];
            button.disabled = blocked;
            button.classList.toggle('tactical-toolbar__button--blocked', blocked);
        });
    }

    setStatus(text: string, icon: string): void {
        this.statusText.textContent = text;
        this.statusIcon.textContent = icon;
    }

    onExitGame(handler: () => void): void {
        this.exitButton.addEventListener('click', () => {
            this.hideOptionsModal();
            handler();
        });
    }

    closeOptions(): void {
        this.hideOptionsModal();
    }

    resetStatus(): void {
        this.setStatus('Bereit für Kombos!', '✨');
    }

    private getSwapModeElement(): HTMLSelectElement {
        const element = getRequiredElement('swap-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Swap mode element is not a select');
        }
        return element;
    }

    private getOptionsToggle(): HTMLButtonElement {
        const element = getRequiredElement('options-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options toggle is not a button');
        }
        return element;
    }

    private getOptionsClose(): HTMLButtonElement {
        const element = getRequiredElement('options-close');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options close is not a button');
        }
        return element;
    }

    private getOptionsModal(): HTMLElement {
        return getRequiredElement('options-modal');
    }

    private getAudioToggle(): HTMLButtonElement {
        const element = getRequiredElement('audio-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Audio toggle is not a button');
        }
        return element;
    }

    private getGoalsListElement(): HTMLUListElement {
        const element = getRequiredElement('goals-list');
        if (!(element instanceof HTMLUListElement)) {
            throw new Error('Goals list element is not a list');
        }
        return element;
    }

    private getTacticalToolbar(): HTMLElement {
        return getRequiredElement('tactical-toolbar');
    }

    private initPowerupButtons(): void {
        this.tacticalToolbar.innerHTML = '';
        const entries = Object.entries(TACTICAL_POWERUPS) as [TacticalPowerup, typeof TACTICAL_POWERUPS[TacticalPowerup]][];
        entries.forEach(([type, meta]) => {
            const button = document.createElement('button');
            button.className = 'tactical-toolbar__button';
            button.type = 'button';
            button.dataset.powerup = type;
            button.setAttribute('aria-label', meta.description);

            const metaContainer = document.createElement('span');
            metaContainer.className = 'tactical-toolbar__meta';

            const icon = document.createElement('span');
            icon.className = 'tactical-toolbar__icon';
            icon.textContent = meta.icon;

            const label = document.createElement('span');
            label.className = 'tactical-toolbar__label';
            label.textContent = meta.label;
            metaContainer.appendChild(icon);
            metaContainer.appendChild(label);

            const count = document.createElement('span');
            count.className = 'tactical-toolbar__count';
            count.textContent = '0';

            button.appendChild(metaContainer);
            button.appendChild(count);
            button.addEventListener('click', () => this.powerupHandler?.(type));

            this.powerupButtons[type] = button;
            this.powerupCountNodes[type] = count;
            this.tacticalToolbar.appendChild(button);
        });
    }

    private getLevelCard(): HTMLElement {
        return getRequiredElement('level-card');
    }

    private getMovesLabel(): HTMLElement {
        return getRequiredElement('moves-label');
    }

    private getDifficultyLabel(): HTMLElement {
        return getRequiredElement('difficulty');
    }

    private getExitButton(): HTMLButtonElement {
        const element = getRequiredElement('exit-game');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Exit game button is not a button');
        }
        return element;
    }

    private updateProgress(state: GameState): void {
        if (state.mode === 'time') {
            const remaining = Math.max(0, state.timeRemaining ?? 0);
            const capacity = Math.max(1, state.timeCapacity ?? remaining, remaining);
            const ratio = Math.min(1, capacity === 0 ? 0 : remaining / capacity);
            const ariaText = 'Verbleibende Zeit ' + this.formatTime(remaining) + ' von ' + this.formatTime(capacity);
            this.scoreProgress.setAttribute('aria-valuenow', remaining.toFixed(1));
            this.scoreProgress.setAttribute('aria-valuemax', capacity.toFixed(1));
            this.scoreProgress.setAttribute('aria-valuetext', ariaText);
            this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
            this.score.textContent = this.formatTime(remaining);
            return;
        }
        const clampedScore = Math.max(0, state.score);
        const target = state.mode === 'blocker'
            ? Math.max(1, Math.max(state.targetScore, state.bestScore, clampedScore))
            : Math.max(1, state.targetScore);
        const ratio = Math.min(1, clampedScore / target);
        const ariaText =
            state.mode === 'blocker'
                ? 'Punktestand ' + clampedScore + ' von ' + target + '. Bester Lauf: ' + state.bestScore
                : 'Punktestand ' + clampedScore + ' von ' + target;
        this.scoreProgress.setAttribute('aria-valuenow', clampedScore.toString());
        this.scoreProgress.setAttribute('aria-valuemax', target.toString());
        this.scoreProgress.setAttribute('aria-valuetext', ariaText);
        this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
    }

    private renderGoals(goals: GoalProgress[], mode: GameMode, state: GameState): void {
        this.goalsList.innerHTML = '';
        if (mode === 'blocker') {
            this.renderBlockerModeHighscore(state.bestScore);
            return;
        }
        if (mode === 'time') {
            this.renderTimeModeHint(state);
        }
        goals.forEach((goal) => {
            const item = document.createElement('li');
            item.className = 'hud__goal';
            const remaining = Math.max(goal.target - goal.current, 0);

            const visual = this.createGoalVisual(goal);
            const counter = document.createElement('span');
            counter.className = 'hud__goal-count';
            counter.textContent = String(remaining);

            const label = document.createElement('span');
            label.className = 'hud__goal-label';
            label.textContent = goal.description;

            item.setAttribute('aria-label', goal.description + ' verbleibend: ' + remaining);
            item.appendChild(visual);
            item.appendChild(counter);
            item.appendChild(label);
            this.goalsList.appendChild(item);
        });
    }

    private updatePowerupButtons(powerups: PowerupInventory): void {
        this.lastPowerupInventory = powerups;
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const button = this.powerupButtons[type];
            const countNode = this.powerupCountNodes[type];
            const remaining = Math.max(0, powerups[type] ?? 0);
            countNode.textContent = String(remaining);
            const blockedState = this.toolbarBlocked || remaining <= 0;
            button.disabled = blockedState;
            button.classList.toggle('tactical-toolbar__button--blocked', this.toolbarBlocked);
        });
    }

    private showOptionsModal(): void {
        this.optionsModal.removeAttribute('hidden');
        this.optionsModal.setAttribute('aria-hidden', 'false');
        this.optionsToggle.setAttribute('aria-expanded', 'true');
        this.optionsToggle.setAttribute('aria-pressed', 'true');
        this.optionsClose.focus();
    }

    private hideOptionsModal(): void {
        this.optionsModal.setAttribute('hidden', 'true');
        this.optionsModal.setAttribute('aria-hidden', 'true');
        this.optionsToggle.setAttribute('aria-expanded', 'false');
        this.optionsToggle.setAttribute('aria-pressed', 'false');
        this.optionsToggle.focus();
    }

    private setAudioToggleState(enabled: boolean): void {
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? 'Audio an' : 'Audio aus';
    }

    private createGoalVisual(goal: GoalProgress): HTMLElement {
        if (goal.type === 'destroy-color') {
            const chip = document.createElement('span');
            chip.className = 'hud__goal-chip hud__goal-chip--color';
            chip.style.setProperty('--goal-color', getColorHex(goal.color));
            chip.setAttribute('aria-hidden', 'true');
            return chip;
        }
        const chip = document.createElement('span');
        chip.className = 'hud__goal-chip hud__goal-chip--booster';
        chip.textContent = this.getBoosterIcon(goal.booster);
        chip.setAttribute('aria-hidden', 'true');
        return chip;
    }

    private applyDifficultyStyle(difficulty: Difficulty): void {
        const levels: Difficulty[] = ['easy', 'normal', 'hard', 'expert', 'nightmare'];
        levels.forEach((levelName) => {
            this.levelCard.classList.toggle('hud__card--difficulty-' + levelName, levelName === difficulty);
        });
        const label = this.formatDifficultyLabel(difficulty);
        this.difficultyLabel.textContent = label;
        this.levelCard.setAttribute('aria-label', 'Level ' + this.level.textContent + ' – ' + label);
    }

    private renderBlockerModeHighscore(highscore: number): void {
        const item = document.createElement('li');
        item.className = 'hud__goal hud__goal--hint';
        const label = document.createElement('span');
        label.className = 'hud__goal-label';
        label.textContent = 'Highscore: ' + highscore;
        item.appendChild(label);
        this.goalsList.appendChild(item);
    }

    private renderTimeModeHint(state: GameState): void {
        const item = document.createElement('li');
        item.className = 'hud__goal hud__goal--hint';
        const label = document.createElement('span');
        label.className = 'hud__goal-label';
        const survived = this.formatTime(state.survivalTime ?? 0);
        const best = this.formatTime(state.bestScore ?? 0);
        label.textContent = 'Überlebt: ' + survived + ' · Bestzeit: ' + best;
        item.appendChild(label);
        this.goalsList.appendChild(item);
    }

    private formatDifficultyLabel(difficulty: Difficulty): string {
        const labelMap: Record<Difficulty, string> = {
            easy: 'Easy',
            normal: 'Normal',
            hard: 'Hard',
            expert: 'Expert',
            nightmare: 'Nightmare'
        };
        return labelMap[difficulty];
    }

    private getBoosterIcon(booster: ActivatableBoosterType): string {
        if (booster === BOOSTERS.LINE) return '💣';
        if (booster === BOOSTERS.BURST_SMALL) return '🧨';
        if (booster === BOOSTERS.BURST_MEDIUM) return '💥';
        if (booster === BOOSTERS.BURST_LARGE) return '☢️';
        return '';
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = Math.floor(safeSeconds % 60);
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }
}

export { Hud };

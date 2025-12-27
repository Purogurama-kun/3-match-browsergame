import {
    BOOSTERS,
    TACTICAL_POWERUPS,
    TacticalPowerup,
    getColorHex,
    COLOR_SHAPE_CLASS
} from './constants.js';
import {
    ActivatableBoosterType,
    CellShapeMode,
    Difficulty,
    GameMode,
    GameState,
    GoalProgress,
    PowerupInventory
} from './types.js';
import { getRequiredElement } from './dom.js';
import { describeGoal } from './levels.js';
import { t, Locale } from './i18n.js';

class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.levelCard = this.getLevelCard();
        this.level = getRequiredElement('level');
        this.movesLabel = this.getMovesLabel();
        this.moves = getRequiredElement('moves');
        this.movesCard = this.getMovesCard();
        this.scoreProgress = getRequiredElement('score-progress');
        this.scoreProgressFill = getRequiredElement('score-progress-fill');
        this.statusText = getRequiredElement('status-text');
        this.statusIcon = getRequiredElement('status-icon');
        this.goalsList = this.getGoalsListElement();
        this.tacticalToolbar = this.getTacticalToolbar();
        this.timeHint = this.getTimeHintElement();
        this.powerupButtons = {} as Record<TacticalPowerup, HTMLButtonElement>;
        this.powerupCountNodes = {} as Record<TacticalPowerup, HTMLElement>;
        this.initPowerupButtons();
        this.optionsToggle = this.getOptionsToggle();
        this.optionsClose = this.getOptionsClose();
        this.optionsModal = this.getOptionsModal();
        this.audioToggle = this.getAudioToggle();
        this.performanceToggle = getRequiredElement('performance-toggle') as HTMLButtonElement;
        this.cellShapeSelect = this.getCellShapeSelect();
        this.languageSelect = this.getLanguageSelect();
        this.difficultyLabel = this.getDifficultyLabel();
        this.exitButton = this.getExitButton();
        this.setAudioToggleState(true);
        this.setLanguage('en');
        this.setPerformanceModeEnabled(false);
        this.hideOptionsModal();
        this.performanceToggle.addEventListener('click', () => {
            const nextState = this.performanceToggle.getAttribute('aria-pressed') !== 'true';
            this.setPerformanceModeEnabled(nextState);
            if (this.performanceModeHandler) {
                this.performanceModeHandler(nextState);
            }
        });
    }

    private score: HTMLElement;
    private levelCard: HTMLElement;
    private level: HTMLElement;
    private movesLabel: HTMLElement;
    private moves: HTMLElement;
    private movesCard: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private statusText: HTMLElement;
    private statusIcon: HTMLElement;
    private goalsList: HTMLUListElement;
    private optionsToggle: HTMLButtonElement;
    private optionsClose: HTMLButtonElement;
    private optionsModal: HTMLElement;
    private audioToggle: HTMLButtonElement;
    private difficultyLabel: HTMLElement;
    private exitButton: HTMLButtonElement;
    private timeHint: HTMLElement;
    private cellShapeSelect: HTMLSelectElement;
    private languageSelect: HTMLSelectElement;
    private performanceToggle: HTMLButtonElement;
    private performanceModeEnabled = false;
    private performanceModeHandler: ((enabled: boolean) => void) | null = null;
    private audioEnabled = true;
    private cellShapeMode: CellShapeMode = 'square';
    private tacticalToolbar: HTMLElement;
    private powerupButtons: Record<TacticalPowerup, HTMLButtonElement>;
    private powerupCountNodes: Record<TacticalPowerup, HTMLElement>;
    private powerupHandler: ((type: TacticalPowerup) => void) | null = null;
    private toolbarBlocked = false;
    private lastPowerupInventory: PowerupInventory | null = null;
    private pendingPowerupType: TacticalPowerup | null = null;

    render(state: GameState): void {
        const isTimeMode = state.mode === 'time';
        const shouldShowMovesCard = state.mode === 'level';
        this.movesCard.style.display = shouldShowMovesCard ? '' : 'none';
        this.score.textContent = isTimeMode
            ? this.formatTime(state.timeRemaining ?? 0)
            : state.mode === 'blocker'
                ? state.score + ' '
                : state.score + '/' + state.targetScore;
        this.level.textContent = String(state.level);
        this.movesLabel.textContent = isTimeMode ? t('hud.label.time') : t('hud.label.moves');
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

    onCellShapeModeChange(handler: (mode: CellShapeMode) => void): void {
        this.cellShapeSelect.addEventListener('change', () => {
            handler(this.cellShapeSelect.value as CellShapeMode);
        });
    }

    onLanguageChange(handler: (locale: Locale) => void): void {
        this.languageSelect.addEventListener('change', () => {
            handler(this.languageSelect.value as Locale);
        });
    }

    setLanguage(locale: Locale): void {
        this.languageSelect.value = locale;
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

    applyLocale(): void {
        this.setAudioToggleState(this.audioEnabled);
        this.refreshPowerupButtons();
    }

    setCellShapeMode(mode: CellShapeMode): void {
        this.cellShapeMode = mode;
        this.cellShapeSelect.value = mode;
    }

    setPowerupToolbarBlocked(blocked: boolean): void {
        this.toolbarBlocked = blocked;
        this.updateToolbarState();
    }

    setStatus(text: string, icon: string): void {
        this.statusText.textContent = text;
        this.statusIcon.textContent = icon;
    }

    setPendingPowerup(type: TacticalPowerup | null): void {
        if (this.pendingPowerupType === type) return;
        this.pendingPowerupType = type;
        this.updateToolbarState();
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
        this.setStatus(t('hud.status.ready'), '✨');
    }

    private getCellShapeSelect(): HTMLSelectElement {
        const element = getRequiredElement('cell-shape-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Cell shape mode element is not a select');
        }
        return element;
    }

    private getLanguageSelect(): HTMLSelectElement {
        const element = getRequiredElement('language-select');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Language select is not a select');
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

    private getTimeHintElement(): HTMLElement {
        const element = getRequiredElement('hud-time-hint');
        if (!(element instanceof HTMLElement)) {
            throw new Error('Time hint element is not an element');
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
            button.setAttribute('aria-label', t(meta.descriptionKey));

            const metaContainer = document.createElement('span');
            metaContainer.className = 'tactical-toolbar__meta';

            const icon = document.createElement('span');
            icon.className = 'tactical-toolbar__icon';
            icon.textContent = meta.icon;

            const label = document.createElement('span');
            label.className = 'tactical-toolbar__label';
            const labelText = t(meta.labelKey);
            metaContainer.appendChild(icon);
            label.textContent = labelText;
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
        this.updateToolbarState();
    }

    private refreshPowerupButtons(): void {
        this.initPowerupButtons();
        if (this.lastPowerupInventory) {
            this.updatePowerupButtons(this.lastPowerupInventory);
        }
    }

    private getLevelCard(): HTMLElement {
        return getRequiredElement('level-card');
    }

    private getMovesLabel(): HTMLElement {
        return getRequiredElement('moves-label');
    }

    private getMovesCard(): HTMLElement {
        return getRequiredElement('moves-card');
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
            const ariaText = t('hud.aria.remainingTime', {
                current: this.formatTime(remaining),
                capacity: this.formatTime(capacity)
            });
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
                ? t('hud.aria.scoreBlocker', {
                      score: clampedScore,
                      target,
                      best: state.bestScore
                  })
                : t('hud.aria.scoreNormal', {
                      score: clampedScore,
                      target
                  });
        this.scoreProgress.setAttribute('aria-valuenow', clampedScore.toString());
        this.scoreProgress.setAttribute('aria-valuemax', target.toString());
        this.scoreProgress.setAttribute('aria-valuetext', ariaText);
        this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
    }

    private renderGoals(goals: GoalProgress[], mode: GameMode, state: GameState): void {
        this.goalsList.innerHTML = '';
        if (mode === 'blocker') {
            this.renderBlockerModeHighscore(state.bestScore);
            this.hideTimeModeHint();
            return;
        }
        if (mode === 'time') {
            this.renderTimeModeHint(state);
        } else {
            this.hideTimeModeHint();
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
            const description = describeGoal(goal);
            goal.description = description;
            label.textContent = description;

            item.setAttribute('aria-label', t('hud.goal.remaining', { description, remaining }));
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
        });
        this.updateToolbarState();
    }

    private updateToolbarState(): void {
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const button = this.powerupButtons[type];
            if (!button) return;
            const remaining = Math.max(0, this.lastPowerupInventory?.[type] ?? 0);
            const blockedByToolbar = this.toolbarBlocked && this.pendingPowerupType !== type;
            const shouldDisable = blockedByToolbar || remaining <= 0;
            button.disabled = shouldDisable;
            button.classList.toggle('tactical-toolbar__button--blocked', blockedByToolbar);
            button.classList.toggle('tactical-toolbar__button--active', this.pendingPowerupType === type);
            button.setAttribute('aria-pressed', String(this.pendingPowerupType === type));
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
        this.audioEnabled = enabled;
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? t('hud.audio.on') : t('hud.audio.off');
    }

    setPerformanceModeEnabled(enabled: boolean): void {
        this.performanceModeEnabled = enabled;
        this.performanceToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        this.performanceToggle.textContent = enabled
            ? t('options.performance.low')
            : t('options.performance.high');
    }

    onPerformanceModeChange(handler: (enabled: boolean) => void): void {
        this.performanceModeHandler = handler;
    }

    private createGoalVisual(goal: GoalProgress): HTMLElement {
        if (goal.type === 'destroy-color') {
            const chip = document.createElement('span');
            chip.className = 'hud__goal-chip hud__goal-chip--color';
            chip.style.setProperty('--goal-color', getColorHex(goal.color));
            chip.setAttribute('aria-hidden', 'true');
            const shapeKey =
                this.cellShapeMode === 'shaped'
                    ? COLOR_SHAPE_CLASS[goal.color]
                    : 'square';
            if (shapeKey) {
                chip.classList.add('board__cell--shape-' + shapeKey);
            }
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
        label.textContent = t('hud.blockerHighscore', { score: highscore });
        item.appendChild(label);
        this.goalsList.appendChild(item);
    }

    private renderTimeModeHint(state: GameState): void {
        const survived = this.formatTime(state.survivalTime ?? 0);
        const best = this.formatTime(state.bestScore ?? 0);
        this.timeHint.textContent = t('hud.timeModeHint', { survived, best });
        this.timeHint.removeAttribute('hidden');
    }

    private hideTimeModeHint(): void {
        this.timeHint.setAttribute('hidden', 'true');
        this.timeHint.textContent = '';
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

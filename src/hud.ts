import {
    TACTICAL_POWERUPS,
    TacticalPowerup,
    getColorHex,
    COLOR_SHAPE_CLASS
} from './constants.js';
import {
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
import { OptionsMenu } from './options-menu.js';
import { getBoosterIcon } from './boosters.js';

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
        this.levelTimeProgress = getRequiredElement('level-time-progress');
        this.levelTimeProgressFill = getRequiredElement('level-time-progress-fill');
        this.levelTimeProgressValue = getRequiredElement('level-time-progress-value');
        this.goalsCard = this.getGoalsCardElement();
        this.goalsList = this.getGoalsListElement();
        this.tacticalToolbar = this.getTacticalToolbar();
        this.timeHint = this.getTimeHintElement();
        this.speechBubble = getRequiredElement('hud-speech-bubble');
        this.speechIcon = getRequiredElement('hud-speech-icon');
        this.speechText = getRequiredElement('hud-speech-text');
        this.multiplierValue = getRequiredElement('hud-multiplier');
        this.scoreMultiplierSlot = getRequiredElement('hud-score-multiplier-slot');
        this.scoreMultiplierValue = getRequiredElement('hud-score-multiplier');
        this.multiplierProgressSlot = getRequiredElement('hud-multiplier-progress-slot');
        this.powerupButtons = {} as Record<TacticalPowerup, HTMLButtonElement>;
        this.powerupCountNodes = {} as Record<TacticalPowerup, HTMLElement>;
        this.initPowerupButtons();
        this.optionsMenu = new OptionsMenu();
        this.difficultyLabel = this.getDifficultyLabel();
    }

    private score: HTMLElement;
    private levelCard: HTMLElement;
    private level: HTMLElement;
    private movesLabel: HTMLElement;
    private moves: HTMLElement;
    private movesCard: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private levelTimeProgress: HTMLElement;
    private levelTimeProgressFill: HTMLElement;
    private levelTimeProgressValue: HTMLElement;
    private goalsCard: HTMLElement;
    private goalsList: HTMLUListElement;
    private difficultyLabel: HTMLElement;
    private timeHint: HTMLElement;
    private speechBubble: HTMLElement;
    private speechIcon: HTMLElement;
    private speechText: HTMLElement;
    private multiplierValue: HTMLElement;
    private scoreMultiplierSlot: HTMLElement;
    private scoreMultiplierValue: HTMLElement;
    private multiplierProgressSlot: HTMLElement;
    private readonly optionsMenu: OptionsMenu;
    private cellShapeMode: CellShapeMode = 'square';
    private currentMode: GameMode = 'level';
    private tacticalToolbar: HTMLElement;
    private powerupButtons: Record<TacticalPowerup, HTMLButtonElement>;
    private powerupCountNodes: Record<TacticalPowerup, HTMLElement>;
    private powerupHandler: ((type: TacticalPowerup) => void) | null = null;
    private toolbarBlocked = false;
    private lastPowerupInventory: PowerupInventory | null = null;
    private pendingPowerupType: TacticalPowerup | null = null;
    private speechTimeout: ReturnType<typeof window.setTimeout> | null = null;
    private lastStatusKey: string | null = null;
    private statusLockUntil = 0;
    render(state: GameState): void {
        const isTimeMode = state.mode === 'time';
        const shouldShowMovesCard = state.mode === 'level';
        this.movesCard.style.display = shouldShowMovesCard ? '' : 'none';
        this.currentMode = state.mode;
        this.updateMultiplierPlacement();
        this.updateMultiplierDisplay(state);
        this.score.textContent = isTimeMode
            ? this.formatTime(state.timeRemaining ?? 0)
            : state.mode === 'blocker'
                ? this.formatBlockerScore(state.score, state.bestScore)
                : state.score + '/' + state.targetScore;
        this.level.textContent = String(state.level);
        this.movesLabel.textContent = isTimeMode ? t('hud.label.time') : t('hud.label.moves');
        this.moves.textContent = isTimeMode
            ? this.formatTime(state.timeRemaining ?? 0)
            : state.mode === 'blocker'
                ? '∞'
                : String(state.movesLeft);
        this.applyDifficultyStyle(state.difficulty);

        this.updateLevelTimeGoal(state);
        this.updateProgress(state);
        this.renderGoals(state.goals, state.mode, state);
        this.updatePowerupButtons(state.powerups);
    }

    onCellShapeModeChange(handler: (mode: CellShapeMode) => void): void {
        this.optionsMenu.onCellShapeModeChange(handler);
    }

    onLanguageChange(handler: (locale: Locale) => void): void {
        this.optionsMenu.onLanguageChange(handler);
    }

    setLanguage(locale: Locale): void {
        this.optionsMenu.setLanguage(locale);
    }

    onTacticalPowerup(handler: (type: TacticalPowerup) => void): void {
        this.powerupHandler = handler;
    }

    onAudioToggle(handler: (enabled: boolean) => void): void {
        this.optionsMenu.onAudioToggle(handler);
    }

    onRecordingToggle(handler: (enabled: boolean) => void): void {
        this.optionsMenu.onRecordingToggle(handler);
    }

    initOptionsMenu(): void {
        this.optionsMenu.initialize();
    }

    setAudioEnabled(enabled: boolean): void {
        this.optionsMenu.setAudioEnabled(enabled);
    }

    setRecordingEnabled(enabled: boolean): void {
        this.optionsMenu.setRecordingEnabled(enabled);
    }

    setRecordingToggleLocked(lock: boolean): void {
        this.optionsMenu.setRecordingToggleLocked(lock);
    }

    applyLocale(): void {
        this.refreshPowerupButtons();
        this.optionsMenu.applyLocale();
    }

    setCellShapeMode(mode: CellShapeMode): void {
        this.cellShapeMode = mode;
        this.optionsMenu.setCellShapeMode(mode);
    }

    setPowerupToolbarBlocked(blocked: boolean): void {
        this.toolbarBlocked = blocked;
        this.updateToolbarState();
    }

    private restartSpeechTimer(): void {
        if (this.speechTimeout !== null) {
            window.clearTimeout(this.speechTimeout);
            this.speechTimeout = null;
        }
        this.speechTimeout = window.setTimeout(() => {
            this.speechBubble.classList.add('hud__speech-bubble--fade-out');
            this.speechTimeout = window.setTimeout(() => {
                this.speechBubble.hidden = true;
                this.speechBubble.classList.remove('hud__speech-bubble--fade-out');
                this.statusLockUntil = this.getNow() + 1200;
                this.lastStatusKey = null;
                this.speechTimeout = null;
            }, 300);
        }, 2800);
    }

    setStatus(text: string, icon: string, key?: string): void {
        const statusKey = icon + '|' + (key ?? text);
        const now = this.getNow();
        const isVisible = !this.speechBubble.hidden;
        if (isVisible && this.lastStatusKey === statusKey) {
            this.restartSpeechTimer();
            return;
        }
        if (!isVisible && now < this.statusLockUntil) {
            return;
        }
        this.lastStatusKey = statusKey;
        this.speechIcon.textContent = icon;
        this.speechText.textContent = text;
        if (!isVisible) {
            this.speechBubble.hidden = false;
            this.speechBubble.classList.remove('hud__speech-bubble--fade-out');
        }
        this.restartSpeechTimer();
    }

    private getNow(): number {
        return typeof window !== 'undefined' && window.performance ? window.performance.now() : Date.now();
    }

    setMultiplier(value: number): void {
        if (this.currentMode === 'time') {
            this.scoreMultiplierValue.textContent = 'x' + value.toFixed(2);
            return;
        }
        this.multiplierValue.textContent = 'x' + value.toFixed(2);
    }

    private updateMultiplierPlacement(): void {
        const target = this.multiplierProgressSlot;
        if (this.multiplierValue.parentElement === target) return;
        target.appendChild(this.multiplierValue);
    }

    private updateMultiplierDisplay(state: GameState): void {
        if (state.mode === 'time') {
            const timeMultiplier = state.timeDrainMultiplier ?? 1;
            this.multiplierValue.textContent = 'x' + timeMultiplier.toFixed(2);
            this.scoreMultiplierSlot.hidden = false;
            this.scoreMultiplierValue.textContent = 'x' + state.comboMultiplier.toFixed(2);
            return;
        }
        this.scoreMultiplierSlot.hidden = true;
        this.multiplierValue.textContent = 'x' + state.comboMultiplier.toFixed(2);
    }

    setPendingPowerup(type: TacticalPowerup | null): void {
        if (this.pendingPowerupType === type) return;
        this.pendingPowerupType = type;
        this.updateToolbarState();
    }

    onExitGame(handler: () => void): void {
        this.optionsMenu.onExitGame(handler);
    }

    onDeleteProgress(handler: () => void): void {
        this.optionsMenu.onDeleteProgress(handler);
    }

    onLogout(handler: () => void): void {
        this.optionsMenu.onLogout(handler);
    }

    setLogoutEnabled(enabled: boolean): void {
        this.optionsMenu.setLogoutEnabled(enabled);
    }

    closeOptions(): void {
        this.optionsMenu.close();
    }

    isOptionsOpen(): boolean {
        return this.optionsMenu.isOpen();
    }

    resetStatus(): void {
        this.setStatus(t('hud.status.ready'), '✨');
    }

    private getGoalsListElement(): HTMLUListElement {
        return getRequiredElement<HTMLUListElement>('goals-list');
    }

    private getGoalsCardElement(): HTMLElement {
        const element = document.querySelector('.hud__card--goals');
        if (!element) {
            throw new Error('Missing element: hud__card--goals');
        }
        return element as HTMLElement;
    }

    private getTimeHintElement(): HTMLElement {
        return getRequiredElement<HTMLElement>('hud-time-hint');
    }

    private getTacticalToolbar(): HTMLElement {
        return getRequiredElement<HTMLElement>('tactical-toolbar');
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

            const icon = document.createElement('span');
            icon.className = 'tactical-toolbar__icon';
            icon.textContent = meta.icon;

            const count = document.createElement('span');
            count.className = 'tactical-toolbar__count';
            count.textContent = '0';

            button.append(icon, count);
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
        return getRequiredElement<HTMLElement>('level-card');
    }

    private getMovesLabel(): HTMLElement {
        return getRequiredElement<HTMLElement>('moves-label');
    }

    private getMovesCard(): HTMLElement {
        return getRequiredElement<HTMLElement>('moves-card');
    }

    private getDifficultyLabel(): HTMLElement {
        return getRequiredElement<HTMLElement>('difficulty');
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
            const percent = (ratio * 100).toFixed(1) + '%';
            this.scoreProgressFill.style.width = percent;
            this.scoreProgress.style.setProperty('--progress', percent);
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
        const percent = (ratio * 100).toFixed(1) + '%';
        this.scoreProgressFill.style.width = percent;
        this.scoreProgress.style.setProperty('--progress', percent);
    }

    private updateLevelTimeGoal(state: GameState): void {
        const shouldShow =
            state.mode === 'level' &&
            state.timeRemaining !== undefined &&
            state.timeCapacity !== undefined;
        if (!shouldShow) {
            this.levelTimeProgress.hidden = true;
            return;
        }
        const remaining = Math.max(0, state.timeRemaining ?? 0);
        const capacity = Math.max(1, state.timeCapacity ?? remaining, remaining);
        const ratio = Math.min(1, capacity === 0 ? 0 : remaining / capacity);
        const ariaText = t('hud.aria.remainingTime', {
            current: this.formatTime(remaining),
            capacity: this.formatTime(capacity)
        });
        this.levelTimeProgress.hidden = false;
        this.levelTimeProgress.setAttribute('aria-valuenow', remaining.toFixed(1));
        this.levelTimeProgress.setAttribute('aria-valuemax', capacity.toFixed(1));
        this.levelTimeProgress.setAttribute('aria-valuetext', ariaText);
        const percent = (ratio * 100).toFixed(1) + '%';
        this.levelTimeProgressFill.style.width = percent;
        this.levelTimeProgress.style.setProperty('--progress', percent);
        this.levelTimeProgressValue.textContent = this.formatTime(remaining);
    }

    private renderGoals(goals: GoalProgress[], mode: GameMode, state: GameState): void {
        this.goalsList.innerHTML = '';
        if (mode === 'blocker' || mode === 'time') {
            this.hideTimeModeHint();
            this.goalsCard.style.display = 'none';
            return;
        }
        if (goals.length === 0) {
            this.hideTimeModeHint();
            this.goalsCard.style.display = 'none';
            return;
        }
        this.goalsCard.style.display = '';
        this.hideTimeModeHint();
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

    setPerformanceModeEnabled(enabled: boolean): void {
        this.optionsMenu.setPerformanceModeEnabled(enabled);
    }

    onPerformanceModeChange(handler: (enabled: boolean) => void): void {
        this.optionsMenu.onPerformanceModeChange(handler);
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
        if (goal.type === 'destroy-hard-candies') {
            const chip = document.createElement('span');
            chip.className = 'hud__goal-chip hud__goal-chip--hard';
            chip.textContent = '🧊';
            chip.setAttribute('aria-hidden', 'true');
            return chip;
        }
        const chip = document.createElement('span');
        chip.className = 'hud__goal-chip hud__goal-chip--booster';
        chip.textContent = getBoosterIcon(goal.booster);
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

    private renderTimeModeHint(state: GameState): void {
        const survived = this.formatTime(state.survivalTime ?? 0);
        const best = this.formatTime(state.bestScore ?? 0);
        const capacity = Math.max(1, state.timeCapacity ?? 0, state.timeRemaining ?? 0);
        const remaining = Math.max(0, state.timeRemaining ?? 0);
        const ratio = Math.min(1, capacity === 0 ? 0 : remaining / capacity);
        this.renderTimeHintBar(t('hud.timeModeHint', { survived, best }), ratio);
    }

    private renderLevelTimeHint(state: GameState): void {
        const remainingText = this.formatTime(state.timeRemaining ?? 0);
        const current = Math.max(0, state.timeRemaining ?? 0);
        const capacity = Math.max(current, state.timeCapacity ?? current);
        const ratio = capacity === 0 ? 0 : Math.min(1, current / capacity);
        this.renderTimeHintBar(remainingText, ratio);
    }

    private renderTimeHintBar(label: string, ratio: number): void {
        const clamped = Math.max(0, Math.min(1, ratio));
        const fillWidth = (clamped * 100).toFixed(1) + '%';
        this.timeHint.innerHTML = `
            <span class="hud__time-hint-track" aria-hidden="true">
                <span class="hud__time-hint-fill" style="width:${fillWidth}"></span>
            </span>
            <span class="hud__time-hint-label">${label}</span>
        `;
        this.timeHint.hidden = false;
    }

    private hideTimeModeHint(): void {
        this.timeHint.hidden = true;
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

    private formatBlockerScore(current: number, highscore: number): string {
        const safeHighscore = Math.max(0, highscore);
        return `${current}\u00a0/\u00a0${safeHighscore}`;
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = Math.floor(safeSeconds % 60);
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }
}

export { Hud };

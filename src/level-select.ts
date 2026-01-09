import { getRequiredElement } from './dom.js';
import { LEVELS, describeGoal, getLevelDefinition } from './levels.js';
import { t } from './i18n.js';
import type { TranslationKey } from './i18n.js';
import { Difficulty } from './types.js';
import { isDebugMode } from './debug.js';

type LevelSelectOptions = {
    onStart: (level: number) => void;
    onClose: () => void;
};

class LevelSelectView {
    constructor(options: LevelSelectOptions) {
        this.container = getRequiredElement('level-select');
        this.path = getRequiredElement<HTMLOListElement>('level-select-path');
        this.backButton = getRequiredElement<HTMLButtonElement>('level-select-back');
        this.selectedLabel = getRequiredElement('level-select-selected-label');
        this.meta = getRequiredElement('level-select-meta');
        this.timeHint = getRequiredElement('level-select-time-hint');
        this.goals = getRequiredElement<HTMLUListElement>('level-select-goals');
        this.playButton = getRequiredElement<HTMLButtonElement>('level-select-play');
        this.maxLevel = LEVELS.length;
        this.options = options;
        this.buildPath();
        this.backButton.addEventListener('click', () => this.requestClose());
        this.playButton.addEventListener('click', () => this.requestStart());
    }

    private readonly container: HTMLElement;
    private readonly path: HTMLOListElement;
    private readonly backButton: HTMLButtonElement;
    private readonly selectedLabel: HTMLElement;
    private readonly meta: HTMLElement;
    private readonly timeHint: HTMLElement;
    private readonly goals: HTMLUListElement;
    private readonly playButton: HTMLButtonElement;
    private readonly maxLevel: number;
    private readonly options: LevelSelectOptions;
    private readonly levelButtons: HTMLButtonElement[] = [];
    private highestLevel = 1;
    private selectedLevel = 1;

    open(highestLevel: number): void {
        this.highestLevel = this.clampLevel(highestLevel);
        this.selectedLevel = this.highestLevel;
        document.body.classList.add('match-app--level-select');
        this.container.removeAttribute('hidden');
        this.render();
        this.resetScrollPosition();
    }

    hide(): void {
        this.container.setAttribute('hidden', 'true');
        document.body.classList.remove('match-app--level-select');
    }

    update(highestLevel: number): void {
        this.highestLevel = this.clampLevel(highestLevel);
        if (this.selectedLevel > this.highestLevel) {
            this.selectedLevel = this.highestLevel;
        }
        this.render();
    }

    applyLocale(): void {
        this.render();
    }

    private requestClose(): void {
        this.hide();
        this.options.onClose();
    }

    private requestStart(): void {
        this.hide();
        this.options.onStart(this.selectedLevel);
    }

    private buildPath(): void {
        this.path.innerHTML = '';
        for (let level = 1; level <= this.maxLevel; level++) {
            const item = document.createElement('li');
            item.className = 'level-select__node';
            const button = document.createElement('button');
            button.className = 'level-select__node-button';
            button.type = 'button';
            button.textContent = String(level);
            button.addEventListener('click', () => this.selectLevel(level));
            item.appendChild(button);
            this.path.appendChild(item);
            this.levelButtons.push(button);
        }
    }

    private selectLevel(level: number): void {
        if (level > this.getUnlockedLevel()) {
            return;
        }
        this.selectedLevel = level;
        this.render();
    }

    private render(): void {
        this.renderNodes();
        this.renderSelected();
    }

    private renderNodes(): void {
        const unlockedLevel = this.getUnlockedLevel();
        const currentLevel = this.getCurrentLevel();
        this.levelButtons.forEach((button, index) => {
            const level = index + 1;
            const isUnlocked = level <= unlockedLevel;
            const isCurrent = level === currentLevel;
            const isSelected = level === this.selectedLevel;
            button.disabled = !isUnlocked;
            button.classList.toggle('level-select__node-button--locked', !isUnlocked);
            button.classList.toggle('level-select__node-button--current', isCurrent);
            button.classList.toggle('level-select__node-button--cleared', level < this.highestLevel);
            button.classList.toggle('level-select__node-button--selected', isSelected);
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            const label = isUnlocked
                ? t('levelSelect.nodeLabel', { level })
                : t('levelSelect.nodeLockedLabel', { level });
            button.setAttribute('aria-label', label);
        });
    }

    private renderSelected(): void {
        const definition = getLevelDefinition(this.selectedLevel);
        const difficultyLabel = this.formatDifficultyLabel(definition.difficulty);
        this.selectedLabel.textContent = t('levelSelect.selectedTitle', { level: definition.id });
        this.meta.textContent = t('levelSelect.meta', {
            moves: definition.moves,
            target: definition.targetScore,
            difficulty: difficultyLabel
        });
        if (definition.timeGoalSeconds !== undefined) {
            const formatted = this.formatTime(definition.timeGoalSeconds);
            this.timeHint.textContent = t('levelSelect.timeGoal', { time: formatted });
            this.timeHint.removeAttribute('hidden');
        } else {
            this.timeHint.setAttribute('hidden', 'true');
            this.timeHint.textContent = '';
        }
        this.goals.innerHTML = '';
        if (definition.timeGoalSeconds !== undefined) {
            const timeItem = document.createElement('li');
            timeItem.className = 'level-select__goal';
            timeItem.textContent = t('levelSelect.timeGoal', {
                time: this.formatTime(definition.timeGoalSeconds)
            });
            this.goals.appendChild(timeItem);
        }
        definition.goals.forEach((goal) => {
            const item = document.createElement('li');
            item.className = 'level-select__goal';
            item.textContent = describeGoal(goal);
            this.goals.appendChild(item);
        });
        this.playButton.textContent = t('levelSelect.playButton');
        this.playButton.disabled = this.selectedLevel > this.getUnlockedLevel();
        this.playButton.setAttribute(
            'aria-label',
            t('levelSelect.playButtonLabel', { level: this.selectedLevel })
        );
    }

    private resetScrollPosition(): void {
        this.path.scrollTop = 0;
    }

    private formatDifficultyLabel(difficulty: Difficulty): string {
        const keyMap: Record<Difficulty, TranslationKey> = {
            easy: 'difficulty.easy',
            normal: 'difficulty.normal',
            hard: 'difficulty.hard',
            expert: 'difficulty.expert',
            nightmare: 'difficulty.nightmare'
        };
        return t(keyMap[difficulty]);
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = Math.floor(safeSeconds % 60);
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    private clampLevel(level: number): number {
        return Math.min(Math.max(1, Math.floor(level)), this.maxLevel);
    }

    private getUnlockedLevel(): number {
        return isDebugMode() ? this.maxLevel : this.highestLevel;
    }

    private getCurrentLevel(): number {
        return isDebugMode() ? this.maxLevel : this.highestLevel;
    }
}

export { LevelSelectView };

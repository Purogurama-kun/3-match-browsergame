import { getRequiredElement } from './dom.js';
import { getColorHex } from './constants.js';
import { getBoosterIcon } from './boosters.js';
import { LEVELS, describeGoal, getLevelDefinition } from './levels.js';
import { t } from './i18n.js';
import type { TranslationKey } from './i18n.js';
import { Difficulty, LevelGoal } from './types.js';
import { isDebugMode } from './debug.js';

const TIME_GOAL_ICON_SRC = 'assets/images/timer.svg';
const SCORE_GOAL_ICON_SYMBOL = '🎯';

type LevelSelectOptions = {
    onStart: (level: number) => void;
    onClose: () => void;
};

type LevelSelectGoalIcon =
    | { variant: 'time'; src: string }
    | { variant: 'color'; color: string }
    | { variant: 'booster'; symbol: string }
    | { variant: 'hard'; symbol: string }
    | { variant: 'score'; symbol: string };

type MetaChipVariant = 'moves' | 'difficulty';

class LevelSelectView {
    constructor(options: LevelSelectOptions) {
        this.container = getRequiredElement('level-select');
        this.path = getRequiredElement<HTMLOListElement>('level-select-path');
        this.backButton = getRequiredElement<HTMLButtonElement>('level-select-back');
        this.selectedLabel = getRequiredElement('level-select-selected-label');
        this.meta = getRequiredElement('level-select-meta');
        this.goals = getRequiredElement<HTMLUListElement>('level-select-goals');
        this.playButton = getRequiredElement<HTMLButtonElement>('level-select-play');
        this.selectedStory = getRequiredElement('level-select-selected-story');
        this.levelTitleNode = document.createElement('span');
        this.difficultyChip = document.createElement('span');
        this.difficultyChip.className = 'level-select__difficulty';
        this.selectedLabel.textContent = '';
        this.selectedLabel.append(this.levelTitleNode, this.difficultyChip);
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
    private readonly goals: HTMLUListElement;
    private readonly playButton: HTMLButtonElement;
    private readonly selectedStory: HTMLElement;
    private readonly levelTitleNode: HTMLSpanElement;
    private readonly difficultyChip: HTMLSpanElement;
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
        this.levelTitleNode.textContent = t('levelSelect.selectedTitle', { level: definition.id });
        const movesText = t('levelSelect.metaMoves', { moves: definition.moves });
        const difficultyAccessible = t('levelSelect.metaDifficulty', { difficulty: difficultyLabel });
        this.meta.innerHTML = '';
        this.meta.append(this.createMetaChip(movesText, 'moves', movesText));
        this.updateDifficultyChip(definition.difficulty, difficultyLabel, difficultyAccessible);
        this.selectedStory.textContent = this.getLocationDescription(definition.id);
        this.goals.innerHTML = '';
        const targetDescription = t('levelSelect.targetGoal', { target: definition.targetScore });
        this.goals.appendChild(
            this.createGoalElement(
                definition.targetScore.toString(),
                { variant: 'score', symbol: SCORE_GOAL_ICON_SYMBOL },
                targetDescription
            )
        );
        if (definition.timeGoalSeconds !== undefined) {
            const formattedTime = this.formatTime(definition.timeGoalSeconds);
            const description = t('levelSelect.timeGoal', { time: formattedTime });
            this.goals.appendChild(
                this.createGoalElement(formattedTime, { variant: 'time', src: TIME_GOAL_ICON_SRC }, description)
            );
        }
        definition.goals.forEach((goal) => {
            const description = describeGoal(goal);
            this.goals.appendChild(
                this.createGoalElement(this.getGoalValue(goal), this.getGoalIcon(goal), description)
            );
        });
        this.playButton.textContent = t('levelSelect.playButton');
        this.playButton.disabled = this.selectedLevel > this.getUnlockedLevel();
        this.playButton.setAttribute(
            'aria-label',
            t('levelSelect.playButtonLabel', { level: this.selectedLevel })
        );
    }

    private createGoalElement(
        value: string,
        icon: LevelSelectGoalIcon,
        ariaDescription: string
    ): HTMLLIElement {
        const item = document.createElement('li');
        item.className = 'level-select__goal';
        item.setAttribute('aria-label', ariaDescription);

        const iconNode = document.createElement('span');
        iconNode.className = `level-select__goal-icon level-select__goal-icon--${icon.variant}`;
        iconNode.setAttribute('aria-hidden', 'true');

        if (icon.variant === 'time') {
            const img = document.createElement('img');
            img.src = icon.src;
            img.alt = '';
            iconNode.appendChild(img);
        } else if (icon.variant === 'color') {
            iconNode.style.setProperty('--goal-icon-color', icon.color);
        } else {
            iconNode.textContent = icon.symbol;
        }

        const valueNode = document.createElement('span');
        valueNode.className = 'level-select__goal-value';
        valueNode.textContent = value;

        item.append(iconNode, valueNode);
        return item;
    }

    private getGoalIcon(goal: LevelGoal): LevelSelectGoalIcon {
        switch (goal.type) {
            case 'destroy-color':
                return { variant: 'color', color: getColorHex(goal.color) };
            case 'destroy-hard-candies':
                return { variant: 'hard', symbol: '▣' };
            case 'activate-booster':
            default:
                return { variant: 'booster', symbol: getBoosterIcon(goal.booster) };
        }
    }

    private getGoalValue(goal: LevelGoal): string {
        return goal.target.toString();
    }

    private getLocationDescription(levelId: number): string {
        const key = this.getLocationKey(levelId);
        switch (key) {
            case 'vendorPlaza':
                return t('levelSelect.location.vendorPlaza');
            case 'ribbonAlley':
                return t('levelSelect.location.ribbonAlley');
            case 'lanternBridge':
                return t('levelSelect.location.lanternBridge');
            case 'festival':
                return t('levelSelect.location.festival');
            default:
                return t('levelSelect.location.vendorPlaza');
        }
    }

    private getLocationKey(levelId: number): 'vendorPlaza' | 'ribbonAlley' | 'lanternBridge' | 'festival' {
        if (levelId >= 1 && levelId <= 15) {
            return 'vendorPlaza';
        }
        if (levelId >= 16 && levelId <= 25) {
            return 'ribbonAlley';
        }
        if (levelId >= 26 && levelId <= 49) {
            return 'lanternBridge';
        }
        if (levelId === 50) {
            return 'festival';
        }
        return 'vendorPlaza';
    }

    private createMetaChip(text: string, variant: MetaChipVariant, ariaLabel: string): HTMLSpanElement {
        const chip = document.createElement('span');
        chip.className = `level-select__meta-chip level-select__meta-chip--${variant}`;
        chip.textContent = text;
        chip.setAttribute('aria-label', ariaLabel);
        return chip;
    }

    private updateDifficultyChip(difficulty: Difficulty, text: string, aria: string): void {
        this.difficultyChip.textContent = text;
        this.difficultyChip.setAttribute('aria-label', aria);
        this.difficultyChip.classList.remove(
            'level-select__difficulty--easy',
            'level-select__difficulty--normal',
            'level-select__difficulty--hard',
            'level-select__difficulty--expert',
            'level-select__difficulty--nightmare'
        );
        this.difficultyChip.classList.add(`level-select__difficulty--${difficulty}`);
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

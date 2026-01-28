import { getRequiredElement } from './dom.js';
import { getColorHex } from './constants.js';
import { getBoosterIcon } from './boosters.js';
import { describeGoal, getLevelCount, getLevelDefinition } from './levels.js';
import { t } from './i18n.js';
import type { TranslationKey } from './i18n.js';
import { Difficulty, LevelGoal } from './types.js';
import { isDebugMode } from './debug.js';
import { getStoryActs, getStoryActLabel as getStoryActLabelText } from './story.js';

const TIME_GOAL_ICON_SRC = 'assets/images/timer.svg';
const SCORE_GOAL_ICON_SYMBOL = '🎯';
const MIRA_PROFILE_SRC = 'assets/images/mira-profile.png';

type LevelSelectOptions = {
    onStart: (level: number) => void;
    onClose: () => void;
};

type LevelSelectOpenOptions = {
    focusLevel?: number;
    fromLevel?: number;
    animateMira?: boolean;
    showDetails?: boolean;
};

const MIRA_MOVE_DURATION = 1600;
const MIRA_SCROLL_DELAY = 350;
const MIRA_DETAILS_DELAY = 220;

type LevelSelectGoalIcon =
    | { variant: 'time'; src: string }
    | { variant: 'color'; color: string }
    | { variant: 'booster'; symbol: string }
    | { variant: 'hard'; symbol: string }
    | { variant: 'collect'; src: string }
    | { variant: 'score'; symbol: string };

type MetaChipVariant = 'moves' | 'difficulty';

type StoryActLabel = {
    level: number;
    element: HTMLSpanElement;
};

class LevelSelectView {
    constructor(options: LevelSelectOptions) {
        this.container = getRequiredElement('level-select');
        this.path = getRequiredElement<HTMLOListElement>('level-select-path');
        this.backButton = getRequiredElement<HTMLButtonElement>('level-select-back');
        this.detailsModal = getRequiredElement('level-select-details-modal');
        this.detailsBackdrop = getRequiredElement('level-select-details-backdrop');
        this.detailsCloseButton = getRequiredElement<HTMLButtonElement>('level-select-details-close');
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
        this.miraMarker = document.createElement('span');
        this.miraMarker.className = 'level-select__mira';
        this.miraMarker.setAttribute('aria-hidden', 'true');
        this.miraMarker.hidden = true;
        const miraImage = document.createElement('img');
        miraImage.className = 'hud__profile-image level-select__mira-image';
        miraImage.src = MIRA_PROFILE_SRC;
        miraImage.alt = '';
        this.miraMarker.appendChild(miraImage);
        this.maxLevel = getLevelCount();
        this.options = options;
        this.buildPath();
        this.backButton.addEventListener('click', () => this.requestClose());
        this.playButton.addEventListener('click', () => this.requestStart());
        this.detailsCloseButton.addEventListener('click', () => this.hideDetails());
        this.detailsBackdrop.addEventListener('click', () => this.hideDetails());
        document.addEventListener('keydown', (event) => {
            if (!this.isDetailsOpen) {
                return;
            }
            if (event.key === 'Escape') {
                this.hideDetails();
            }
        });
    }

    private readonly container: HTMLElement;
    private readonly path: HTMLOListElement;
    private readonly backButton: HTMLButtonElement;
    private readonly detailsModal: HTMLElement;
    private readonly detailsBackdrop: HTMLElement;
    private readonly detailsCloseButton: HTMLButtonElement;
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
    private readonly levelNodes: HTMLLIElement[] = [];
    private readonly miraMarker: HTMLSpanElement;
    private readonly actLabels: StoryActLabel[] = [];
    private highestLevel = 1;
    private selectedLevel = 1;
    private isDetailsOpen = false;
    private miraAnimationTimer: number | null = null;
    private miraTransitionHandler: ((event: TransitionEvent) => void) | null = null;
    private miraDetailsTimer: number | null = null;
    private miraMoveDelayTimer: number | null = null;
    private miraScrollFrame: number | null = null;
    private miraScrollTimer: number | null = null;
    private miraScrollToken = 0;

    open(highestLevel: number, options?: LevelSelectOpenOptions): void {
        this.highestLevel = this.clampLevel(highestLevel);
        const requestedLevel = this.clampLevel(options?.focusLevel ?? this.highestLevel);
        const unlockedLevel = this.getUnlockedLevel();
        this.selectedLevel = Math.min(requestedLevel, unlockedLevel);
        document.body.classList.add('match-app--level-select');
        this.container.removeAttribute('hidden');
        this.hideDetails();
        this.cleanupMiraAnimation();
        this.render();
        this.resetScrollPosition();
        this.runOpenAnimation(options);
    }

    hide(): void {
        this.container.setAttribute('hidden', 'true');
        document.body.classList.remove('match-app--level-select');
        this.hideDetails();
        this.cleanupMiraAnimation();
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
            this.tryAddActLabel(item, level);
            this.path.appendChild(item);
            this.levelButtons.push(button);
            this.levelNodes.push(item);
        }
    }

    private selectLevel(level: number): void {
        if (level > this.getUnlockedLevel()) {
            return;
        }
        this.selectedLevel = level;
        this.render();
        this.showDetails();
    }

    private render(): void {
        this.renderActLabels();
        this.renderNodes();
        this.renderSelected();
    }

    private runOpenAnimation(options?: LevelSelectOpenOptions): void {
        if (!options?.showDetails && !options?.animateMira) {
            return;
        }
        if (options.animateMira && typeof options.fromLevel === 'number') {
            const fromLevel = options.fromLevel;
            const targetLevel = this.clampLevel(options.focusLevel ?? this.getUnlockedLevel());
            this.updateMiraMarker(fromLevel);
            this.scrollPathToMiraRange(fromLevel, targetLevel, () => {
                this.miraMoveDelayTimer = window.setTimeout(() => {
                    this.miraMoveDelayTimer = null;
                    this.animateMiraMarker(fromLevel, targetLevel, () => {
                        if (options.showDetails) {
                            this.miraDetailsTimer = window.setTimeout(() => {
                                this.miraDetailsTimer = null;
                                this.showDetails();
                            }, MIRA_DETAILS_DELAY);
                        }
                    });
                }, MIRA_SCROLL_DELAY);
            });
            return;
        }
        if (options.showDetails) {
            this.showDetails();
        }
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
        this.updateMiraMarker(unlockedLevel);
    }

    private animateMiraMarker(fromLevel: number, toLevel: number, onComplete: () => void): void {
        const startLevel = this.clampLevel(fromLevel);
        const endLevel = this.clampLevel(toLevel);
        if (startLevel === endLevel) {
            this.updateMiraMarker(endLevel);
            onComplete();
            return;
        }
        const startNode = this.levelNodes[startLevel - 1];
        const endNode = this.levelNodes[endLevel - 1];
        if (!startNode || !endNode) {
            this.updateMiraMarker(endLevel);
            onComplete();
            return;
        }
        this.cleanupMiraAnimation();
        this.updateMiraMarker(startLevel);
        const startRect = this.miraMarker.getBoundingClientRect();
        this.path.classList.add('level-select__path--animating');
        this.updateMiraMarker(endLevel);
        const endRect = this.miraMarker.getBoundingClientRect();
        const deltaX = Math.round(startRect.left - endRect.left);
        const deltaY = Math.round(startRect.top - endRect.top);
        this.miraMarker.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        const finish = (): void => {
            if (this.miraAnimationTimer !== null) {
                window.clearTimeout(this.miraAnimationTimer);
                this.miraAnimationTimer = null;
            }
            this.miraMarker.removeEventListener('transitionend', handleTransitionEnd);
            this.miraTransitionHandler = null;
            this.miraMarker.classList.remove('level-select__mira--moving');
            this.miraMarker.style.removeProperty('transform');
            this.path.classList.remove('level-select__path--animating');
            onComplete();
        };
        const handleTransitionEnd = (event: TransitionEvent): void => {
            if (event.propertyName !== 'transform') {
                return;
            }
            finish();
        };
        this.miraTransitionHandler = handleTransitionEnd;
        this.miraMarker.addEventListener('transitionend', handleTransitionEnd);
        void this.miraMarker.offsetHeight;
        this.miraAnimationTimer = window.setTimeout(finish, MIRA_MOVE_DURATION + 300);
        window.requestAnimationFrame(() => {
            this.miraMarker.classList.add('level-select__mira--moving');
            this.miraMarker.style.transform = 'translate(0px, 0px)';
        });
    }

    private cleanupMiraAnimation(): void {
        this.miraScrollToken += 1;
        if (this.miraScrollFrame !== null) {
            window.cancelAnimationFrame(this.miraScrollFrame);
            this.miraScrollFrame = null;
        }
        if (this.miraScrollTimer !== null) {
            window.clearTimeout(this.miraScrollTimer);
            this.miraScrollTimer = null;
        }
        if (this.miraMoveDelayTimer !== null) {
            window.clearTimeout(this.miraMoveDelayTimer);
            this.miraMoveDelayTimer = null;
        }
        if (this.miraAnimationTimer !== null) {
            window.clearTimeout(this.miraAnimationTimer);
            this.miraAnimationTimer = null;
        }
        if (this.miraDetailsTimer !== null) {
            window.clearTimeout(this.miraDetailsTimer);
            this.miraDetailsTimer = null;
        }
        if (this.miraTransitionHandler) {
            this.miraMarker.removeEventListener('transitionend', this.miraTransitionHandler);
            this.miraTransitionHandler = null;
        }
        this.miraMarker.classList.remove('level-select__mira--moving');
        this.miraMarker.style.removeProperty('transform');
        this.path.classList.remove('level-select__path--animating');
    }

    private scrollPathToMiraRange(fromLevel: number, toLevel: number, onComplete: () => void): void {
        const startLevel = this.clampLevel(fromLevel);
        const endLevel = this.clampLevel(toLevel);
        const startNode = this.levelNodes[startLevel - 1];
        const endNode = this.levelNodes[endLevel - 1];
        if (!startNode || !endNode) {
            onComplete();
            return;
        }
        const midpoint = (this.getNodeCenter(startNode) + this.getNodeCenter(endNode)) / 2;
        if (this.path.scrollHeight > this.path.clientHeight + 1) {
            const targetScrollTop = midpoint - this.path.clientHeight / 2;
            this.scrollPathTo(targetScrollTop, onComplete);
            return;
        }
        const viewportMidpoint =
            (this.getNodeViewportCenter(startNode) + this.getNodeViewportCenter(endNode)) / 2;
        const targetScrollTop = window.scrollY + viewportMidpoint - window.innerHeight / 2;
        this.scrollWindowTo(targetScrollTop, onComplete);
    }

    private scrollPathTo(targetScrollTop: number, onComplete: () => void): void {
        const maxScroll = Math.max(0, this.path.scrollHeight - this.path.clientHeight);
        const clampedTarget = Math.max(0, Math.min(maxScroll, Math.round(targetScrollTop)));
        const token = this.miraScrollToken + 1;
        this.miraScrollToken = token;
        const finish = (): void => {
            if (this.miraScrollToken !== token) {
                return;
            }
            if (this.miraScrollFrame !== null) {
                window.cancelAnimationFrame(this.miraScrollFrame);
                this.miraScrollFrame = null;
            }
            if (this.miraScrollTimer !== null) {
                window.clearTimeout(this.miraScrollTimer);
                this.miraScrollTimer = null;
            }
            onComplete();
        };
        if (Math.abs(this.path.scrollTop - clampedTarget) < 2) {
            this.path.scrollTop = clampedTarget;
            finish();
            return;
        }
        let settledFrames = 0;
        const check = (): void => {
            if (this.miraScrollToken !== token) {
                return;
            }
            if (Math.abs(this.path.scrollTop - clampedTarget) < 2) {
                settledFrames += 1;
                if (settledFrames >= 2) {
                    finish();
                    return;
                }
            } else {
                settledFrames = 0;
            }
            this.miraScrollFrame = window.requestAnimationFrame(check);
        };
        this.path.scrollTo({ top: clampedTarget, behavior: 'smooth' });
        this.miraScrollFrame = window.requestAnimationFrame(check);
        this.miraScrollTimer = window.setTimeout(finish, 1200);
    }

    private scrollWindowTo(targetScrollTop: number, onComplete: () => void): void {
        const maxScroll = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
        );
        const clampedTarget = Math.max(0, Math.min(maxScroll, Math.round(targetScrollTop)));
        const token = this.miraScrollToken + 1;
        this.miraScrollToken = token;
        const finish = (): void => {
            if (this.miraScrollToken !== token) {
                return;
            }
            if (this.miraScrollFrame !== null) {
                window.cancelAnimationFrame(this.miraScrollFrame);
                this.miraScrollFrame = null;
            }
            if (this.miraScrollTimer !== null) {
                window.clearTimeout(this.miraScrollTimer);
                this.miraScrollTimer = null;
            }
            onComplete();
        };
        if (Math.abs(window.scrollY - clampedTarget) < 2) {
            window.scrollTo({ top: clampedTarget });
            finish();
            return;
        }
        let settledFrames = 0;
        const check = (): void => {
            if (this.miraScrollToken !== token) {
                return;
            }
            if (Math.abs(window.scrollY - clampedTarget) < 2) {
                settledFrames += 1;
                if (settledFrames >= 2) {
                    finish();
                    return;
                }
            } else {
                settledFrames = 0;
            }
            this.miraScrollFrame = window.requestAnimationFrame(check);
        };
        window.scrollTo({ top: clampedTarget, behavior: 'smooth' });
        this.miraScrollFrame = window.requestAnimationFrame(check);
        this.miraScrollTimer = window.setTimeout(finish, 1200);
    }

    private getNodeCenter(node: HTMLElement): number {
        return node.offsetTop + node.offsetHeight / 2;
    }

    private getNodeViewportCenter(node: HTMLElement): number {
        const rect = node.getBoundingClientRect();
        return rect.top + rect.height / 2;
    }

    private updateMiraMarker(unlockedLevel: number): void {
        const clampedLevel = this.clampLevel(unlockedLevel);
        const targetNode = this.levelNodes[clampedLevel - 1];
        if (!targetNode) {
            this.miraMarker.hidden = true;
            this.path.style.setProperty('--level-select-progress-height', '0px');
            return;
        }
        if (this.miraMarker.parentElement !== targetNode) {
            this.miraMarker.remove();
            targetNode.appendChild(this.miraMarker);
        }
        this.miraMarker.hidden = false;
        this.updateProgressPath(targetNode);
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
        const actLabel = this.getStoryActLabel(definition.id);
        const locationDescription = this.getLocationDescription(definition.id);
        this.selectedStory.textContent = `${actLabel} · ${locationDescription}`;
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
        this.detailsCloseButton.setAttribute('aria-label', t('levelSelect.closeDetails'));
    }

    private showDetails(): void {
        if (this.isDetailsOpen) {
            return;
        }
        this.detailsModal.removeAttribute('hidden');
        this.isDetailsOpen = true;
        this.detailsCloseButton.focus();
    }

    private hideDetails(): void {
        if (!this.isDetailsOpen) {
            this.detailsModal.setAttribute('hidden', 'true');
            return;
        }
        this.detailsModal.setAttribute('hidden', 'true');
        this.isDetailsOpen = false;
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

        if (icon.variant === 'time' || icon.variant === 'collect') {
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
                return { variant: 'booster', symbol: getBoosterIcon(goal.booster) };
            case 'collect-items':
                return { variant: 'collect', src: 'assets/images/candy-collector-4.svg' };
            default:
                return { variant: 'score', symbol: SCORE_GOAL_ICON_SYMBOL };
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

    private tryAddActLabel(item: HTMLLIElement, level: number): void {
        const storyAct = getStoryActs().find((act) => act.startLevel === level);
        if (!storyAct) {
            return;
        }
        item.classList.add('level-select__node--act');
        const label = document.createElement('span');
        label.className = 'level-select__act-label';
        label.setAttribute('data-act', storyAct.id);
        item.appendChild(label);
        this.actLabels.push({ level, element: label });
    }

    private renderActLabels(): void {
        this.actLabels.forEach((label) => {
            const text = getStoryActLabelText(label.level);
            label.element.textContent = text;
            label.element.setAttribute('aria-label', text);
        });
    }

    private getStoryActLabel(levelId: number): string {
        return getStoryActLabelText(levelId);
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

    private updateProgressPath(targetNode: HTMLLIElement): void {
        const pathRect = this.path.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();
        const startOffset = this.getProgressStartOffset(pathRect);
        const targetCenter = targetRect.top - pathRect.top + targetRect.height / 2;
        const progressHeight = Math.max(0, targetCenter - startOffset);
        this.path.style.setProperty('--level-select-progress-top', `${Math.round(startOffset)}px`);
        this.path.style.setProperty('--level-select-progress-height', `${Math.round(progressHeight)}px`);
    }

    private getProgressStartOffset(pathRect: DOMRect): number {
        const pathTopOffset = this.getPathTopOffset();
        if (pathTopOffset > 0) {
            return pathTopOffset;
        }
        const firstNode = this.levelNodes[0];
        if (firstNode) {
            const firstRect = firstNode.getBoundingClientRect();
            return firstRect.top - pathRect.top + firstRect.height / 2;
        }
        return 0;
    }

    private getPathTopOffset(): number {
        const styles = getComputedStyle(this.path);
        const topValue = styles.getPropertyValue('--level-select-path-top').trim();
        const offset = this.parseCssLength(topValue);
        if (offset > 0) {
            return offset;
        }
        const paddingTop = this.parseCssLength(styles.paddingTop);
        return Math.max(0, paddingTop);
    }

    private parseCssLength(value: string): number {
        if (value.endsWith('rem')) {
            const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
            const remValue = parseFloat(value);
            return Number.isFinite(rootSize) && Number.isFinite(remValue) ? rootSize * remValue : 0;
        }
        if (value.endsWith('px')) {
            const pxValue = parseFloat(value);
            return Number.isFinite(pxValue) ? pxValue : 0;
        }
        const fallbackValue = parseFloat(value);
        return Number.isFinite(fallbackValue) ? fallbackValue : 0;
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

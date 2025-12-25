import { Hud } from './hud.js';
import { getRequiredElement } from './dom.js';
import { Board, CellState } from './board.js';
import { SwipeDirection } from './types.js';
import type { GameMode, LineOrientation } from './types.js';
import {
    GRID_SIZE,
    BOOSTERS,
    BoosterType,
    getColorKeyFromHex,
    COLOR_SHAPE_CLASS,
    SHAPE_CLASS_NAMES
} from './constants.js';
import type { ColorKey } from './constants.js';
import { t } from './i18n.js';
import { ParticleEffect } from './particle-effect.js';
import type { ParticleOptions } from './particle-effect.js';

type ModalOptions = {
    title: string;
    text: string;
    buttonText: string;
    onClose: () => void;
};

class Renderer {
    private readonly hud: Hud;
    private readonly gameEl: HTMLElement;
    private readonly modalEl: HTMLElement;
    private readonly modalTitle: HTMLElement;
    private readonly modalText: HTMLElement;
    private readonly modalButton: HTMLButtonElement;
    private readonly moveEvaluationEl: HTMLElement;
    private moveEvaluationTimer: number | null = null;
    private modalCallback: (() => void) | null = null;
    private readonly cells: HTMLDivElement[] = [];
    private selectedIndex: number | null = null;
    private readonly explodingIndices = new Set<number>();
    private onCellClick: ((index: number) => void) | null = null;
    private onCellSwipe: ((index: number, direction: SwipeDirection) => void) | null = null;
    private touchStartIndex: number | null = null;
    private touchStartX: number | null = null;
    private touchStartY: number | null = null;
    private readonly swipeThreshold = 18;
    private cellShapesEnabled = true;
    private readonly particleEffect: ParticleEffect;
    private gameMode: GameMode = 'level';

    constructor(hud: Hud) {
        this.hud = hud;
        this.gameEl = getRequiredElement('game');
        this.modalEl = getRequiredElement('result-modal');
        this.modalTitle = getRequiredElement('result-title');
        this.modalText = getRequiredElement('result-text');
        this.modalButton = getRequiredElement('result-button') as HTMLButtonElement;
        this.moveEvaluationEl = getRequiredElement('move-evaluation');
        this.particleEffect = new ParticleEffect(this.gameEl);

        this.modalButton.addEventListener('click', () => this.hideModal());
        this.modalEl.addEventListener('click', (event) => {
            if (event.target === this.modalEl) {
                this.hideModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modalEl.classList.contains('modal--visible')) {
                this.hideModal();
            }
        });
    }

    setGameMode(mode: GameMode): void {
        this.gameMode = mode;
    }

    screenShake(): void {
        this.gameEl.classList.add('board--shake');
        setTimeout(() => this.gameEl.classList.remove('board--shake'), 350);
    }

    getGameElement(): HTMLElement {
        return this.gameEl;
    }

    setCellShapesEnabled(enabled: boolean): void {
        this.cellShapesEnabled = enabled;
    }

    renderBoard(
        board: Board,
        onCellClick: (index: number) => void,
        onCellSwipe: (index: number, direction: SwipeDirection) => void
    ): void {
        this.onCellClick = onCellClick;
        this.onCellSwipe = onCellSwipe;
        this.resetTouchState();
        this.selectedIndex = null;
        this.cells.length = 0;
        this.gameEl.innerHTML = '';
        this.particleEffect.reset();
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'board__cell';
            cell.dataset.index = String(i);
            this.attachCellListeners(cell, i);
            this.cells.push(cell);
            this.gameEl.appendChild(cell);
        }
        this.refreshBoard(board);
    }

    refreshBoard(board: Board): void {
        for (let i = 0; i < this.cells.length; i++) {
            this.applyCellState(i, board.getCellState(i));
        }
        if (this.selectedIndex !== null) {
            this.getCellElement(this.selectedIndex).classList.add('board__cell--selected');
        }
    }

    updateCell(index: number, state: CellState): void {
        this.applyCellState(index, state);
        if (this.selectedIndex === index) {
            this.getCellElement(index).classList.add('board__cell--selected');
        }
    }

    showInvalidMove(index: number): void {
        const cell = this.getCellElement(index);
        cell.classList.add('board__cell--shake');
    }

    clearInvalidMove(index: number): void {
        const cell = this.getCellElement(index);
        cell.classList.remove('board__cell--shake');
    }

    selectCell(index: number): void {
        if (this.selectedIndex === index) return;
        this.clearSelection();
        this.selectedIndex = index;
        this.getCellElement(index).classList.add('board__cell--selected');
    }

    clearSelection(): void {
        if (this.selectedIndex === null) return;
        this.getCellElement(this.selectedIndex).classList.remove('board__cell--selected');
        this.selectedIndex = null;
    }

    markCellExploding(index: number): void {
        if (this.explodingIndices.has(index)) return;
        this.explodingIndices.add(index);
        this.getCellElement(index).classList.add('board__cell--explode');
    }

    clearCellExplosion(index: number): void {
        if (!this.explodingIndices.delete(index)) return;
        this.getCellElement(index).classList.remove('board__cell--explode');
    }

    emitCellParticles(index: number, color: string | null = null, options: ParticleOptions = {}): void {
        const cell = this.getCellElement(index);
        const resolvedColor =
            color ||
            cell.style.getPropertyValue('--cell-color') ||
            options.accentColor ||
            null;
        this.particleEffect.emitFromCell(cell, resolvedColor, options);
    }

    isCellExploding(index: number): boolean {
        return this.explodingIndices.has(index);
    }

    renderMultiplierStatus(comboMultiplier: number, delta: number, moveScore: number): void {
        const icon = delta > 0 ? '⬆️' : delta < 0 ? '⬇️' : '✨';
        const formattedMultiplier = 'x' + comboMultiplier.toFixed(2);
        const scorePart = moveScore > 0 ? t('renderer.points', { points: moveScore }) : '';
        const prefix =
            delta > 0
                ? t('renderer.comboIncrease')
                : delta < 0
                    ? t('renderer.comboDecrease')
                    : t('renderer.comboNeutral');
        this.hud.setStatus(prefix + ' ' + formattedMultiplier + scorePart, icon);
    }

    showMoveEvaluation(message: string, speechEnabled: boolean): void {
        if (this.moveEvaluationTimer !== null) {
            clearTimeout(this.moveEvaluationTimer);
            this.moveEvaluationTimer = null;
        }
        this.moveEvaluationEl.textContent = message;
        this.moveEvaluationEl.classList.add('move-evaluation--visible');
        if (speechEnabled) {
            this.speak(message);
        }
        this.moveEvaluationTimer = window.setTimeout(() => {
            this.moveEvaluationEl.classList.remove('move-evaluation--visible');
            this.moveEvaluationTimer = null;
        }, 2000);
    }

    resetMoveEvaluation(): void {
        if (this.moveEvaluationTimer !== null) {
            clearTimeout(this.moveEvaluationTimer);
            this.moveEvaluationTimer = null;
        }
        this.moveEvaluationEl.classList.remove('move-evaluation--visible');
    }

    playSpawnAnimation(): number {
        const baseDuration = 550;
        let longestDelay = 0;
        this.cells.forEach((cell, index) => {
            if (cell.classList.contains('board__cell--void')) return;
            const { row, col } = this.getRowCol(index);
            const delay = row * 70 + col * 12;
            longestDelay = Math.max(longestDelay, delay);
            cell.classList.remove('board__cell--spawn');
            cell.style.animationDelay = delay + 'ms';
            cell.classList.add('board__cell--spawn');
            cell.addEventListener(
                'animationend',
                () => {
                    cell.classList.remove('board__cell--spawn');
                    cell.style.removeProperty('animation-delay');
                },
                { once: true }
            );
        });
        return baseDuration + longestDelay;
    }

    animateGeneratorHit(index: number): void {
        const cell = this.getCellElement(index);
        cell.classList.add('board__cell--generator-hit');
        cell.addEventListener(
            'animationend',
            () => {
                cell.classList.remove('board__cell--generator-hit');
            },
            { once: true }
        );
    }

    showModal(options: ModalOptions): void {
        this.modalCallback = options.onClose;
        this.modalTitle.textContent = options.title;
        this.modalText.textContent = options.text;
        this.modalButton.textContent = options.buttonText;
        this.modalEl.classList.add('modal--visible');
        this.modalButton.focus();
    }

    hideModal(triggerCallback = true): void {
        if (!this.modalEl.classList.contains('modal--visible')) {
            this.modalCallback = null;
            return;
        }
        this.modalEl.classList.remove('modal--visible');
        if (triggerCallback && this.modalCallback) {
            const callback = this.modalCallback;
            this.modalCallback = null;
            callback();
            return;
        }
        this.modalCallback = null;
    }

    isModalVisible(): boolean {
        return this.modalEl.classList.contains('modal--visible');
    }

    private applyCellState(index: number, state: CellState): void {
        const cell = this.getCellElement(index);
        cell.className = 'board__cell';
        cell.dataset.index = String(index);
        cell.dataset.booster = state.booster;
        cell.dataset.blocked = state.blocked ? 'true' : 'false';
        cell.dataset.hard = state.hard ? 'true' : 'false';
        cell.dataset.generator = state.generator ? 'true' : 'false';
        if (state.lineOrientation) {
            cell.dataset.lineOrientation = state.lineOrientation;
        } else {
            delete cell.dataset.lineOrientation;
        }
        this.clearShapeClasses(cell);
        const colorKey = state.color ? getColorKeyFromHex(state.color) : null;
        cell.dataset.colorKey = colorKey ?? '';
        cell.textContent = '';
        cell.style.removeProperty('--cell-color');
        cell.classList.remove('board__cell--sugar-chest');
        cell.style.removeProperty('--sugar-chest-image');
        if (state.blocked) {
            cell.classList.add('board__cell--void');
            return;
        }
        const chestStage = state.sugarChestStage;
        if (typeof chestStage === 'number') {
            const stageIndex = String(chestStage).padStart(2, '0');
            cell.classList.add('board__cell--sugar-chest');
            cell.style.setProperty(
                '--sugar-chest-image',
                `url(/assets/images/sugar-chest-${stageIndex}.png)`
            );
            return;
        }
        if (state.color) {
            cell.style.setProperty('--cell-color', state.color);
        }
        if (!state.generator && this.cellShapesEnabled) {
            this.applyShapeForColor(cell, colorKey);
        }
        if (state.generator) {
            cell.classList.add('board__cell--generator');
            cell.textContent = '⛓️';
            return;
        }
        if (state.hard) {
            cell.classList.add('board__cell--hard');
        }
        this.applyBoosterVisual(cell, state.booster, state.lineOrientation);
    }

    private applyShapeForColor(cell: HTMLDivElement, colorKey: ColorKey | null): void {
        if (!colorKey) return;
        const shape = COLOR_SHAPE_CLASS[colorKey];
        if (!shape) return;
        cell.classList.add(`board__cell--shape-${shape}`);
    }

    private clearShapeClasses(cell: HTMLDivElement): void {
        SHAPE_CLASS_NAMES.forEach((className) => cell.classList.remove(className));
    }

    private applyBoosterVisual(cell: HTMLDivElement, booster: BoosterType, orientation?: LineOrientation): void {
        cell.classList.remove(
            'board__cell--bomb-line',
            'board__cell--bomb-line-horizontal',
            'board__cell--bomb-line-vertical',
            'board__cell--bomb-radius',
            'board__cell--bomb-small',
            'board__cell--bomb-medium',
            'board__cell--bomb-large',
            'board__cell--bomb-ultimate'
        );
        cell.style.color = '#0b0f1d';
        cell.textContent = '';
        if (booster === BOOSTERS.LINE) {
            cell.classList.add('board__cell--bomb-line');
            if (this.gameMode === 'blocker') {
                cell.classList.add('board__cell--bomb-line-horizontal', 'board__cell--bomb-line-vertical');
            } else {
                const directionClass =
                    orientation === 'vertical' ? 'board__cell--bomb-line-vertical' : 'board__cell--bomb-line-horizontal';
                cell.classList.add(directionClass);
            }
            cell.textContent = '💣';
        }
        if (booster === BOOSTERS.BURST_SMALL) {
            cell.classList.add('board__cell--bomb-small');
            cell.textContent = '🧨';
        }
        if (booster === BOOSTERS.BURST_MEDIUM) {
            cell.classList.add('board__cell--bomb-medium');
            cell.textContent = '💥';
        }
        if (booster === BOOSTERS.BURST_LARGE) {
            cell.classList.add('board__cell--bomb-large', 'board__cell--bomb-ultimate');
            cell.style.color = '#f8fafc';
            cell.textContent = '☢️';
        }
    }

    private attachCellListeners(cell: HTMLDivElement, index: number): void {
        cell.addEventListener('click', () => this.onCellClick?.(index));
        cell.addEventListener('touchstart', (event) => this.handleTouchStart(index, event), { passive: false });
        cell.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
        cell.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false });
        cell.addEventListener('touchcancel', () => this.resetTouchState());
    }

    private handleTouchStart(index: number, event: TouchEvent): void {
        const touch = event.touches[0];
        if (!touch) return;
        this.touchStartIndex = index;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
    }

    private handleTouchMove(event: TouchEvent): void {
        if (this.touchStartIndex === null) return;
        if (!this.touchStartX || !this.touchStartY) return;
        const touch = event.touches[0];
        if (!touch) return;
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (Math.max(absX, absY) < this.swipeThreshold) {
            return;
        }
        event.preventDefault();
        const direction: SwipeDirection =
            absX > absY ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up';
        this.onCellSwipe?.(this.touchStartIndex, direction);
        this.resetTouchState();
    }

    private handleTouchEnd(event: TouchEvent): void {
        if (!event.changedTouches.length) {
            this.resetTouchState();
            return;
        }
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this.touchStartIndex = null;
        this.touchStartX = null;
        this.touchStartY = null;
    }

    private getCellElement(index: number): HTMLDivElement {
        const cell = this.cells[index];
        if (!cell) {
            throw new Error('Cell element missing for index: ' + index);
        }
        return cell;
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }

    private speak(message: string): void {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.onerror = (event) => {
            console.error('speech error', event);
        };
        utterance.lang = 'en-US';
        utterance.rate = 1.08;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        window.speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }
}

export { Renderer };

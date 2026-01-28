import { Hud } from './hud.js';
import { getRequiredElement } from './dom.js';
import { Board, CellState, type DropMove } from './board.js';
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
import type { ParticleOptions, ShockwaveType } from './particle-effect.js';

type ModalOptions = {
    title: string;
    text: string;
    buttonText: string;
    secondaryButtonText?: string;
    onClose: () => void;
    onSecondary?: () => void;
    coinSummary?: {
        collectedText: string;
        bonusText?: string;
    };
};

class Renderer {
    private readonly hud: Hud;
    private readonly gameEl: HTMLElement;
    private readonly modalEl: HTMLElement;
    private readonly modalTitle: HTMLElement;
    private readonly modalText: HTMLElement;
    private readonly modalButton: HTMLButtonElement;
    private readonly modalSecondaryButton: HTMLButtonElement;
    private readonly moveEvaluationEl: HTMLElement;
    private moveEvaluationTimer: number | null = null;
    private readonly shuffleNoticeEl: HTMLElement;
    private readonly shuffleNoticeTextEl: HTMLElement;
    private shuffleNoticeTimer: number | null = null;
    private celebrationEl: HTMLDivElement | null = null;
    private celebrationTimer: number | null = null;
    private modalCallback: (() => void) | null = null;
    private modalSecondaryCallback: (() => void) | null = null;
    private readonly cells: HTMLDivElement[] = [];
    private readonly renderedKeys: string[] = [];
    private readonly pendingCellUpdates = new Map<number, CellState>();
    private pendingFlushHandle: number | null = null;
    private collectorRow: HTMLDivElement | null = null;
    private renderContextVersion = 0;
    private selectedIndex: number | null = null;
    private readonly hintIndices = new Set<number>();
    private readonly explodingIndices = new Set<number>();
    private onCellClick: ((index: number) => void) | null = null;
    private onCellSwipe: ((index: number, direction: SwipeDirection) => void) | null = null;
    private touchStartIndex: number | null = null;
    private touchStartX: number | null = null;
    private touchStartY: number | null = null;
    private readonly swipeThreshold = 18;
    private cellShapesEnabled = true;
    private animationsEnabled = true;
    private readonly particleEffect: ParticleEffect;
    private gameMode: GameMode = 'level';
    private readonly recordingButton: HTMLButtonElement;
    private recordingButtonHandler: (() => void) | null = null;

    constructor(hud: Hud) {
        this.hud = hud;
        this.gameEl = getRequiredElement('game');
        this.modalEl = getRequiredElement('result-modal');
        this.modalTitle = getRequiredElement('result-title');
        this.modalText = getRequiredElement('result-text');
        this.modalButton = getRequiredElement('result-button') as HTMLButtonElement;
        this.modalSecondaryButton = getRequiredElement('result-home-button') as HTMLButtonElement;
        this.moveEvaluationEl = getRequiredElement('move-evaluation');
        this.shuffleNoticeEl = getRequiredElement('shuffle-notice');
        this.shuffleNoticeTextEl = getRequiredElement('shuffle-notice-text');
        this.particleEffect = new ParticleEffect(this.gameEl);
        this.recordingButton = getRequiredElement('result-recording-button') as HTMLButtonElement;
        this.recordingButton.addEventListener('click', () => {
            if (!this.recordingButtonHandler) return;
            this.recordingButtonHandler();
        });
        this.recordingButton.setAttribute('hidden', 'true');

        this.modalButton.addEventListener('click', () => this.hideModal());
        this.modalSecondaryButton.addEventListener('click', () => this.hideModal(false, true));
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
        this.renderContextVersion++;
        document.body.classList.remove('match-app--mode-time', 'match-app--mode-blocker');
        if (mode === 'time') {
            document.body.classList.add('match-app--mode-time');
        } else if (mode === 'blocker') {
            document.body.classList.add('match-app--mode-blocker');
        }
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
        this.renderContextVersion++;
    }

    setAnimationsEnabled(enabled: boolean): void {
        this.animationsEnabled = enabled;
    }

    showLevelWinCelebration(): void {
        if (!this.animationsEnabled) return;
        if (this.celebrationTimer !== null) {
            window.clearTimeout(this.celebrationTimer);
            this.celebrationTimer = null;
        }
        if (this.celebrationEl) {
            this.celebrationEl.remove();
            this.celebrationEl = null;
        }

        const celebration = document.createElement('div');
        celebration.className = 'board__celebration';

        const colors = ['#ffffff', '#ffe29a', '#ff8a65', '#7ed957', '#67e8f9', '#fbbf24'];
        const pieces = 48;
        let maxEnd = 0;

        for (let i = 0; i < pieces; i++) {
            const piece = document.createElement('span');
            piece.className = 'board__confetti';
            const delay = Math.random() * 0.25;
            const duration = 1.4 + Math.random() * 1.0;
            const drift = Math.random() * 140 - 70;
            const rotate = Math.random() * 720 - 360;
            const scale = 0.7 + Math.random() * 0.6;

            piece.style.left = `${Math.random() * 100}%`;
            piece.style.setProperty('--confetti-color', colors[i % colors.length] ?? '#ffffff');
            piece.style.setProperty('--confetti-delay', `${delay.toFixed(2)}s`);
            piece.style.setProperty('--confetti-duration', `${duration.toFixed(2)}s`);
            piece.style.setProperty('--confetti-drift', `${drift.toFixed(0)}px`);
            piece.style.setProperty('--confetti-rotate', `${rotate.toFixed(0)}deg`);
            piece.style.setProperty('--confetti-scale', `${scale.toFixed(2)}`);
            celebration.appendChild(piece);
            maxEnd = Math.max(maxEnd, delay + duration);
        }

        document.body.appendChild(celebration);
        this.celebrationEl = celebration;
        this.celebrationTimer = window.setTimeout(() => {
            celebration.remove();
            if (this.celebrationEl === celebration) {
                this.celebrationEl = null;
            }
            this.celebrationTimer = null;
        }, (maxEnd + 0.1) * 1000);
    }

    setBackground(backgroundUrl?: string): void {
        if (backgroundUrl) {
            document.body.style.backgroundImage = `url('${backgroundUrl}')`;
            document.body.classList.add('match-app--playing');
        } else {
            document.body.style.backgroundImage = '';
            document.body.classList.remove('match-app--playing');
        }
    }

    renderBoard(
        board: Board,
        onCellClick: (index: number) => void,
        onCellSwipe: (index: number, direction: SwipeDirection) => void
    ): void {
        this.clearHint();
        this.onCellClick = onCellClick;
        this.onCellSwipe = onCellSwipe;
        this.resetTouchState();
        this.selectedIndex = null;
        this.cells.length = 0;
        this.renderedKeys.length = 0;
        this.pendingCellUpdates.clear();
        this.gameEl.innerHTML = '';
        this.particleEffect.reset();
        this.collectorRow = null;
        this.gameEl.classList.remove('board--has-collector');
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'board__cell';
            cell.dataset.index = String(i);
            this.attachCellListeners(cell, i);
            this.cells.push(cell);
            this.gameEl.appendChild(cell);
        }
        if (this.createCollectorRow(board)) {
            this.gameEl.classList.add('board--has-collector');
        }
        this.refreshBoard(board);
        this.flushPendingUpdates();
    }

    setCollectorVisible(visible: boolean): void {
        if (!this.collectorRow) return;
        this.collectorRow.hidden = !visible;
    }

    private createCollectorRow(board: Board): boolean {
        const collectorColumns = new Set(board.getCollectorColumns());
        if (collectorColumns.size === 0) {
            return false;
        }
        const row = document.createElement('div');
        row.className = 'board__collector-row';
        for (let i = 0; i < GRID_SIZE; i++) {
            const slot = document.createElement('span');
            slot.className = 'board__collector-slot';
            if (collectorColumns.has(i)) {
                slot.classList.add('board__collector-slot--active');
                slot.textContent = '⬇️';
            }
            row.appendChild(slot);
        }
        this.gameEl.appendChild(row);
        this.collectorRow = row;
        return true;
    }

    refreshBoard(board: Board): void {
        this.clearHint();
        for (let i = 0; i < this.cells.length; i++) {
            this.queueCellUpdate(i, board.getCellState(i));
        }
    }

    updateCell(index: number, state: CellState): void {
        this.queueCellUpdate(index, state);
    }

    animateDrops(moves: DropMove[], spawnedIndices: number[]): void {
        if (!this.animationsEnabled) {
            return;
        }
        if (moves.length === 0 && spawnedIndices.length === 0) {
            return;
        }
        const rowStep = this.getRowStep();
        if (rowStep <= 0) {
            return;
        }
        const animatedIndices = new Set<number>();
        moves.forEach((move) => {
            const fromRow = this.getRowCol(move.from).row;
            const toRow = this.getRowCol(move.to).row;
            const deltaRows = toRow - fromRow;
            if (deltaRows <= 0) return;
            this.applyDropAnimation(move.to, deltaRows, rowStep);
            animatedIndices.add(move.to);
        });
        spawnedIndices.forEach((index) => {
            if (animatedIndices.has(index)) return;
            const row = this.getRowCol(index).row;
            const deltaRows = Math.max(1, row + 1);
            this.applyDropAnimation(index, deltaRows, rowStep);
        });
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

    showHint(indices: number[]): void {
        this.clearHint();
        indices.forEach((index) => {
            const cell = this.cells[index];
            if (!cell) return;
            cell.classList.add('board__cell--hint');
            this.hintIndices.add(index);
        });
    }

    clearHint(): void {
        this.hintIndices.forEach((index) => {
            const cell = this.cells[index];
            if (!cell) return;
            cell.classList.remove('board__cell--hint');
        });
        this.hintIndices.clear();
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

    emitHardCandyBreak(index: number): void {
        if (!this.animationsEnabled) return;
        const cell = this.getCellElement(index);
        this.particleEffect.emitFromCell(cell, '#fef3c7', {
            count: 22,
            minDistance: 18,
            maxDistance: 40,
            minDuration: 0.4,
            maxDuration: 0.8,
            delayVariance: 0.12,
            modifierClass: 'board__particle--hard-shell'
        });
    }

    animateBombActivation(index: number, _boosterType: BoosterType): void {
        if (!this.animationsEnabled) return;
        const cell = this.getCellElement(index);
        cell.classList.add('board__cell--bomb-activate');
        cell.addEventListener(
            'animationend',
            () => cell.classList.remove('board__cell--bomb-activate'),
            { once: true }
        );
    }

    animateBombExplosion(index: number, boosterType: BoosterType): void {
        if (!this.animationsEnabled) return;
        const cell = this.getCellElement(index);
        const shockwaveType = this.getShockwaveType(boosterType);
        if (!shockwaveType) return;

        const explosionClass = `board__cell--bomb-explode-${shockwaveType}`;
        cell.classList.add(explosionClass);
        cell.addEventListener(
            'animationend',
            () => cell.classList.remove(explosionClass),
            { once: true }
        );

        this.particleEffect.emitShockwave(cell, shockwaveType);

        if (boosterType === BOOSTERS.BURST_MEDIUM || boosterType === BOOSTERS.BURST_LARGE) {
            this.particleEffect.emitFlash(shockwaveType);
        }
    }

    animateBombCombo(indices: number[], strength: number = 0.5): void {
        if (!this.animationsEnabled) return;
        if (indices.length === 0) return;

        indices.forEach((index) => {
            const cell = this.getCellElement(index);
            cell.classList.add('board__cell--bomb-explode-combo');
            cell.style.setProperty('--combo-strength', String(Math.min(Math.max(strength, 0.2), 1)));
            cell.addEventListener(
                'animationend',
                () => {
                    cell.classList.remove('board__cell--bomb-explode-combo');
                    cell.style.removeProperty('--combo-strength');
                },
                { once: true }
            );
        });

        const primaryIndex = indices[0];
        if (primaryIndex === undefined) return;
        const primaryCell = this.getCellElement(primaryIndex);

        this.particleEffect.emitComboShockwave(primaryCell, strength);
        this.particleEffect.emitComboSparks(primaryCell, strength);
        this.particleEffect.emitFlash('combo');
    }

    private getShockwaveType(boosterType: BoosterType): ShockwaveType | null {
        if (boosterType === BOOSTERS.LINE) return 'line';
        if (boosterType === BOOSTERS.BURST_SMALL) return 'small';
        if (boosterType === BOOSTERS.BURST_MEDIUM) return 'medium';
        if (boosterType === BOOSTERS.BURST_LARGE) return 'large';
        return null;
    }

    isCellExploding(index: number): boolean {
        return this.explodingIndices.has(index);
    }

    renderMultiplierStatus(comboMultiplier: number, delta: number, moveScore: number): void {
        const icon = delta > 0 ? '⬆️' : delta < 0 ? '⬇️' : '✨';
        const formattedMultiplier = 'x' + comboMultiplier.toFixed(2);
        this.hud.setMultiplier(comboMultiplier);
        if (delta === 0) {
            return;
        }
        const scorePart = moveScore > 0 ? t('renderer.points', { points: moveScore }) : '';
        const prefix = delta > 0 ? t('renderer.comboIncrease') : t('renderer.comboDecrease');
        this.hud.setStatus(prefix + ' ' + formattedMultiplier + scorePart, icon, prefix);
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

    showMiraSpeech(message: string, icon: string): void {
        this.hud.setStatus(message, icon, message);
    }

    showShuffleNotice(message: string): void {
        if (!message) return;
        this.shuffleNoticeTextEl.textContent = message;
        this.shuffleNoticeEl.removeAttribute('hidden');
        this.shuffleNoticeEl.classList.add('shuffle-notice--visible');
        if (this.shuffleNoticeTimer !== null) {
            clearTimeout(this.shuffleNoticeTimer);
        }
        this.shuffleNoticeTimer = window.setTimeout(() => this.hideShuffleNotice(), 1400);
    }

    hideShuffleNotice(): void {
        if (this.shuffleNoticeTimer !== null) {
            clearTimeout(this.shuffleNoticeTimer);
            this.shuffleNoticeTimer = null;
        }
        if (this.shuffleNoticeEl.hasAttribute('hidden')) return;
        this.shuffleNoticeEl.setAttribute('hidden', 'true');
        this.shuffleNoticeEl.classList.remove('shuffle-notice--visible');
    }

    playSpawnAnimation(): number {
        if (!this.animationsEnabled) {
            return 0;
        }
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
        this.modalSecondaryCallback = options.onSecondary ?? null;
        this.modalTitle.textContent = options.title;
        this.modalText.textContent = '';
        if (options.text) {
            const baseText = document.createTextNode(options.text);
            this.modalText.appendChild(baseText);
        }
        if (options.coinSummary) {
            if (options.text) {
                this.modalText.appendChild(document.createTextNode(' '));
            }
            const summary = document.createElement('span');
            summary.className = 'modal__coin-summary';
            summary.appendChild(document.createTextNode(options.coinSummary.collectedText));
            const icon = document.createElement('img');
            icon.className = 'modal__coin-icon';
            icon.src = '/assets/images/sugar_coin.webp';
            icon.alt = '';
            icon.setAttribute('aria-hidden', 'true');
            summary.appendChild(icon);
            if (options.coinSummary.bonusText) {
                summary.appendChild(document.createTextNode(' ' + options.coinSummary.bonusText));
            }
            this.modalText.appendChild(summary);
        }
        this.modalButton.textContent = options.buttonText;
        if (options.secondaryButtonText && options.onSecondary) {
            this.modalSecondaryButton.textContent = options.secondaryButtonText;
            this.modalSecondaryButton.removeAttribute('hidden');
        } else {
            this.modalSecondaryButton.setAttribute('hidden', 'true');
        }
        this.modalEl.classList.add('modal--visible');
        this.modalButton.focus();
    }

    setRecordingButtonVisible(visible: boolean): void {
        if (visible) {
            this.recordingButton.removeAttribute('hidden');
        } else {
            this.recordingButton.setAttribute('hidden', 'true');
        }
    }

    onRecordingRequested(handler: () => void): void {
        this.recordingButtonHandler = handler;
    }

    hideModal(triggerPrimary = true, triggerSecondary = false): void {
        if (!this.modalEl.classList.contains('modal--visible')) {
            this.modalCallback = null;
            this.modalSecondaryCallback = null;
            return;
        }
        this.modalEl.classList.remove('modal--visible');
        const primaryCallback = this.modalCallback;
        const secondaryCallback = this.modalSecondaryCallback;
        this.modalCallback = null;
        this.modalSecondaryCallback = null;
        if (triggerPrimary && primaryCallback) {
            primaryCallback();
        }
        if (triggerSecondary && secondaryCallback) {
            secondaryCallback();
        }
    }

    isModalVisible(): boolean {
        return this.modalEl.classList.contains('modal--visible');
    }

    private applyCellState(index: number, state: CellState): void {
        const renderedKey = this.getRenderedKey(state);
        if (this.renderedKeys[index] === renderedKey) {
            return;
        }
        this.renderedKeys[index] = renderedKey;
        const cell = this.getCellElement(index);
        cell.className = 'board__cell';
        cell.dataset.index = String(index);
        cell.dataset.booster = state.booster;
        cell.dataset.blocked = state.blocked ? 'true' : 'false';
        cell.dataset.hard = state.hard ? 'true' : 'false';
        cell.dataset.generator = state.generator ? 'true' : 'false';
        cell.dataset.shifting = state.shifting ? 'true' : 'false';
        cell.dataset.collectionItem = state.collectionItem ? 'true' : 'false';
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
        cell.style.removeProperty('--shifting-next-color');
        cell.classList.remove('board__cell--sugar-chest');
        cell.classList.remove('board__cell--delivery');
        cell.classList.remove('board__cell--hard-2', 'board__cell--hard-3');
        cell.classList.remove(
            'board__cell--hardening',
            'board__cell--hardening-2',
            'board__cell--hardening-3'
        );
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
                `url(/assets/images/sugar-chest-${stageIndex}.webp)`
            );
            return;
        }
        if (state.collectionItem) {
            cell.classList.add('board__cell--delivery');
            cell.textContent = '📦';
            return;
        }
        if (state.color) {
            cell.style.setProperty('--cell-color', state.color);
        }
        if (state.shiftingNextColor) {
            cell.style.setProperty('--shifting-next-color', state.shiftingNextColor);
        }
        if (!state.generator && this.cellShapesEnabled) {
            this.applyShapeForColor(cell, colorKey);
        }
        if (state.generator) {
            cell.classList.add('board__cell--generator');
            cell.textContent = '⛓️';
            return;
        }
        if (state.shifting) {
            cell.classList.add('board__cell--shifting');
        }
        if (!state.hard && typeof state.hardeningStage === 'number') {
            cell.classList.add('board__cell--hardening');
            if (state.hardeningStage >= 2) {
                cell.classList.add('board__cell--hardening-2');
            }
            if (state.hardeningStage >= 3) {
                cell.classList.add('board__cell--hardening-3');
            }
        }
        if (state.hard) {
            cell.classList.add('board__cell--hard');
            if (state.hardStage === 2) {
                cell.classList.add('board__cell--hard-2');
            }
            if (state.hardStage === 3) {
                cell.classList.add('board__cell--hard-3');
            }
        }
        this.applyBoosterVisual(cell, state.booster, state.lineOrientation);
    }

    private queueCellUpdate(index: number, state: CellState): void {
        this.pendingCellUpdates.set(index, state);
        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.pendingFlushHandle !== null) return;
        this.pendingFlushHandle = window.requestAnimationFrame(() => {
            this.pendingFlushHandle = null;
            this.flushPendingUpdates();
        });
    }

    private flushPendingUpdates(): void {
        if (this.pendingFlushHandle !== null) {
            window.cancelAnimationFrame(this.pendingFlushHandle);
            this.pendingFlushHandle = null;
        }
        if (this.pendingCellUpdates.size === 0) {
            return;
        }
        this.pendingCellUpdates.forEach((state, index) => {
            this.applyCellState(index, state);
        });
        this.pendingCellUpdates.clear();
        if (this.selectedIndex !== null) {
            this.getCellElement(this.selectedIndex).classList.add('board__cell--selected');
        }
    }

    private getRenderedKey(state: CellState): string {
        const stage = typeof state.sugarChestStage === 'number' ? state.sugarChestStage : '';
        const hardStage = typeof state.hardStage === 'number' ? state.hardStage : '';
        const hardeningStage = typeof state.hardeningStage === 'number' ? state.hardeningStage : '';
        const orientation = state.lineOrientation ?? '';
        const color = state.color ?? '';
        return [
            this.renderContextVersion,
            color,
            state.booster,
            state.blocked ? '1' : '0',
            state.hard ? '1' : '0',
            state.generator ? '1' : '0',
            state.shifting ? '1' : '0',
            state.collectionItem ? '1' : '0',
            state.shiftingNextColor ?? '',
            stage,
            hardStage,
            hardeningStage,
            orientation
        ].join('|');
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

    showSugarCoinReward(index: number, amount: number): void {
        if (amount <= 0) return;
        const cell = this.getCellElement(index);
        const notification = document.createElement('div');
        notification.className = 'board__sugar-notification';

        const icon = document.createElement('img');
        icon.className = 'board__sugar-notification-icon';
        icon.src = '/assets/images/sugar_coin.webp';
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');

        const value = document.createElement('span');
        value.className = 'board__sugar-notification-value';
        value.textContent = `+${amount}`;

        notification.append(icon, value);

        const centerX = cell.offsetLeft + cell.clientWidth / 2;
        const centerY = cell.offsetTop + cell.clientHeight / 2;
        notification.style.left = `${centerX}px`;
        notification.style.top = `${centerY}px`;

        const removeNotification = (): void => {
            notification.removeEventListener('animationend', removeNotification);
            if (notification.parentElement) {
                notification.remove();
            }
        };
        notification.addEventListener('animationend', removeNotification);
        this.gameEl.appendChild(notification);
        window.setTimeout(removeNotification, 1200);
    }

    private getRowStep(): number {
        const firstCell = this.cells[0];
        const nextRowCell = this.cells[GRID_SIZE];
        if (!firstCell) return 0;
        if (nextRowCell) {
            const delta = nextRowCell.getBoundingClientRect().top - firstCell.getBoundingClientRect().top;
            if (delta > 0) {
                return delta;
            }
        }
        return firstCell.getBoundingClientRect().height;
    }

    private applyDropAnimation(index: number, deltaRows: number, rowStep: number): void {
        if (deltaRows <= 0 || rowStep <= 0) return;
        const cell = this.getCellElement(index);
        const distance = deltaRows * rowStep;
        const duration = Math.min(520, 160 + deltaRows * 55);
        cell.classList.remove('board__cell--drop');
        cell.style.setProperty('--drop-distance', `${distance}px`);
        cell.style.animationDuration = `${duration}ms`;
        void cell.offsetWidth;
        requestAnimationFrame(() => {
            cell.classList.add('board__cell--drop');
        });
        cell.addEventListener(
            'animationend',
            () => {
                cell.classList.remove('board__cell--drop');
                cell.style.removeProperty('--drop-distance');
                cell.style.removeProperty('animation-duration');
            },
            { once: true }
        );
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

import { Hud } from './hud.js';
import { getRequiredElement } from './dom.js';
import { Board, CellState, type DropMove } from './board.js';
import { SwipeDirection } from './types.js';
import type { GameMode, LineOrientation } from './types.js';
import {
    GRID_SIZE,
    BOOSTERS,
    BoosterType,
    BLACK_BOMB_COLOR,
    getColorKeyFromHex,
    COLOR_SHAPE_CLASS
} from './constants.js';
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

type BoardMetrics = {
    width: number;
    height: number;
    paddingLeft: number;
    paddingTop: number;
    cellSize: number;
    gap: number;
    rowStep: number;
};

type CanvasCellRect = {
    x: number;
    y: number;
    size: number;
};

type CellAnimation =
    | { kind: 'drop'; index: number; fromRowOffset: number; startedAt: number; duration: number }
    | { kind: 'spawn'; index: number; startedAt: number; duration: number; delay: number }
    | { kind: 'invalid'; index: number; startedAt: number; duration: number }
    | { kind: 'explode'; index: number; startedAt: number; duration: number }
    | { kind: 'generatorHit'; index: number; startedAt: number; duration: number }
    | { kind: 'bombActivation'; index: number; startedAt: number; duration: number }
    | { kind: 'bombExplosion'; index: number; startedAt: number; duration: number }
    | { kind: 'bombCombo'; index: number; startedAt: number; duration: number; strength: number };

class Renderer {
    private readonly hud: Hud;
    private readonly gameEl: HTMLElement;
    private readonly modalEl: HTMLElement;
    private readonly modalTitle: HTMLElement;
    private readonly modalText: HTMLElement;
    private readonly modalButton: HTMLButtonElement;
    private readonly modalSecondaryButton: HTMLButtonElement;
    private readonly modalActions: HTMLElement;
    private readonly moveEvaluationEl: HTMLElement;
    private moveEvaluationTimer: number | null = null;
    private readonly shuffleNoticeEl: HTMLElement;
    private readonly shuffleNoticeTextEl: HTMLElement;
    private shuffleNoticeTimer: number | null = null;
    private celebrationEl: HTMLDivElement | null = null;
    private celebrationTimer: number | null = null;
    private modalCallback: (() => void) | null = null;
    private modalSecondaryCallback: (() => void) | null = null;
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private resizeObserver: ResizeObserver | null = null;
    private readonly cellStates: CellState[] = [];
    private readonly renderedKeys: string[] = [];
    private readonly pendingCellUpdates = new Map<number, CellState>();
    private pendingFlushHandle: number | null = null;
    private animationFrameHandle: number | null = null;
    private redrawRequested = false;
    private metrics: BoardMetrics = {
        width: 0,
        height: 0,
        paddingLeft: 0,
        paddingTop: 0,
        cellSize: 0,
        gap: 0,
        rowStep: 0
    };
    private readonly activeAnimations: CellAnimation[] = [];
    private readonly sugarChestImages = new Map<number, HTMLImageElement>();
    private collectionImage: HTMLImageElement | null = null;
    private collectorRow: HTMLDivElement | null = null;
    private renderContextVersion = 0;
    private selectedIndex: number | null = null;
    private hoveredIndex: number | null = null;
    private readonly hintIndices = new Set<number>();
    private readonly explodingIndices = new Set<number>();
    private onCellClick: ((index: number) => void) | null = null;
    private onCellSwipe: ((index: number, direction: SwipeDirection) => void) | null = null;
    private pointerStartIndex: number | null = null;
    private pointerStartX: number | null = null;
    private pointerStartY: number | null = null;
    private pointerHandledSwipe = false;
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
        const canvas = getRequiredElement('game-canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Game canvas element is missing.');
        }
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas 2D context is unavailable.');
        }
        this.canvas = canvas;
        this.context = context;
        this.modalEl = getRequiredElement('result-modal');
        this.modalTitle = getRequiredElement('result-title');
        this.modalText = getRequiredElement('result-text');
        this.modalButton = getRequiredElement('result-button') as HTMLButtonElement;
        this.modalSecondaryButton = getRequiredElement('result-home-button') as HTMLButtonElement;
        this.modalActions = this.getModalActions();
        this.moveEvaluationEl = getRequiredElement('move-evaluation');
        this.shuffleNoticeEl = getRequiredElement('shuffle-notice');
        this.shuffleNoticeTextEl = getRequiredElement('shuffle-notice-text');
        this.particleEffect = new ParticleEffect(this.gameEl);
        this.preloadBoardImages();
        this.attachCanvasListeners();
        this.setupResizeObserver();
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
        this.requestRedraw();
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
        this.requestRedraw();
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
        this.resetPointerState();
        this.selectedIndex = null;
        this.cellStates.length = 0;
        this.renderedKeys.length = 0;
        this.pendingCellUpdates.clear();
        this.activeAnimations.length = 0;
        this.clearBoardDomChildren();
        this.particleEffect.reset();
        this.collectorRow = null;
        this.gameEl.classList.remove('board--has-collector');
        if (this.createCollectorRow(board)) {
            this.gameEl.classList.add('board--has-collector');
        }
        this.updateCanvasMetrics();
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
                const base = document.createElement('img');
                base.className = 'board__collector-base';
                base.src = '/assets/images/candy-collector-4.svg';
                base.alt = '';
                slot.appendChild(base);

                const arrow = document.createElement('span');
                arrow.className = 'board__collector-arrow';
                const arrowIcon = document.createElement('img');
                arrowIcon.className = 'board__collector-arrow-icon';
                arrowIcon.src = '/assets/images/arrow_drop_down.svg';
                arrowIcon.alt = '';
                arrow.appendChild(arrowIcon);
                slot.appendChild(arrow);
            }
            row.appendChild(slot);
        }
        this.gameEl.appendChild(row);
        this.collectorRow = row;
        return true;
    }

    refreshBoard(board: Board): void {
        this.clearHint();
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
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
        const rowStep = this.metrics.rowStep || this.getRowStep();
        if (rowStep <= 0) {
            return;
        }
        const now = performance.now();
        const animatedIndices = new Set<number>();
        moves.forEach((move) => {
            const fromRow = this.getRowCol(move.from).row;
            const toRow = this.getRowCol(move.to).row;
            const deltaRows = toRow - fromRow;
            if (deltaRows <= 0) return;
            this.applyDropAnimation(move.to, deltaRows, now);
            animatedIndices.add(move.to);
        });
        spawnedIndices.forEach((index) => {
            if (animatedIndices.has(index)) return;
            const row = this.getRowCol(index).row;
            const deltaRows = Math.max(1, row + 1);
            this.applyDropAnimation(index, deltaRows, now);
        });
    }

    showInvalidMove(index: number): void {
        this.replaceAnimation(index, 'invalid', {
            kind: 'invalid',
            index,
            startedAt: performance.now(),
            duration: 360
        });
        this.requestRedraw();
    }

    clearInvalidMove(index: number): void {
        this.removeAnimations(index, 'invalid');
        this.requestRedraw();
    }

    selectCell(index: number): void {
        if (this.selectedIndex === index) return;
        this.clearSelection();
        this.selectedIndex = index;
        this.requestRedraw();
    }

    clearSelection(): void {
        if (this.selectedIndex === null) return;
        this.selectedIndex = null;
        this.requestRedraw();
    }

    showHint(indices: number[]): void {
        this.clearHint();
        indices.forEach((index) => {
            if (index < 0 || index >= GRID_SIZE * GRID_SIZE) return;
            this.hintIndices.add(index);
        });
        this.requestRedraw();
    }

    clearHint(): void {
        this.hintIndices.clear();
        this.requestRedraw();
    }

    markCellExploding(index: number): void {
        if (this.explodingIndices.has(index)) return;
        this.explodingIndices.add(index);
        this.replaceAnimation(index, 'explode', {
            kind: 'explode',
            index,
            startedAt: performance.now(),
            duration: 520
        });
        this.requestRedraw();
    }

    clearCellExplosion(index: number): void {
        if (!this.explodingIndices.delete(index)) return;
        this.removeAnimations(index, 'explode');
        this.requestRedraw();
    }

    emitCellParticles(index: number, color: string | null = null, options: ParticleOptions = {}): void {
        const state = this.cellStates[index];
        const center = this.getCellCenter(index);
        if (!center) return;
        const resolvedColor = color || state?.color || options.accentColor || null;
        this.particleEffect.emitAtPoint(center.x, center.y, resolvedColor, options);
    }

    emitHardCandyBreak(index: number): void {
        if (!this.animationsEnabled) return;
        const center = this.getCellCenter(index);
        if (!center) return;
        this.particleEffect.emitAtPoint(center.x, center.y, '#fef3c7', {
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
        this.replaceAnimation(index, 'bombActivation', {
            kind: 'bombActivation',
            index,
            startedAt: performance.now(),
            duration: 480
        });
        this.requestRedraw();
    }

    animateBombExplosion(index: number, boosterType: BoosterType): void {
        if (!this.animationsEnabled) return;
        const shockwaveType = this.getShockwaveType(boosterType);
        if (!shockwaveType) return;

        this.replaceAnimation(index, 'bombExplosion', {
            kind: 'bombExplosion',
            index,
            startedAt: performance.now(),
            duration: 520
        });
        const center = this.getCellCenter(index);
        if (center) {
            this.particleEffect.emitShockwaveAtPoint(center.x, center.y, shockwaveType);
        }

        if (boosterType === BOOSTERS.BURST_MEDIUM || boosterType === BOOSTERS.BURST_LARGE) {
            this.particleEffect.emitFlash(shockwaveType);
        }
        this.requestRedraw();
    }

    animateBombCombo(indices: number[], strength: number = 0.5): void {
        if (!this.animationsEnabled) return;
        if (indices.length === 0) return;

        const now = performance.now();
        indices.forEach((index) => {
            this.replaceAnimation(index, 'bombCombo', {
                kind: 'bombCombo',
                index,
                startedAt: now,
                duration: 600,
                strength: Math.min(Math.max(strength, 0.2), 1)
            });
        });

        const primaryIndex = indices[0];
        if (primaryIndex === undefined) return;
        const center = this.getCellCenter(primaryIndex);
        if (center) {
            this.particleEffect.emitComboShockwaveAtPoint(center.x, center.y, strength);
            this.particleEffect.emitComboSparksAtPoint(center.x, center.y, strength);
        }
        this.particleEffect.emitFlash('combo');
        this.requestRedraw();
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
        const now = performance.now();
        this.cellStates.forEach((state, index) => {
            if (state.blocked) return;
            const { row, col } = this.getRowCol(index);
            const delay = row * 70 + col * 12;
            longestDelay = Math.max(longestDelay, delay);
            this.replaceAnimation(index, 'spawn', {
                kind: 'spawn',
                index,
                startedAt: now,
                duration: baseDuration,
                delay
            });
        });
        this.requestRedraw();
        return baseDuration + longestDelay;
    }

    animateGeneratorHit(index: number): void {
        if (!this.animationsEnabled) return;
        this.replaceAnimation(index, 'generatorHit', {
            kind: 'generatorHit',
            index,
            startedAt: performance.now(),
            duration: 450
        });
        this.requestRedraw();
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
        this.updateModalActionsLayout();
        this.modalEl.classList.add('modal--visible');
        this.modalButton.focus();
    }

    setRecordingButtonVisible(visible: boolean): void {
        if (visible) {
            this.recordingButton.removeAttribute('hidden');
        } else {
            this.recordingButton.setAttribute('hidden', 'true');
        }
        this.updateModalActionsLayout();
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

    private getModalActions(): HTMLElement {
        const actions = this.modalEl.querySelector('.modal__actions');
        if (!actions) {
            throw new Error('Missing modal actions container.');
        }
        return actions as HTMLElement;
    }

    private updateModalActionsLayout(): void {
        const hasSecondary = !this.modalSecondaryButton.hasAttribute('hidden');
        const hasRecording = !this.recordingButton.hasAttribute('hidden');
        const shouldPair = !hasSecondary && hasRecording;
        this.modalActions.classList.toggle('modal__actions--pair', shouldPair);
    }

    private applyCellState(index: number, state: CellState): void {
        const renderedKey = this.getRenderedKey(state);
        if (this.renderedKeys[index] === renderedKey) {
            return;
        }
        this.renderedKeys[index] = renderedKey;
        this.cellStates[index] = { ...state };
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
        this.requestRedraw();
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

    private attachCanvasListeners(): void {
        this.canvas.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        this.canvas.addEventListener('pointerup', (event) => this.handlePointerUp(event));
        this.canvas.addEventListener('pointercancel', () => this.resetPointerState());
        this.canvas.addEventListener('pointerleave', () => this.handlePointerLeave());
    }

    private handlePointerDown(event: PointerEvent): void {
        const index = this.getIndexAtPoint(event.clientX, event.clientY);
        if (index === null) return;
        this.setHoveredIndex(index);
        this.pointerStartIndex = index;
        this.pointerStartX = event.clientX;
        this.pointerStartY = event.clientY;
        this.pointerHandledSwipe = false;
        this.canvas.setPointerCapture(event.pointerId);
    }

    private handlePointerMove(event: PointerEvent): void {
        this.setHoveredIndex(this.getIndexAtPoint(event.clientX, event.clientY));
        if (this.pointerStartIndex === null) return;
        if (this.pointerStartX === null || this.pointerStartY === null) return;
        if (this.pointerHandledSwipe) return;
        const deltaX = event.clientX - this.pointerStartX;
        const deltaY = event.clientY - this.pointerStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (Math.max(absX, absY) < this.swipeThreshold) {
            return;
        }
        event.preventDefault();
        const direction: SwipeDirection =
            absX > absY ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up';
        this.onCellSwipe?.(this.pointerStartIndex, direction);
        this.pointerHandledSwipe = true;
    }

    private handlePointerUp(event: PointerEvent): void {
        this.setHoveredIndex(this.getIndexAtPoint(event.clientX, event.clientY));
        if (this.pointerStartIndex !== null && !this.pointerHandledSwipe) {
            const endIndex = this.getIndexAtPoint(event.clientX, event.clientY);
            if (endIndex === this.pointerStartIndex) {
                this.onCellClick?.(this.pointerStartIndex);
            }
        }
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
        this.resetPointerState();
    }

    private handlePointerLeave(): void {
        this.setHoveredIndex(null);
        this.resetPointerState();
    }

    private setHoveredIndex(index: number | null): void {
        if (this.hoveredIndex === index) return;
        this.hoveredIndex = index;
        this.canvas.style.cursor = index === null ? '' : 'pointer';
        this.requestRedraw();
    }

    private resetPointerState(): void {
        this.pointerStartIndex = null;
        this.pointerStartX = null;
        this.pointerStartY = null;
        this.pointerHandledSwipe = false;
    }

    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateCanvasMetrics();
            this.requestRedraw();
        });
        this.resizeObserver.observe(this.gameEl);
    }

    private preloadBoardImages(): void {
        [1, 2, 3].forEach((stage) => {
            const image = new Image();
            image.src = `/assets/images/sugar-chest-${String(stage).padStart(2, '0')}.webp`;
            image.addEventListener('load', () => this.requestRedraw(), { once: true });
            this.sugarChestImages.set(stage, image);
        });
        const collectionImage = new Image();
        collectionImage.src = '/assets/images/collectable-rainbow_star.png';
        collectionImage.addEventListener('load', () => this.requestRedraw(), { once: true });
        this.collectionImage = collectionImage;
    }

    private clearBoardDomChildren(): void {
        Array.from(this.gameEl.children).forEach((child) => {
            if (child === this.canvas) return;
            child.remove();
        });
        if (this.canvas.parentElement !== this.gameEl) {
            this.gameEl.prepend(this.canvas);
        }
    }

    private updateCanvasMetrics(): void {
        const style = window.getComputedStyle(this.gameEl);
        const paddingLeft = this.readPixelValue(style.paddingLeft);
        const paddingRight = this.readPixelValue(style.paddingRight);
        const paddingTop = this.readPixelValue(style.paddingTop);
        const paddingBottom = this.readPixelValue(style.paddingBottom);
        const gap = this.readPixelValue(style.gap || style.columnGap);
        const width = this.gameEl.clientWidth;
        const height = this.gameEl.clientHeight;
        const availableWidth = Math.max(width - paddingLeft - paddingRight - gap * (GRID_SIZE - 1), 0);
        const availableHeight = Math.max(height - paddingTop - paddingBottom - gap * (GRID_SIZE - 1), 0);
        const cellSize = Math.max(Math.min(availableWidth, availableHeight) / GRID_SIZE, 0);
        const pixelRatio = window.devicePixelRatio || 1;

        this.metrics = {
            width,
            height,
            paddingLeft,
            paddingTop,
            cellSize,
            gap,
            rowStep: cellSize + gap
        };
        this.canvas.width = Math.max(Math.round(width * pixelRatio), 1);
        this.canvas.height = Math.max(Math.round(height * pixelRatio), 1);
        this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    private readPixelValue(value: string): number {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private requestRedraw(): void {
        this.redrawRequested = true;
        if (this.animationFrameHandle !== null) return;
        this.animationFrameHandle = window.requestAnimationFrame((time) => this.drawFrame(time));
    }

    private drawFrame(time: number): void {
        this.animationFrameHandle = null;
        this.redrawRequested = false;
        this.drawBoard(time);
        this.removeFinishedAnimations(time);
        if (this.activeAnimations.length > 0 || this.hintIndices.size > 0 || this.redrawRequested) {
            this.requestRedraw();
        }
    }

    private removeFinishedAnimations(time: number): void {
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const animation = this.activeAnimations[i];
            if (!animation) continue;
            const delay = animation.kind === 'spawn' ? animation.delay : 0;
            if (time - animation.startedAt < animation.duration + delay) continue;
            this.activeAnimations.splice(i, 1);
        }
    }

    private drawBoard(time: number): void {
        if (this.metrics.width <= 0 || this.metrics.height <= 0 || this.metrics.cellSize <= 0) {
            this.updateCanvasMetrics();
        }
        const context = this.context;
        context.clearRect(0, 0, this.metrics.width, this.metrics.height);
        for (let index = 0; index < GRID_SIZE * GRID_SIZE; index++) {
            const state = this.cellStates[index];
            if (!state) continue;
            this.drawCell(index, state, time);
        }
    }

    private drawCell(index: number, state: CellState, time: number): void {
        const rect = this.getCellRect(index);
        const transform = this.getAnimationTransform(index, time);
        const context = this.context;
        context.save();
        context.globalAlpha *= transform.opacity;
        context.translate(rect.x + rect.size / 2 + transform.translateX, rect.y + rect.size / 2 + transform.translateY);
        context.scale(transform.scale, transform.scale);
        context.translate(-rect.size / 2, -rect.size / 2);

        const localRect = { x: 0, y: 0, size: rect.size };
        if (state.blocked) {
            this.drawVoidCell(localRect);
        } else if (typeof state.sugarChestStage === 'number') {
            this.drawSugarChest(localRect, state.sugarChestStage);
        } else if (state.collectionItem) {
            this.drawCollectionItem(localRect);
        } else if (state.generator) {
            this.drawGenerator(localRect, state);
        } else {
            this.drawCandy(localRect, state);
        }
        this.drawStateOverlays(localRect, state);
        this.drawBooster(localRect, state.booster, state.lineOrientation);
        if (this.hoveredIndex === index) {
            this.drawHover(localRect);
        }
        if (this.selectedIndex === index) {
            this.drawSelection(localRect);
        }
        if (this.hintIndices.has(index)) {
            this.drawHint(localRect, time);
        }
        if (this.explodingIndices.has(index) || this.hasAnimation(index, 'explode')) {
            this.drawExplosion(localRect, this.getAnimationProgress(index, 'explode', time));
        }
        context.restore();
    }

    private getAnimationTransform(index: number, time: number): { translateX: number; translateY: number; scale: number; opacity: number } {
        let translateX = 0;
        let translateY = 0;
        let scale = 1;
        let opacity = 1;
        this.activeAnimations.forEach((animation) => {
            if (animation.index !== index) return;
            if (animation.kind === 'drop') {
                const progress = this.easeOutCubic(this.getProgress(animation, time));
                translateY += -animation.fromRowOffset * this.metrics.rowStep * (1 - progress);
            } else if (animation.kind === 'spawn') {
                const progress = this.easeOutBack(this.getProgress(animation, time));
                scale *= Math.max(progress, 0);
                opacity *= Math.min(Math.max(progress, 0), 1);
            } else if (animation.kind === 'invalid') {
                const progress = this.getProgress(animation, time);
                translateX += Math.sin(progress * Math.PI * 6) * (1 - progress) * 7;
            } else if (animation.kind === 'generatorHit') {
                const progress = this.getProgress(animation, time);
                scale *= 1 + Math.sin(progress * Math.PI) * 0.12;
            } else if (animation.kind === 'bombActivation') {
                const progress = this.getProgress(animation, time);
                scale *= 1 + Math.sin(progress * Math.PI * 4) * 0.08;
            } else if (animation.kind === 'bombExplosion') {
                const progress = this.getProgress(animation, time);
                scale *= 1 + Math.sin(progress * Math.PI) * 0.18;
            } else if (animation.kind === 'bombCombo') {
                const progress = this.getProgress(animation, time);
                scale *= 1 + Math.sin(progress * Math.PI) * 0.16 * animation.strength;
            }
        });
        if (this.hoveredIndex === index && this.pointerStartIndex === null) {
            translateY -= Math.max(1, this.metrics.cellSize * 0.03);
            scale *= 1.02;
        }
        return { translateX, translateY, scale, opacity };
    }

    private drawCandy(rect: CanvasCellRect, state: CellState): void {
        const color = state.color || '#6b7280';
        const colorKey = getColorKeyFromHex(color);
        const shape = this.cellShapesEnabled && colorKey ? COLOR_SHAPE_CLASS[colorKey] : 'square';
        this.drawBaseCandy(rect, color, shape);
        if (state.shifting && state.shiftingNextColor) {
            this.drawShiftingOverlay(rect, state.shiftingNextColor);
        }
    }

    private drawBaseCandy(rect: CanvasCellRect, color: string, shape: string): void {
        const context = this.context;
        const inset = rect.size * 0.06;
        const size = rect.size - inset * 2;
        context.save();
        this.createCandyPath(inset, inset, size, shape);
        context.shadowColor = 'rgba(0, 0, 0, 0.35)';
        context.shadowBlur = rect.size * 0.16;
        context.shadowOffsetY = rect.size * 0.08;
        context.fillStyle = color;
        context.fill();
        context.restore();

        context.save();
        this.createCandyPath(inset, inset, size, shape);
        context.fillStyle = color;
        context.fill();
        context.clip();
        const gradient = context.createLinearGradient(0, 0, rect.size, rect.size);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, rect.size, rect.size);
        const shine = context.createRadialGradient(
            rect.size * 0.3,
            rect.size * 0.24,
            rect.size * 0.02,
            rect.size * 0.3,
            rect.size * 0.24,
            rect.size * 0.5
        );
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        shine.addColorStop(0.48, 'rgba(255, 255, 255, 0.12)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = shine;
        context.fillRect(0, 0, rect.size, rect.size);
        context.restore();

        context.save();
        this.createCandyPath(inset, inset, size, shape);
        context.lineWidth = Math.max(1, rect.size * 0.04);
        context.strokeStyle = 'rgba(17, 17, 17, 0.65)';
        context.stroke();
        context.lineWidth = Math.max(1, rect.size * 0.018);
        context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        context.stroke();
        context.restore();
    }

    private createCandyPath(x: number, y: number, size: number, shape: string): void {
        const context = this.context;
        const center = x + size / 2;
        context.beginPath();
        if (shape === 'round') {
            context.arc(center, y + size / 2, size / 2, 0, Math.PI * 2);
            return;
        }
        if (shape === 'triangle') {
            context.moveTo(center, y);
            context.lineTo(x + size, y + size);
            context.lineTo(x, y + size);
            context.closePath();
            return;
        }
        if (shape === 'diamond') {
            context.moveTo(center, y);
            context.lineTo(x + size, y + size / 2);
            context.lineTo(center, y + size);
            context.lineTo(x, y + size / 2);
            context.closePath();
            return;
        }
        if (shape === 'hexagon' || shape === 'pentagon') {
            const sides = shape === 'hexagon' ? 6 : 5;
            const radius = size / 2;
            for (let i = 0; i < sides; i++) {
                const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
                const px = center + Math.cos(angle) * radius;
                const py = y + size / 2 + Math.sin(angle) * radius;
                if (i === 0) {
                    context.moveTo(px, py);
                } else {
                    context.lineTo(px, py);
                }
            }
            context.closePath();
            return;
        }
        context.roundRect(x, y, size, size, Math.max(6, size * 0.2));
    }

    private drawVoidCell(rect: CanvasCellRect): void {
        const context = this.context;
        context.save();
        context.globalAlpha = 0.28;
        context.fillStyle = 'rgba(15, 23, 42, 0.55)';
        context.beginPath();
        context.roundRect(rect.size * 0.1, rect.size * 0.1, rect.size * 0.8, rect.size * 0.8, rect.size * 0.18);
        context.fill();
        context.restore();
    }

    private drawSugarChest(rect: CanvasCellRect, stage: number): void {
        this.drawCellShadow(rect, 'rgba(0, 0, 0, 0.32)');
        const image = this.sugarChestImages.get(stage);
        if (image?.complete && image.naturalWidth > 0) {
            this.context.drawImage(image, rect.size * 0.06, rect.size * 0.06, rect.size * 0.88, rect.size * 0.88);
            return;
        }
        this.drawBaseCandy(rect, '#fbbf24', 'square');
    }

    private drawCollectionItem(rect: CanvasCellRect): void {
        this.drawBaseCandy(rect, '#111827', 'round');
        const image = this.collectionImage;
        if (image?.complete && image.naturalWidth > 0) {
            this.context.drawImage(image, rect.size * 0.14, rect.size * 0.14, rect.size * 0.72, rect.size * 0.72);
        }
    }

    private drawGenerator(rect: CanvasCellRect, state: CellState): void {
        this.drawBaseCandy(rect, state.color || '#64748b', 'square');
        this.drawDiagonalStripes(rect, 'rgba(255, 255, 255, 0.55)', 'rgba(251, 191, 36, 0.14)', 0.55);
        this.drawRoundedStroke(rect, rect.size * 0.08, rect.size * 0.82, 'rgba(248, 250, 252, 0.82)', rect.size * 0.045);
        this.drawOutlinedText('⛓️', rect, rect.size * 0.42, '#e2e8f0', '#0b0f1d');
    }

    private drawStateOverlays(rect: CanvasCellRect, state: CellState): void {
        if (!state.hard && typeof state.hardeningStage === 'number') {
            this.drawHardeningOverlay(rect, state.hardeningStage);
        }
        if (state.hard) {
            this.drawHardCandyOverlay(rect, state.hardStage ?? 1);
        }
    }

    private drawHardCandyOverlay(rect: CanvasCellRect, stage: number): void {
        const context = this.context;
        if (stage >= 3) {
            context.save();
            context.globalAlpha = 0.78;
            const gradient = context.createRadialGradient(
                rect.size * 0.34,
                rect.size * 0.3,
                rect.size * 0.04,
                rect.size * 0.48,
                rect.size * 0.52,
                rect.size * 0.62
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
            gradient.addColorStop(1, 'rgba(226, 232, 240, 0.2)');
            context.fillStyle = gradient;
            context.beginPath();
            context.roundRect(rect.size * 0.08, rect.size * 0.08, rect.size * 0.84, rect.size * 0.84, rect.size * 0.2);
            context.fill();
            context.restore();
        } else {
            this.drawDiagonalStripes(
                rect,
                'rgba(255, 255, 255, 0.48)',
                stage === 2 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.12)',
                stage === 2 ? 0.75 : 0.55
            );
            if (stage >= 2) {
                this.drawDiagonalStripes(rect, 'rgba(255, 255, 255, 0.36)', 'rgba(251, 191, 36, 0.18)', 0.55, -1);
            }
        }
        context.save();
        context.lineWidth = Math.max(2, rect.size * 0.07);
        context.strokeStyle = stage >= 3 ? 'rgba(255, 255, 255, 0.92)' : stage === 2 ? 'rgba(226, 232, 240, 0.82)' : 'rgba(241, 245, 249, 0.62)';
        context.beginPath();
        context.roundRect(rect.size * 0.13, rect.size * 0.13, rect.size * 0.74, rect.size * 0.74, rect.size * 0.18);
        context.stroke();
        context.restore();
    }

    private drawHardeningOverlay(rect: CanvasCellRect, stage: number): void {
        const context = this.context;
        const edgeSize = Math.max(3, rect.size * 0.09);
        const capSize = edgeSize * 0.52;
        const clampedStage = Math.min(Math.max(stage, 1), 3);
        context.save();
        context.globalAlpha = 0.9;
        context.fillStyle = '#f8fafc';
        context.fillRect(rect.size * 0.12, rect.size * 0.1, rect.size * 0.76, edgeSize);
        this.drawHardeningCap(rect.size * 0.12, rect.size * 0.1 + edgeSize / 2, capSize);
        this.drawHardeningCap(rect.size * 0.88, rect.size * 0.1 + edgeSize / 2, capSize);
        if (clampedStage >= 2) {
            context.fillRect(rect.size * 0.88 - edgeSize, rect.size * 0.12, edgeSize, rect.size * 0.76);
            this.drawHardeningCap(rect.size * 0.88 - edgeSize / 2, rect.size * 0.88, capSize);
        }
        if (clampedStage >= 3) {
            context.fillRect(rect.size * 0.12, rect.size * 0.88 - edgeSize, rect.size * 0.76, edgeSize);
            context.fillRect(rect.size * 0.1, rect.size * 0.12, edgeSize, rect.size * 0.76);
            this.drawHardeningCap(rect.size * 0.12 + edgeSize / 2, rect.size * 0.88, capSize);
            this.drawHardeningCap(rect.size * 0.12 + edgeSize / 2, rect.size * 0.12, capSize);
        }
        context.restore();
    }

    private drawBooster(rect: CanvasCellRect, booster: BoosterType, orientation?: LineOrientation): void {
        if (booster === BOOSTERS.NONE) return;
        const context = this.context;
        if (booster === BOOSTERS.LINE) {
            this.drawGlow(rect, 'rgba(255, 235, 59, 0.38)', 0.18);
            context.save();
            context.strokeStyle = 'rgba(255, 255, 255, 0.92)';
            context.lineWidth = Math.max(4, rect.size * 0.09);
            context.lineCap = 'round';
            if (this.gameMode === 'blocker' || orientation !== 'vertical') {
                context.beginPath();
                context.moveTo(rect.size * 0.18, rect.size * 0.5);
                context.lineTo(rect.size * 0.82, rect.size * 0.5);
                context.stroke();
            }
            if (this.gameMode === 'blocker' || orientation === 'vertical') {
                context.beginPath();
                context.moveTo(rect.size * 0.5, rect.size * 0.18);
                context.lineTo(rect.size * 0.5, rect.size * 0.82);
                context.stroke();
            }
            context.restore();
            const label = this.gameMode === 'blocker' ? '✣' : orientation === 'vertical' ? '↕' : '↔';
            this.drawOutlinedText(label, rect, rect.size * 0.4, '#ffffff', '#0b0f1d');
            return;
        }
        if (booster === BOOSTERS.BURST_SMALL) {
            this.drawGlow(rect, 'rgba(126, 217, 87, 0.38)', 0.16);
            this.drawOutlinedText('🧨', rect, rect.size * 0.4, '#f8fafc', '#0b0f1d');
        }
        if (booster === BOOSTERS.BURST_MEDIUM) {
            this.drawGlow(rect, 'rgba(255, 87, 34, 0.45)', 0.2);
            this.drawOutlinedText('💥', rect, rect.size * 0.44, '#f8fafc', '#0b0f1d');
        }
        if (booster === BOOSTERS.BURST_LARGE) {
            this.drawBaseCandy(rect, BLACK_BOMB_COLOR, 'round');
            this.drawGlow(rect, 'rgba(103, 232, 249, 0.5)', 0.24);
            this.drawOutlinedText('☢️', rect, rect.size * 0.42, '#f8fafc', '#020617');
        }
    }

    private drawSelection(rect: CanvasCellRect): void {
        const context = this.context;
        this.drawGlow(rect, 'rgba(255, 255, 255, 0.42)', 0.18);
        context.save();
        context.lineWidth = Math.max(3, rect.size * 0.07);
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.beginPath();
        context.roundRect(rect.size * 0.04, rect.size * 0.04, rect.size * 0.92, rect.size * 0.92, rect.size * 0.2);
        context.stroke();
        context.restore();
    }

    private drawHint(rect: CanvasCellRect, time: number): void {
        const pulse = 0.55 + Math.sin(time / 180) * 0.25;
        const context = this.context;
        this.drawGlow(rect, `rgba(250, 204, 21, ${pulse * 0.45})`, 0.2);
        context.save();
        context.lineWidth = Math.max(2, rect.size * 0.055);
        context.strokeStyle = `rgba(255, 245, 157, ${pulse})`;
        context.beginPath();
        context.roundRect(rect.size * 0.08, rect.size * 0.08, rect.size * 0.84, rect.size * 0.84, rect.size * 0.18);
        context.stroke();
        context.restore();
    }

    private drawHover(rect: CanvasCellRect): void {
        const context = this.context;
        context.save();
        context.lineWidth = Math.max(1, rect.size * 0.025);
        context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        context.beginPath();
        context.roundRect(rect.size * 0.07, rect.size * 0.07, rect.size * 0.86, rect.size * 0.86, rect.size * 0.2);
        context.stroke();
        context.restore();
    }

    private drawExplosion(rect: CanvasCellRect, progress: number): void {
        const context = this.context;
        context.save();
        context.globalAlpha = 1 - progress * 0.75;
        context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        context.lineWidth = Math.max(2, rect.size * 0.05);
        context.beginPath();
        context.arc(rect.size / 2, rect.size / 2, rect.size * (0.18 + progress * 0.42), 0, Math.PI * 2);
        context.stroke();
        context.restore();
    }

    private drawText(text: string, rect: CanvasCellRect, size: number, color: string): void {
        const context = this.context;
        context.save();
        context.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = color;
        context.fillText(text, rect.size / 2, rect.size / 2 + size * 0.04);
        context.restore();
    }

    private drawOutlinedText(text: string, rect: CanvasCellRect, size: number, color: string, outline: string): void {
        const context = this.context;
        context.save();
        context.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = Math.max(2, size * 0.12);
        context.strokeStyle = outline;
        context.fillStyle = color;
        const x = rect.size / 2;
        const y = rect.size / 2 + size * 0.04;
        context.strokeText(text, x, y);
        context.fillText(text, x, y);
        context.restore();
    }

    private drawCellShadow(rect: CanvasCellRect, color: string): void {
        const context = this.context;
        context.save();
        context.shadowColor = color;
        context.shadowBlur = rect.size * 0.16;
        context.shadowOffsetY = rect.size * 0.08;
        context.fillStyle = color;
        context.beginPath();
        context.roundRect(rect.size * 0.08, rect.size * 0.08, rect.size * 0.84, rect.size * 0.84, rect.size * 0.18);
        context.fill();
        context.restore();
    }

    private drawShiftingOverlay(rect: CanvasCellRect, nextColor: string): void {
        const context = this.context;
        context.save();
        context.lineWidth = Math.max(3, rect.size * 0.08);
        context.strokeStyle = '#05070c';
        context.beginPath();
        context.roundRect(rect.size * 0.07, rect.size * 0.07, rect.size * 0.86, rect.size * 0.86, rect.size * 0.18);
        context.stroke();
        context.strokeStyle = nextColor;
        context.lineWidth = Math.max(2, rect.size * 0.045);
        context.beginPath();
        context.roundRect(rect.size * 0.13, rect.size * 0.13, rect.size * 0.74, rect.size * 0.74, rect.size * 0.14);
        context.stroke();
        context.fillStyle = nextColor;
        context.globalAlpha = 0.72;
        context.beginPath();
        context.moveTo(rect.size * 0.66, rect.size * 0.12);
        context.lineTo(rect.size * 0.9, rect.size * 0.12);
        context.lineTo(rect.size * 0.9, rect.size * 0.36);
        context.closePath();
        context.fill();
        context.restore();
    }

    private drawDiagonalStripes(
        rect: CanvasCellRect,
        stripeColor: string,
        backingColor: string,
        alpha: number,
        direction = 1
    ): void {
        const context = this.context;
        const inset = rect.size * 0.08;
        const width = rect.size - inset * 2;
        const stripeStep = Math.max(8, rect.size * 0.22);
        context.save();
        context.globalAlpha = alpha;
        context.beginPath();
        context.roundRect(inset, inset, width, width, rect.size * 0.18);
        context.clip();
        context.fillStyle = backingColor;
        context.fillRect(inset, inset, width, width);
        context.strokeStyle = stripeColor;
        context.lineWidth = Math.max(3, rect.size * 0.07);
        for (let offset = -rect.size; offset <= rect.size * 2; offset += stripeStep) {
            context.beginPath();
            if (direction > 0) {
                context.moveTo(offset, rect.size);
                context.lineTo(offset + rect.size, 0);
            } else {
                context.moveTo(offset, 0);
                context.lineTo(offset + rect.size, rect.size);
            }
            context.stroke();
        }
        context.restore();
    }

    private drawRoundedStroke(rect: CanvasCellRect, inset: number, size: number, color: string, lineWidth: number): void {
        const context = this.context;
        context.save();
        context.lineWidth = lineWidth;
        context.strokeStyle = color;
        context.beginPath();
        context.roundRect(inset, inset, size, size, rect.size * 0.18);
        context.stroke();
        context.restore();
    }

    private drawHardeningCap(x: number, y: number, radius: number): void {
        const context = this.context;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }

    private drawGlow(rect: CanvasCellRect, color: string, spread: number): void {
        const context = this.context;
        context.save();
        context.strokeStyle = color;
        context.lineWidth = Math.max(3, rect.size * spread);
        context.beginPath();
        context.roundRect(rect.size * 0.07, rect.size * 0.07, rect.size * 0.86, rect.size * 0.86, rect.size * 0.2);
        context.stroke();
        context.restore();
    }

    private getIndexAtPoint(clientX: number, clientY: number): number | null {
        if (this.metrics.rowStep <= 0 || this.metrics.cellSize <= 0) return null;
        const boardRect = this.gameEl.getBoundingClientRect();
        const x = clientX - boardRect.left - this.metrics.paddingLeft;
        const y = clientY - boardRect.top - this.metrics.paddingTop;
        if (x < 0 || y < 0) return null;
        const col = Math.floor(x / this.metrics.rowStep);
        const row = Math.floor(y / this.metrics.rowStep);
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
        const cellX = col * this.metrics.rowStep;
        const cellY = row * this.metrics.rowStep;
        if (x > cellX + this.metrics.cellSize || y > cellY + this.metrics.cellSize) return null;
        return row * GRID_SIZE + col;
    }

    private getCellRect(index: number): CanvasCellRect {
        const { row, col } = this.getRowCol(index);
        return {
            x: this.metrics.paddingLeft + col * this.metrics.rowStep,
            y: this.metrics.paddingTop + row * this.metrics.rowStep,
            size: this.metrics.cellSize
        };
    }

    private getCellCenter(index: number): { x: number; y: number } | null {
        if (index < 0 || index >= GRID_SIZE * GRID_SIZE || this.metrics.cellSize <= 0) return null;
        const rect = this.getCellRect(index);
        return { x: rect.x + rect.size / 2, y: rect.y + rect.size / 2 };
    }

    private replaceAnimation(index: number, kind: CellAnimation['kind'], animation: CellAnimation): void {
        this.removeAnimations(index, kind);
        this.activeAnimations.push(animation);
    }

    private removeAnimations(index: number, kind: CellAnimation['kind']): void {
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const animation = this.activeAnimations[i];
            if (animation?.index === index && animation.kind === kind) {
                this.activeAnimations.splice(i, 1);
            }
        }
    }

    private hasAnimation(index: number, kind: CellAnimation['kind']): boolean {
        return this.activeAnimations.some((animation) => animation.index === index && animation.kind === kind);
    }

    private getAnimationProgress(index: number, kind: CellAnimation['kind'], time: number): number {
        const animation = this.activeAnimations.find((item) => item.index === index && item.kind === kind);
        if (!animation) return 1;
        return this.getProgress(animation, time);
    }

    private getProgress(animation: CellAnimation, time: number): number {
        const delay = animation.kind === 'spawn' ? animation.delay : 0;
        return Math.min(Math.max((time - animation.startedAt - delay) / animation.duration, 0), 1);
    }

    private easeOutCubic(value: number): number {
        return 1 - Math.pow(1 - value, 3);
    }

    private easeOutBack(value: number): number {
        const overshoot = 1.70158;
        const shifted = value - 1;
        return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
    }

    showSugarCoinReward(index: number, amount: number): void {
        if (amount <= 0) return;
        const center = this.getCellCenter(index);
        if (!center) return;
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

        notification.style.left = `${center.x}px`;
        notification.style.top = `${center.y}px`;

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
        return this.metrics.rowStep;
    }

    private applyDropAnimation(index: number, deltaRows: number, startedAt: number): void {
        if (deltaRows <= 0) return;
        const duration = Math.min(520, 160 + deltaRows * 55);
        this.replaceAnimation(index, 'drop', {
            kind: 'drop',
            index,
            fromRowOffset: deltaRows,
            startedAt,
            duration
        });
        this.requestRedraw();
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

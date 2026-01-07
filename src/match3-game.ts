import {
    GRID_SIZE,
    BOOSTERS,
    BLACK_BOMB_COLOR,
    BoosterType,
    randomColor,
    TacticalPowerup,
    createFreshPowerupInventory
} from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { CellShapeMode, GameState, LineOrientation, PowerupInventory, SwipeDirection } from './types.js';
import { Renderer } from './renderer.js';
import { describeGoal, LEVELS } from './levels.js';
import { GameModeState, ModeContext, BoardConfig } from './game-mode-state.js';
import { LevelModeState } from './level-mode-state.js';
import { BlockerModeState } from './blocker-mode-state.js';
import { LeaderboardState, LeaderboardStateOptions } from './leaderboard-state.js';
import { TimeModeState } from './time-mode-state.js';
import { t, Locale } from './i18n.js';
import { HintManager } from './hint-manager.js';
import { MatchScanner } from './match-scanner.js';
import { MultiplierTracker } from './multiplier-tracker.js';
import { PowerupManager } from './powerup-manager.js';
import { SugarChestManager } from './sugar-chest-manager.js';
import type { MatchResult } from './match-scanner.js';
import type { ParticleOptions } from './particle-effect.js';

type ColumnEntry = {
    color: string;
    booster: BoosterType;
    lineOrientation?: LineOrientation | undefined;
    hard: boolean;
    generator: boolean;
    sugarChestStage?: number;
};

class Match3Game implements ModeContext {
    constructor() {
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.renderer = new Renderer(this.hud);
        this.board = new Board();
        this.matchScanner = new MatchScanner(this.board);
        this.multiplierTracker = new MultiplierTracker({
            renderer: this.renderer,
            sounds: this.sounds,
            minMultiplier: this.minMultiplier,
            maxMultiplier: this.maxMultiplier
        });
        this.powerups = new PowerupManager(
            {
                board: this.board,
                hud: this.hud,
                renderer: this.renderer,
                sounds: this.sounds,
                getState: () => this.state,
                updateHud: () => this.updateHud(),
                defer: (callback, delay) => this.defer(callback, delay),
                getAnimationDelay: (duration) => this.getAnimationDelay(duration),
                rearrangeBoardColors: () => this.rearrangeBoardColors(),
                dropCells: () => this.dropCells(),
                checkMatches: () => this.checkMatches(),
                destroyCellAndMaybeFinishGenerator: (index) => this.destroyCellAndMaybeFinishGenerator(index),
                getRowCol: (index) => this.getRowCol(index),
                areAdjacent: (a, b) => this.areAdjacent(a, b),
                resetHintState: () => this.resetHintState(),
                onLockChange: () => this.syncPowerupToolbarLock(),
                isPerformanceMode: () => this.performanceMode
            },
            createFreshPowerupInventory()
        );
        this.sugarChests = new SugarChestManager({
            board: this.board,
            renderer: this.renderer,
            isPerformanceMode: () => this.performanceMode,
            getAnimationDelay: (duration) => this.getAnimationDelay(duration),
            defer: (callback, delay) => this.defer(callback, delay),
            onSugarCoins: (amount) => this.sugarCoinListener?.(amount),
            getRowCol: (index) => this.getRowCol(index),
            getAdjacentIndices: (row, col) => this.getAdjacentIndices(row, col)
        });
        this.hintManager = new HintManager({
            renderer: this.renderer,
            delayMs: this.hintDelayMs,
            canSchedule: () => this.canScheduleHint(),
            findHintMove: () => this.matchScanner.findHintMove()
        });
        this.hud.onTacticalPowerup((type) => this.handleTacticalPowerup(type));
        this.hud.onAudioToggle((enabled) => {
            const active = this.sounds.setEnabled(enabled);
            if (active !== enabled) {
                this.hud.setAudioEnabled(active);
            }
        });
        this.hud.onCellShapeModeChange((mode) => this.updateCellShapeMode(mode));
        this.hud.onPerformanceModeChange((enabled) => this.setPerformanceMode(enabled));
        this.setPerformanceMode(this.loadPerformanceModeSetting());
        this.hud.initOptionsMenu();
        this.hud.setAudioEnabled(this.sounds.isEnabled());
        this.renderer.setCellShapesEnabled(true);
        this.hud.setCellShapeMode(this.cellShapeMode);
        this.modeState = new LevelModeState(1);
        this.state = this.modeState.enter(this);
        this.powerups.applyInventoryToState();
        this.multiplierTracker.setState(this.state);
        this.refreshGoalDescriptions();
        this.updateCellShapeMode(this.state.cellShapeMode);

        this.generation = 0;
        this.pendingTimers = [];
        this.boardAnimating = false;
        this.syncPowerupToolbarLock();
    }

    private sounds: SoundManager;
    private hud: Hud;
    private readonly renderer: Renderer;
    private board: Board;
    private matchScanner: MatchScanner;
    private hintManager: HintManager;
    private powerups: PowerupManager;
    private sugarChests: SugarChestManager;
    private multiplierTracker: MultiplierTracker;
    private state: GameState;
    private modeState: GameModeState;
    private generation: number;
    private pendingTimers: number[];
    private readonly baseCellPoints = 10;
    private readonly minMultiplier = 0.5;
    private readonly maxMultiplier = 5;
    private readonly maxBombDropChance = 0.05; // 5%
    private boardAnimating: boolean;
    private cellShapeMode: CellShapeMode = 'square';
    private sugarCoinListener: ((amount: number) => void) | null = null;
    private progressListener: ((level: number) => void) | null = null;
    private blockerHighScoreListener: ((score: number) => void) | null = null;
    private timeBestListener: ((time: number) => void) | null = null;
    private levelAttemptListener: ((level: number) => void) | null = null;
    private blockerAttemptListener: ((score: number) => void) | null = null;
    private timeAttemptListener: ((time: number) => void) | null = null;
    private exitGameListener: (() => void) | null = null;
    private leaderboardState: LeaderboardState | null = null;
    private generatorMoveCounter = 0;
    private readonly generatorSpreadInterval = 2;
    private readonly generatorSpreadRadius = 3;
    private performanceMode = false;
    private readonly performanceModeStorageKey = 'match3-performance-mode';
    private readonly hintDelayMs = 10000;

    startLevel(level: number): void {
        this.hud.closeOptions();
        this.switchMode(new LevelModeState(level));
        this.createBoard();
    }

    startBlocker(bestScore: number): void {
        this.hud.closeOptions();
        this.switchMode(new BlockerModeState(bestScore));
        this.createBoard();
    }

    startTime(bestSurvival: number): void {
        this.hud.closeOptions();
        this.switchMode(new TimeModeState(bestSurvival));
        this.createBoard();
    }

    stop(): void {
        this.generation++;
        if (this.modeState) {
            this.modeState.exit(this);
        }
        this.clearPendingTimers();
        this.resetHintState();
        this.board.clear();
        this.resetMoveTracking();
        this.renderer.resetMoveEvaluation();
        this.renderer.hideModal(false);
        this.powerups.clearPendingPowerup();
        this.hud.resetStatus();
    }

    onExitGameRequested(handler: () => void): void {
        this.exitGameListener = handler;
        this.hud.onExitGame(handler);
    }

    onDeleteProgressRequested(handler: () => void): void {
        this.hud.onDeleteProgress(handler);
    }

    onLogoutRequested(handler: () => void): void {
        this.hud.onLogout(handler);
    }

    setLogoutEnabled(enabled: boolean): void {
        this.hud.setLogoutEnabled(enabled);
    }

    onLanguageChange(handler: (locale: Locale) => void): void {
        this.hud.onLanguageChange(handler);
    }

    onProgressChange(handler: (highestUnlockedLevel: number) => void): void {
        this.progressListener = handler;
    }

    onBlockerHighScore(handler: (score: number) => void): void {
        this.blockerHighScoreListener = handler;
    }

    onTimeBest(handler: (time: number) => void): void {
        this.timeBestListener = handler;
    }

    onLevelAttempt(handler: (level: number) => void): void {
        this.levelAttemptListener = handler;
    }

    onBlockerAttempt(handler: (score: number) => void): void {
        this.blockerAttemptListener = handler;
    }

    onTimeAttempt(handler: (time: number) => void): void {
        this.timeAttemptListener = handler;
    }

    onSugarCoinsEarned(handler: (amount: number) => void): void {
        this.sugarCoinListener = handler;
    }

    onPowerupInventoryChange(handler: (inventory: PowerupInventory) => void): void {
        this.powerups.setPowerupInventoryListener(handler);
    }

    setPowerupInventory(inventory: PowerupInventory): void {
        this.powerups.setPowerupInventory(inventory);
    }

    showLeaderboard(options: LeaderboardStateOptions): void {
        this.stop();
        if (this.leaderboardState) {
            this.leaderboardState.update(options);
        } else {
            this.leaderboardState = new LeaderboardState(options);
        }
        this.switchMode(this.leaderboardState);
    }

    closeOptions(): void {
        this.hud.closeOptions();
    }

    private switchMode(modeState: GameModeState): void {
        if (this.modeState) {
            this.modeState.exit(this);
        }
        this.modeState = modeState;
        this.state = this.modeState.enter(this);
        this.powerups.applyInventoryToState();
        this.multiplierTracker.setState(this.state);
        this.renderer.setGameMode(this.state.mode);
        this.refreshGoalDescriptions();
        this.updateCellShapeMode(this.cellShapeMode);
    }

    updateHud(state: GameState = this.state): void {
        this.hud.render(state);
    }

    handleLocaleChange(locale: Locale): void {
        this.hud.setLanguage(locale);
        this.hud.applyLocale();
        this.refreshGoalDescriptions();
        this.updateHud();
        this.hud.resetStatus();
    }

    private refreshGoalDescriptions(): void {
        if (!this.state) return;
        this.state.goals = this.state.goals.map((goal) => ({
            ...goal,
            description: describeGoal(goal)
        }));
    }

    private updateCellShapeMode(mode: CellShapeMode): void {
        this.cellShapeMode = mode;
        if (this.state) {
            this.state.cellShapeMode = mode;
        }
        this.renderer.setCellShapesEnabled(mode === 'shaped');
        this.hud.setCellShapeMode(mode);
        if (this.board.getCells().length > 0) {
            this.renderer.refreshBoard(this.board);
        }
        this.updateHud();
    }

    private syncPowerupToolbarLock(): void {
        this.hud.setPowerupToolbarBlocked(
            this.boardAnimating || this.multiplierTracker.isMoveActive() || this.powerups.isInProgress()
        );
    }

    private createBoard(): void {
        this.generation++;
        this.clearPendingTimers();
        this.resetHintState();
        this.boardAnimating = true;
        this.syncPowerupToolbarLock();
        const boardConfig = this.modeState.getBoardConfig();
        this.board.create(boardConfig);
        this.renderer.renderBoard(
            this.board,
            (index) => this.handleCellClick(index),
            (index, direction) => this.handleCellSwipe(index, direction)
        );
        this.generatorMoveCounter = 0;
        if (this.modeState.onBoardCreated) {
            this.modeState.onBoardCreated(this.state, this);
        }
        this.resetMoveTracking();
        this.renderer.renderMultiplierStatus(this.state.comboMultiplier, 0, 0);
        this.updateHud();
        this.animateBoardEntry();
    }

    ensurePlayableBoard(boardConfig: BoardConfig): void {
        let attempts = 0;
        while (!this.hasAnyValidMove() && attempts < 5) {
            this.board.create(boardConfig);
            attempts++;
        }
    }

    shuffleBoardWithNotice(message: string): void {
        if (this.boardAnimating || this.powerups.isInProgress()) return;
        if (!this.rearrangeBoardColors()) return;
        this.renderer.showShuffleNotice(message);
        this.defer(() => this.checkMatches(), this.getAnimationDelay(150));
    }

    private handleCellClick(index: number): void {
        if (this.boardAnimating) return;
        if (this.powerups.handleCellSelection(index)) return;
        if (this.powerups.isInProgress()) return;
        if (this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        this.resetHintState();

        const booster = this.board.getCellBooster(index);
        if (booster === BOOSTERS.BURST_LARGE) {
            this.activateBooster(index, true);
            return;
        }

        if (this.state.selected === null) {
            this.state.selected = index;
            this.renderer.selectCell(index);
            return;
        }

        if (index === this.state.selected) {
            this.renderer.clearSelection();
            this.state.selected = null;
            this.scheduleHint();
            return;
        }

        if (this.state.selected !== null && !this.areAdjacent(this.state.selected, index)) {
            this.showInvalidMove(this.state.selected);
            this.renderer.clearSelection();
            this.state.selected = index;
            this.renderer.selectCell(index);
            return;
        }

        const firstSelected = this.state.selected;
        this.renderer.clearSelection();
        this.state.selected = null;
        this.trySwap(firstSelected, index);
    }

    private handleCellSwipe(index: number, direction: SwipeDirection): void {
        if (this.boardAnimating) return;
        if (this.powerups.hasPendingPowerup()) return;
        if (this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        this.resetHintState();
        const neighbor = this.getNeighbor(index, direction);
        if (!neighbor) return;
        if (this.state.selected) {
            this.renderer.clearSelection();
            this.state.selected = null;
        }
        this.trySwap(index, neighbor);
    }

    private handleTacticalPowerup(type: TacticalPowerup): void {
        if (this.boardAnimating || this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        const result = this.powerups.handleTacticalPowerup(type);
        if (result === 'canceled') {
            this.scheduleHint();
        }
    }

    private findMatches(): MatchResult {
        return this.matchScanner.findMatches();
    }

    private checkMatches(): void {
        const matchResult = this.findMatches();
        const { matched, boostersToCreate } = matchResult;
        this.softenAdjacentHardCandies(matched);
        this.sugarChests.advanceNearMatches(matched);

        if (matched.size > 0) {
            const hasBlastBooster = boostersToCreate.some(
                (boost) =>
                    boost.type === BOOSTERS.BURST_SMALL ||
                    boost.type === BOOSTERS.BURST_MEDIUM ||
                    boost.type === BOOSTERS.BURST_LARGE
            );
            const hasLineMatch = boostersToCreate.some((boost) => boost.type === BOOSTERS.LINE);
            if (hasBlastBooster) {
                this.sounds.play('radiusBomb');
            } else if (hasLineMatch) {
                this.sounds.play('lineBomb');
            } else {
                this.sounds.play('match');
            }
            if (!this.performanceMode) {
                this.renderer.screenShake();
            }
            matched.forEach((idx) => {
                const booster = this.board.getCellBooster(idx);
                if (booster !== BOOSTERS.NONE) {
                    this.activateBooster(idx, false);
                    return;
                }
                this.destroyCell(idx);
            });
            this.defer(() => {
                boostersToCreate.forEach((b) => this.createBooster(b.index, b.type, b.orientation));
                this.dropCells();
            }, this.getAnimationDelay(350));
            return;
        }

        this.finalizeMoveScore();
        this.powerups.finishPowerupIfNeeded();
        this.modeState.handleBoardSettled(this.state, this);
        this.scheduleHint();
    }

    private softenAdjacentHardCandies(matched: Set<number>): void {
        if (matched.size === 0) return;
        const softened = new Set<number>();
        matched.forEach((idx) => {
            const { row, col } = this.getRowCol(idx);
            this.getAdjacentIndices(row, col).forEach((neighbor) => {
                if (softened.has(neighbor)) return;
                if (this.board.isBlockedIndex(neighbor)) return;
                if (!this.board.isHardCandy(neighbor)) return;
                this.board.softenCandy(neighbor);
                softened.add(neighbor);
                this.renderer.updateCell(neighbor, this.board.getCellState(neighbor));
            });
        });
    }

    private destroyCell(index: number): void {
        if (this.board.isBlockedIndex(index)) return;
        if (this.board.isSugarChest(index)) {
            this.sugarChests.handleHit(index, false);
            return;
        }
        const isGenerator = this.board.isBlockerGenerator(index);
        if (this.board.isHardCandy(index)) {
            if (isGenerator) {
                this.renderer.animateGeneratorHit(index);
            }
            this.board.softenCandy(index);
            this.renderer.updateCell(index, this.board.getCellState(index));
            return;
        }
        const booster = this.board.getCellBooster(index);
        const color = this.board.getCellColor(index);
        if ((!color && booster === BOOSTERS.NONE) || this.renderer.isCellExploding(index)) return;
        if (!this.performanceMode) {
            this.renderer.emitCellParticles(index, color || null, this.getParticleOptionsForBooster(booster));
        }
        if (isGenerator) {
            this.renderer.animateGeneratorHit(index);
        }
        this.renderer.markCellExploding(index);
        this.defer(() => {
            this.renderer.clearCellExplosion(index);
            this.board.clearCell(index);
            this.awardScore(this.baseCellPoints);
            if (color) {
                this.modeState.handleColorCleared(this.state, color, this);
            }
            this.updateHud();
            this.renderer.updateCell(index, this.board.getCellState(index));
        }, this.getAnimationDelay(300));
    }

    private createBooster(index: number, type: BoosterType, orientation?: LineOrientation): void {
        if (type === BOOSTERS.BURST_LARGE) {
            this.board.setCellColor(index, BLACK_BOMB_COLOR);
        } else {
            this.board.setCellColor(index, randomColor());
        }
        this.board.setBooster(index, type);
        if (type === BOOSTERS.LINE) {
            this.board.setLineOrientation(index, orientation ?? 'horizontal');
        } else {
            this.board.setLineOrientation(index, null);
        }
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    private activateBooster(index: number, consumesMove: boolean): void {
        const { row, col } = this.getRowCol(index);
        const booster = this.board.getCellBooster(index);
        this.modeState.handleBoosterUsed(this.state, booster, this);

        if (consumesMove) {
            this.modeState.consumeMove(this.state);
            this.beginMove();
        }

        this.executeBoosterEffect(booster, row, col);

        if (consumesMove) {
            this.defer(() => this.dropCells(), this.getAnimationDelay(300));
        }
        this.updateHud();
    }

    private executeBoosterEffect(booster: BoosterType, row: number, col: number): void {
        if (booster === BOOSTERS.LINE) {
            this.sounds.play('lineBomb');
            const index = this.indexAt(row, col);
            const orientation = this.board.getLineOrientation(index) ?? 'horizontal';
            const affected: number[] =
                orientation === 'horizontal' ? [...this.getRowIndices(row)] : [...this.getColumnIndices(col)];
            if (this.state.mode === 'blocker') {
                const secondary =
                    orientation === 'horizontal' ? this.getColumnIndices(col) : this.getRowIndices(row);
                affected.push(...secondary);
            }
            this.destroyCells(affected);
            return;
        }

        if (this.state.mode === 'blocker') {
            const size = this.getBlockerBoosterSize(booster);
            if (size !== null) {
                this.sounds.play('radiusBomb');
                this.destroySquareArea(row, col, size);
                return;
            }
        }

        const radius = this.getBoosterRadius(booster);
        if (radius === null) return;
        this.sounds.play('radiusBomb');
        this.destroyCircularArea(row, col, radius);
    }

    private getBlockerBoosterSize(booster: BoosterType): number | null {
        if (booster === BOOSTERS.BURST_SMALL) return 3;
        if (booster === BOOSTERS.BURST_MEDIUM) return 4;
        if (booster === BOOSTERS.BURST_LARGE) return 6;
        return null;
    }

    private destroySquareArea(row: number, col: number, size: number): void {
        if (size <= 0) return;
        const halfBefore = Math.floor((size - 1) / 2);
        const halfAfter = size - 1 - halfBefore;
        const startRow = Math.max(0, row - halfBefore);
        const endRow = Math.min(GRID_SIZE - 1, row + halfAfter);
        const startCol = Math.max(0, col - halfBefore);
        const endCol = Math.min(GRID_SIZE - 1, col + halfAfter);
        const affected: number[] = [];
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                affected.push(this.indexAt(r, c));
            }
        }
        this.destroyCells(affected);
    }

    private getBoosterRadius(booster: BoosterType): number | null {
        if (booster === BOOSTERS.BURST_SMALL) return 1;
        if (booster === BOOSTERS.BURST_MEDIUM) return 1.5;
        if (booster === BOOSTERS.BURST_LARGE) return 2;
        return null;
    }

    private getRowIndices(row: number): number[] {
        const indices: number[] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            indices.push(row * GRID_SIZE + c);
        }
        return indices;
    }

    private getColumnIndices(col: number): number[] {
        const indices: number[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            indices.push(r * GRID_SIZE + col);
        }
        return indices;
    }

    private destroyCells(indices: Iterable<number>): void {
        const unique = new Set(indices);
        unique.forEach((idx) => this.destroyCellAndMaybeFinishGenerator(idx));
    }

    private destroyCellAndMaybeFinishGenerator(index: number): void {
        const generatorWasHard = this.board.isBlockerGenerator(index) && this.board.isHardCandy(index);
        this.destroyCell(index);
        if (generatorWasHard && this.board.isBlockerGenerator(index)) {
            this.destroyCell(index);
        }
    }

    private rearrangeBoardColors(): boolean {
        const candidateIndices: number[] = [];
        const colors: string[] = [];
        for (let index = 0; index < GRID_SIZE * GRID_SIZE; index++) {
            if (this.board.isBlockedIndex(index)) continue;
            if (this.board.isBlockerGenerator(index)) continue;
            const color = this.board.getCellColor(index);
            if (!color) continue;
            candidateIndices.push(index);
            colors.push(color);
        }
        if (colors.length === 0) {
            return false;
        }
        this.shuffleArray(colors);
        candidateIndices.forEach((index, idx) => {
            const color = colors[idx];
            if (!color) return;
            this.board.setCellColor(index, color);
        });
        this.renderer.refreshBoard(this.board);
        return true;
    }

    private shuffleArray<T>(items: T[]): void {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = items[i];
            const candidate = items[j];
            if (temp === undefined || candidate === undefined) {
                continue;
            }
            items[i] = candidate;
            items[j] = temp;
        }
    }

    private destroyCircularArea(row: number, col: number, radius: number): void {
        const affected = new Set<number>();
        const range = Math.ceil(radius);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const targetRow = row + dx;
                const targetCol = col + dy;
                if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) continue;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius + 0.001) {
                    affected.add(targetRow * GRID_SIZE + targetCol);
                }
            }
        }
        affected.forEach((idx) => this.destroyCellAndMaybeFinishGenerator(idx));
    }

    private shouldSpawnBombFromDrop(): boolean {
        const normalizedMultiplier = Math.min(Math.max(this.state.comboMultiplier, 0), this.maxMultiplier);
        const chance = (normalizedMultiplier / this.maxMultiplier) * this.maxBombDropChance;
        return Math.random() < chance;
    }

    private shouldSpawnHardCandy(): boolean {
        return this.modeState.shouldSpawnHardCandy(this.state);
    }

    private createFallingBomb(index: number): void {
        this.board.setCellColor(index, randomColor());
        this.board.setBooster(index, BOOSTERS.BURST_SMALL);
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    private dropCells(): void {
        for (let col = 0; col < GRID_SIZE; col++) {
            this.collapseColumn(col);
        }
        this.renderer.refreshBoard(this.board);
        this.defer(() => this.checkMatches(), this.getAnimationDelay(200));
    }

    private collapseColumn(col: number): void {
        let segmentBottom = GRID_SIZE - 1;
        for (let row = GRID_SIZE - 1; row >= -1; row--) {
            const isBoundary =
                row < 0 || this.board.isBlockedIndex(row * GRID_SIZE + col);
            if (isBoundary) {
                const segmentTop = row + 1;
                if (segmentTop <= segmentBottom) {
                    this.collapseColumnSegment(col, segmentTop, segmentBottom);
                }
                segmentBottom = row - 1;
            }
        }
    }

    private collapseColumnSegment(col: number, topRow: number, bottomRow: number): void {
        if (topRow > bottomRow) return;
        const entries: ColumnEntry[] = [];
        for (let row = topRow; row <= bottomRow; row++) {
            const index = row * GRID_SIZE + col;
            const entry = this.captureColumnEntry(index);
            if (entry) {
                entries.push(entry);
            }
            this.board.clearCell(index);
        }
        let targetRow = bottomRow;
        while (entries.length > 0) {
            const entry = entries.pop()!;
            const index = targetRow * GRID_SIZE + col;
            this.placeColumnEntry(index, entry);
            targetRow--;
        }
        for (let row = targetRow; row >= topRow; row--) {
            const index = row * GRID_SIZE + col;
            if (this.board.trySpawnSugarChest(index)) continue;
            const spawnHardCandy = this.shouldSpawnHardCandy();
            if (this.shouldSpawnBombFromDrop()) {
                this.createFallingBomb(index);
                this.board.setHardCandy(index, false);
            } else {
                this.board.setCellColor(index, randomColor());
                this.board.setBooster(index, BOOSTERS.NONE);
                this.board.setHardCandy(index, spawnHardCandy);
            }
        }
    }

    private captureColumnEntry(index: number): ColumnEntry | null {
        const state = this.board.getCellState(index);
        if (state.blocked) return null;
        if (state.sugarChestStage !== undefined) {
            return {
                color: '',
                booster: BOOSTERS.NONE,
                hard: false,
                generator: false,
                sugarChestStage: state.sugarChestStage
            };
        }
        if (!state.color && state.booster === BOOSTERS.NONE && !state.hard && !state.generator) {
            return null;
        }
        return {
            color: state.color,
            booster: state.booster,
            lineOrientation: state.lineOrientation,
            hard: state.hard,
            generator: state.generator
        };
    }

    private placeColumnEntry(index: number, entry: ColumnEntry): void {
        this.board.clearCell(index);
        if (entry.sugarChestStage !== undefined) {
            this.board.setSugarChestStage(index, entry.sugarChestStage);
            return;
        }
        if (entry.generator) {
            this.board.setBlockerGenerator(index, true, entry.hard);
            return;
        }
        const state = this.board.getCellState(index);
        state.color = entry.color;
        state.booster = entry.booster;
        if (entry.booster === BOOSTERS.LINE) {
            state.lineOrientation = entry.lineOrientation ?? 'horizontal';
        } else {
            delete state.lineOrientation;
        }
        state.hard = entry.hard;
    }

    private areAdjacent(aIndex: number, bIndex: number): boolean {
        const { row: aRow, col: aCol } = this.getRowCol(aIndex);
        const { row: bRow, col: bCol } = this.getRowCol(bIndex);
        return Math.abs(aRow - bRow) + Math.abs(aCol - bCol) === 1;
    }

    private getNeighbor(index: number, direction: SwipeDirection): number | null {
        const { row, col } = this.getRowCol(index);
        let targetRow = row;
        let targetCol = col;
        if (direction === 'up') targetRow--;
        if (direction === 'down') targetRow++;
        if (direction === 'left') targetCol--;
        if (direction === 'right') targetCol++;
        if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) return null;
        const targetIndex = targetRow * GRID_SIZE + targetCol;
        if (this.board.isBlockedIndex(targetIndex)) return null;
        return targetIndex;
    }

    private trySwap(firstIndex: number, secondIndex: number): void {
        this.resetHintState();
        const firstIsLocked =
            this.board.isBlockedCell(firstIndex) ||
            this.board.isHardCandy(firstIndex) ||
            this.board.isBlockerGenerator(firstIndex);
        const secondIsLocked =
            this.board.isBlockedCell(secondIndex) ||
            this.board.isHardCandy(secondIndex) ||
            this.board.isBlockerGenerator(secondIndex);
        if (firstIsLocked || secondIsLocked) {
            this.showInvalidMove(firstIsLocked ? firstIndex : secondIndex);
            return;
        }
        if (!this.areAdjacent(firstIndex, secondIndex)) {
            this.showInvalidMove(secondIndex);
            return;
        }
        this.board.swapCells(firstIndex, secondIndex);
        this.renderer.refreshBoard(this.board);
        const { matched } = this.findMatches();
        if (matched.size === 0) {
            this.board.swapCells(firstIndex, secondIndex);
            this.renderer.refreshBoard(this.board);
            this.resetMoveTracking();
            this.showInvalidMove(secondIndex);
            this.scheduleHint();
            return;
        }
        this.modeState.consumeMove(this.state);
        this.beginMove();
        this.updateHud();
        this.defer(() => this.checkMatches(), this.getAnimationDelay(120));
    }

    private defer(callback: () => void, delay: number): void {
        const gen = this.generation;
        const timerId = setTimeout(() => {
            if (this.generation !== gen) return;
            callback();
        }, delay);
        this.pendingTimers.push(timerId);
    }

    private clearPendingTimers(): void {
        this.pendingTimers.forEach((id) => clearTimeout(id));
        this.pendingTimers = [];
    }

    private showInvalidMove(index: number): void {
        this.renderer.showInvalidMove(index);
        this.defer(() => this.renderer.clearInvalidMove(index), this.getAnimationDelay(350));
    }

    finishLevel(result: 'win' | 'lose', completedLevel: number): void {
        const rawNextLevel = result === 'win' ? completedLevel + 1 : completedLevel;
        const nextLevel = Math.min(rawNextLevel, LEVELS.length);
        if (result === 'win') {
            this.sounds.play('levelUp');
            this.notifyProgress(nextLevel);
            this.notifyLevelAttempt(completedLevel);
        } else {
            this.sounds.play('levelFail');
        }
        const title =
            result === 'win'
                ? t('result.level.winTitle', { level: completedLevel })
                : t('result.level.loseTitle');
        const hasMoreLevels = nextLevel > completedLevel;
        const text =
            result === 'win'
                ? hasMoreLevels
                    ? t('result.level.winNext', { level: nextLevel })
                    : t('result.level.winAll', { count: LEVELS.length })
                : t('result.level.loseText');
        this.renderer.showModal({
            title,
            text,
            buttonText: t('button.continue'),
            secondaryButtonText: t('button.home'),
            onSecondary: () => this.requestExitGame(),
            onClose: () => {
                this.switchMode(new LevelModeState(nextLevel));
                this.createBoard();
            }
        });
    }

    finishBlockerRun(finalScore: number, bestScore: number): void {
        this.sounds.play('levelFail');
        this.notifyBlockerAttempt(finalScore);
        const isNewBest = finalScore >= bestScore;
        const title = isNewBest ? t('result.blocker.newHighscore') : t('result.blocker.gameOver');
        const text = t('result.blocker.text', { score: finalScore, best: bestScore });
        this.renderer.showModal({
            title,
            text,
            buttonText: t('button.restart'),
            secondaryButtonText: t('button.home'),
            onSecondary: () => this.requestExitGame(),
            onClose: () => {
                this.switchMode(new BlockerModeState(bestScore));
                this.createBoard();
            }
        });
    }

    finishTimeRun(finalTime: number, bestTime: number): void {
        this.sounds.play('levelFail');
        this.notifyTimeAttempt(finalTime);
        const isNewBest = finalTime >= bestTime;
        const finalLabel = this.formatTime(Math.max(0, finalTime));
        const bestLabel = this.formatTime(Math.max(0, bestTime));
        const title = isNewBest ? t('result.time.newBest') : t('result.time.timeUp');
        const text = t('result.time.text', { survived: finalLabel, best: bestLabel });
        this.renderer.showModal({
            title,
            text,
            buttonText: t('button.restart'),
            secondaryButtonText: t('button.home'),
            onSecondary: () => this.requestExitGame(),
            onClose: () => {
                this.switchMode(new TimeModeState(bestTime));
                this.createBoard();
            }
        });
    }

    private requestExitGame(): void {
        this.exitGameListener?.();
    }

    private awardScore(basePoints: number): void {
        this.multiplierTracker.awardScore(basePoints, (points) => {
            if (this.modeState.handleScoreAwarded) {
                this.modeState.handleScoreAwarded(this.state, points, this);
            }
        });
    }

    private beginMove(): void {
        this.resetHintState();
        this.multiplierTracker.beginMove();
        this.syncPowerupToolbarLock();
    }

    private resetMoveTracking(): void {
        this.multiplierTracker.resetMove();
        this.syncPowerupToolbarLock();
    }

    private finalizeMoveScore(): void {
        if (!this.multiplierTracker.finalizeMoveScore()) return;
        this.syncPowerupToolbarLock();
        this.generatorMoveCounter++;
        this.triggerBlockerGeneratorsIfReady();
        this.updateHud();
        this.modeState.handleMoveResolved(this.state, this);
        this.modeState.checkForCompletion(this.state, this);
    }

    private hardenRandomCells(amount: number): void {
        if (amount <= 0) return;
        const candidates: number[] = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            if (this.board.isBlockedIndex(i)) continue;
            if (this.board.isBlockerGenerator(i)) continue;
            if (this.board.isHardCandy(i)) continue;
            if (!this.board.getCellColor(i)) continue;
            candidates.push(i);
        }
        for (let n = 0; n < amount; n++) {
            if (candidates.length === 0) break;
            const pick = Math.floor(Math.random() * candidates.length);
            const index = candidates.splice(pick, 1)[0];
            if (index === undefined) break;
            this.board.setBooster(index, BOOSTERS.NONE);
            this.board.setHardCandy(index, true);
        }
    }

    private triggerBlockerGeneratorsIfReady(): void {
        if (this.generatorMoveCounter % this.generatorSpreadInterval !== 0) return;
        const generators = this.board.getBlockerGeneratorIndices();
        generators.forEach((index) => this.hardenCellsFromGenerator(index));
    }

    private hardenCellsFromGenerator(generatorIndex: number): void {
        const { row, col } = this.getRowCol(generatorIndex);
        const target = this.collectIndicesWithinRadius(row, col, this.generatorSpreadRadius)
            .map((index) => ({ index, distance: this.getManhattanDistance(row, col, index) }))
            .filter((entry) => this.isValidGeneratorTarget(entry.index))
            .sort((a, b) => (a.distance === b.distance ? a.index - b.index : a.distance - b.distance))[0];
        if (!target) return;
        this.hardenCell(target.index);
    }

    private collectIndicesWithinRadius(row: number, col: number, radius: number): number[] {
        const indices: number[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const distance = Math.abs(r - row) + Math.abs(c - col);
                if (distance <= radius) {
                    indices.push(this.indexAt(r, c));
                }
            }
        }
        return indices;
    }

    private isValidGeneratorTarget(index: number): boolean {
        if (this.board.isBlockedIndex(index)) return false;
        if (this.board.isBlockerGenerator(index)) return false;
        if (this.board.isHardCandy(index)) return false;
        if (!this.board.getCellColor(index)) return false;
        return true;
    }

    private hardenCell(index: number): void {
        this.board.setBooster(index, BOOSTERS.NONE);
        this.board.setHardCandy(index, true);
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    private getManhattanDistance(row: number, col: number, index: number): number {
        const position = this.getRowCol(index);
        return Math.abs(position.row - row) + Math.abs(position.col - col);
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }

    private getAdjacentIndices(row: number, col: number): number[] {
        return [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 }
        ]
            .filter((pos) => pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE)
            .map((pos) => this.indexAt(pos.row, pos.col));
    }

    hasAnyValidMove(): boolean {
        return this.matchScanner.hasAnyValidMove();
    }

    private scheduleHint(): void {
        this.hintManager.schedule();
    }

    private canScheduleHint(): boolean {
        if (this.boardAnimating) return false;
        if (this.multiplierTracker.isMoveActive()) return false;
        if (this.powerups.hasPendingPowerup()) return false;
        if (this.powerups.isInProgress()) return false;
        if (this.state.selected !== null) return false;
        if (this.renderer.isModalVisible()) return false;
        return true;
    }

    private resetHintState(): void {
        this.hintManager.reset();
    }

    private animateBoardEntry(): void {
        const duration = this.renderer.playSpawnAnimation();
        this.defer(() => {
            this.boardAnimating = false;
            this.syncPowerupToolbarLock();
            this.scheduleHint();
        }, this.getAnimationDelay(duration));
    }

    private setPerformanceMode(enabled: boolean): void {
        this.performanceMode = enabled;
        this.hud.setPerformanceModeEnabled(enabled);
        this.renderer.setAnimationsEnabled(!enabled);
        this.savePerformanceModeSetting(enabled);
    }

    private savePerformanceModeSetting(enabled: boolean): void {
        try {
            window.localStorage.setItem(this.performanceModeStorageKey, enabled ? 'true' : 'false');
        } catch {
            // ignore quota or permission issues
        }
    }

    private loadPerformanceModeSetting(): boolean {
        try {
            return window.localStorage.getItem(this.performanceModeStorageKey) === 'true';
        } catch {
            return false;
        }
    }

    private getAnimationDelay(duration: number): number {
        if (duration <= 0) return 0;
        if (!this.performanceMode) return duration;
        return Math.max(0, Math.round(duration * 0.35));
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }

    private getParticleOptionsForBooster(booster: BoosterType): ParticleOptions {
        const baseOptions: ParticleOptions = {
            count: 16,
            minDistance: 16,
            maxDistance: 28,
            minDuration: 0.58,
            maxDuration: 0.92,
            delayVariance: 0.2
        };
        if (booster === BOOSTERS.LINE) {
            return {
                ...baseOptions,
                count: 22,
                minDistance: 22,
                maxDistance: 34,
                minDuration: 0.72,
                maxDuration: 1.02,
                accentColor: '#fde047'
            };
        }
        if (booster === BOOSTERS.BURST_SMALL) {
            return {
                ...baseOptions,
                count: 24,
                minDistance: 24,
                maxDistance: 38,
                minDuration: 0.78,
                maxDuration: 1.05,
                accentColor: '#4ade80'
            };
        }
        if (booster === BOOSTERS.BURST_MEDIUM) {
            return {
                ...baseOptions,
                count: 28,
                minDistance: 28,
                maxDistance: 44,
                minDuration: 0.86,
                maxDuration: 1.18,
                delayVariance: 0.24,
                accentColor: '#fb923c'
            };
        }
        if (booster === BOOSTERS.BURST_LARGE) {
            return {
                ...baseOptions,
                count: 34,
                minDistance: 32,
                maxDistance: 52,
                minDuration: 0.95,
                maxDuration: 1.35,
                delayVariance: 0.28,
                accentColor: '#67e8f9'
            };
        }
        return baseOptions;
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    getHud(): Hud {
        return this.hud;
    }

    getBoard(): Board {
        return this.board;
    }

    getSounds(): SoundManager {
        return this.sounds;
    }

    hardenCells(amount: number): void {
        this.hardenRandomCells(amount);
    }

    isModalVisible(): boolean {
        return this.renderer.isModalVisible() || this.hud.isOptionsOpen();
    }

    notifyBlockerHighScore(score: number): void {
        if (this.blockerHighScoreListener) {
            this.blockerHighScoreListener(score);
        }
    }

    notifyTimeBest(time: number): void {
        if (this.timeBestListener) {
            this.timeBestListener(time);
        }
    }

    notifyProgress(unlockedLevel: number): void {
        if (this.progressListener) {
            this.progressListener(unlockedLevel);
        }
    }

    private notifyLevelAttempt(level: number): void {
        if (this.levelAttemptListener) {
            this.levelAttemptListener(level);
        }
    }

    private notifyBlockerAttempt(score: number): void {
        if (this.blockerAttemptListener) {
            this.blockerAttemptListener(score);
        }
    }

    private notifyTimeAttempt(time: number): void {
        if (this.timeAttemptListener) {
            this.timeAttemptListener(time);
        }
    }
}

export { Match3Game };

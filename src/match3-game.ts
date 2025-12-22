import {
    GRID_SIZE,
    BOOSTERS,
    BLACK_BOMB_COLOR,
    BoosterType,
    randomColor,
    TACTICAL_POWERUPS,
    TacticalPowerup
} from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { GameState, SwapMode, SwipeDirection } from './types.js';
import { Renderer } from './renderer.js';
import { LEVELS } from './levels.js';
import { GameModeState, ModeContext, BoardConfig } from './game-mode-state.js';
import { LevelModeState } from './level-mode-state.js';
import { BlockerModeState } from './blocker-mode-state.js';
import { LeaderboardState, LeaderboardStateOptions } from './leaderboard-state.js';
import { TimeModeState } from './time-mode-state.js';

type MatchResult = {
    matched: Set<number>;
    boostersToCreate: { index: number; type: BoosterType }[];
    largestMatch: number;
    createdBoosterTypes: BoosterType[];
};

type MatchAccumulator = {
    matched: Set<number>;
    boostersToCreate: { index: number; type: BoosterType }[];
    boosterSlots: Set<number>;
    createdBoosterTypes: Set<BoosterType>;
    largestMatch: number;
};

class Match3Game implements ModeContext {
    constructor() {
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.renderer = new Renderer(this.hud);
        this.board = new Board();
        this.swapMode = this.hud.getSwapMode();
        this.hud.onSwapModeChange((mode) => {
            this.swapMode = mode;
        });
        this.hud.onTacticalPowerup((type) => this.handleTacticalPowerup(type));
        this.hud.onAudioToggle((enabled) => {
            const active = this.sounds.setEnabled(enabled);
            if (active !== enabled) {
                this.hud.setAudioEnabled(active);
            }
        });
        this.hud.initOptionsMenu();
        this.hud.setAudioEnabled(this.sounds.isEnabled());
        this.modeState = new LevelModeState(1);
        this.state = this.modeState.enter(this);

        this.generation = 0;
        this.pendingTimers = [];
        this.moveActive = false;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
        this.boardAnimating = false;
        this.syncPowerupToolbarLock();
    }

    private sounds: SoundManager;
    private hud: Hud;
    private readonly renderer: Renderer;
    private board: Board;
    private state: GameState;
    private modeState: GameModeState;
    private swapMode: SwapMode;
    private generation: number;
    private pendingTimers: number[];
    private moveActive: boolean;
    private currentMoveScore: number;
    private currentMoveBaseScore: number;
    private readonly baseCellPoints = 10;
    private readonly minMultiplier = 0.5;
    private readonly maxMultiplier = 5;
    private readonly maxBombDropChance = 0.05; // 5%
    private boardAnimating: boolean;
    private pendingPowerup: TacticalPowerup | null = null;
    private pendingPowerupSelections: number[] = [];
    private powerupInProgress = false;
    private progressListener: ((level: number) => void) | null = null;
    private blockerHighScoreListener: ((score: number) => void) | null = null;
    private timeBestListener: ((time: number) => void) | null = null;
    private leaderboardState: LeaderboardState | null = null;
    private generatorMoveCounter = 0;
    private readonly generatorSpreadInterval = 2;
    private readonly generatorSpreadRadius = 3;

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
        this.board.clear();
        this.resetMoveTracking();
        this.renderer.resetMoveEvaluation();
        this.renderer.hideModal(false);
        this.hud.resetStatus();
    }

    onExitGameRequested(handler: () => void): void {
        this.hud.onExitGame(handler);
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
    }

    updateHud(state: GameState = this.state): void {
        this.hud.render(state);
    }

    private syncPowerupToolbarLock(): void {
        this.hud.setPowerupToolbarBlocked(this.boardAnimating || this.moveActive || this.powerupInProgress);
    }

    private releasePowerupLock(): void {
        if (!this.powerupInProgress) return;
        this.powerupInProgress = false;
        this.syncPowerupToolbarLock();
    }

    private createBoard(): void {
        this.generation++;
        this.clearPendingTimers();
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

    private handleCellClick(index: number): void {
        if (this.boardAnimating) return;
        if (this.pendingPowerup) {
            this.handlePowerupCellSelection(index);
            return;
        }
        if (this.powerupInProgress) return;
        if (this.moveActive) return;
        if (!this.modeState.canStartMove(this.state)) return;

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
        if (this.pendingPowerup) return;
        if (this.moveActive) return;
        if (!this.modeState.canStartMove(this.state)) return;
        const neighbor = this.getNeighbor(index, direction);
        if (!neighbor) return;
        if (this.state.selected) {
            this.renderer.clearSelection();
            this.state.selected = null;
        }
        this.trySwap(index, neighbor);
    }

    private handlePowerupCellSelection(index: number): void {
        if (!this.pendingPowerup) return;
        if (this.pendingPowerup === 'bomb') {
            const { row, col } = this.getRowCol(index);
            this.pendingPowerup = null;
            this.renderer.clearSelection();
            this.applyBombPowerup(row, col);
            return;
        }
        if (this.pendingPowerup === 'switch') {
            const selection = this.pendingPowerupSelections;
            if (selection.length === 0) {
                this.pendingPowerupSelections = [index];
                this.renderer.selectCell(index);
                this.hud.setStatus('Wähle ein angrenzendes Feld', TACTICAL_POWERUPS.switch.icon);
                return;
            }
            const first = selection[0]!;
            if (!this.areAdjacent(first, index)) {
                this.hud.setStatus('Ziel muss angrenzend sein', '⚠️');
                this.pendingPowerupSelections = [];
                this.renderer.clearSelection();
                return;
            }
            this.pendingPowerupSelections = [];
            this.pendingPowerup = null;
            this.renderer.clearSelection();
            this.executeSwitchPowerup(first, index);
        }
    }

    private handleTacticalPowerup(type: TacticalPowerup): void {
        if (this.boardAnimating || this.moveActive || this.powerupInProgress) return;
        if (!this.modeState.canStartMove(this.state)) return;
        if (!this.consumePowerup(type)) return;
        const meta = TACTICAL_POWERUPS[type];
        if (!meta) return;
        this.powerupInProgress = true;
        this.syncPowerupToolbarLock();
        this.renderer.clearSelection();
        this.state.selected = null;
        if (type === 'shuffle') {
            this.hud.setStatus(meta.label + ' aktiviert!', meta.icon ?? '✨');
            this.pendingPowerup = null;
            this.applyShufflePowerup();
        } else {
            this.pendingPowerup = type;
            this.pendingPowerupSelections = [];
            this.hud.setStatus('Wähle Ziel für ' + meta.label, meta.icon ?? '✨');
        }
        this.updateHud();
    }

    private findMatches(): MatchResult {
        const accumulator = this.createMatchAccumulator();

        this.scanSquareMatches(accumulator);
        this.scanTPatterns(accumulator);
        this.scanLPatterns(accumulator);
        this.scanLineMatches(accumulator);

        return {
            matched: accumulator.matched,
            boostersToCreate: accumulator.boostersToCreate,
            largestMatch: accumulator.largestMatch,
            createdBoosterTypes: Array.from(accumulator.createdBoosterTypes)
        };
    }

    private checkMatches(): void {
        const matchResult = this.findMatches();
        const { matched, boostersToCreate } = matchResult;
        this.softenAdjacentHardCandies(matched);

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
            this.renderer.screenShake();
            matched.forEach((idx) => {
                const booster = this.board.getCellBooster(idx);
                if (booster !== BOOSTERS.NONE) {
                    this.activateBooster(idx, false);
                    return;
                }
                this.destroyCell(idx);
            });
            this.defer(() => {
                boostersToCreate.forEach((b) => this.createBooster(b.index, b.type));
                this.dropCells();
            }, 350);
            return;
        }

        this.finalizeMoveScore();
        if (this.powerupInProgress) {
            this.powerupInProgress = false;
            this.syncPowerupToolbarLock();
        }
        this.modeState.handleBoardSettled(this.state, this);
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
            });
        });
    }

    private destroyCell(index: number): void {
        if (this.board.isBlockedIndex(index)) return;
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
        }, 300);
    }

    private createBooster(index: number, type: BoosterType): void {
        if (type === BOOSTERS.BURST_LARGE) {
            this.board.setCellColor(index, BLACK_BOMB_COLOR);
        } else {
            this.board.setCellColor(index, randomColor());
        }
        this.board.setBooster(index, type);
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
            this.defer(() => this.dropCells(), 300);
        }
        this.updateHud();
    }

    private executeBoosterEffect(booster: BoosterType, row: number, col: number): void {
        if (booster === BOOSTERS.LINE) {
            this.sounds.play('lineBomb');
            this.destroyCells(this.getRowIndices(row));
            return;
        }

        const radius = this.getBoosterRadius(booster);
        if (radius === null) return;
        this.sounds.play('radiusBomb');
        this.destroyCircularArea(row, col, radius);
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
        unique.forEach((idx) => this.destroyCell(idx));
    }

    private consumePowerup(type: TacticalPowerup): boolean {
        const remaining = this.state.powerups[type] ?? 0;
        if (remaining <= 0) return false;
        this.state.powerups[type] = remaining - 1;
        return true;
    }

    private applyShufflePowerup(): void {
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
            this.releasePowerupLock();
            return;
        }
        this.shuffleArray(colors);
        candidateIndices.forEach((index, idx) => {
            const color = colors[idx];
            if (!color) return;
            this.board.setCellColor(index, color);
        });
        this.renderer.refreshBoard(this.board);
        this.defer(() => {
            this.checkMatches();
            this.releasePowerupLock();
        }, 150);
    }

    private applyBombPowerup(row: number, col: number): void {
        const startRow = Math.min(Math.max(row - 1, 0), GRID_SIZE - 4);
        const startCol = Math.min(Math.max(col - 1, 0), GRID_SIZE - 4);
        const affected: number[] = [];
        this.pendingPowerupSelections = [];
        this.hud.setStatus(TACTICAL_POWERUPS.bomb.label + ' entfesselt!', TACTICAL_POWERUPS.bomb.icon);
        for (let r = startRow; r < startRow + 4; r++) {
            for (let c = startCol; c < startCol + 4; c++) {
                affected.push(r * GRID_SIZE + c);
            }
        }
        this.sounds.play('radiusBomb');
        this.renderer.screenShake();
        affected.forEach((index) => this.destroyCell(index));
        this.defer(() => {
            this.dropCells();
            this.releasePowerupLock();
        }, 320);
    }

    private executeSwitchPowerup(firstIndex: number, secondIndex: number): void {
        this.board.swapCells(firstIndex, secondIndex);
        this.renderer.refreshBoard(this.board);
        this.hud.setStatus('Switch ausgeführt!', TACTICAL_POWERUPS.switch.icon);
        this.defer(() => {
            this.checkMatches();
            this.releasePowerupLock();
        }, 120);
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
        affected.forEach((idx) => this.destroyCell(idx));
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
        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                const targetIndex = r * GRID_SIZE + c;
                if (this.board.isBlockedIndex(targetIndex)) continue;
                if (this.board.getCellColor(targetIndex)) continue;
                for (let k = r - 1; k >= 0; k--) {
                    const sourceIndex = k * GRID_SIZE + c;
                    if (this.board.isBlockedIndex(sourceIndex)) continue;
                    const sourceColor = this.board.getCellColor(sourceIndex);
                    if (!sourceColor) continue;
                    const sourceIsHard = this.board.isHardCandy(sourceIndex);
                    const sourceIsGenerator = this.board.isBlockerGenerator(sourceIndex);
                    this.board.setBlockerGenerator(targetIndex, sourceIsGenerator, sourceIsHard);
                    this.board.setCellColor(targetIndex, sourceColor);
                    this.board.setBooster(
                        targetIndex,
                        sourceIsGenerator ? BOOSTERS.NONE : this.board.getCellBooster(sourceIndex)
                    );
                    this.board.setHardCandy(targetIndex, sourceIsHard);
                    this.board.clearCell(sourceIndex);
                    break;
                }
                if (!this.board.getCellColor(targetIndex)) {
                    const spawnHardCandy = this.shouldSpawnHardCandy();
                    if (this.shouldSpawnBombFromDrop()) {
                        this.createFallingBomb(targetIndex);
                        this.board.setHardCandy(targetIndex, false);
                    } else {
                        this.board.setCellColor(targetIndex, randomColor());
                        this.board.setBooster(targetIndex, BOOSTERS.NONE);
                        this.board.setHardCandy(targetIndex, spawnHardCandy);
                    }
                }
            }
        }
        this.renderer.refreshBoard(this.board);
        this.defer(() => this.checkMatches(), 200);
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
        const firstIsLocked =
            this.board.isBlockedCell(firstIndex) || this.board.isHardCandy(firstIndex) || this.board.isBlockerGenerator(firstIndex);
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
        if (this.swapMode === 'require-match') {
            const { matched } = this.findMatches();
            if (matched.size === 0) {
                this.board.swapCells(firstIndex, secondIndex);
                this.renderer.refreshBoard(this.board);
                this.resetMoveTracking();
                this.showInvalidMove(secondIndex);
                return;
            }
        }
        this.modeState.consumeMove(this.state);
        this.beginMove();
        this.updateHud();
        this.defer(() => this.checkMatches(), 120);
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
        this.defer(() => this.renderer.clearInvalidMove(index), 350);
    }

    finishLevel(result: 'win' | 'lose', completedLevel: number): void {
        const rawNextLevel = result === 'win' ? completedLevel + 1 : completedLevel;
        const nextLevel = Math.min(rawNextLevel, LEVELS.length);
        if (result === 'win') {
            this.sounds.play('levelUp');
            this.notifyProgress(nextLevel);
        } else {
            this.sounds.play('levelFail');
        }
        const title = result === 'win' ? 'Level ' + completedLevel + ' geschafft!' : 'Level verloren!';
        const hasMoreLevels = nextLevel > completedLevel;
        const text =
            result === 'win'
                ? hasMoreLevels
                    ? 'Weiter geht es mit Level ' + nextLevel + '.'
                    : 'Du hast alle ' +
                      LEVELS.length +
                      ' Level gemeistert. Spiele das Finale weiter für Highscores.'
                : 'Versuche es direkt noch einmal.';
        this.renderer.showModal({
            title,
            text,
            buttonText: 'Weiter',
            onClose: () => {
                this.switchMode(new LevelModeState(nextLevel));
                this.createBoard();
            }
        });
    }

    finishBlockerRun(finalScore: number, bestScore: number): void {
        this.sounds.play('levelFail');
        const isNewBest = finalScore >= bestScore;
        const title = isNewBest ? 'Neuer Highscore!' : 'Keine Züge mehr!';
        const text =
            'Punkte: ' + finalScore + '. Bester Lauf: ' + bestScore + '. Gleich noch einmal?';
        this.renderer.showModal({
            title,
            text,
            buttonText: 'Neu starten',
            onClose: () => {
                this.switchMode(new BlockerModeState(bestScore));
                this.createBoard();
            }
        });
    }

    finishTimeRun(finalTime: number, bestTime: number): void {
        this.sounds.play('levelFail');
        const isNewBest = finalTime >= bestTime;
        const finalLabel = this.formatTime(Math.max(0, finalTime));
        const bestLabel = this.formatTime(Math.max(0, bestTime));
        const title = isNewBest ? 'Neue Bestzeit!' : 'Zeit abgelaufen!';
        const text =
            'Überlebt: ' + finalLabel + '. Bestzeit: ' + bestLabel + '. Noch einmal?';
        this.renderer.showModal({
            title,
            text,
            buttonText: 'Neu starten',
            onClose: () => {
                this.switchMode(new TimeModeState(bestTime));
                this.createBoard();
            }
        });
    }

    private awardScore(basePoints: number): void {
        const effective = Math.round(basePoints * this.state.comboMultiplier);
        this.state.score += effective;
        this.currentMoveScore += effective;
        this.currentMoveBaseScore += basePoints;
        if (this.modeState.handleScoreAwarded) {
            this.modeState.handleScoreAwarded(this.state, basePoints, this);
        }
    }

    private beginMove(): void {
        this.moveActive = true;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
        this.syncPowerupToolbarLock();
    }

    private resetMoveTracking(): void {
        this.moveActive = false;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
        this.syncPowerupToolbarLock();
    }

    private finalizeMoveScore(): void {
        if (!this.moveActive) return;
        const delta = this.calculateMultiplierDelta(this.currentMoveScore);
        this.state.comboMultiplier = this.clampMultiplier(this.state.comboMultiplier + delta);
        this.renderer.renderMultiplierStatus(this.state.comboMultiplier, delta, this.currentMoveScore);
        this.showMoveEvaluation(this.currentMoveBaseScore);
        this.resetMoveTracking();
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

    private calculateMultiplierDelta(moveScore: number): number {
        if (moveScore >= 150) return 0.5;
        if (moveScore >= 90) return 0.35;
        if (moveScore >= 60) return 0.2;
        if (moveScore === 0) return -0.3;
        if (moveScore < 30) return -0.15;
        return 0;
    }

    private clampMultiplier(multiplier: number): number {
        const rounded = Math.round(multiplier * 100) / 100;
        return Math.min(this.maxMultiplier, Math.max(this.minMultiplier, rounded));
    }

    private showMoveEvaluation(baseMoveScore: number): void {
        const message = this.getMoveEvaluationMessage(baseMoveScore);
        if (!message) return;
        this.renderer.showMoveEvaluation(message, this.sounds.isEnabled());
    }

    private getMoveEvaluationMessage(baseMoveScore: number): string {
        if (baseMoveScore >= 1600) return 'Candy Chaos!';
        if (baseMoveScore >= 800) return 'Sweetplosion!';
        if (baseMoveScore >= 400) return 'Candy Blast!';
        if (baseMoveScore >= 200) return 'Candy Frenzy!';
        if (baseMoveScore >= 100) return 'Sweet Heat!';
        return '';
    }

    private createMatchAccumulator(): MatchAccumulator {
        return {
            matched: new Set<number>(),
            boostersToCreate: [],
            boosterSlots: new Set<number>(),
            createdBoosterTypes: new Set<BoosterType>(),
            largestMatch: 0
        };
    }

    private scanSquareMatches(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 }
        ];
        this.scanPattern(offsets, { row: 0, col: 0 }, BOOSTERS.BURST_SMALL, accumulator);
    }

    private scanTPatterns(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 1, col: 1 },
            { row: 2, col: 1 }
        ];
        this.scanRotatedPatterns(offsets, { row: 1, col: 1 }, BOOSTERS.BURST_MEDIUM, accumulator);
    }

    private scanLPatterns(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 1, col: 0 },
            { row: 2, col: 0 },
            { row: 2, col: 1 },
            { row: 2, col: 2 }
        ];
        this.scanRotatedPatterns(offsets, { row: 2, col: 0 }, BOOSTERS.BURST_MEDIUM, accumulator);
    }

    private scanLineMatches(accumulator: MatchAccumulator): void {
        for (let r = 0; r < GRID_SIZE; r++) {
            this.checkLine(this.getRowIndices(r), accumulator);
        }

        for (let c = 0; c < GRID_SIZE; c++) {
            this.checkLine(this.getColumnIndices(c), accumulator);
        }
    }

    private checkLine(indices: number[], accumulator: MatchAccumulator): void {
        let streak = 1;
        for (let i = 1; i <= indices.length; i++) {
            const prevIndex = indices[i - 1];
            const currIndex = i < indices.length ? indices[i] : undefined;
            if (prevIndex === undefined) {
                throw new Error('Missing index at position: ' + (i - 1));
            }
            const prevColor = this.getMatchableColor(prevIndex);
            const currColor = currIndex !== undefined ? this.getMatchableColor(currIndex) : '';
            if (currColor && currColor === prevColor) {
                streak++;
            } else {
                if (streak >= 3 && prevColor) {
                    const streakCells = indices.slice(i - streak, i);
                    streakCells.forEach((idx) => accumulator.matched.add(idx));
                    if (streak === 4) {
                        const lineIndex = streakCells[1];
                        if (lineIndex === undefined) {
                            throw new Error('Missing line booster index');
                        }
                        this.addBoosterSlot(lineIndex, BOOSTERS.LINE, accumulator);
                    }
                    if (streak >= 5) {
                        const centerIndex = streakCells[Math.floor(streakCells.length / 2)];
                        if (centerIndex === undefined) {
                            throw new Error('Missing large blast index');
                        }
                        this.addBoosterSlot(centerIndex, BOOSTERS.BURST_LARGE, accumulator);
                    }
                    accumulator.largestMatch = Math.max(accumulator.largestMatch, streak);
                }
                streak = 1;
            }
        }
    }

    private scanRotatedPatterns(
        baseOffsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number },
        boosterType: BoosterType,
        accumulator: MatchAccumulator
    ): void {
        for (let rotation = 0; rotation < 4; rotation++) {
            const offsets = baseOffsets.map((offset) => this.rotateOffset(offset, rotation));
            const rotatedBoosterOffset = this.rotateOffset(boosterOffset, rotation);
            this.scanPattern(offsets, rotatedBoosterOffset, boosterType, accumulator);
        }
    }

    private scanPattern(
        offsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number } | null,
        boosterType: BoosterType | null,
        accumulator: MatchAccumulator
    ): void {
        const allOffsets = boosterOffset ? offsets.concat([boosterOffset]) : offsets;
        const maxRow = Math.max(...allOffsets.map((offset) => offset.row));
        const maxCol = Math.max(...allOffsets.map((offset) => offset.col));
        for (let r = 0; r <= GRID_SIZE - (maxRow + 1); r++) {
            for (let c = 0; c <= GRID_SIZE - (maxCol + 1); c++) {
                this.checkPatternAt(r, c, offsets, boosterOffset, boosterType, accumulator);
            }
        }
    }

    private checkPatternAt(
        originRow: number,
        originCol: number,
        offsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number } | null,
        boosterType: BoosterType | null,
        accumulator: MatchAccumulator
    ): void {
        let color = '';
        const indices: number[] = [];
        for (const offset of offsets) {
            const row = originRow + offset.row;
            const col = originCol + offset.col;
            const cellColor = this.getColorAt(row, col);
            if (!cellColor) return;
            if (!color) color = cellColor;
            if (cellColor !== color) return;
            indices.push(this.indexAt(row, col));
        }
        indices.forEach((idx) => accumulator.matched.add(idx));
        if (boosterOffset && boosterType) {
            const boosterIndex = this.indexAt(originRow + boosterOffset.row, originCol + boosterOffset.col);
            this.addBoosterSlot(boosterIndex, boosterType, accumulator);
        }
        accumulator.largestMatch = Math.max(accumulator.largestMatch, offsets.length);
    }

    private addBoosterSlot(index: number, type: BoosterType, accumulator: MatchAccumulator): void {
        if (accumulator.boosterSlots.has(index)) return;
        accumulator.boosterSlots.add(index);
        accumulator.boostersToCreate.push({ index, type });
        accumulator.createdBoosterTypes.add(type);
    }

    private getMatchableColor(index: number): string {
        if (this.board.isBlockedIndex(index)) return '';
        if (this.board.isHardCandy(index)) return '';
        const booster = this.board.getCellBooster(index);
        if (booster === BOOSTERS.BURST_LARGE) return '';
        return this.board.getCellColor(index);
    }

    private getColorAt(row: number, col: number): string {
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return '';
        return this.getMatchableColor(this.indexAt(row, col));
    }

    private rotateOffset(offset: { row: number; col: number }, times: number): { row: number; col: number } {
        let row = offset.row;
        let col = offset.col;
        for (let i = 0; i < times; i++) {
            const newRow = col;
            const newCol = 2 - row;
            row = newRow;
            col = newCol;
        }
        return { row, col };
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

    private isSwappable(index: number): boolean {
        if (this.board.isBlockedIndex(index)) return false;
        if (this.board.isHardCandy(index)) return false;
        return Boolean(this.board.getCellColor(index));
    }

    hasAnyValidMove(): boolean {
        const colors = this.getMatchableColorSnapshot();
        for (let i = 0; i < colors.length; i++) {
            if (!this.isSwappable(i)) continue;
            const { row, col } = this.getRowCol(i);
            const neighbors = [
                { row, col: col + 1 },
                { row: row + 1, col }
            ];
            for (const neighbor of neighbors) {
                if (neighbor.row >= GRID_SIZE || neighbor.col >= GRID_SIZE) continue;
                const neighborIndex = this.indexAt(neighbor.row, neighbor.col);
                if (!this.isSwappable(neighborIndex)) continue;
                if (this.swapCreatesMatch(i, neighborIndex, colors)) return true;
            }
        }
        return false;
    }

    private swapCreatesMatch(a: number, b: number, colors: (string | null)[]): boolean {
        const originalA = colors[a] ?? null;
        const originalB = colors[b] ?? null;
        colors[a] = originalB;
        colors[b] = originalA;
        const hasMatch = this.formsMatchAt(a, colors) || this.formsMatchAt(b, colors);
        colors[a] = originalA;
        colors[b] = originalB;
        return hasMatch;
    }

    private formsMatchAt(index: number, colors: (string | null)[]): boolean {
        const color = colors[index];
        if (!color) return false;
        const { row, col } = this.getRowCol(index);
        let horizontal = 1;
        for (let c = col - 1; c >= 0; c--) {
            const neighborColor = colors[this.indexAt(row, c)] ?? null;
            if (neighborColor !== color) break;
            horizontal++;
        }
        for (let c = col + 1; c < GRID_SIZE; c++) {
            const neighborColor = colors[this.indexAt(row, c)] ?? null;
            if (neighborColor !== color) break;
            horizontal++;
        }
        if (horizontal >= 3) return true;

        let vertical = 1;
        for (let r = row - 1; r >= 0; r--) {
            const neighborColor = colors[this.indexAt(r, col)] ?? null;
            if (neighborColor !== color) break;
            vertical++;
        }
        for (let r = row + 1; r < GRID_SIZE; r++) {
            const neighborColor = colors[this.indexAt(r, col)] ?? null;
            if (neighborColor !== color) break;
            vertical++;
        }
        return vertical >= 3;
    }

    private getMatchableColorSnapshot(): (string | null)[] {
        const snapshot: (string | null)[] = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const color = this.getMatchableColor(i);
            snapshot.push(color || null);
        }
        return snapshot;
    }

    private animateBoardEntry(): void {
        const duration = this.renderer.playSpawnAnimation();
        this.defer(() => {
            this.boardAnimating = false;
            this.syncPowerupToolbarLock();
        }, duration);
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
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
        return this.renderer.isModalVisible();
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
}

export { Match3Game };

import { GRID_SIZE, BOOSTERS, BLACK_BOMB_COLOR, BoosterType, randomColor, getColorKeyFromHex } from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { GameState, GoalProgress, LevelDefinition, LevelGoal, SwapMode, SwipeDirection } from './types.js';
import { getRequiredElement } from './dom.js';
import { LEVELS, describeGoal, getLevelDefinition } from './levels.js';

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

class Match3Game {
    constructor() {
        this.gameEl = getRequiredElement('game');
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.board = new Board(
            this.gameEl,
            (cell) => this.handleCellClick(cell),
            (cell, direction) => this.handleCellSwipe(cell, direction)
        );
        this.swapMode = this.hud.getSwapMode();
        this.hud.onSwapModeChange((mode) => {
            this.swapMode = mode;
        });
        this.hud.onAudioToggle((enabled) => {
            const active = this.sounds.setEnabled(enabled);
            if (active !== enabled) {
                this.hud.setAudioEnabled(active);
            }
        });
        this.hud.initOptionsMenu();
        this.hud.setAudioEnabled(this.sounds.isEnabled());
        this.state = {
            selected: null,
            score: 0,
            level: 1,
            targetScore: 0,
            movesLeft: 0,
            goals: [],
            difficulty: 'easy',
            comboMultiplier: 1
        };

        this.generation = 0;
        this.pendingTimers = [];

        this.modalEl = getRequiredElement('result-modal');
        this.modalTitle = getRequiredElement('result-title');
        this.modalText = getRequiredElement('result-text');
        this.modalButton = getRequiredElement('result-button');
        this.modalCallback = null;
        this.moveActive = false;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
        this.moveEvaluationEl = getRequiredElement('move-evaluation');
        this.moveEvaluationTimer = null;

        this.modalButton.addEventListener('click', () => this.hideResultModal());
        this.modalEl.addEventListener('click', (event) => {
            if (event.target === this.modalEl) {
                this.hideResultModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modalEl.classList.contains('game__modal--visible')) {
                this.hideResultModal();
            }
        });
        this.boardAnimating = false;
    }

    private gameEl: HTMLElement;
    private sounds: SoundManager;
    private hud: Hud;
    private board: Board;
    private state: GameState;
    private swapMode: SwapMode;
    private generation: number;
    private pendingTimers: number[];
    private modalEl: HTMLElement;
    private modalTitle: HTMLElement;
    private modalText: HTMLElement;
    private modalButton: HTMLButtonElement;
    private modalCallback: (() => void) | null;
    private moveActive: boolean;
    private currentMoveScore: number;
    private currentMoveBaseScore: number;
    private moveEvaluationEl: HTMLElement;
    private moveEvaluationTimer: number | null;
    private readonly baseCellPoints = 10;
    private readonly minMultiplier = 0.5;
    private readonly maxMultiplier = 5;
    private readonly maxBombDropChance = 0.05; // 5%
    private levelDefinition!: LevelDefinition;
    private boardAnimating: boolean;

    start(): void {
        this.hud.closeOptions();
        this.initLevel(1);
        this.createBoard();
    }

    stop(): void {
        this.generation++;
        this.clearPendingTimers();
        this.board.clear();
        this.resetMoveTracking();
        this.moveEvaluationEl.classList.remove('game__move-evaluation--visible');
        if (this.moveEvaluationTimer !== null) {
            clearTimeout(this.moveEvaluationTimer);
            this.moveEvaluationTimer = null;
        }
        this.hud.resetStatus();
    }

    onExitGameRequested(handler: () => void): void {
        this.hud.onExitGame(handler);
    }

    closeOptions(): void {
        this.hud.closeOptions();
    }

    private screenShake(): void {
        this.gameEl.classList.add('game__board--shake');
        setTimeout(() => this.gameEl.classList.remove('game__board--shake'), 350);
    }

    private updateHud(): void {
        this.hud.render(this.state);
    }

    private initLevel(levelNumber: number): void {
        const definition = getLevelDefinition(levelNumber);
        this.levelDefinition = definition;
        this.state = {
            selected: null,
            score: 0,
            level: definition.id,
            targetScore: definition.targetScore,
            movesLeft: definition.moves,
            goals: this.createGoals(definition.goals),
            difficulty: definition.difficulty,
            comboMultiplier: 1
        };
    }

    private createGoals(levelGoals: LevelGoal[]): GoalProgress[] {
        return levelGoals.map((goal) => ({
            ...goal,
            current: 0,
            description: describeGoal(goal)
        }));
    }

    private createBoard(): void {
        this.generation++;
        this.clearPendingTimers();
        this.boardAnimating = true;
        const boardConfig: { blockedCells?: number[]; hardCandies?: number[] } = {};
        if (this.levelDefinition.missingCells) boardConfig.blockedCells = this.levelDefinition.missingCells;
        if (this.levelDefinition.hardCandies) boardConfig.hardCandies = this.levelDefinition.hardCandies;
        this.board.create(boardConfig);
        this.resetMoveTracking();
        this.renderMultiplierStatus(0, 0);
        this.updateHud();
        this.animateBoardEntry();
    }

    private handleCellClick(cell: HTMLDivElement): void {
        if (this.boardAnimating) return;
        if (this.moveActive) return;
        if (this.state.movesLeft <= 0) return;

        const booster = this.board.getCellBooster(cell);
        if (booster === BOOSTERS.BURST_LARGE) {
            this.activateBooster(cell, true);
            return;
        }

        if (!this.state.selected) {
            this.state.selected = cell;
            cell.classList.add('game__cell--selected');
            return;
        }

        if (cell === this.state.selected) {
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = null;
            return;
        }

        if (!this.areAdjacent(this.state.selected, cell)) {
            this.showInvalidMove(this.state.selected);
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = cell;
            cell.classList.add('game__cell--selected');
            return;
        }

        const firstSelected = this.state.selected;
        this.state.selected.classList.remove('game__cell--selected');
        this.state.selected = null;
        this.trySwap(firstSelected, cell);
    }

    private handleCellSwipe(cell: HTMLDivElement, direction: SwipeDirection): void {
        if (this.boardAnimating) return;
        if (this.moveActive) return;
        if (this.state.movesLeft <= 0) return;
        const neighbor = this.getNeighbor(cell, direction);
        if (!neighbor) return;
        if (this.state.selected) {
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = null;
        }
        this.trySwap(cell, neighbor);
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
            this.screenShake();
            matched.forEach((idx) => {
                const cell = this.board.getCell(idx);
                const booster = this.board.getCellBooster(cell);
                if (booster !== BOOSTERS.NONE) {
                    this.activateBooster(cell, false);
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

        if (this.isLevelComplete()) {
            this.endLevel(true);
            return;
        }

        if (this.state.movesLeft <= 0) this.endLevel(false);
    }

    private softenAdjacentHardCandies(matched: Set<number>): void {
        if (matched.size === 0) return;
        const softened = new Set<number>();
        matched.forEach((idx) => {
            const { row, col } = this.getRowCol(idx);
            this.getAdjacentIndices(row, col).forEach((neighbor) => {
                if (softened.has(neighbor)) return;
                if (this.board.isBlockedIndex(neighbor)) return;
                const cell = this.board.getCell(neighbor);
                if (!this.board.isHardCandy(cell)) return;
                this.board.softenCandy(cell);
                softened.add(neighbor);
            });
        });
    }

    private destroyCell(index: number): void {
        const cell = this.board.getCell(index);
        if (this.board.isBlockedIndex(index)) return;
        if (this.board.isHardCandy(cell)) {
            this.board.softenCandy(cell);
            return;
        }
        const booster = this.board.getCellBooster(cell);
        const color = this.board.getCellColor(cell);
        if ((!color && booster === BOOSTERS.NONE) || cell.classList.contains('game__cell--explode')) return;
        cell.classList.add('game__cell--explode');
        this.defer(() => {
            this.board.clearCell(cell);
            this.awardScore(this.baseCellPoints);
            this.updateGoalsForDestroyedCell(color);
            this.updateHud();
            this.checkWinCondition();
        }, 300);
    }

    private createBooster(index: number, type: BoosterType): void {
        const cell = this.board.getCell(index);
        if (type === BOOSTERS.BURST_LARGE) {
            this.board.setCellColor(cell, BLACK_BOMB_COLOR);
        } else {
            this.board.setCellColor(cell, randomColor());
        }
        this.board.setBooster(cell, type);
    }

    private activateBooster(cell: HTMLDivElement, consumesMove: boolean): void {
        const index = Number(cell.dataset.index);
        const { row, col } = this.getRowCol(index);
        const booster = this.board.getCellBooster(cell);
        this.updateGoalsForBooster(booster);

        if (consumesMove) {
            this.state.movesLeft--;
            this.beginMove();
        }

        this.executeBoosterEffect(booster, row, col);

        if (consumesMove) {
            this.defer(() => this.dropCells(), 300);
        }
        this.updateHud();
        this.checkWinCondition();
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

    private createFallingBomb(cell: HTMLDivElement): void {
        this.board.setCellColor(cell, randomColor());
        this.board.setBooster(cell, BOOSTERS.BURST_SMALL);
    }

    private dropCells(): void {
        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                const i = r * GRID_SIZE + c;
                if (this.board.isBlockedIndex(i)) continue;
                const cell = this.board.getCell(i);
                if (!this.board.getCellColor(cell)) {
                    for (let k = r - 1; k >= 0; k--) {
                        const sourceIndex = k * GRID_SIZE + c;
                        if (this.board.isBlockedIndex(sourceIndex)) continue;
                        const above = this.board.getCell(sourceIndex);
                        const sourceColor = this.board.getCellColor(above);
                        if (!sourceColor) continue;
                        this.board.setCellColor(cell, sourceColor);
                        this.board.setBooster(cell, this.board.getCellBooster(above));
                        this.board.setHardCandy(cell, this.board.isHardCandy(above));
                        this.board.clearCell(above);
                        break;
                    }
                    if (!this.board.getCellColor(cell)) {
                        if (this.shouldSpawnBombFromDrop()) {
                            this.createFallingBomb(cell);
                        } else {
                            this.board.setCellColor(cell, randomColor());
                            this.board.setBooster(cell, BOOSTERS.NONE);
                        }
                        this.board.setHardCandy(cell, false);
                    }
                }
            }
        }
        this.defer(() => this.checkMatches(), 200);
    }

    private endLevel(didWin: boolean): void {
        const completedLevel = this.state.level;
        const rawNextLevel = didWin ? completedLevel + 1 : completedLevel;
        const nextLevel = Math.min(rawNextLevel, LEVELS.length);
        if (didWin) {
            this.sounds.play('levelUp');
        } else {
            this.sounds.play('levelFail');
        }
        this.showResultModal(didWin ? 'win' : 'lose', completedLevel, nextLevel, () => {
            this.initLevel(nextLevel);
            this.createBoard();
        });
    }

    private areAdjacent(a: HTMLDivElement, b: HTMLDivElement): boolean {
        const { row: aRow, col: aCol } = this.getRowCol(Number(a.dataset.index));
        const { row: bRow, col: bCol } = this.getRowCol(Number(b.dataset.index));
        return Math.abs(aRow - bRow) + Math.abs(aCol - bCol) === 1;
    }

    private getNeighbor(cell: HTMLDivElement, direction: SwipeDirection): HTMLDivElement | null {
        const { row, col } = this.getRowCol(Number(cell.dataset.index));
        let targetRow = row;
        let targetCol = col;
        if (direction === 'up') targetRow--;
        if (direction === 'down') targetRow++;
        if (direction === 'left') targetCol--;
        if (direction === 'right') targetCol++;
        if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) return null;
        const targetIndex = targetRow * GRID_SIZE + targetCol;
        if (this.board.isBlockedIndex(targetIndex)) return null;
        return this.board.getCell(targetIndex);
    }

    private trySwap(first: HTMLDivElement, second: HTMLDivElement): void {
        if (this.board.isBlockedCell(first) || this.board.isBlockedCell(second)) {
            this.showInvalidMove(second);
            return;
        }
        if (!this.areAdjacent(first, second)) {
            this.showInvalidMove(second);
            return;
        }
        this.board.swapCells(first, second);
        if (this.swapMode === 'require-match') {
            const { matched } = this.findMatches();
            if (matched.size === 0) {
                this.board.swapCells(first, second);
                this.resetMoveTracking();
                this.showInvalidMove(second);
                return;
            }
        }
        this.state.movesLeft--;
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

    private showInvalidMove(cell: HTMLDivElement): void {
        cell.classList.add('game__cell--shake');
        this.defer(() => cell.classList.remove('game__cell--shake'), 350);
    }

    private showResultModal(
        result: 'win' | 'lose',
        completedLevel: number,
        nextLevel: number,
        onClose: () => void
    ): void {
        this.modalCallback = onClose;
        if (result === 'win') {
            this.modalTitle.textContent = 'Level ' + completedLevel + ' geschafft!';
            const hasMoreLevels = nextLevel > completedLevel;
            this.modalText.textContent = hasMoreLevels
                ? 'Weiter geht es mit Level ' + nextLevel + '.'
                : 'Du hast alle ' + LEVELS.length + ' Level gemeistert. Spiele das Finale weiter für Highscores.';
        } else {
            this.modalTitle.textContent = 'Level verloren!';
            this.modalText.textContent = 'Versuche es direkt noch einmal.';
        }
        this.modalEl.classList.add('game__modal--visible');
        this.modalButton.focus();
    }

    private hideResultModal(): void {
        if (!this.modalEl.classList.contains('game__modal--visible')) return;
        this.modalEl.classList.remove('game__modal--visible');
        const callback = this.modalCallback;
        this.modalCallback = null;
        if (callback) callback();
    }

    private checkWinCondition(): void {
        if (this.isLevelComplete()) {
            this.endLevel(true);
        }
    }

    private isLevelComplete(): boolean {
        return this.state.score >= this.state.targetScore && this.areGoalsComplete();
    }

    private areGoalsComplete(): boolean {
        return this.state.goals.every((goal) => goal.current >= goal.target);
    }

    private updateGoalsForDestroyedCell(color: string): void {
        const colorKey = getColorKeyFromHex(color);
        if (!colorKey) return;
        this.state.goals = this.state.goals.map((goal) => {
            if (goal.type === 'destroy-color' && goal.color === colorKey) {
                return { ...goal, current: Math.min(goal.target, goal.current + 1) };
            }
            return goal;
        });
    }

    private updateGoalsForBooster(booster: BoosterType): void {
        if (booster === BOOSTERS.NONE) return;
        this.state.goals = this.state.goals.map((goal) => {
            if (goal.type === 'activate-booster' && goal.booster === booster) {
                return { ...goal, current: Math.min(goal.target, goal.current + 1) };
            }
            return goal;
        });
    }

    private awardScore(basePoints: number): void {
        const effective = Math.round(basePoints * this.state.comboMultiplier);
        this.state.score += effective;
        this.currentMoveScore += effective;
        this.currentMoveBaseScore += basePoints;
    }

    private beginMove(): void {
        this.moveActive = true;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
    }

    private resetMoveTracking(): void {
        this.moveActive = false;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
    }

    private finalizeMoveScore(): void {
        if (!this.moveActive) return;
        const delta = this.calculateMultiplierDelta(this.currentMoveScore);
        this.state.comboMultiplier = this.clampMultiplier(this.state.comboMultiplier + delta);
        this.renderMultiplierStatus(delta, this.currentMoveScore);
        this.showMoveEvaluation(this.currentMoveBaseScore);
        this.resetMoveTracking();
        this.updateHud();
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

    private renderMultiplierStatus(delta: number, moveScore: number): void {
        const icon = delta > 0 ? '⬆️' : delta < 0 ? '⬇️' : '✨';
        const formattedMultiplier = 'x' + this.state.comboMultiplier.toFixed(2);
        const scorePart = moveScore > 0 ? ' · +' + moveScore + ' Punkte' : '';
        const prefix = delta > 0 ? 'Starker Zug!' : delta < 0 ? 'Tempo verloren!' : 'Multiplikator';
        this.hud.setStatus(prefix + ' ' + formattedMultiplier + scorePart, icon);
    }

    private showMoveEvaluation(baseMoveScore: number): void {
        const message = this.getMoveEvaluationMessage(baseMoveScore);
        if (!message) return;
        if (this.moveEvaluationTimer !== null) {
            clearTimeout(this.moveEvaluationTimer);
            this.moveEvaluationTimer = null;
        }
        this.moveEvaluationEl.textContent = message;
        this.moveEvaluationEl.classList.add('game__move-evaluation--visible');
        if (this.sounds.isEnabled()) {
            this.speech(message);
        }
        this.moveEvaluationTimer = window.setTimeout(() => {
            this.moveEvaluationEl.classList.remove('game__move-evaluation--visible');
            this.moveEvaluationTimer = null;
        }, 2000);
    }

    private speech(message: string)
    {
        const utterance = new SpeechSynthesisUtterance(message); // message.replace(' ', '… ')
        utterance.onerror = (e) => { console.error("speech error", e); };
        utterance.lang = 'en-US';
        utterance.rate = 1.08;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        window.speechSynthesis.cancel(); // stop previous speech otherwise they can queue.
        //console.log(speechSynthesis.getVoices()); // for `utterance.voice = ...`
        speechSynthesis.speak(utterance);
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
        const cell = this.board.getCell(index);
        if (this.board.isHardCandy(cell)) return '';
        const booster = this.board.getCellBooster(cell);
        if (booster === BOOSTERS.BURST_LARGE) return '';
        return this.board.getCellColor(cell);
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

    private animateBoardEntry(): void {
        const duration = this.board.playSpawnAnimation();
        this.defer(() => {
            this.boardAnimating = false;
        }, duration);
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }
}

export { Match3Game };

import { BoosterType, GRID_SIZE } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { GameState } from './types.js';

class BlockerModeState implements GameModeState {
    readonly id = 'blocker';
    private personalBest: number;
    private moves: number;
    private difficultyTier: number;
    private hardCandyChance: number;
    private readonly hardeningInterval = 6;
    private readonly maxHardCandyChance = 0.55;

    constructor(bestScore: number) {
        this.personalBest = Math.max(0, Math.floor(Number.isFinite(bestScore) ? bestScore : 0));
        this.moves = 0;
        this.difficultyTier = 0;
        this.hardCandyChance = 0.05;
    }

    enter(context: ModeContext): GameState {
        this.moves = 0;
        this.difficultyTier = 0;
        this.hardCandyChance = 0.05;
        const state: GameState = {
            mode: 'blocker',
            selected: null,
            score: 0,
            bestScore: this.personalBest,
            level: 1,
            targetScore: this.computeBlockerTarget(this.personalBest, 0),
            movesLeft: Number.POSITIVE_INFINITY,
            goals: [],
            difficulty: 'easy',
            comboMultiplier: 1
        };
        context.getHud().setStatus('Blocker-Modus gestartet. Überlebe so lange wie möglich.', '♾️');
        return state;
    }

    exit(_context: ModeContext): void {
        // Nothing to clean up yet.
    }

    canStartMove(_state: GameState): boolean {
        return true;
    }

    consumeMove(_state: GameState): void {
        // Blocker mode does not reduce a move counter.
    }

    handleMoveResolved(state: GameState, context: ModeContext): void {
        this.trackBlockerHighScore(state, context);
        this.moves++;
        if (this.moves % this.hardeningInterval === 0) {
            this.difficultyTier++;
            const hardenCount = 1 + Math.floor(this.difficultyTier / 2);
            context.hardenCells(hardenCount);
            this.refreshDifficulty(state);
            context.getHud().setStatus('Mehr harte Bonbons erscheinen!', '🧊');
        }
        this.updateBlockerTargetScore(state);
        context.updateHud(state);
    }

    handleBoardSettled(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    checkForCompletion(state: GameState, context: ModeContext): void {
        if (context.isModalVisible()) return;
        if (context.hasAnyValidMove()) return;
        this.trackBlockerHighScore(state, context);
        context.finishBlockerRun(state.score, this.personalBest);
    }

    handleColorCleared(_state: GameState, _color: string, _context: ModeContext): void {
        // Blocker mode has no color goals.
    }

    handleBoosterUsed(_state: GameState, _booster: BoosterType, _context: ModeContext): void {
        // Blocker mode has no booster goals.
    }

    getBoardConfig(): BoardConfig {
        return { blockerGenerators: this.getStartingGenerators() };
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return Math.random() < this.hardCandyChance;
    }

    onBoardCreated(_state: GameState, context: ModeContext): void {
        context.ensurePlayableBoard(this.getBoardConfig());
    }

    private computeBlockerTarget(bestScore: number, currentScore: number): number {
        return Math.max(500, bestScore, currentScore + 500);
    }

    private updateBlockerTargetScore(state: GameState): void {
        state.targetScore = this.computeBlockerTarget(this.personalBest, state.score);
    }

    private refreshDifficulty(state: GameState): void {
        this.hardCandyChance = Math.min(this.maxHardCandyChance, 0.05 + this.difficultyTier * 0.1);
        state.level = this.difficultyTier + 1;
        state.difficulty = this.mapDifficultyForTier(this.difficultyTier);
    }

    private mapDifficultyForTier(tier: number): GameState['difficulty'] {
        if (tier >= 6) return 'nightmare';
        if (tier >= 4) return 'expert';
        if (tier >= 3) return 'hard';
        if (tier >= 1) return 'normal';
        return 'easy';
    }

    private trackBlockerHighScore(state: GameState, context: ModeContext): void {
        if (state.score <= this.personalBest) return;
        this.personalBest = state.score;
        state.bestScore = this.personalBest;
        this.updateBlockerTargetScore(state);
        context.notifyBlockerHighScore(this.personalBest);
        context.getHud().setStatus('Neuer Highscore!', '🏆');
    }

    private getStartingGenerators(): number[] {
        const edgeSlots = [
            { row: 0, col: 1 },
            { row: 1, col: GRID_SIZE - 1 },
            { row: GRID_SIZE - 1, col: GRID_SIZE - 2 },
            { row: GRID_SIZE - 2, col: 0 }
        ];
        return edgeSlots.map((slot) => slot.row * GRID_SIZE + slot.col);
    }
}

export { BlockerModeState };

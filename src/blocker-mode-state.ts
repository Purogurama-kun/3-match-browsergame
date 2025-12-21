import { BoosterType } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { GameState } from './types.js';

/**
 * Manages the endless blocker mode with escalating difficulty.
 *
 * @class
 */
class BlockerModeState implements GameModeState {
    readonly id = 'blocker';
    private personalBest: number;
    private moves: number;
    private difficultyTier: number;
    private hardCandyChance: number;
    private readonly hardeningInterval = 6;
    private readonly maxHardCandyChance = 0.55;

    /**
     * Creates a blocker mode state with the given best score baseline.
     *
     * @param {number} bestScore - The existing high score used for difficulty seeding.
     */
    constructor(bestScore: number) {
        this.personalBest = Math.max(0, Math.floor(Number.isFinite(bestScore) ? bestScore : 0));
        this.moves = 0;
        this.difficultyTier = 0;
        this.hardCandyChance = 0.05;
    }

    /**
     * Sets up the endless mode and returns the initial game state.
     *
     * @param {ModeContext} context - Shared systems available to the state.
     * @returns {GameState} Fresh game state for blocker mode.
     */
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

    /**
     * Cleans up state resources before leaving the mode.
     *
     * @param {ModeContext} _context - Shared systems available to the state.
     */
    exit(_context: ModeContext): void {
        // Nothing to clean up yet.
    }

    /**
     * Indicates whether a move is allowed to start.
     *
     * @param {GameState} _state - Current game state.
     * @returns {boolean} Always true because blocker mode has no move cap.
     */
    canStartMove(_state: GameState): boolean {
        return true;
    }

    /**
     * Consumes a move when the player acts.
     *
     * @param {GameState} _state - Current game state.
     */
    consumeMove(_state: GameState): void {
        // Blocker mode does not reduce a move counter.
    }

    /**
     * Responds after a move has finished resolving.
     *
     * @param {GameState} state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
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

    /**
     * Reacts when the board has no more cascading actions.
     *
     * @param {GameState} state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
    handleBoardSettled(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    /**
     * Checks whether the run should end.
     *
     * @param {GameState} state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
    checkForCompletion(state: GameState, context: ModeContext): void {
        if (context.isModalVisible()) return;
        if (context.hasAnyValidMove()) return;
        this.trackBlockerHighScore(state, context);
        context.finishBlockerRun(state.score, this.personalBest);
    }

    /**
     * Goal progress updates are not needed in blocker mode.
     *
     * @param {GameState} _state - Current game state.
     * @param {string} _color - Hex color value of the destroyed block.
     * @param {ModeContext} _context - Shared systems available to the state.
     */
    handleColorCleared(_state: GameState, _color: string, _context: ModeContext): void {
        // Blocker mode has no color goals.
    }

    /**
     * Goal progress updates are not needed in blocker mode.
     *
     * @param {GameState} _state - Current game state.
     * @param {BoosterType} _booster - Booster used by the player.
     * @param {ModeContext} _context - Shared systems available to the state.
     */
    handleBoosterUsed(_state: GameState, _booster: BoosterType, _context: ModeContext): void {
        // Blocker mode has no booster goals.
    }

    /**
     * Provides board configuration for the mode.
     *
     * @returns {BoardConfig} Empty configuration because blocker mode uses a full grid.
     */
    getBoardConfig(): BoardConfig {
        return {};
    }

    /**
     * Determines whether a new hard candy should spawn.
     *
     * @param {GameState} _state - Current game state.
     * @returns {boolean} True when the chance threshold is met.
     */
    shouldSpawnHardCandy(_state: GameState): boolean {
        return Math.random() < this.hardCandyChance;
    }

    /**
     * Ensures the initial board has at least one valid move.
     *
     * @param {GameState} _state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
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
}

export { BlockerModeState };

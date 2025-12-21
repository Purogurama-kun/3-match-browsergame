import { BoosterType, getColorKeyFromHex } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { LevelDefinition, GameState, LevelGoal, GoalProgress } from './types.js';
import { describeGoal, getLevelDefinition } from './levels.js';

/**
 * Represents the standard level progression mode.
 *
 * @class
 */
class LevelModeState implements GameModeState {
    readonly id = 'level';
    private levelNumber: number;
    private levelDefinition: LevelDefinition;

    /**
     * Creates a new level mode state for the given level number.
     *
     * @param {number} levelNumber - The level that should be loaded when entering the state.
     */
    constructor(levelNumber: number) {
        this.levelNumber = Math.max(1, levelNumber);
        this.levelDefinition = getLevelDefinition(this.levelNumber);
    }

    /**
     * Initializes the level state and returns the base game state snapshot.
     *
     * @param {ModeContext} _context - Shared systems available to the state.
     * @returns {GameState} Fresh game state for the selected level.
     */
    enter(_context: ModeContext): GameState {
        this.levelDefinition = getLevelDefinition(this.levelNumber);
        return {
            mode: 'level',
            selected: null,
            score: 0,
            bestScore: 0,
            level: this.levelDefinition.id,
            targetScore: this.levelDefinition.targetScore,
            movesLeft: this.levelDefinition.moves,
            goals: this.createGoals(this.levelDefinition.goals),
            difficulty: this.levelDefinition.difficulty,
            comboMultiplier: 1
        };
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
     * @param {GameState} state - Current game state.
     * @returns {boolean} True when at least one move remains.
     */
    canStartMove(state: GameState): boolean {
        return state.movesLeft > 0;
    }

    /**
     * Consumes a move when the player acts.
     *
     * @param {GameState} state - Current game state.
     */
    consumeMove(state: GameState): void {
        if (state.movesLeft > 0) {
            state.movesLeft--;
        }
    }

    /**
     * Responds after a move has finished resolving.
     *
     * @param {GameState} state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
    handleMoveResolved(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
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
     * Checks for win or loss conditions.
     *
     * @param {GameState} state - Current game state.
     * @param {ModeContext} context - Shared systems available to the state.
     */
    checkForCompletion(state: GameState, context: ModeContext): void {
        if (this.isLevelComplete(state)) {
            context.finishLevel('win', state.level);
            return;
        }
        if (state.movesLeft <= 0) {
            context.finishLevel('lose', state.level);
        }
    }

    /**
     * Updates goal progress when a color block is destroyed.
     *
     * @param {GameState} state - Current game state.
     * @param {string} color - Hex color value of the destroyed block.
     * @param {ModeContext} _context - Shared systems available to the state.
     */
    handleColorCleared(state: GameState, color: string, _context: ModeContext): void {
        const colorKey = getColorKeyFromHex(color);
        if (!colorKey) return;
        state.goals = state.goals.map((goal) => {
            if (goal.type === 'destroy-color' && goal.color === colorKey) {
                return { ...goal, current: Math.min(goal.target, goal.current + 1) };
            }
            return goal;
        });
    }

    /**
     * Updates goal progress when a booster is activated.
     *
     * @param {GameState} state - Current game state.
     * @param {BoosterType} booster - Booster used by the player.
     * @param {ModeContext} _context - Shared systems available to the state.
     */
    handleBoosterUsed(state: GameState, booster: BoosterType, _context: ModeContext): void {
        if (booster === 'none') return;
        state.goals = state.goals.map((goal) => {
            if (goal.type === 'activate-booster' && goal.booster === booster) {
                return { ...goal, current: Math.min(goal.target, goal.current + 1) };
            }
            return goal;
        });
    }

    /**
     * Provides board configuration for the level.
     *
     * @returns {BoardConfig} Board setup options such as blocked or hard cells.
     */
    getBoardConfig(): BoardConfig {
        const config: BoardConfig = {};
        if (this.levelDefinition.missingCells) config.blockedCells = this.levelDefinition.missingCells;
        if (this.levelDefinition.hardCandies) config.hardCandies = this.levelDefinition.hardCandies;
        return config;
    }

    /**
     * Hard candy never spawns dynamically in level mode.
     *
     * @param {GameState} _state - Current game state.
     * @returns {boolean} Always false for level mode.
     */
    shouldSpawnHardCandy(_state: GameState): boolean {
        return false;
    }

    private createGoals(levelGoals: LevelGoal[]): GoalProgress[] {
        return levelGoals.map((goal) => ({
            ...goal,
            current: 0,
            description: describeGoal(goal)
        }));
    }

    private isLevelComplete(state: GameState): boolean {
        return state.score >= state.targetScore && this.areGoalsComplete(state);
    }

    private areGoalsComplete(state: GameState): boolean {
        return state.goals.every((goal) => goal.current >= goal.target);
    }
}

export { LevelModeState };

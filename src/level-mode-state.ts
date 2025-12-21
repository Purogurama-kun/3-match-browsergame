import { BoosterType, getColorKeyFromHex } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { LevelDefinition, GameState, LevelGoal, GoalProgress } from './types.js';
import { describeGoal, getLevelDefinition } from './levels.js';

class LevelModeState implements GameModeState {
    readonly id = 'level';
    private levelNumber: number;
    private levelDefinition: LevelDefinition;

    constructor(levelNumber: number) {
        this.levelNumber = Math.max(1, levelNumber);
        this.levelDefinition = getLevelDefinition(this.levelNumber);
    }

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

    exit(_context: ModeContext): void {
        // Nothing to clean up yet.
    }

    canStartMove(state: GameState): boolean {
        return state.movesLeft > 0;
    }

    consumeMove(state: GameState): void {
        if (state.movesLeft > 0) {
            state.movesLeft--;
        }
    }

    handleMoveResolved(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    handleBoardSettled(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    checkForCompletion(state: GameState, context: ModeContext): void {
        if (this.isLevelComplete(state)) {
            context.finishLevel('win', state.level);
            return;
        }
        if (state.movesLeft <= 0) {
            context.finishLevel('lose', state.level);
        }
    }

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

    handleBoosterUsed(state: GameState, booster: BoosterType, _context: ModeContext): void {
        if (booster === 'none') return;
        state.goals = state.goals.map((goal) => {
            if (goal.type === 'activate-booster' && goal.booster === booster) {
                return { ...goal, current: Math.min(goal.target, goal.current + 1) };
            }
            return goal;
        });
    }

    getBoardConfig(): BoardConfig {
        const config: BoardConfig = {};
        if (this.levelDefinition.missingCells) config.blockedCells = this.levelDefinition.missingCells;
        if (this.levelDefinition.hardCandies) config.hardCandies = this.levelDefinition.hardCandies;
        return config;
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return false; // Hard candy never spawns dynamically in level mode.
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

import { BoosterType, getColorKeyFromHex, createFreshPowerupInventory } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { LevelDefinition, GameState, LevelGoal, GoalProgress } from './types.js';
import { describeGoal, getLevelDefinition } from './levels.js';
import { t } from './i18n.js';

class LevelModeState implements GameModeState {
    readonly id = 'level';
    private levelNumber: number;
    private levelDefinition: LevelDefinition;
    private timerId: number | null = null;
    private lastTick = 0;
    private state: GameState | null = null;

    constructor(levelNumber: number) {
        this.levelNumber = Math.max(1, levelNumber);
        this.levelDefinition = getLevelDefinition(this.levelNumber);
    }

    enter(context: ModeContext): GameState {
        this.levelDefinition = getLevelDefinition(this.levelNumber);
        const timeGoal = this.levelDefinition.timeGoalSeconds;
        const state: GameState = {
            mode: 'level',
            selected: null,
            score: 0,
            bestScore: 0,
            level: this.levelDefinition.id,
            targetScore: this.levelDefinition.targetScore,
            movesLeft: this.levelDefinition.moves,
            goals: this.createGoals(this.levelDefinition.goals),
            difficulty: this.levelDefinition.difficulty,
            comboMultiplier: 1,
            powerups: createFreshPowerupInventory()
            ,
            cellShapeMode: 'square'
        };
        if (timeGoal !== undefined) {
            state.timeRemaining = timeGoal;
            state.timeCapacity = timeGoal;
        }
        this.state = state;
        this.startTimer(context);
        return state;
    }

    exit(_context: ModeContext): void {
        this.stopTimer();
        this.state = null;
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
        if (context.isModalVisible()) return;
        this.checkForCompletion(state, context);
        if (context.isModalVisible()) return;
        if (!context.hasAnyValidMove()) {
            context.shuffleBoardWithNotice(t('hud.status.noMoves'));
        }
    }

    checkForCompletion(state: GameState, context: ModeContext): void {
        if (context.isModalVisible()) return;
        if (state.timeRemaining !== undefined && state.timeRemaining <= 0) {
            this.stopTimer();
            context.finishLevel('lose', state.level);
            return;
        }
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

    handleHardCandyHit(state: GameState, context: ModeContext): void {
        let progressed = false;
        state.goals = state.goals.map((goal) => {
            if (goal.type !== 'destroy-hard-candies') return goal;
            progressed = true;
            return { ...goal, current: Math.min(goal.target, goal.current + 1) };
        });
        if (progressed) {
            context.updateHud(state);
        }
    }

    getBoardConfig(): BoardConfig {
        const config: BoardConfig = {};
        if (this.levelDefinition.missingCells) config.blockedCells = this.levelDefinition.missingCells;
        if (this.levelDefinition.hardCandies) config.hardCandies = this.levelDefinition.hardCandies;
        if (this.levelDefinition.cellOverrides) config.cellOverrides = this.levelDefinition.cellOverrides;
        const generators = this.pickBlockerGenerators();
        if (generators.length > 0) {
            config.blockerGenerators = generators;
        }
        return config;
    }

    getBackground(): string | undefined {
        return this.levelDefinition.background;
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return false; // Hard candy never spawns dynamically in level mode.
    }

    private startTimer(context: ModeContext): void {
        const duration = this.levelDefinition.timeGoalSeconds;
        if (duration === undefined) return;
        this.stopTimer();
        this.lastTick = performance.now();
        this.timerId = window.setInterval(() => this.tick(context), 200);
    }

    private stopTimer(): void {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    private tick(context: ModeContext): void {
        if (!this.state) return;
        if (context.isModalVisible()) {
            this.lastTick = performance.now();
            return;
        }
        const now = performance.now();
        const deltaSeconds = (now - this.lastTick) / 1000;
        this.lastTick = now;
        const current = this.state.timeRemaining ?? 0;
        const remaining = Math.max(0, current - deltaSeconds);
        this.state.timeRemaining = remaining;
        if (remaining <= 0) {
            this.stopTimer();
            context.finishLevel('lose', this.state.level);
            return;
        }
        context.updateHud(this.state);
    }

    private createGoals(levelGoals: LevelGoal[]): GoalProgress[] {
        return levelGoals.map((goal) => ({
            ...goal,
            current: 0,
            description: describeGoal(goal)
        }));
    }

    private pickBlockerGenerators(): number[] {
        if (this.levelDefinition.blockerGenerators && this.levelDefinition.blockerGenerators.length > 0) {
            return [...this.levelDefinition.blockerGenerators];
        }
        return [];
    }

    private isLevelComplete(state: GameState): boolean {
        return state.score >= state.targetScore && this.areGoalsComplete(state);
    }

    private areGoalsComplete(state: GameState): boolean {
        return state.goals.every((goal) => goal.current >= goal.target);
    }
}

export { LevelModeState };

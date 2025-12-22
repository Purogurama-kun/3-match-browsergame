import {
    BOOSTERS,
    BoosterType,
    ColorKey,
    getColorKeyFromHex,
    createFreshPowerupInventory
} from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { GoalProgress, GameState, LevelGoal } from './types.js';
import { describeGoal } from './levels.js';

class TimeModeState implements GameModeState {
    readonly id = 'time';
    private bestSurvival: number;
    private timerId: number | null = null;
    private lastTick = 0;
    private difficultyTier = 0;
    private state: GameState | null = null;
    private completedGoals = 0;
    private hasEnded = false;

    private readonly startingTime = 60;
    private readonly scoreTimeFactor = 0.035;
    private readonly goalBonusSeconds = 8;
    private readonly accelerationInterval = 30;
    private readonly accelerationStep = 0.12;
    private readonly hardCandyBaseChance = 0.05;

    constructor(bestSurvival: number) {
        this.bestSurvival = Math.max(0, Math.floor(Number.isFinite(bestSurvival) ? bestSurvival : 0));
    }

    enter(context: ModeContext): GameState {
        this.hasEnded = false;
        this.stopTimer();
        this.difficultyTier = 0;
        this.completedGoals = 0;
        const goals = this.createGoals(2);
        const state: GameState = {
            mode: 'time',
            selected: null,
            score: 0,
            bestScore: this.bestSurvival,
            level: 1,
            targetScore: 0,
            movesLeft: Number.POSITIVE_INFINITY,
            goals,
            difficulty: 'easy',
            comboMultiplier: 1,
            timeRemaining: this.startingTime,
            survivalTime: 0,
            timeCapacity: this.startingTime,
            powerups: createFreshPowerupInventory()
        };
        this.state = state;
        this.startTimer(context);
        context.getHud().setStatus('Überlebe so lange wie möglich. Zeit gibt es für Matches und Ziele.', '⏳');
        return state;
    }

    exit(_context: ModeContext): void {
        this.stopTimer();
        this.state = null;
    }

    canStartMove(state: GameState): boolean {
        return (state.timeRemaining ?? 0) > 0;
    }

    consumeMove(_state: GameState): void {
        // Time mode does not consume discrete moves.
    }

    handleMoveResolved(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    handleBoardSettled(state: GameState, context: ModeContext): void {
        if (!context.hasAnyValidMove()) {
            context.ensurePlayableBoard(this.getBoardConfig());
        }
        this.checkForCompletion(state, context);
    }

    checkForCompletion(state: GameState, context: ModeContext): void {
        if (state.timeRemaining !== undefined && state.timeRemaining <= 0) {
            this.endRun(context);
        }
    }

    handleColorCleared(state: GameState, color: string, context: ModeContext): void {
        const colorKey = getColorKeyFromHex(color);
        if (!colorKey) return;
        this.updateGoals((goal) => goal.type === 'destroy-color' && goal.color === colorKey, state, context);
    }

    handleBoosterUsed(state: GameState, booster: BoosterType, context: ModeContext): void {
        if (booster === BOOSTERS.NONE) return;
        this.updateGoals((goal) => goal.type === 'activate-booster' && goal.booster === booster, state, context);
    }

    handleScoreAwarded(state: GameState, basePoints: number, _context: ModeContext): void {
        this.addTime(state, basePoints * this.scoreTimeFactor);
    }

    getBoardConfig(): BoardConfig {
        return {};
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        const tierBonus = Math.min(0.4, this.difficultyTier * 0.03);
        return Math.random() < this.hardCandyBaseChance + tierBonus;
    }

    onBoardCreated(_state: GameState, context: ModeContext): void {
        context.ensurePlayableBoard(this.getBoardConfig());
    }

    private startTimer(context: ModeContext): void {
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
        if (!this.state || this.hasEnded) return;
        const now = performance.now();
        const deltaSeconds = (now - this.lastTick) / 1000;
        this.lastTick = now;

        const drain = deltaSeconds * this.getDrainMultiplier();
        const currentTime = this.state.timeRemaining ?? 0;
        const remaining = Math.max(0, currentTime - drain);
        this.state.timeRemaining = remaining;
        this.state.survivalTime = (this.state.survivalTime ?? 0) + deltaSeconds;
        this.updateDifficulty(this.state);
        if (remaining <= 0) {
            this.endRun(context);
            return;
        }
        context.updateHud(this.state);
    }

    private getDrainMultiplier(): number {
        return 1 + this.difficultyTier * this.accelerationStep;
    }

    private updateDifficulty(state: GameState): void {
        const survival = state.survivalTime ?? 0;
        const nextTier = Math.floor(survival / this.accelerationInterval);
        if (nextTier === this.difficultyTier) return;
        this.difficultyTier = nextTier;
        state.level = this.difficultyTier + 1;
        state.difficulty = this.mapDifficulty(this.difficultyTier);
    }

    private addTime(state: GameState, seconds: number): void {
        if (seconds <= 0) return;
        const current = state.timeRemaining ?? 0;
        const next = current + seconds;
        state.timeRemaining = next;
        state.timeCapacity = Math.max(state.timeCapacity ?? this.startingTime, next, this.startingTime);
    }

    private updateGoals(
        predicate: (goal: GoalProgress) => boolean,
        state: GameState,
        context: ModeContext
    ): void {
        let completedIndex: number | null = null;
        state.goals = state.goals.map((goal, index) => {
            if (!predicate(goal)) return goal;
            const incremented = { ...goal, current: Math.min(goal.target, goal.current + 1) };
            if (incremented.current >= incremented.target && goal.current < goal.target) {
                completedIndex = index;
                return incremented;
            }
            return incremented;
        });
        if (completedIndex !== null) {
            this.handleGoalCompleted(completedIndex, state, context);
        }
    }

    private handleGoalCompleted(index: number, state: GameState, context: ModeContext): void {
        this.completedGoals++;
        this.addTime(state, this.goalBonusSeconds);
        const nextGoal = this.createGoal();
        state.goals = state.goals.map((goal, idx) => (idx === index ? nextGoal : goal));
        context.getHud().setStatus('Ziel geschafft! +' + this.goalBonusSeconds.toFixed(0) + 's', '⏱️');
        context.updateHud(state);
    }

    private createGoals(count: number): GoalProgress[] {
        return Array.from({ length: count }, () => this.createGoal());
    }

    private createGoal(): GoalProgress {
        const tier = this.difficultyTier;
        const goal = Math.random() < 0.6 ? this.createColorGoal(tier) : this.createBoosterGoal(tier);
        return {
            ...goal,
            current: 0,
            description: describeGoal(goal)
        };
    }

    private createColorGoal(tier: number): LevelGoal {
        const colors: ColorKey[] = ['red', 'amber', 'blue', 'purple', 'green'];
        const color = colors[Math.floor(Math.random() * colors.length)] ?? 'red';
        const base = 8 + tier * 2;
        const target = base + Math.floor(Math.random() * 4);
        return { type: 'destroy-color', color, target };
    }

    private createBoosterGoal(tier: number): LevelGoal {
        const boosters = [BOOSTERS.LINE, BOOSTERS.BURST_SMALL, BOOSTERS.BURST_MEDIUM] as const;
        const pick = boosters[Math.floor(Math.random() * boosters.length)] ?? BOOSTERS.BURST_SMALL;
        const target = 1 + Math.floor(tier / 2);
        return { type: 'activate-booster', booster: pick, target };
    }

    private endRun(context: ModeContext): void {
        if (this.hasEnded || !this.state) return;
        this.hasEnded = true;
        this.stopTimer();
        const finalTime = Math.floor(this.state.survivalTime ?? 0);
        if (finalTime > this.bestSurvival) {
            this.bestSurvival = finalTime;
            this.state.bestScore = this.bestSurvival;
            context.notifyTimeBest(finalTime);
        }
        context.finishTimeRun(finalTime, this.bestSurvival);
    }

    private mapDifficulty(tier: number): GameState['difficulty'] {
        if (tier >= 6) return 'nightmare';
        if (tier >= 4) return 'expert';
        if (tier >= 3) return 'hard';
        if (tier >= 1) return 'normal';
        return 'easy';
    }
}

export { TimeModeState };

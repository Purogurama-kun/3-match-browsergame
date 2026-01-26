import {
    BOOSTERS,
    BoosterType,
    getColorKeyFromHex,
    createFreshPowerupInventory
} from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { getTimeModeConfig, mapDifficultyFromTier, type TimeModeConfig } from './mode-config.js';
import { GoalProgress, GameState, LevelGoal, ActivatableBoosterType } from './types.js';
import { describeGoal } from './levels.js';
import { t } from './i18n.js';

class TimeModeState implements GameModeState {
    readonly id = 'time';
    private bestSurvival: number;
    private timerId: number | null = null;
    private lastTick = 0;
    private difficultyTier = 0;
    private state: GameState | null = null;
    private completedGoals = 0;
    private hasEnded = false;
    private config: TimeModeConfig;

    constructor(bestSurvival: number) {
        this.bestSurvival = Math.max(0, Math.floor(Number.isFinite(bestSurvival) ? bestSurvival : 0));
        this.config = getTimeModeConfig();
    }

    enter(context: ModeContext): GameState {
        this.config = getTimeModeConfig();
        this.hasEnded = false;
        this.stopTimer();
        this.difficultyTier = 0;
        this.completedGoals = 0;
        const goals = this.createGoals(this.config.goalCount);
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
            comboChainBonus: 0,
            timeRemaining: this.config.startingTime,
            survivalTime: 0,
            timeCapacity: this.config.startingTime,
            timeDrainMultiplier: this.getDrainMultiplier(),
            powerups: createFreshPowerupInventory()
            ,
            cellShapeMode: 'square'
        };
        this.state = state;
        this.startTimer(context);
        context.getHud().setStatus(t('time.status.started'), '⏳');
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
        if (context.isModalVisible()) return;
        this.checkForCompletion(state, context);
        if (context.isModalVisible()) return;
        if (!context.hasAnyValidMove()) {
            context.shuffleBoardWithNotice(t('hud.status.noMoves'));
        }
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

    handleHardCandyHit(_state: GameState, _context: ModeContext): void {
        // Time mode ignores hard candy goals.
    }

    handleScoreAwarded(state: GameState, basePoints: number, _context: ModeContext): void {
        this.addTime(state, basePoints * this.config.scoreTimeFactor);
    }

    getBoardConfig(): BoardConfig {
        return {};
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        const tierBonus = Math.min(
            this.config.hardCandyChanceMaxBonus,
            this.difficultyTier * this.config.hardCandyChancePerTier
        );
        return Math.random() < this.config.hardCandyBaseChance + tierBonus;
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
        if (context.isModalVisible()) {
            this.lastTick = performance.now();
            return;
        }
        const now = performance.now();
        const deltaSeconds = (now - this.lastTick) / 1000;
        this.lastTick = now;

        const drain = deltaSeconds * this.getDrainMultiplier();
        const currentTime = this.state.timeRemaining ?? 0;
        const remaining = Math.max(0, currentTime - drain);
        this.state.timeRemaining = remaining;
        this.state.survivalTime = (this.state.survivalTime ?? 0) + deltaSeconds;
        this.updateDifficulty(this.state);
        this.state.timeDrainMultiplier = this.getDrainMultiplier();
        if (remaining <= 0) {
            this.endRun(context);
            return;
        }
        context.updateHud(this.state);
    }

    private getDrainMultiplier(): number {
        return this.config.baseDrainMultiplier + this.difficultyTier * this.config.accelerationStep;
    }

    private updateDifficulty(state: GameState): void {
        const survival = state.survivalTime ?? 0;
        const nextTier = Math.floor(survival / this.config.accelerationIntervalSeconds);
        if (nextTier === this.difficultyTier) return;
        this.difficultyTier = nextTier;
        state.level = this.difficultyTier + 1;
        state.difficulty = mapDifficultyFromTier(this.difficultyTier, this.config.difficultyTiers);
    }

    private addTime(state: GameState, seconds: number): void {
        if (seconds <= 0) return;
        const current = state.timeRemaining ?? 0;
        const next = current + seconds;
        state.timeRemaining = next;
        state.timeCapacity = Math.max(state.timeCapacity ?? this.config.startingTime, next, this.config.startingTime);
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
        this.addTime(state, this.config.goalBonusSeconds);
        const otherGoals = state.goals
            .filter((_, idx) => idx !== index)
            .map((goal) => this.goalProgressToDefinition(goal));
        const nextGoal = this.createGoalProgress(otherGoals);
        state.goals = state.goals.map((goal, idx) => (idx === index ? nextGoal : goal));
        context.getHud().setStatus(
            t('time.status.goalComplete', { seconds: this.config.goalBonusSeconds.toFixed(0) }),
            '⏱️'
        );
        context.updateHud(state);
    }

    private createGoals(count: number): GoalProgress[] {
        const goals: GoalProgress[] = [];
        for (let i = 0; i < count; i++) {
            const exclude = goals.map((goal) => this.goalProgressToDefinition(goal));
            goals.push(this.createGoalProgress(exclude));
        }
        return goals;
    }

    private createGoalProgress(exclude: LevelGoal[]): GoalProgress {
        const goal = this.createUniqueLevelGoal(exclude);
        return {
            ...goal,
            current: 0,
            description: describeGoal(goal)
        };
    }

    private createColorGoal(tier: number): LevelGoal {
        const colors = this.config.colorGoalPool;
        const color = colors[Math.floor(Math.random() * colors.length)] ?? 'red';
        const base = this.config.colorGoalBase + tier * this.config.colorGoalTierStep;
        const target = base + Math.floor(Math.random() * this.config.colorGoalRandomRange);
        return { type: 'destroy-color', color, target };
    }

    private createBoosterGoal(tier: number): LevelGoal {
        const boosters = this.config.boosterGoalPool;
        const pick = (boosters[Math.floor(Math.random() * boosters.length)] ??
            BOOSTERS.BURST_SMALL) as ActivatableBoosterType;
        const target = 1 + Math.floor(tier / this.config.boosterGoalTierDivisor);
        return { type: 'activate-booster', booster: pick, target };
    }

    private createUniqueLevelGoal(exclude: LevelGoal[]): LevelGoal {
        const tier = this.difficultyTier;
        let candidate: LevelGoal = this.createColorGoal(tier);
        for (let attempt = 0; attempt < this.config.uniqueGoalAttempts; attempt++) {
            candidate =
                Math.random() < this.config.colorGoalChance
                    ? this.createColorGoal(tier)
                    : this.createBoosterGoal(tier);
            if (!this.isDuplicateGoal(candidate, exclude)) {
                return candidate;
            }
        }
        return candidate;
    }

    private isDuplicateGoal(goal: LevelGoal, existing: LevelGoal[]): boolean {
        return existing.some((other) => {
            if (goal.type !== other.type) return false;
            if (goal.type === 'destroy-color' && other.type === 'destroy-color') {
                return goal.color === other.color;
            }
            if (goal.type === 'activate-booster' && other.type === 'activate-booster') {
                return goal.booster === other.booster;
            }
            if (goal.type === 'destroy-hard-candies' && other.type === 'destroy-hard-candies') {
                return true;
            }
            return false;
        });
    }

    private goalProgressToDefinition(goal: GoalProgress): LevelGoal {
        if (goal.type === 'destroy-color') {
            return { type: 'destroy-color', color: goal.color, target: goal.target };
        }
        if (goal.type === 'activate-booster') {
            return { type: 'activate-booster', booster: goal.booster, target: goal.target };
        }
        return { type: 'destroy-hard-candies', target: goal.target };
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

}

export { TimeModeState };

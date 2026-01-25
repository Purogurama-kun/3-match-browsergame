import { BoosterType, ColorKey, TacticalPowerup } from './constants.js';

type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'nightmare';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

type GameMode = 'level' | 'blocker' | 'time' | 'leaderboard';

type LeaderboardMode = Extract<GameMode, 'level' | 'blocker' | 'time'>;
type LeaderboardScope = 'global' | 'personal';

type LeaderboardEntry = {
    playerName: string;
    completedAt: string;
    nationality?: string | null;
    level?: number;
    score?: number;
    timeSeconds?: number;
    isLocalEntry?: boolean;
};

type LeaderboardIdentity = {
    id: string;
    name: string;
    nationality?: string | null;
};

type GoalType = 'destroy-color' | 'activate-booster';

type ActivatableBoosterType = Exclude<BoosterType, 'none'>;

type DestroyColorGoal = {
    type: 'destroy-color';
    color: ColorKey;
    target: number;
};

type ActivateBoosterGoal = {
    type: 'activate-booster';
    booster: ActivatableBoosterType;
    target: number;
};

type DestroyHardCandiesGoal = {
    type: 'destroy-hard-candies';
    target: number;
};

type LevelGoal = DestroyColorGoal | ActivateBoosterGoal | DestroyHardCandiesGoal;

type GoalProgress = (DestroyColorGoal | ActivateBoosterGoal | DestroyHardCandiesGoal) & {
    current: number;
    description: string;
};

type LevelDefinition = {
    id: number;
    moves: number;
    targetScore: number;
    timeGoalSeconds?: number;
    goals: LevelGoal[];
    difficulty: Difficulty;
    background?: string;
    missingCells?: number[];
    hardCandies?: number[];
    blockerGenerators?: number[];
    cellOverrides?: BoardCellOverride[];
};

type PowerupInventory = Record<TacticalPowerup, number>;

type GameState = {
    mode: GameMode;
    selected: number | null;
    score: number;
    bestScore: number;
    level: number;
    targetScore: number;
    movesLeft: number;
    goals: GoalProgress[];
    difficulty: Difficulty;
    comboMultiplier: number;
    timeRemaining?: number;
    survivalTime?: number;
    timeCapacity?: number;
    timeDrainMultiplier?: number;
    powerups: PowerupInventory;
    cellShapeMode: CellShapeMode;
};

type CellShapeMode = 'square' | 'shaped';

type LineOrientation = 'horizontal' | 'vertical';

type BoardCellOverride = {
    index: number;
    color?: string;
    hard?: boolean;
    blocked?: boolean;
    generator?: boolean;
    booster?: BoosterType;
    lineOrientation?: LineOrientation;
    sugarChestStage?: number;
};

export {
    GameState,
    SwipeDirection,
    GoalType,
    ActivatableBoosterType,
    DestroyColorGoal,
    ActivateBoosterGoal,
    GoalProgress,
    LevelDefinition,
    LevelGoal,
    Difficulty,
    GameMode,
    LeaderboardMode,
    LeaderboardScope,
    LeaderboardEntry,
    LeaderboardIdentity,
    PowerupInventory,
    CellShapeMode,
    LineOrientation,
    BoardCellOverride
};

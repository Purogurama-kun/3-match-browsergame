import { BoosterType, ColorKey } from './constants.js';

type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'nightmare';

type SwapMode = 'free-swap' | 'require-match';

type SwipeDirection = 'up' | 'down' | 'left' | 'right';

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

type LevelGoal = DestroyColorGoal | ActivateBoosterGoal;

type GoalProgress = (DestroyColorGoal | ActivateBoosterGoal) & {
    current: number;
    description: string;
};

type LevelDefinition = {
    id: number;
    moves: number;
    targetScore: number;
    goals: LevelGoal[];
    difficulty: Difficulty;
    missingCells?: number[];
    hardCandies?: number[];
};

type GameState = {
    selected: HTMLDivElement | null;
    score: number;
    level: number;
    targetScore: number;
    movesLeft: number;
    goals: GoalProgress[];
    difficulty: Difficulty;
    comboMultiplier: number;
};

export {
    GameState,
    SwapMode,
    SwipeDirection,
    GoalType,
    ActivatableBoosterType,
    DestroyColorGoal,
    ActivateBoosterGoal,
    GoalProgress,
    LevelDefinition,
    LevelGoal,
    Difficulty
};

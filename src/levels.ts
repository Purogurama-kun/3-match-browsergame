import { GRID_SIZE, BOOSTERS, ColorKey, getColorHex } from './constants.js';
import {
    ActivateBoosterGoal,
    BoardCellOverride,
    DestroyColorGoal,
    Difficulty,
    LevelDefinition,
    LevelGoal,
    LineOrientation
} from './types.js';
import { t } from './i18n.js';
import { getStoryActBackground } from './story.js';

const indexAt = (row: number, col: number): number => row * GRID_SIZE + col;

function getBackgroundForLevel(levelId: number): string {
    if (levelId >= 1 && levelId <= 15) {
        return 'assets/images/vendor-plaza.png';
    }
    if (levelId >= 16 && levelId <= 25) {
        return 'assets/images/ribbon-alley.png';
    }
    if (levelId >= 26 && levelId <= 49) {
        return 'assets/images/lantern-bridge.png';
    }
    if (levelId === 50) {
        return 'assets/images/festival.png';
    }
    return 'assets/images/vendor-plaza.png';
}

const CENTER_GAPS = [indexAt(3, 3), indexAt(3, 4), indexAt(4, 3), indexAt(4, 4)];
const CORNER_GAPS = [indexAt(0, 0), indexAt(0, 7), indexAt(7, 0), indexAt(7, 7)];
const DIAGONAL_GAPS = [indexAt(1, 1), indexAt(2, 2), indexAt(5, 5), indexAt(6, 6)];
const EDGE_GAPS = [indexAt(0, 3), indexAt(0, 4), indexAt(7, 3), indexAt(7, 4)];
const STAIR_GAPS = [indexAt(1, 2), indexAt(2, 3), indexAt(3, 4), indexAt(4, 5), indexAt(5, 6)];

const INNER_HARD_SHELL = [indexAt(3, 2), indexAt(3, 5), indexAt(4, 2), indexAt(4, 5)];
const MID_HARD_CROSS = [indexAt(2, 3), indexAt(2, 4), indexAt(5, 3), indexAt(5, 4)];
const EDGE_HARD_GUARDS = [indexAt(1, 1), indexAt(1, 6), indexAt(6, 1), indexAt(6, 6)];
const FINAL_HARD_RING = [indexAt(2, 2), indexAt(2, 5), indexAt(5, 2), indexAt(5, 5), indexAt(3, 3), indexAt(4, 4)];
const GAP_POSITIONS = new Set<number>([
    ...CENTER_GAPS,
    ...CORNER_GAPS,
    ...DIAGONAL_GAPS,
    ...EDGE_GAPS,
    ...STAIR_GAPS
]);
const PLAYABLE_INDICES = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index).filter(
    (index) => !GAP_POSITIONS.has(index)
);
const distanceFromCenter = (index: number): number => {
    const row = Math.floor(index / GRID_SIZE);
    const column = index % GRID_SIZE;
    const center = (GRID_SIZE - 1) / 2;
    return Math.abs(row - center) + Math.abs(column - center);
};
const SORTED_PLAYABLE_INDICES = [...PLAYABLE_INDICES].sort((a, b) => {
    const diff = distanceFromCenter(a) - distanceFromCenter(b);
    return diff !== 0 ? diff : a - b;
});
const CORE_HARD_FIELD = SORTED_PLAYABLE_INDICES.slice(0, 28);
const DENSE_HARD_FIELD = SORTED_PLAYABLE_INDICES.slice(0, 34);
const MASSIVE_HARD_FIELD = SORTED_PLAYABLE_INDICES.slice(0, 40);

const BOARD_TOKEN_COLORS: Record<string, ColorKey> = {
    R: 'red',
    A: 'amber',
    B: 'blue',
    P: 'purple',
    G: 'green'
};

const BOARD_TOKEN_BOOSTERS: Record<string, { booster: ActivateBoosterGoal['booster']; lineOrientation?: LineOrientation }> = {
    L: { booster: BOOSTERS.LINE, lineOrientation: 'horizontal' },
    V: { booster: BOOSTERS.LINE, lineOrientation: 'vertical' },
    S: { booster: BOOSTERS.BURST_SMALL },
    M: { booster: BOOSTERS.BURST_MEDIUM },
    U: { booster: BOOSTERS.BURST_LARGE }
};


type LevelDifficultyValue = Difficulty | number;

type BoardLayoutInput = {
    rows: string[];
};

type LevelDefinitionInput = Omit<LevelDefinition, 'difficulty' | 'cellOverrides'> & {
    difficulty: LevelDifficultyValue;
    board?: BoardLayoutInput;
};

const RAW_LEVELS: LevelDefinitionInput[] = [
    {
        id: 1,
        moves: 20,
        targetScore: 300,
        difficulty: 1,
        goals: [{ type: 'destroy-color', color: 'red', target: 10 }]
    },
    {
        id: 2,
        moves: 22,
        targetScore: 500,
        difficulty: 2,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 12 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 2 }
        ]
    },
    {
        id: 3,
        moves: 22,
        targetScore: 700,
        difficulty: 3,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 14 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 2 }
        ]
    },
    {
        id: 4,
        moves: 24,
        targetScore: 950,
        difficulty: 4,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 15 },
            { type: 'destroy-color', color: 'green', target: 12 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 2 }
        ]
    },
    {
        id: 5,
        moves: 26,
        targetScore: 1250,
        difficulty: 5,
        goals: [
            { type: 'destroy-color', color: 'red', target: 18 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ]
    },
    {
        id: 6,
        moves: 24,
        targetScore: 1550,
        difficulty: 6,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 18 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 2 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 2 }
        ]
    },
    {
        id: 7,
        moves: 24,
        targetScore: 1850,
        difficulty: 7,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 20 },
            { type: 'destroy-color', color: 'purple', target: 16 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 2 }
        ]
    },
    {
        id: 8,
        moves: 22,
        targetScore: 2150,
        timeGoalSeconds: 180,
        difficulty: 8,
        goals: [
            { type: 'destroy-color', color: 'green', target: 20 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 3 }
        ]
    },
    {
        id: 9,
        moves: 22,
        targetScore: 2550,
        difficulty: 9,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 22 },
            { type: 'destroy-color', color: 'red', target: 20 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 }
        ]
    },
    {
        id: 10,
        moves: 22,
        targetScore: 3100,
        difficulty: 12,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 22 },
            { type: 'destroy-color', color: 'purple', target: 20 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 2 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 11,
        moves: 23,
        targetScore: 3600,
        difficulty: 13,
        goals: [
            { type: 'destroy-color', color: 'red', target: 24 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 2 }
        ],
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 12,
        moves: 23,
        targetScore: 4000,
        difficulty: 14,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 24 },
            { type: 'destroy-color', color: 'green', target: 20 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 }
        ],
        missingCells: CORNER_GAPS
    },
    {
        id: 13,
        moves: 22,
        targetScore: 4400,
        difficulty: 15,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 24 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 3 }
        ],
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 14,
        moves: 22,
        targetScore: 4800,
        difficulty: 16,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 26 },
            { type: 'destroy-color', color: 'red', target: 22 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 }
        ],
        missingCells: CENTER_GAPS
    },
    {
        id: 15,
        moves: 21,
        targetScore: 5200,
        timeGoalSeconds: 195,
        difficulty: 17,
        goals: [
            { type: 'destroy-color', color: 'green', target: 26 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 16,
        moves: 21,
        targetScore: 5600,
        difficulty: 18,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 26 },
            { type: 'destroy-color', color: 'blue', target: 24 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 4 }
        ],
        missingCells: DIAGONAL_GAPS
    },
    {
        id: 17,
        moves: 20,
        targetScore: 5800,
        difficulty: 19,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 28 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 }
        ],
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 18,
        moves: 20,
        targetScore: 6200,
        difficulty: 20,
        goals: [
            { type: 'destroy-color', color: 'red', target: 28 },
            { type: 'destroy-color', color: 'green', target: 24 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 }
        ],
        missingCells: EDGE_GAPS
    },
    {
        id: 19,
        moves: 20,
        targetScore: 6600,
        difficulty: 21,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 30 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 20,
        moves: 20,
        targetScore: 7000,
        difficulty: 24,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 28 },
            { type: 'destroy-color', color: 'purple', target: 26 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: STAIR_GAPS,
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 21,
        moves: 21,
        targetScore: 7400,
        difficulty: 25,
        goals: [
            { type: 'destroy-color', color: 'red', target: 30 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 4 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 4 }
        ],
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 22,
        moves: 21,
        targetScore: 7700,
        timeGoalSeconds: 195,
        difficulty: 26,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 30 },
            { type: 'destroy-color', color: 'green', target: 26 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 3 }
        ],
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 23,
        moves: 21,
        targetScore: 8000,
        difficulty: 27,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 30 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 4 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 4 }
        ],
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 24,
        moves: 20,
        targetScore: 8200,
        difficulty: 28,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 32 },
            { type: 'destroy-color', color: 'red', target: 28 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 4 }
        ],
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 25,
        moves: 20,
        targetScore: 8500,
        difficulty: 29,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 32 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 4 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: CORNER_GAPS,
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 26,
        moves: 20,
        targetScore: 9000,
        difficulty: 30,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 32 },
            { type: 'destroy-color', color: 'green', target: 28 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 4 }
        ],
        missingCells: CORNER_GAPS,
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 27,
        moves: 19,
        targetScore: 9500,
        difficulty: 31,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 34 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 4 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 5 }
        ],
        missingCells: CENTER_GAPS,
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 28,
        moves: 19,
        targetScore: 10000,
        difficulty: 32,
        goals: [
            { type: 'destroy-color', color: 'red', target: 34 },
            { type: 'destroy-color', color: 'amber', target: 30 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 4 }
        ],
        missingCells: DIAGONAL_GAPS,
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 29,
        moves: 19,
        targetScore: 10500,
        difficulty: 33,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 34 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: EDGE_GAPS,
        hardCandies: INNER_HARD_SHELL
    },
    {
        id: 30,
        moves: 19,
        targetScore: 11000,
        difficulty: 36,
        goals: [
            { type: 'destroy-color', color: 'green', target: 34 },
            { type: 'destroy-color', color: 'purple', target: 32 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 4 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: [...CENTER_GAPS, ...CORNER_GAPS],
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 31,
        moves: 19,
        targetScore: 11500,
        difficulty: 37,
        goals: [
            { type: 'destroy-color', color: 'red', target: 36 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 5 }
        ],
        missingCells: CENTER_GAPS,
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 32,
        moves: 19,
        targetScore: 12000,
        difficulty: 38,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 36 },
            { type: 'destroy-color', color: 'blue', target: 32 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 5 }
        ],
        missingCells: DIAGONAL_GAPS,
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 33,
        moves: 18,
        targetScore: 12500,
        difficulty: 39,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 36 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: STAIR_GAPS,
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 34,
        moves: 18,
        targetScore: 13000,
        difficulty: 40,
        goals: [
            { type: 'destroy-color', color: 'green', target: 38 },
            { type: 'destroy-color', color: 'red', target: 34 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 5 }
        ],
        missingCells: [...CENTER_GAPS, ...EDGE_GAPS],
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 35,
        moves: 18,
        targetScore: 13500,
        difficulty: 41,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 38 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 6 }
        ],
        missingCells: DIAGONAL_GAPS,
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 36,
        moves: 18,
        targetScore: 14000,
        difficulty: 42,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 38 },
            { type: 'destroy-color', color: 'purple', target: 36 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 5 }
        ],
        missingCells: [...CORNER_GAPS, ...EDGE_GAPS],
        hardCandies: MID_HARD_CROSS
    },
    {
        id: 37,
        moves: 17,
        targetScore: 14500,
        difficulty: 43,
        goals: [
            { type: 'destroy-color', color: 'red', target: 40 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: STAIR_GAPS,
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 38,
        moves: 17,
        targetScore: 15000,
        difficulty: 44,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 40 },
            { type: 'destroy-color', color: 'green', target: 36 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 5 }
        ],
        missingCells: [...CENTER_GAPS, ...CORNER_GAPS],
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 39,
        moves: 17,
        targetScore: 15500,
        difficulty: 45,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 40 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 6 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 6 }
        ],
        missingCells: DIAGONAL_GAPS,
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 40,
        moves: 17,
        targetScore: 16000,
        timeGoalSeconds: 180,
        difficulty: 48,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 40 },
            { type: 'destroy-color', color: 'red', target: 38 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 5 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: [...CENTER_GAPS, ...EDGE_GAPS, ...CORNER_GAPS],
        hardCandies: [...FINAL_HARD_RING, ...EDGE_HARD_GUARDS]
    },
    {
        id: 41,
        moves: 17,
        targetScore: 16500,
        difficulty: 49,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 42 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 6 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 6 }
        ],
        missingCells: [...CENTER_GAPS, ...EDGE_GAPS],
        hardCandies: FINAL_HARD_RING
    },
    {
        id: 42,
        moves: 17,
        targetScore: 17000,
        difficulty: 50,
        goals: [
            { type: 'destroy-color', color: 'green', target: 42 },
            { type: 'destroy-color', color: 'purple', target: 40 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 6 }
        ],
        missingCells: STAIR_GAPS,
        hardCandies: EDGE_HARD_GUARDS
    },
    {
        id: 43,
        moves: 17,
        targetScore: 17500,
        difficulty: 51,
        goals: [
            { type: 'destroy-color', color: 'red', target: 44 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 6 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 2 }
        ],
        missingCells: [...CORNER_GAPS, ...DIAGONAL_GAPS],
        hardCandies: CORE_HARD_FIELD
    },
    {
        id: 44,
        moves: 17,
        targetScore: 18000,
        difficulty: 52,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 44 },
            { type: 'destroy-color', color: 'amber', target: 42 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 6 }
        ],
        missingCells: [...CENTER_GAPS, ...STAIR_GAPS],
        hardCandies: DENSE_HARD_FIELD
    },
    {
        id: 45,
        moves: 17,
        targetScore: 18500,
        timeGoalSeconds: 210,
        difficulty: 53,
        goals: [
            { type: 'destroy-color', color: 'purple', target: 44 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 6 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 7 }
        ],
        missingCells: [...EDGE_GAPS, ...DIAGONAL_GAPS],
        hardCandies: CORE_HARD_FIELD
    },
    {
        id: 46,
        moves: 16,
        targetScore: 19000,
        difficulty: 54,
        goals: [
            { type: 'destroy-color', color: 'green', target: 46 },
            { type: 'destroy-color', color: 'red', target: 44 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 6 }
        ],
        missingCells: [...CORNER_GAPS, ...CENTER_GAPS, ...EDGE_GAPS],
        hardCandies: MASSIVE_HARD_FIELD
    },
    {
        id: 47,
        moves: 16,
        targetScore: 19500,
        difficulty: 55,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 46 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 7 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 2 }
        ],
        missingCells: STAIR_GAPS,
        hardCandies: DENSE_HARD_FIELD
    },
    {
        id: 48,
        moves: 16,
        targetScore: 20000,
        difficulty: 56,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 46 },
            { type: 'destroy-color', color: 'purple', target: 44 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 7 }
        ],
        missingCells: [...CENTER_GAPS, ...DIAGONAL_GAPS],
        hardCandies: DENSE_HARD_FIELD
    },
    {
        id: 49,
        moves: 15,
        targetScore: 20500,
        difficulty: 57,
        goals: [
            { type: 'destroy-color', color: 'red', target: 48 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 7 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 7 }
        ],
        missingCells: [...EDGE_GAPS, ...STAIR_GAPS],
        hardCandies: CORE_HARD_FIELD
    },
    {
        id: 50,
        moves: 16,
        targetScore: 21000,
        difficulty: 60,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 46 },
            { type: 'destroy-color', color: 'green', target: 44 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_MEDIUM, target: 6 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ],
        missingCells: [...CENTER_GAPS, ...CORNER_GAPS, ...EDGE_GAPS],
        hardCandies: MASSIVE_HARD_FIELD
    }
];

const DEFAULT_LEVELS: LevelDefinition[] = RAW_LEVELS.map((definition, index) =>
    normalizeLevelDefinition(definition, index + 1)
);

let LEVELS: LevelDefinition[] = [...DEFAULT_LEVELS];

function normalizeLevelDefinition(definition: LevelDefinitionInput, id: number): LevelDefinition {
    const { board, ...definitionBase } = definition;
    const boardOverrides = board ? parseBoardLayout(board, id) : null;
    const goals = [...definitionBase.goals];
    const resolvedMissingCells = boardOverrides?.blockedCells ?? definitionBase.missingCells;
    const resolvedHardCandies = boardOverrides?.hardCandies ?? definitionBase.hardCandies;
    const resolvedBlockerGenerators =
        boardOverrides?.blockerGenerators ?? definitionBase.blockerGenerators;
    const normalizedTimeGoal =
        definitionBase.timeGoalSeconds !== undefined
            ? Math.max(180, definitionBase.timeGoalSeconds)
            : undefined;
    const hasHardCandyGoal = goals.some((goal) => goal.type === 'destroy-hard-candies');
    if (!hasHardCandyGoal && resolvedHardCandies && resolvedHardCandies.length > 0) {
        goals.push({ type: 'destroy-hard-candies', target: resolvedHardCandies.length });
    }
    const rawBackground = definitionBase.background;
    const resolvedBackground = rawBackground && rawBackground.trim().length > 0
        ? rawBackground
        : getStoryActBackground(id) || getBackgroundForLevel(id);
    return {
        ...definitionBase,
        id,
        difficulty: normalizeDifficulty(definitionBase.difficulty),
        background: resolvedBackground,
        goals,
        ...(resolvedMissingCells ? { missingCells: [...resolvedMissingCells] } : {}),
        ...(resolvedHardCandies ? { hardCandies: [...resolvedHardCandies] } : {}),
        ...(resolvedBlockerGenerators
            ? { blockerGenerators: [...resolvedBlockerGenerators] }
            : {}),
        ...(boardOverrides?.cellOverrides ? { cellOverrides: [...boardOverrides.cellOverrides] } : {}),
        ...(normalizedTimeGoal !== undefined ? { timeGoalSeconds: normalizedTimeGoal } : {})
    };
}

function normalizeDifficulty(value: LevelDifficultyValue): Difficulty {
    if (typeof value === 'string') {
        return value;
    }
    // Preserve the original numeric progression by mapping ranges to named buckets.
    if (value <= 10) {
        return 'easy';
    }
    if (value <= 22) {
        return 'normal';
    }
    if (value <= 35) {
        return 'hard';
    }
    if (value <= 50) {
        return 'expert';
    }
    return 'nightmare';
}

type ParsedBoardLayout = {
    blockedCells: number[];
    hardCandies: number[];
    blockerGenerators: number[];
    cellOverrides: BoardCellOverride[];
};

type ParsedBoardToken = {
    type: string;
    stage: string;
};

function parseBoardLayout(layout: BoardLayoutInput, levelId: number): ParsedBoardLayout | null {
    const rows = layout.rows ?? [];
    if (rows.length !== GRID_SIZE) {
        console.warn(`Level ${levelId}: board rows must be ${GRID_SIZE} lines long.`);
        return null;
    }
    let isValid = true;
    const blockedCells: number[] = [];
    const hardCandies: number[] = [];
    const blockerGenerators: number[] = [];
    const cellOverrides: BoardCellOverride[] = [];
    rows.forEach((row, rowIndex) => {
        const tokens = tokenizeBoardRow(row);
        if (tokens.length !== GRID_SIZE) {
            console.warn(
                `Level ${levelId}: board row ${rowIndex + 1} must have ${GRID_SIZE} cells.`
            );
            isValid = false;
            return;
        }
        tokens.forEach((rawToken, colIndex) => {
            const parsed = parseBoardToken(rawToken);
            const index = rowIndex * GRID_SIZE + colIndex;
            if (!parsed) {
                isValid = false;
                return;
            }
            if (parsed.type === '.') {
                return;
            }
            if (parsed.type === 'X') {
                blockedCells.push(index);
                return;
            }
            if (parsed.type === 'H') {
                hardCandies.push(index);
                const stage = Number(parsed.stage);
                if (stage > 1) {
                    cellOverrides.push({ index, hard: true, hardStage: stage });
                }
                return;
            }
            if (parsed.type === 'T') {
                blockerGenerators.push(index);
                return;
            }
            const colorKey = BOARD_TOKEN_COLORS[parsed.type];
            if (colorKey) {
                cellOverrides.push({ index, color: getColorHex(colorKey) });
                return;
            }
            const boosterToken = BOARD_TOKEN_BOOSTERS[parsed.type];
            if (boosterToken) {
                cellOverrides.push({
                    index,
                    booster: boosterToken.booster,
                    ...(boosterToken.lineOrientation ? { lineOrientation: boosterToken.lineOrientation } : {})
                });
                return;
            }
            if (parsed.type === 'C') {
                const stage = Number(parsed.stage);
                if (stage >= 1 && stage <= 3) {
                    cellOverrides.push({ index, sugarChestStage: stage });
                    return;
                }
            }
            console.warn(`Level ${levelId}: unknown board token "${rawToken}".`);
            isValid = false;
        });
    });
    if (!isValid) {
        return null;
    }
    return { blockedCells, hardCandies, blockerGenerators, cellOverrides };
}

function tokenizeBoardRow(row: string): string[] {
    const trimmed = row.trim();
    if (!trimmed) return [];
    if (/\s/.test(trimmed)) {
        return trimmed.split(/\s+/);
    }
    if (trimmed.length === GRID_SIZE * 2) {
        const tokens: string[] = [];
        for (let i = 0; i < trimmed.length; i += 2) {
            tokens.push(trimmed.slice(i, i + 2));
        }
        return tokens;
    }
    if (trimmed.length === GRID_SIZE) {
        return trimmed.split('');
    }
    return trimmed.split('');
}

function parseBoardToken(rawToken: string): ParsedBoardToken | null {
    const token = rawToken.trim().toUpperCase();
    if (!token) return null;
    if (token.length === 1) {
        if (token === '.') return { type: '.', stage: '1' };
        if (token === '1' || token === '2' || token === '3') {
            return { type: 'C', stage: token };
        }
        return { type: token, stage: '1' };
    }
    const type = token.charAt(0);
    const stage = token.charAt(1);
    if (!stage) return null;
    if (type === '.') {
        return stage === '1' ? { type: '.', stage } : null;
    }
    if (type === 'C') {
        return stage === '1' || stage === '2' || stage === '3' ? { type, stage } : null;
    }
    if (type === 'H') {
        return stage === '1' || stage === '2' || stage === '3' ? { type, stage } : null;
    }
    if (type === 'X' || type === 'T') {
        return stage === '1' ? { type, stage } : null;
    }
    if (BOARD_TOKEN_COLORS[type]) {
        return stage === '1' ? { type, stage } : null;
    }
    if (BOARD_TOKEN_BOOSTERS[type]) {
        return stage === '1' ? { type, stage } : null;
    }
    return null;
}

function setLevelsFromData(raw: unknown): boolean {
    const inputs = extractLevelInputs(raw);
    if (!inputs || inputs.length === 0) {
        console.warn('Level data file is missing or empty. Using bundled defaults.');
        return false;
    }
    LEVELS = inputs.map((definition, index) => normalizeLevelDefinition(definition, index + 1));
    return true;
}

function extractLevelInputs(raw: unknown): LevelDefinitionInput[] | null {
    if (Array.isArray(raw)) {
        return raw as LevelDefinitionInput[];
    }
    if (raw && typeof raw === 'object' && Array.isArray((raw as { levels?: unknown }).levels)) {
        return (raw as { levels: LevelDefinitionInput[] }).levels;
    }
    return null;
}

function getLevelCount(): number {
    return LEVELS.length;
}

function getLevels(): LevelDefinition[] {
    return LEVELS;
}

function getLevelDefinition(levelNumber: number): LevelDefinition {
    const clamped = Math.min(Math.max(1, levelNumber), LEVELS.length);
    const baseDefinition = LEVELS[clamped - 1];
    if (!baseDefinition) {
        throw new Error('Missing level definition for: ' + levelNumber);
    }
    return {
        ...baseDefinition,
        id: clamped,
        ...(baseDefinition.missingCells ? { missingCells: [...baseDefinition.missingCells] } : {}),
        ...(baseDefinition.hardCandies ? { hardCandies: [...baseDefinition.hardCandies] } : {}),
        ...(baseDefinition.blockerGenerators ? { blockerGenerators: [...baseDefinition.blockerGenerators] } : {}),
        ...(baseDefinition.cellOverrides ? { cellOverrides: [...baseDefinition.cellOverrides] } : {}),
        ...(baseDefinition.timeGoalSeconds !== undefined ? { timeGoalSeconds: baseDefinition.timeGoalSeconds } : {})
    };
}

const COLOR_NAME_KEYS: Record<ColorKey, 'color.red' | 'color.amber' | 'color.blue' | 'color.purple' | 'color.green'> = {
    red: 'color.red',
    amber: 'color.amber',
    blue: 'color.blue',
    purple: 'color.purple',
    green: 'color.green'
};

const BOOSTER_LABEL_KEYS: Record<
    ActivateBoosterGoal['booster'],
    'booster.LINE' | 'booster.BURST_SMALL' | 'booster.BURST_MEDIUM' | 'booster.BURST_LARGE'
> = {
    [BOOSTERS.LINE]: 'booster.LINE',
    [BOOSTERS.BURST_SMALL]: 'booster.BURST_SMALL',
    [BOOSTERS.BURST_MEDIUM]: 'booster.BURST_MEDIUM',
    [BOOSTERS.BURST_LARGE]: 'booster.BURST_LARGE'
};

function describeGoal(goal: LevelGoal): string {
    if (goal.type === 'destroy-color') {
        const colorKey = COLOR_NAME_KEYS[goal.color];
        if (!colorKey) {
            throw new Error('Missing color name for: ' + goal.color);
        }
        return t('goal.destroyColor', { target: goal.target, color: t(colorKey) });
    }
    if (goal.type === 'destroy-hard-candies') {
        return t('goal.destroyHardCandies', { target: goal.target });
    }
    const boosterKey = BOOSTER_LABEL_KEYS[goal.booster];
    if (!boosterKey) {
        throw new Error('Missing booster label for: ' + goal.booster);
    }
    return t('goal.activateBooster', { target: goal.target, booster: t(boosterKey) });
}

export { LEVELS, getLevels, getLevelCount, setLevelsFromData, getLevelDefinition, describeGoal };

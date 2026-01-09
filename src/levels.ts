import { GRID_SIZE, BOOSTERS, ColorKey } from './constants.js';
import {
    ActivateBoosterGoal,
    DestroyColorGoal,
    Difficulty,
    LevelDefinition,
    LevelGoal
} from './types.js';
import { t } from './i18n.js';

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

type LevelDifficultyValue = Difficulty | number;
type LevelDefinitionInput = Omit<LevelDefinition, 'difficulty'> & { difficulty: LevelDifficultyValue };

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
        targetScore: 6000,
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
        targetScore: 6500,
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
        targetScore: 7000,
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
        targetScore: 7400,
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
        targetScore: 8300,
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
        targetScore: 8900,
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
        targetScore: 9500,
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
        targetScore: 10100,
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
        targetScore: 10700,
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
        targetScore: 11400,
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
        targetScore: 12100,
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
        targetScore: 12800,
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
        targetScore: 13500,
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
        targetScore: 13800,
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
        targetScore: 15100,
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
        targetScore: 15900,
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
        targetScore: 16700,
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
        targetScore: 17500,
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
        targetScore: 18300,
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
        targetScore: 19100,
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
        targetScore: 19900,
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
        targetScore: 20700,
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
        targetScore: 21500,
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
        targetScore: 21600,
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
        targetScore: 23300,
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
        targetScore: 24200,
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
        targetScore: 25100,
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
        targetScore: 26000,
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
        targetScore: 26900,
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
        targetScore: 27900,
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
        targetScore: 28900,
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
        targetScore: 29900,
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
        targetScore: 30900,
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
        targetScore: 30800,
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

const LEVELS: LevelDefinition[] = RAW_LEVELS.map((definition, index) =>
    normalizeLevelDefinition(definition, index + 1)
);

function normalizeLevelDefinition(definition: LevelDefinitionInput, id: number): LevelDefinition {
    const goals = [...definition.goals];
    const normalizedTimeGoal =
        definition.timeGoalSeconds !== undefined ? Math.max(180, definition.timeGoalSeconds) : undefined;
    if (definition.hardCandies && definition.hardCandies.length > 0) {
        goals.push({ type: 'destroy-hard-candies', target: definition.hardCandies.length });
    }
    return {
        ...definition,
        id,
        difficulty: normalizeDifficulty(definition.difficulty),
        background: getBackgroundForLevel(id),
        goals,
        ...(definition.missingCells ? { missingCells: [...definition.missingCells] } : {}),
        ...(definition.hardCandies ? { hardCandies: [...definition.hardCandies] } : {}),
        ...(definition.blockerGenerators ? { blockerGenerators: [...definition.blockerGenerators] } : {}),
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

export { LEVELS, getLevelDefinition, describeGoal };

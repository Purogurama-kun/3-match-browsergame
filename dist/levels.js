import { BOOSTERS, getColorHex } from './constants.js';
const LEVELS = [
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
        targetScore: 450,
        difficulty: 2,
        goals: [
            { type: 'destroy-color', color: 'amber', target: 12 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 2 }
        ]
    },
    {
        id: 3,
        moves: 22,
        targetScore: 650,
        difficulty: 3,
        goals: [
            { type: 'destroy-color', color: 'blue', target: 14 },
            { type: 'activate-booster', booster: BOOSTERS.LINE, target: 2 }
        ]
    },
    {
        id: 4,
        moves: 24,
        targetScore: 850,
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
        targetScore: 1100,
        difficulty: 5,
        goals: [
            { type: 'destroy-color', color: 'red', target: 18 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_SMALL, target: 3 },
            { type: 'activate-booster', booster: BOOSTERS.BURST_LARGE, target: 1 }
        ]
    }
];
function getLevelDefinition(levelNumber) {
    const index = Math.min(Math.max(1, levelNumber), LEVELS.length) - 1;
    const baseDefinition = LEVELS[index];
    if (!baseDefinition) {
        throw new Error('Missing level definition for: ' + levelNumber);
    }
    if (levelNumber <= LEVELS.length) {
        return baseDefinition;
    }
    const difficultyIncrease = levelNumber - baseDefinition.id;
    return {
        ...baseDefinition,
        id: levelNumber,
        difficulty: baseDefinition.difficulty + difficultyIncrease,
        targetScore: baseDefinition.targetScore + difficultyIncrease * 150
    };
}
function describeGoal(goal) {
    if (goal.type === 'destroy-color') {
        return 'Zerstöre ' + goal.target + ' ' + formatColorName(goal.color) + ' Steine';
    }
    return 'Aktiviere ' + goal.target + ' ' + formatBoosterName(goal.booster);
}
function formatColorName(color) {
    getColorHex(color);
    const nameMap = {
        red: 'rote',
        amber: 'gelbe',
        blue: 'blaue',
        purple: 'violette',
        green: 'grüne'
    };
    const name = nameMap[color];
    if (!name) {
        throw new Error('Missing color name for: ' + color);
    }
    return name;
}
function formatBoosterName(booster) {
    if (booster === BOOSTERS.LINE) {
        return 'Linienbomben';
    }
    if (booster === BOOSTERS.BURST_SMALL) {
        return 'kleine Bomben';
    }
    if (booster === BOOSTERS.BURST_MEDIUM) {
        return 'mittlere Bomben';
    }
    if (booster === BOOSTERS.BURST_LARGE) {
        return 'große Bomben';
    }
    throw new Error('Missing booster label for: ' + booster);
}
export { LEVELS, getLevelDefinition, describeGoal };

import { BOOSTERS, ColorKey, GRID_SIZE } from './constants.js';
import type { ActivatableBoosterType, Difficulty } from './types.js';

type DifficultyTierConfig = {
    normal: number;
    hard: number;
    expert: number;
    nightmare: number;
};

type BlockerModeConfig = {
    targetScoreBase: number;
    targetScoreStep: number;
    hardeningIntervalMoves: number;
    hardenBaseCount: number;
    hardenTierDivisor: number;
    startingHardCandyChance: number;
    hardCandyChancePerTier: number;
    maxHardCandyChance: number;
    generatorIndices: number[];
    difficultyTiers: DifficultyTierConfig;
};

type TimeModeConfig = {
    startingTime: number;
    scoreTimeFactor: number;
    goalBonusSeconds: number;
    accelerationIntervalSeconds: number;
    baseDrainMultiplier: number;
    accelerationStep: number;
    hardCandyBaseChance: number;
    hardCandyChancePerTier: number;
    hardCandyChanceMaxBonus: number;
    goalCount: number;
    colorGoalBase: number;
    colorGoalTierStep: number;
    colorGoalRandomRange: number;
    colorGoalChance: number;
    boosterGoalTierDivisor: number;
    uniqueGoalAttempts: number;
    colorGoalPool: ColorKey[];
    boosterGoalPool: ActivatableBoosterType[];
    difficultyTiers: DifficultyTierConfig;
};

const DEFAULT_DIFFICULTY_TIERS: DifficultyTierConfig = {
    normal: 1,
    hard: 3,
    expert: 4,
    nightmare: 6
};

const DEFAULT_BLOCKER_GENERATOR_SLOTS = [
    { row: 0, col: 1 },
    { row: 1, col: GRID_SIZE - 1 },
    { row: GRID_SIZE - 1, col: GRID_SIZE - 2 },
    { row: GRID_SIZE - 2, col: 0 }
];

const DEFAULT_BLOCKER_MODE_CONFIG: BlockerModeConfig = {
    targetScoreBase: 500,
    targetScoreStep: 500,
    hardeningIntervalMoves: 6,
    hardenBaseCount: 1,
    hardenTierDivisor: 2,
    startingHardCandyChance: 0.05,
    hardCandyChancePerTier: 0.1,
    maxHardCandyChance: 0.55,
    generatorIndices: DEFAULT_BLOCKER_GENERATOR_SLOTS.map((slot) => slot.row * GRID_SIZE + slot.col),
    difficultyTiers: { ...DEFAULT_DIFFICULTY_TIERS }
};

const DEFAULT_TIME_MODE_CONFIG: TimeModeConfig = {
    startingTime: 60,
    scoreTimeFactor: 0.035,
    goalBonusSeconds: 8,
    accelerationIntervalSeconds: 30,
    baseDrainMultiplier: 2,
    accelerationStep: 0.12,
    hardCandyBaseChance: 0.05,
    hardCandyChancePerTier: 0.03,
    hardCandyChanceMaxBonus: 0.4,
    goalCount: 2,
    colorGoalBase: 8,
    colorGoalTierStep: 2,
    colorGoalRandomRange: 4,
    colorGoalChance: 0.6,
    boosterGoalTierDivisor: 2,
    uniqueGoalAttempts: 6,
    colorGoalPool: ['red', 'amber', 'blue', 'purple', 'green'],
    boosterGoalPool: [BOOSTERS.LINE, BOOSTERS.BURST_SMALL, BOOSTERS.BURST_MEDIUM],
    difficultyTiers: { ...DEFAULT_DIFFICULTY_TIERS }
};

let blockerModeConfig: BlockerModeConfig = cloneBlockerModeConfig(DEFAULT_BLOCKER_MODE_CONFIG);
let timeModeConfig: TimeModeConfig = cloneTimeModeConfig(DEFAULT_TIME_MODE_CONFIG);

function getBlockerModeConfig(): BlockerModeConfig {
    return cloneBlockerModeConfig(blockerModeConfig);
}

function getTimeModeConfig(): TimeModeConfig {
    return cloneTimeModeConfig(timeModeConfig);
}

function setBlockerModeConfigFromData(raw: unknown): boolean {
    const parsed = parseBlockerModeConfig(raw);
    if (!parsed) {
        console.warn('Blocker mode config file is missing or invalid. Using bundled defaults.');
        return false;
    }
    blockerModeConfig = parsed;
    return true;
}

function setTimeModeConfigFromData(raw: unknown): boolean {
    const parsed = parseTimeModeConfig(raw);
    if (!parsed) {
        console.warn('Time mode config file is missing or invalid. Using bundled defaults.');
        return false;
    }
    timeModeConfig = parsed;
    return true;
}

function parseBlockerModeConfig(raw: unknown): BlockerModeConfig | null {
    const data = extractConfigObject(raw);
    if (!data) return null;

    const generatorIndices = parseGeneratorIndices(data.generatorSlots ?? data.generatorIndices ?? data.blockerGenerators);

    return {
        targetScoreBase: readInt(data.targetScoreBase, DEFAULT_BLOCKER_MODE_CONFIG.targetScoreBase, { min: 0 }),
        targetScoreStep: readInt(data.targetScoreStep, DEFAULT_BLOCKER_MODE_CONFIG.targetScoreStep, { min: 0 }),
        hardeningIntervalMoves: readInt(
            data.hardeningIntervalMoves,
            DEFAULT_BLOCKER_MODE_CONFIG.hardeningIntervalMoves,
            { min: 1 }
        ),
        hardenBaseCount: readInt(data.hardenBaseCount, DEFAULT_BLOCKER_MODE_CONFIG.hardenBaseCount, { min: 0 }),
        hardenTierDivisor: readInt(
            data.hardenTierDivisor,
            DEFAULT_BLOCKER_MODE_CONFIG.hardenTierDivisor,
            { min: 1 }
        ),
        startingHardCandyChance: readChance(
            data.startingHardCandyChance,
            DEFAULT_BLOCKER_MODE_CONFIG.startingHardCandyChance
        ),
        hardCandyChancePerTier: readChance(
            data.hardCandyChancePerTier,
            DEFAULT_BLOCKER_MODE_CONFIG.hardCandyChancePerTier
        ),
        maxHardCandyChance: readChance(data.maxHardCandyChance, DEFAULT_BLOCKER_MODE_CONFIG.maxHardCandyChance),
        generatorIndices: generatorIndices ?? DEFAULT_BLOCKER_MODE_CONFIG.generatorIndices,
        difficultyTiers: readDifficultyTiers(data.difficultyTiers, DEFAULT_BLOCKER_MODE_CONFIG.difficultyTiers)
    };
}

function parseTimeModeConfig(raw: unknown): TimeModeConfig | null {
    const data = extractConfigObject(raw);
    if (!data) return null;

    const colorGoalPool = parseColorPool(data.colorGoalPool);
    const boosterGoalPool = parseBoosterPool(data.boosterGoalPool);

    return {
        startingTime: readInt(data.startingTime, DEFAULT_TIME_MODE_CONFIG.startingTime, { min: 1 }),
        scoreTimeFactor: readNumber(data.scoreTimeFactor, DEFAULT_TIME_MODE_CONFIG.scoreTimeFactor, { min: 0 }),
        goalBonusSeconds: readNumber(data.goalBonusSeconds, DEFAULT_TIME_MODE_CONFIG.goalBonusSeconds, { min: 0 }),
        accelerationIntervalSeconds: readInt(
            data.accelerationIntervalSeconds,
            DEFAULT_TIME_MODE_CONFIG.accelerationIntervalSeconds,
            { min: 1 }
        ),
        baseDrainMultiplier: readNumber(
            data.baseDrainMultiplier,
            DEFAULT_TIME_MODE_CONFIG.baseDrainMultiplier,
            { min: 0.1 }
        ),
        accelerationStep: readNumber(data.accelerationStep, DEFAULT_TIME_MODE_CONFIG.accelerationStep, { min: 0 }),
        hardCandyBaseChance: readChance(data.hardCandyBaseChance, DEFAULT_TIME_MODE_CONFIG.hardCandyBaseChance),
        hardCandyChancePerTier: readChance(
            data.hardCandyChancePerTier,
            DEFAULT_TIME_MODE_CONFIG.hardCandyChancePerTier
        ),
        hardCandyChanceMaxBonus: readChance(
            data.hardCandyChanceMaxBonus,
            DEFAULT_TIME_MODE_CONFIG.hardCandyChanceMaxBonus
        ),
        goalCount: readInt(data.goalCount, DEFAULT_TIME_MODE_CONFIG.goalCount, { min: 1 }),
        colorGoalBase: readInt(data.colorGoalBase, DEFAULT_TIME_MODE_CONFIG.colorGoalBase, { min: 0 }),
        colorGoalTierStep: readInt(
            data.colorGoalTierStep,
            DEFAULT_TIME_MODE_CONFIG.colorGoalTierStep,
            { min: 0 }
        ),
        colorGoalRandomRange: readInt(
            data.colorGoalRandomRange,
            DEFAULT_TIME_MODE_CONFIG.colorGoalRandomRange,
            { min: 0 }
        ),
        colorGoalChance: readChance(data.colorGoalChance, DEFAULT_TIME_MODE_CONFIG.colorGoalChance),
        boosterGoalTierDivisor: readInt(
            data.boosterGoalTierDivisor,
            DEFAULT_TIME_MODE_CONFIG.boosterGoalTierDivisor,
            { min: 1 }
        ),
        uniqueGoalAttempts: readInt(
            data.uniqueGoalAttempts,
            DEFAULT_TIME_MODE_CONFIG.uniqueGoalAttempts,
            { min: 1 }
        ),
        colorGoalPool: colorGoalPool ?? DEFAULT_TIME_MODE_CONFIG.colorGoalPool,
        boosterGoalPool: boosterGoalPool ?? DEFAULT_TIME_MODE_CONFIG.boosterGoalPool,
        difficultyTiers: readDifficultyTiers(data.difficultyTiers, DEFAULT_TIME_MODE_CONFIG.difficultyTiers)
    };
}

function extractConfigObject(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    const data = raw as Record<string, unknown>;
    if (data.config && typeof data.config === 'object' && !Array.isArray(data.config)) {
        return data.config as Record<string, unknown>;
    }
    return data;
}

function readNumber(
    value: unknown,
    fallback: number,
    options?: { min?: number; max?: number }
): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    let resolved = numeric;
    if (options?.min !== undefined) {
        resolved = Math.max(options.min, resolved);
    }
    if (options?.max !== undefined) {
        resolved = Math.min(options.max, resolved);
    }
    return resolved;
}

function readInt(value: unknown, fallback: number, options?: { min?: number; max?: number }): number {
    return Math.floor(readNumber(value, fallback, options));
}

function readChance(value: unknown, fallback: number): number {
    return readNumber(value, fallback, { min: 0, max: 1 });
}

function parseGeneratorIndices(value: unknown): number[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const indices: number[] = [];
    let hadInvalid = false;
    value.forEach((entry) => {
        if (typeof entry === 'number') {
            const index = Math.floor(entry);
            if (isValidBoardIndex(index)) {
                indices.push(index);
            } else {
                hadInvalid = true;
            }
            return;
        }
        if (entry && typeof entry === 'object') {
            const record = entry as { row?: unknown; col?: unknown };
            const row = Number(record.row);
            const col = Number(record.col);
            if (Number.isFinite(row) && Number.isFinite(col)) {
                const index = Math.floor(row) * GRID_SIZE + Math.floor(col);
                if (isValidBoardIndex(index)) {
                    indices.push(index);
                } else {
                    hadInvalid = true;
                }
                return;
            }
        }
        hadInvalid = true;
    });

    const unique = Array.from(new Set(indices));
    if (unique.length === 0) {
        if (hadInvalid) {
            console.warn('Blocker mode config has invalid generator slots. Using defaults.');
        }
        return null;
    }
    if (hadInvalid) {
        console.warn('Blocker mode config: some generator slots were invalid and ignored.');
    }
    return unique;
}

function isValidBoardIndex(index: number): boolean {
    return index >= 0 && index < GRID_SIZE * GRID_SIZE;
}

function parseColorPool(value: unknown): ColorKey[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const valid: ColorKey[] = ['red', 'amber', 'blue', 'purple', 'green'];
    const pool = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => valid.includes(entry as ColorKey)) as ColorKey[];
    const unique = Array.from(new Set(pool));
    return unique.length > 0 ? unique : null;
}

function parseBoosterPool(value: unknown): ActivatableBoosterType[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const validBoosters = Object.values(BOOSTERS).filter(
        (booster) => booster !== BOOSTERS.NONE
    ) as ActivatableBoosterType[];
    const pool = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => validBoosters.includes(entry as ActivatableBoosterType)) as ActivatableBoosterType[];
    const unique = Array.from(new Set(pool));
    return unique.length > 0 ? unique : null;
}

function readDifficultyTiers(value: unknown, fallback: DifficultyTierConfig): DifficultyTierConfig {
    if (!value || typeof value !== 'object') {
        return { ...fallback };
    }
    const data = value as Record<string, unknown>;
    const normal = readInt(data.normal, fallback.normal, { min: 0 });
    const hard = readInt(data.hard, fallback.hard, { min: 0 });
    const expert = readInt(data.expert, fallback.expert, { min: 0 });
    const nightmare = readInt(data.nightmare, fallback.nightmare, { min: 0 });

    if (!(normal <= hard && hard <= expert && expert <= nightmare)) {
        console.warn('Mode config difficulty tiers are not ordered. Using defaults.');
        return { ...fallback };
    }
    return { normal, hard, expert, nightmare };
}

function cloneBlockerModeConfig(config: BlockerModeConfig): BlockerModeConfig {
    return {
        ...config,
        generatorIndices: [...config.generatorIndices],
        difficultyTiers: { ...config.difficultyTiers }
    };
}

function cloneTimeModeConfig(config: TimeModeConfig): TimeModeConfig {
    return {
        ...config,
        colorGoalPool: [...config.colorGoalPool],
        boosterGoalPool: [...config.boosterGoalPool],
        difficultyTiers: { ...config.difficultyTiers }
    };
}

function mapDifficultyFromTier(tier: number, tiers: DifficultyTierConfig): Difficulty {
    if (tier >= tiers.nightmare) return 'nightmare';
    if (tier >= tiers.expert) return 'expert';
    if (tier >= tiers.hard) return 'hard';
    if (tier >= tiers.normal) return 'normal';
    return 'easy';
}

export {
    BlockerModeConfig,
    TimeModeConfig,
    getBlockerModeConfig,
    getTimeModeConfig,
    setBlockerModeConfigFromData,
    setTimeModeConfigFromData,
    mapDifficultyFromTier
};

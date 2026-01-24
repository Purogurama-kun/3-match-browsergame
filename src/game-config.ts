import { BOOSTERS } from './constants.js';
import type { ActivatableBoosterType } from './types.js';

type ComboMultiplierStep = {
    minScore?: number;
    maxScore?: number;
    exactScore?: number;
    delta: number;
};

type ComboMultiplierConfig = {
    min: number;
    max: number;
    steps: ComboMultiplierStep[];
};

type ScoringConfig = {
    baseCellPoints: number;
    comboMultiplier: ComboMultiplierConfig;
    boosterScoreValues: Record<ActivatableBoosterType, number>;
    evaluation: MoveEvaluationConfig;
};

type MoveEvaluationTier = {
    minScore: number;
    label: string;
    miraTier?: 'legendary' | 'epic' | 'great' | 'good' | 'decent';
};

type MoveEvaluationConfig = {
    tiers: MoveEvaluationTier[];
};

type GameConfig = {
    scoring: ScoringConfig;
};

const DEFAULT_COMBO_STEPS: ComboMultiplierStep[] = [
    { minScore: 150, delta: 0.5 },
    { minScore: 90, delta: 0.35 },
    { minScore: 60, delta: 0.2 },
    { exactScore: 0, delta: -0.3 },
    { maxScore: 29, delta: -0.15 }
];

const DEFAULT_GAME_CONFIG: GameConfig = {
    scoring: {
        baseCellPoints: 10,
        comboMultiplier: {
            min: 0.5,
            max: 5,
            steps: DEFAULT_COMBO_STEPS
        },
        boosterScoreValues: {
            [BOOSTERS.LINE]: 0,
            [BOOSTERS.BURST_SMALL]: 0,
            [BOOSTERS.BURST_MEDIUM]: 0,
            [BOOSTERS.BURST_LARGE]: 0
        },
        evaluation: {
            tiers: [
                { minScore: 1000, label: 'Candy Chaos!', miraTier: 'legendary' },
                { minScore: 800, label: 'Sweetplosion!', miraTier: 'legendary' },
                { minScore: 400, label: 'Candy Blast!', miraTier: 'epic' },
                { minScore: 200, label: 'Candy Frenzy!', miraTier: 'great' },
                { minScore: 100, label: 'Sweet Heat!', miraTier: 'good' },
                { minScore: 60, label: '', miraTier: 'decent' }
            ]
        }
    }
};

let gameConfig: GameConfig = cloneGameConfig(DEFAULT_GAME_CONFIG);

function getGameConfig(): GameConfig {
    return cloneGameConfig(gameConfig);
}

function setGameConfigFromData(raw: unknown): boolean {
    const parsed = parseGameConfig(raw);
    if (!parsed) {
        console.warn('Game config file is missing or invalid. Using bundled defaults.');
        return false;
    }
    gameConfig = parsed;
    return true;
}

function parseGameConfig(raw: unknown): GameConfig | null {
    const data = extractConfigObject(raw);
    if (!data) return null;
    const scoringRaw = data.scoring && typeof data.scoring === 'object' ? (data.scoring as Record<string, unknown>) : {};
    const comboRaw =
        scoringRaw.comboMultiplier && typeof scoringRaw.comboMultiplier === 'object'
            ? (scoringRaw.comboMultiplier as Record<string, unknown>)
            : {};

    const comboMin = readNumber(comboRaw.min, DEFAULT_GAME_CONFIG.scoring.comboMultiplier.min, { min: 0 });
    const comboMax = readNumber(comboRaw.max, DEFAULT_GAME_CONFIG.scoring.comboMultiplier.max, { min: comboMin });
    const steps = readComboSteps(comboRaw.steps, DEFAULT_GAME_CONFIG.scoring.comboMultiplier.steps);

    return {
        scoring: {
            baseCellPoints: readInt(scoringRaw.baseCellPoints, DEFAULT_GAME_CONFIG.scoring.baseCellPoints, { min: 0 }),
            comboMultiplier: {
                min: comboMin,
                max: comboMax,
                steps
            },
            boosterScoreValues: readBoosterScoreValues(
                scoringRaw.boosterScoreValues,
                DEFAULT_GAME_CONFIG.scoring.boosterScoreValues
            ),
            evaluation: readMoveEvaluation(scoringRaw.evaluation, DEFAULT_GAME_CONFIG.scoring.evaluation)
        }
    };
}

function readComboSteps(value: unknown, fallback: ComboMultiplierStep[]): ComboMultiplierStep[] {
    if (!Array.isArray(value)) {
        return fallback.map((step) => ({ ...step }));
    }
    const steps: ComboMultiplierStep[] = [];
    value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const record = entry as Record<string, unknown>;
        const delta = readNumber(record.delta, NaN);
        if (!Number.isFinite(delta)) return;
        const minScore = readOptionalInt(record.minScore, { min: 0 });
        const maxScore = readOptionalInt(record.maxScore, { min: 0 });
        const exactScore = readOptionalInt(record.exactScore, { min: 0 });
        if (minScore === null && maxScore === null && exactScore === null) return;
        steps.push({
            delta,
            ...(minScore !== null ? { minScore } : {}),
            ...(maxScore !== null ? { maxScore } : {}),
            ...(exactScore !== null ? { exactScore } : {})
        });
    });
    if (steps.length === 0) {
        return fallback.map((step) => ({ ...step }));
    }
    return steps;
}

function readBoosterScoreValues(
    value: unknown,
    fallback: Record<ActivatableBoosterType, number>
): Record<ActivatableBoosterType, number> {
    const result: Record<ActivatableBoosterType, number> = { ...fallback };
    if (!value || typeof value !== 'object') {
        return result;
    }
    const record = value as Record<string, unknown>;
    (Object.keys(fallback) as ActivatableBoosterType[]).forEach((key) => {
        if (!(key in record)) return;
        result[key] = readInt(record[key], fallback[key], { min: 0 });
    });
    return result;
}

function readMoveEvaluation(value: unknown, fallback: MoveEvaluationConfig): MoveEvaluationConfig {
    if (!value || typeof value !== 'object') {
        return cloneMoveEvaluation(fallback);
    }
    const record = value as Record<string, unknown>;
    const tiers = Array.isArray(record.tiers) ? record.tiers : null;
    if (!tiers) {
        return cloneMoveEvaluation(fallback);
    }
    const parsed: MoveEvaluationTier[] = [];
    tiers.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const tier = entry as Record<string, unknown>;
        const minScore = readInt(tier.minScore, NaN, { min: 0 });
        if (!Number.isFinite(minScore)) return;
        const label = typeof tier.label === 'string' ? tier.label : '';
        const miraTier =
            tier.miraTier === 'legendary' ||
            tier.miraTier === 'epic' ||
            tier.miraTier === 'great' ||
            tier.miraTier === 'good' ||
            tier.miraTier === 'decent'
                ? tier.miraTier
                : undefined;
        parsed.push({ minScore, label, ...(miraTier ? { miraTier } : {}) });
    });
    if (parsed.length === 0) {
        return cloneMoveEvaluation(fallback);
    }
    parsed.sort((a, b) => b.minScore - a.minScore);
    return { tiers: parsed };
}

function cloneMoveEvaluation(config: MoveEvaluationConfig): MoveEvaluationConfig {
    return {
        tiers: config.tiers.map((tier) => ({ ...tier }))
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

function readOptionalInt(value: unknown, options?: { min?: number; max?: number }): number | null {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return readInt(numeric, Math.floor(numeric), options);
}

function cloneGameConfig(config: GameConfig): GameConfig {
    return {
        scoring: {
            baseCellPoints: config.scoring.baseCellPoints,
            comboMultiplier: {
                min: config.scoring.comboMultiplier.min,
                max: config.scoring.comboMultiplier.max,
                steps: config.scoring.comboMultiplier.steps.map((step) => ({ ...step }))
            },
            boosterScoreValues: { ...config.scoring.boosterScoreValues },
            evaluation: cloneMoveEvaluation(config.scoring.evaluation)
        }
    };
}

export {
    GameConfig,
    ScoringConfig,
    ComboMultiplierStep,
    MoveEvaluationConfig,
    MoveEvaluationTier,
    getGameConfig,
    setGameConfigFromData
};

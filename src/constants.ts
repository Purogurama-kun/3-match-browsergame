const GRID_SIZE = 8;
const COLOR_DEFINITIONS = {
    red: '#ff7b7b',
    amber: '#ffd166',
    blue: '#7dd3fc',
    purple: '#a78bfa',
    green: '#6ee7b7'
} as const;
const COLORS = Object.values(COLOR_DEFINITIONS);
const BOOSTERS = {
    NONE: 'none',
    LINE: 'line',
    BURST_SMALL: 'burstSmall',
    BURST_MEDIUM: 'burstMedium',
    BURST_LARGE: 'burstLarge'
} as const;
const BLACK_BOMB_COLOR = '#0b0d11';

const TACTICAL_POWERUPS = {
    shuffle: {
        icon: '🔀',
        label: 'Mischen',
        description: 'Alle Bonbons neu anordnen'
    },
    switch: {
        icon: '🔁',
        label: 'Switch',
        description: 'Tausche zwei benachbarte Felder ohne Match'
    },
    bomb: {
        icon: '💣',
        label: 'Bombe',
        description: 'Sprengt ein 4×4-Feld deiner Wahl'
    }
} as const;

const TACTICAL_POWERUP_USES = 1;

type BoosterType = typeof BOOSTERS[keyof typeof BOOSTERS];
type ColorKey = keyof typeof COLOR_DEFINITIONS;
type TacticalPowerup = keyof typeof TACTICAL_POWERUPS;
type CandyShape = 'triangle' | 'hexagon' | 'pentagon' | 'round' | 'diamond' | 'square';

const COLOR_SHAPE_CLASS: Record<ColorKey, CandyShape> = {
    red: 'triangle',
    amber: 'hexagon',
    blue: 'pentagon',
    purple: 'round',
    green: 'diamond'
};

const SHAPE_CLASS_NAMES: string[] = [
    'board__cell--shape-triangle',
    'board__cell--shape-hexagon',
    'board__cell--shape-pentagon',
    'board__cell--shape-round',
    'board__cell--shape-diamond',
    'board__cell--shape-square'
];

function createFreshPowerupInventory(): Record<TacticalPowerup, number> {
    const inventory = {} as Record<TacticalPowerup, number>;
    (Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[]).forEach((key) => {
        inventory[key] = TACTICAL_POWERUP_USES;
    });
    return inventory;
}

function randomColor(): string {
    const index = Math.floor(Math.random() * COLORS.length);
    const color = COLORS[index];
    if (!color) {
        throw new Error('Random color index out of range: ' + index);
    }
    return color;
}

function getColorHex(color: ColorKey): string {
    const value = COLOR_DEFINITIONS[color];
    if (!value) {
        throw new Error('Unknown color key: ' + color);
    }
    return value;
}

function getColorKeyFromHex(hex: string): ColorKey | null {
    const entries = Object.entries(COLOR_DEFINITIONS) as [ColorKey, string][];
    for (const [key, value] of entries) {
        if (value === hex) return key;
    }
    return null;
}

export {
    GRID_SIZE,
    COLORS,
    BOOSTERS,
    BLACK_BOMB_COLOR,
    randomColor,
    BoosterType,
    ColorKey,
    getColorHex,
    getColorKeyFromHex,
    TACTICAL_POWERUPS,
    TacticalPowerup,
    CandyShape,
    COLOR_SHAPE_CLASS,
    SHAPE_CLASS_NAMES,
    createFreshPowerupInventory
};

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

type BoosterType = typeof BOOSTERS[keyof typeof BOOSTERS];
type ColorKey = keyof typeof COLOR_DEFINITIONS;

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
    getColorKeyFromHex
};

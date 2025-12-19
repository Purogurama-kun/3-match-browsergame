const GRID_SIZE = 8;
const COLOR_DEFINITIONS = {
    red: '#ff7b7b',
    amber: '#ffd166',
    blue: '#7dd3fc',
    purple: '#a78bfa',
    green: '#6ee7b7'
};
const COLORS = Object.values(COLOR_DEFINITIONS);
const BOOSTERS = {
    NONE: 'none',
    LINE: 'line',
    BURST_SMALL: 'burstSmall',
    BURST_MEDIUM: 'burstMedium',
    BURST_LARGE: 'burstLarge'
};
const BLACK_BOMB_COLOR = '#0b0d11';
function randomColor() {
    const index = Math.floor(Math.random() * COLORS.length);
    const color = COLORS[index];
    if (!color) {
        throw new Error('Random color index out of range: ' + index);
    }
    return color;
}
function getColorHex(color) {
    const value = COLOR_DEFINITIONS[color];
    if (!value) {
        throw new Error('Unknown color key: ' + color);
    }
    return value;
}
function getColorKeyFromHex(hex) {
    const entries = Object.entries(COLOR_DEFINITIONS);
    for (const [key, value] of entries) {
        if (value === hex)
            return key;
    }
    return null;
}
export { GRID_SIZE, COLORS, BOOSTERS, BLACK_BOMB_COLOR, randomColor, getColorHex, getColorKeyFromHex };

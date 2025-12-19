const GRID_SIZE = 8;
const COLORS = ['#ff7b7b', '#ffd166', '#7dd3fc', '#a78bfa', '#6ee7b7'];
const BOOSTERS = {
    NONE: 'none',
    LINE: 'line',
    BURST_SMALL: 'burstSmall',
    BURST_MEDIUM: 'burstMedium',
    BURST_LARGE: 'burstLarge'
};
function randomColor() {
    const index = Math.floor(Math.random() * COLORS.length);
    const color = COLORS[index];
    if (!color) {
        throw new Error('Random color index out of range: ' + index);
    }
    return color;
}
export { GRID_SIZE, COLORS, BOOSTERS, randomColor };

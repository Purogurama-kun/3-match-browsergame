const GRID_SIZE = 8;
const COLORS = ['red', 'yellow', 'green', 'blue', 'purple'];
const BOOSTERS = {
    NONE: 'none',
    LINE: 'line',
    RADIUS: 'radius'
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

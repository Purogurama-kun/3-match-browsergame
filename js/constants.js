const GRID_SIZE = 8;
const COLORS = ['red', 'yellow', 'green', 'blue', 'purple'];
const BOOSTERS = {
    NONE: 'none',
    LINE: 'line',
    RADIUS: 'radius'
};

function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export { GRID_SIZE, COLORS, BOOSTERS, randomColor };

import { GRID_SIZE, BOOSTERS, COLORS, randomColor } from './constants.js';
class Board {
    constructor(gameEl, onCellClick) {
        this.gameEl = gameEl;
        this.onCellClick = onCellClick;
        this.cells = [];
    }
    create() {
        this.cells = [];
        this.gameEl.innerHTML = '';
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'game__cell';
            this.applyColor(cell, this.pickColorForIndex(i));
            cell.dataset.index = String(i);
            cell.dataset.booster = BOOSTERS.NONE;
            cell.addEventListener('click', () => this.onCellClick(cell));
            this.gameEl.appendChild(cell);
            this.cells.push(cell);
        }
    }
    getCell(index) {
        const cell = this.cells[index];
        if (!cell) {
            throw new Error('Missing cell at index: ' + index);
        }
        return cell;
    }
    getCellColor(cell) {
        var _a;
        return (_a = cell.dataset.color) !== null && _a !== void 0 ? _a : '';
    }
    setCellColor(cell, color) {
        this.applyColor(cell, color);
    }
    setBooster(cell, type) {
        cell.dataset.booster = type;
        this.updateBoosterVisual(cell);
    }
    clearCell(cell) {
        cell.classList.remove('game__cell--explode');
        this.setCellColor(cell, '');
        this.setBooster(cell, BOOSTERS.NONE);
        cell.textContent = '';
    }
    updateBoosterVisual(cell) {
        cell.classList.remove('game__cell--bomb-line', 'game__cell--bomb-radius');
        cell.textContent = '';
        if (cell.dataset.booster === BOOSTERS.LINE) {
            cell.classList.add('game__cell--bomb-line');
            cell.textContent = '💣';
        }
        if (cell.dataset.booster === BOOSTERS.RADIUS) {
            cell.classList.add('game__cell--bomb-radius');
            cell.textContent = '💥';
        }
    }
    swapCells(a, b) {
        const colorA = this.getCellColor(a);
        this.setCellColor(a, this.getCellColor(b));
        this.setCellColor(b, colorA);
        [a.dataset.booster, b.dataset.booster] = [b.dataset.booster, a.dataset.booster];
        this.updateBoosterVisual(a);
        this.updateBoosterVisual(b);
    }
    pickColorForIndex(index) {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        const wouldCreateMatch = (color) => {
            const left1 = col >= 1 ? this.getExistingColor(index - 1) : null;
            const left2 = col >= 2 ? this.getExistingColor(index - 2) : null;
            const up1 = row >= 1 ? this.getExistingColor(index - GRID_SIZE) : null;
            const up2 = row >= 2 ? this.getExistingColor(index - 2 * GRID_SIZE) : null;
            const leftMatch = left1 && left2 && left1 === color && left2 === color;
            const upMatch = up1 && up2 && up1 === color && up2 === color;
            return Boolean(leftMatch || upMatch);
        };
        for (let attempt = 0; attempt < COLORS.length * 2; attempt++) {
            const color = randomColor();
            if (!wouldCreateMatch(color))
                return color;
        }
        for (const color of COLORS) {
            if (!wouldCreateMatch(color))
                return color;
        }
        throw new Error('Unable to pick a non-matching color');
    }
    getExistingColor(index) {
        const cell = this.cells[index];
        return cell ? this.getCellColor(cell) : null;
    }
    applyColor(cell, color) {
        cell.dataset.color = color;
        if (color) {
            cell.style.setProperty('--cell-color', color);
        }
        else {
            cell.style.removeProperty('--cell-color');
        }
    }
}
export { Board };

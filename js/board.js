import { GRID_SIZE, BOOSTERS, randomColor } from './constants.js';

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
            cell.className = 'cell';
            cell.style.background = randomColor();
            cell.dataset.index = i;
            cell.dataset.booster = BOOSTERS.NONE;
            cell.addEventListener('click', () => this.onCellClick(cell));
            this.gameEl.appendChild(cell);
            this.cells.push(cell);
        }
    }

    getCell(index) {
        return this.cells[index];
    }

    getCellColor(cell) {
        return cell.style.background;
    }

    setCellColor(cell, color) {
        cell.style.background = color;
    }

    setBooster(cell, type) {
        cell.dataset.booster = type;
        this.updateBoosterVisual(cell);
    }

    clearCell(cell) {
        cell.classList.remove('explode');
        this.setCellColor(cell, '');
        this.setBooster(cell, BOOSTERS.NONE);
        cell.textContent = '';
    }

    updateBoosterVisual(cell) {
        cell.classList.remove('bomb-line', 'bomb-radius');
        cell.textContent = '';
        if (cell.dataset.booster === BOOSTERS.LINE) {
            cell.classList.add('bomb-line');
            cell.textContent = '💣';
        }
        if (cell.dataset.booster === BOOSTERS.RADIUS) {
            cell.classList.add('bomb-radius');
            cell.textContent = '💥';
        }
    }

    swapCells(a, b) {
        [a.style.background, b.style.background] = [b.style.background, a.style.background];
        [a.dataset.booster, b.dataset.booster] = [b.dataset.booster, a.dataset.booster];
        this.updateBoosterVisual(a);
        this.updateBoosterVisual(b);
    }
}

export { Board };

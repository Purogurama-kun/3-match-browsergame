import { GRID_SIZE, BOOSTERS, COLORS, randomColor } from './constants.js';
class Board {
    constructor(gameEl, onCellClick, onCellSwipe) {
        this.gameEl = gameEl;
        this.onCellClick = onCellClick;
        this.onCellSwipe = onCellSwipe;
        this.cells = [];
        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartCell = null;
        this.swipeThreshold = 18;
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
            cell.addEventListener('touchstart', (event) => this.handleTouchStart(event, cell), { passive: false });
            cell.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
            cell.addEventListener('touchend', (event) => this.handleTouchEnd(event), { passive: false });
            cell.addEventListener('touchcancel', () => this.resetTouchState());
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
    getCellBooster(cell) {
        var _a;
        return (_a = cell.dataset.booster) !== null && _a !== void 0 ? _a : BOOSTERS.NONE;
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
        cell.style.removeProperty('color');
    }
    updateBoosterVisual(cell) {
        cell.classList.remove('game__cell--bomb-line', 'game__cell--bomb-radius', 'game__cell--bomb-small', 'game__cell--bomb-medium', 'game__cell--bomb-large', 'game__cell--bomb-ultimate');
        cell.style.color = '#0b0f1d';
        cell.textContent = '';
        if (cell.dataset.booster === BOOSTERS.LINE) {
            cell.classList.add('game__cell--bomb-line');
            cell.textContent = '💣';
        }
        if (cell.dataset.booster === BOOSTERS.BURST_SMALL) {
            cell.classList.add('game__cell--bomb-small');
            cell.textContent = '🧨';
        }
        if (cell.dataset.booster === BOOSTERS.BURST_MEDIUM) {
            cell.classList.add('game__cell--bomb-medium');
            cell.textContent = '💥';
        }
        if (cell.dataset.booster === BOOSTERS.BURST_LARGE) {
            cell.classList.add('game__cell--bomb-large', 'game__cell--bomb-ultimate');
            cell.style.color = '#f8fafc';
            cell.textContent = '☢️';
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
    handleTouchStart(event, cell) {
        if (event.touches.length !== 1)
            return;
        const touch = event.touches[0];
        if (!touch)
            return;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartCell = cell;
    }
    handleTouchMove(event) {
        if (this.touchStartX === null || this.touchStartY === null)
            return;
        if (event.touches.length !== 1)
            return;
        const touch = event.touches[0];
        if (!touch)
            return;
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        if (Math.max(deltaX, deltaY) > 4) {
            event.preventDefault();
        }
    }
    handleTouchEnd(event) {
        if (!this.touchStartCell || this.touchStartX === null || this.touchStartY === null) {
            this.resetTouchState();
            return;
        }
        if (event.changedTouches.length === 0) {
            this.resetTouchState();
            return;
        }
        const touch = event.changedTouches[0];
        if (!touch) {
            this.resetTouchState();
            return;
        }
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const maxDelta = Math.max(absX, absY);
        if (maxDelta < this.swipeThreshold) {
            this.resetTouchState();
            return;
        }
        event.preventDefault();
        const direction = absX > absY ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up';
        this.onCellSwipe(this.touchStartCell, direction);
        this.resetTouchState();
    }
    resetTouchState() {
        this.touchStartCell = null;
        this.touchStartX = null;
        this.touchStartY = null;
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

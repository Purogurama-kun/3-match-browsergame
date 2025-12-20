import { GRID_SIZE, BOOSTERS, BoosterType, COLORS, randomColor } from './constants.js';
import { SwipeDirection } from './types.js';

class Board {
    constructor(
        gameEl: HTMLElement,
        onCellClick: (cell: HTMLDivElement) => void,
        onCellSwipe: (cell: HTMLDivElement, direction: SwipeDirection) => void
    ) {
        this.gameEl = gameEl;
        this.onCellClick = onCellClick;
        this.onCellSwipe = onCellSwipe;
        this.cells = [];
        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartCell = null;
        this.swipeThreshold = 18;
        this.blockedIndices = new Set();
    }

    private gameEl: HTMLElement;
    private onCellClick: (cell: HTMLDivElement) => void;
    private onCellSwipe: (cell: HTMLDivElement, direction: SwipeDirection) => void;
    private cells: HTMLDivElement[];
    private touchStartX: number | null;
    private touchStartY: number | null;
    private touchStartCell: HTMLDivElement | null;
    private swipeThreshold: number;
    private blockedIndices: Set<number>;

    create(config?: { blockedCells?: number[]; hardCandies?: number[] }): void {
        this.blockedIndices = new Set(config?.blockedCells ?? []);
        const hardCandies = new Set(config?.hardCandies ?? []);
        this.cells = [];
        this.gameEl.innerHTML = '';
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'game__cell';
            cell.dataset.index = String(i);
            cell.dataset.booster = BOOSTERS.NONE;
            cell.dataset.blocked = this.blockedIndices.has(i) ? 'true' : 'false';
            cell.dataset.hard = 'false';
            if (this.isBlockedCell(cell)) {
                cell.classList.add('game__cell--void');
                this.gameEl.appendChild(cell);
                this.cells.push(cell);
                continue;
            }
            this.applyColor(cell, this.pickColorForIndex(i));
            this.setHardCandy(cell, hardCandies.has(i));
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

    getCell(index: number): HTMLDivElement {
        const cell = this.cells[index];
        if (!cell) {
            throw new Error('Missing cell at index: ' + index);
        }
        return cell;
    }

    getCellColor(cell: HTMLDivElement): string {
        return cell.dataset.color ?? '';
    }

    getCellBooster(cell: HTMLDivElement): BoosterType {
        return (cell.dataset.booster as BoosterType) ?? BOOSTERS.NONE;
    }

    isBlockedIndex(index: number): boolean {
        return this.blockedIndices.has(index);
    }

    isBlockedCell(cell: HTMLDivElement): boolean {
        return cell.dataset.blocked === 'true';
    }

    isHardCandy(cell: HTMLDivElement): boolean {
        return cell.dataset.hard === 'true';
    }

    setCellColor(cell: HTMLDivElement, color: string): void {
        this.applyColor(cell, color);
    }

    setBooster(cell: HTMLDivElement, type: BoosterType): void {
        cell.dataset.booster = type;
        this.updateBoosterVisual(cell);
    }

    setHardCandy(cell: HTMLDivElement, isHard: boolean): void {
        cell.dataset.hard = isHard ? 'true' : 'false';
        cell.classList.toggle('game__cell--hard', isHard);
    }

    softenCandy(cell: HTMLDivElement): void {
        this.setHardCandy(cell, false);
    }

    clearCell(cell: HTMLDivElement): void {
        cell.classList.remove('game__cell--explode');
        this.setCellColor(cell, '');
        this.setBooster(cell, BOOSTERS.NONE);
        cell.textContent = '';
        cell.style.removeProperty('color');
        this.setHardCandy(cell, false);
    }

    updateBoosterVisual(cell: HTMLDivElement): void {
        cell.classList.remove(
            'game__cell--bomb-line',
            'game__cell--bomb-radius',
            'game__cell--bomb-small',
            'game__cell--bomb-medium',
            'game__cell--bomb-large',
            'game__cell--bomb-ultimate'
        );
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

    swapCells(a: HTMLDivElement, b: HTMLDivElement): void {
        const colorA = this.getCellColor(a);
        this.setCellColor(a, this.getCellColor(b));
        this.setCellColor(b, colorA);
        const isHardA = this.isHardCandy(a);
        this.setHardCandy(a, this.isHardCandy(b));
        this.setHardCandy(b, isHardA);
        [a.dataset.booster, b.dataset.booster] = [b.dataset.booster, a.dataset.booster];
        this.updateBoosterVisual(a);
        this.updateBoosterVisual(b);
    }

    private handleTouchStart(event: TouchEvent, cell: HTMLDivElement): void {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        if (!touch) return;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartCell = cell;
    }

    private handleTouchMove(event: TouchEvent): void {
        if (this.touchStartX === null || this.touchStartY === null) return;
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        if (!touch) return;
        /*const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        if (Math.max(deltaX, deltaY) > 4) {
            event.preventDefault();
        }*/
        event.preventDefault();
    }

    private handleTouchEnd(event: TouchEvent): void {
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
        const direction: SwipeDirection =
            absX > absY ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up';
        this.onCellSwipe(this.touchStartCell, direction);
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this.touchStartCell = null;
        this.touchStartX = null;
        this.touchStartY = null;
    }

    private pickColorForIndex(index: number): string {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        if (this.isBlockedIndex(index)) return '';
        const wouldCreateMatch = (color: string): boolean => {
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
            if (!wouldCreateMatch(color)) return color;
        }

        for (const color of COLORS) {
            if (!wouldCreateMatch(color)) return color;
        }

        throw new Error('Unable to pick a non-matching color');
    }

    private getExistingColor(index: number): string | null {
        const cell = this.cells[index];
        if (!cell) return null;
        if (this.isBlockedCell(cell)) return null;
        return this.getCellColor(cell);
    }

    private applyColor(cell: HTMLDivElement, color: string): void {
        cell.dataset.color = color;
        if (color) {
            cell.style.setProperty('--cell-color', color);
        } else {
            cell.style.removeProperty('--cell-color');
        }
    }
}

export { Board };

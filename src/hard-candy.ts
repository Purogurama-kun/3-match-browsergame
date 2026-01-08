import { BOOSTERS, GRID_SIZE } from './constants.js';
import { Board } from './board.js';
import { Renderer } from './renderer.js';

type HardCandyOptions = {
    board: Board;
    renderer: Renderer;
    getRowCol: (index: number) => { row: number; col: number };
    getAdjacentIndices: (row: number, col: number) => number[];
};

class HardCandy {
    private board: Board;
    private renderer: Renderer;
    private getRowCol: (index: number) => { row: number; col: number };
    private getAdjacentIndices: (row: number, col: number) => number[];

    private softenedHandler: ((index: number) => void) | null = null;

    constructor(options: HardCandyOptions) {
        this.board = options.board;
        this.renderer = options.renderer;
        this.getRowCol = options.getRowCol;
        this.getAdjacentIndices = options.getAdjacentIndices;
    }

    softenAdjacentHardCandies(matched: Set<number>): void {
        if (matched.size === 0) return;
        const softened = new Set<number>();
        matched.forEach((idx) => {
            const { row, col } = this.getRowCol(idx);
            this.getAdjacentIndices(row, col).forEach((neighbor) => {
                if (softened.has(neighbor)) return;
                if (this.board.isBlockedIndex(neighbor)) return;
                if (!this.board.isHardCandy(neighbor)) return;
                this.board.softenCandy(neighbor);
                softened.add(neighbor);
                this.renderer.updateCell(neighbor, this.board.getCellState(neighbor));
                this.softenedHandler?.(neighbor);
            });
        });
    }

    hardenRandomCells(amount: number): void {
        if (amount <= 0) return;
        const candidates: number[] = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            if (!this.isValidHardeningTarget(i)) continue;
            candidates.push(i);
        }
        for (let n = 0; n < amount; n++) {
            if (candidates.length === 0) break;
            const pick = Math.floor(Math.random() * candidates.length);
            const index = candidates.splice(pick, 1)[0];
            if (index === undefined) break;
            this.board.setBooster(index, BOOSTERS.NONE);
            this.board.setHardCandy(index, true);
        }
    }

    hardenCell(index: number): void {
        this.board.setBooster(index, BOOSTERS.NONE);
        this.board.setHardCandy(index, true);
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    isValidHardeningTarget(index: number): boolean {
        if (this.board.isBlockedIndex(index)) return false;
        if (this.board.isBlockerGenerator(index)) return false;
        if (this.board.isHardCandy(index)) return false;
        if (!this.board.getCellColor(index)) return false;
        return true;
    }

    setSoftenedHandler(handler: ((index: number) => void) | null): void {
        this.softenedHandler = handler;
    }
}

export { HardCandy };

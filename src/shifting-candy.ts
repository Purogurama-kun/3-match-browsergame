import { Board } from './board.js';
import { Renderer } from './renderer.js';
import { BOOSTERS, COLORS, GRID_SIZE } from './constants.js';

type ShiftingCandyOptions = {
    board: Board;
    renderer: Renderer;
    spawnChance: number;
};

class ShiftingCandy {
    private board: Board;
    private renderer: Renderer;
    private spawnChance: number;

    constructor(options: ShiftingCandyOptions) {
        this.board = options.board;
        this.renderer = options.renderer;
        this.spawnChance = Math.max(0, options.spawnChance);
    }

    trySpawn(index: number): boolean {
        if (this.spawnChance <= 0) return false;
        if (Math.random() >= this.spawnChance) return false;
        if (!this.isValidTarget(index)) return false;
        this.board.setShiftingCandy(index, true);
        return this.board.isShiftingCandy(index);
    }

    advanceTurn(): boolean {
        const colors = this.getMatchableColorSnapshot();
        let shifted = false;
        for (let index = 0; index < colors.length; index++) {
            if (!this.board.isShiftingCandy(index)) continue;
            const currentColor = colors[index];
            const plannedColor = this.board.getShiftingNextColor(index) ?? null;
            const nextColor = plannedColor ?? this.pickShiftColor(index, colors);
            if (!nextColor || nextColor === currentColor) continue;
            colors[index] = nextColor;
            this.board.setCellColor(index, nextColor);
            const upcoming = this.pickShiftColor(index, colors);
            this.board.setShiftingNextColor(index, upcoming);
            this.renderer.updateCell(index, this.board.getCellState(index));
            shifted = true;
        }
        return shifted;
    }

    private isValidTarget(index: number): boolean {
        if (this.board.isBlockedIndex(index)) return false;
        if (this.board.isBlockerGenerator(index)) return false;
        if (this.board.isHardCandy(index)) return false;
        if (this.board.isSugarChest(index)) return false;
        if (this.board.getCellBooster(index) !== BOOSTERS.NONE) return false;
        if (!this.board.getCellColor(index)) return false;
        return true;
    }

    private getMatchableColorSnapshot(): (string | null)[] {
        const colors: (string | null)[] = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            colors.push(this.getMatchableColor(i));
        }
        return colors;
    }

    private getMatchableColor(index: number): string | null {
        if (this.board.isBlockedIndex(index)) return null;
        if (this.board.isBlockerGenerator(index)) return null;
        if (this.board.isHardCandy(index)) return null;
        if (this.board.isSugarChest(index)) return null;
        if (this.board.getCellBooster(index) === BOOSTERS.BURST_LARGE) return null;
        return this.board.getCellColor(index) || null;
    }

    private pickShiftColor(index: number, colors: (string | null)[]): string | null {
        const current = colors[index];
        if (!current) return null;
        const candidates = COLORS.filter((color) => color !== current);
        this.shuffle(candidates);
        for (const candidate of candidates) {
            const original = colors[index] ?? null;
            colors[index] = candidate;
            const wouldMatch = this.formsMatchAt(index, colors);
            colors[index] = original;
            if (!wouldMatch) {
                return candidate;
            }
        }
        const fallback = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
        return fallback ?? current;
    }

    private formsMatchAt(index: number, colors: (string | null)[]): boolean {
        const color = colors[index];
        if (!color) return false;
        const { row, col } = this.getRowCol(index);
        let horizontal = 1;
        for (let c = col - 1; c >= 0; c--) {
            const neighbor = colors[this.indexAt(row, c)] ?? null;
            if (neighbor !== color) break;
            horizontal++;
        }
        for (let c = col + 1; c < GRID_SIZE; c++) {
            const neighbor = colors[this.indexAt(row, c)] ?? null;
            if (neighbor !== color) break;
            horizontal++;
        }
        if (horizontal >= 3) return true;

        let vertical = 1;
        for (let r = row - 1; r >= 0; r--) {
            const neighbor = colors[this.indexAt(r, col)] ?? null;
            if (neighbor !== color) break;
            vertical++;
        }
        for (let r = row + 1; r < GRID_SIZE; r++) {
            const neighbor = colors[this.indexAt(r, col)] ?? null;
            if (neighbor !== color) break;
            vertical++;
        }
        return vertical >= 3;
    }

    private shuffle<T>(items: T[]): void {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = items[i];
            const candidate = items[j];
            if (temp === undefined || candidate === undefined) {
                continue;
            }
            items[i] = candidate;
            items[j] = temp;
        }
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }
}

export { ShiftingCandy };

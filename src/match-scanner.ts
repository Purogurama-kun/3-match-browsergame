import { BOOSTERS, GRID_SIZE, type BoosterType } from './constants.js';
import { Board } from './board.js';
import type { LineOrientation } from './types.js';

type BoosterCreation = {
    index: number;
    type: BoosterType;
    orientation?: LineOrientation;
};

type MatchResult = {
    matched: Set<number>;
    boostersToCreate: BoosterCreation[];
    largestMatch: number;
    createdBoosterTypes: BoosterType[];
};

type MatchAccumulator = {
    matched: Set<number>;
    boostersToCreate: BoosterCreation[];
    boosterSlots: Set<number>;
    createdBoosterTypes: Set<BoosterType>;
    largestMatch: number;
};

class MatchScanner {
    private board: Board;

    constructor(board: Board) {
        this.board = board;
    }

    findMatches(): MatchResult {
        const accumulator = this.createMatchAccumulator();

        this.scanSquareMatches(accumulator);
        this.scanTPatterns(accumulator);
        this.scanLPatterns(accumulator);
        this.scanLineMatches(accumulator);

        return {
            matched: accumulator.matched,
            boostersToCreate: accumulator.boostersToCreate,
            largestMatch: accumulator.largestMatch,
            createdBoosterTypes: Array.from(accumulator.createdBoosterTypes)
        };
    }

    hasAnyValidMove(): boolean {
        const colors = this.getMatchableColorSnapshot();
        for (let i = 0; i < colors.length; i++) {
            if (!this.isSwappable(i)) continue;
            const { row, col } = this.getRowCol(i);
            const neighbors = [
                { row, col: col + 1 },
                { row: row + 1, col }
            ];
            for (const neighbor of neighbors) {
                if (neighbor.row >= GRID_SIZE || neighbor.col >= GRID_SIZE) continue;
                const neighborIndex = this.indexAt(neighbor.row, neighbor.col);
                if (!this.isSwappable(neighborIndex)) continue;
                if (this.swapCreatesMatch(i, neighborIndex, colors)) return true;
            }
        }
        return false;
    }

    findHintMove(): number[] | null {
        const colors = this.getMatchableColorSnapshot();
        for (let i = 0; i < colors.length; i++) {
            if (!this.isSwappable(i)) continue;
            const { row, col } = this.getRowCol(i);
            const neighbors = [
                { row, col: col + 1 },
                { row: row + 1, col }
            ];
            for (const neighbor of neighbors) {
                if (neighbor.row >= GRID_SIZE || neighbor.col >= GRID_SIZE) continue;
                const neighborIndex = this.indexAt(neighbor.row, neighbor.col);
                if (!this.isSwappable(neighborIndex)) continue;
                if (this.swapCreatesMatch(i, neighborIndex, colors)) {
                    return [i, neighborIndex];
                }
            }
        }
        return null;
    }

    private createMatchAccumulator(): MatchAccumulator {
        return {
            matched: new Set<number>(),
            boostersToCreate: [],
            boosterSlots: new Set<number>(),
            createdBoosterTypes: new Set<BoosterType>(),
            largestMatch: 0
        };
    }

    private scanSquareMatches(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 }
        ];
        this.scanPattern(offsets, { row: 0, col: 0 }, BOOSTERS.BURST_SMALL, accumulator);
    }

    private scanTPatterns(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 0, col: 2 },
            { row: 1, col: 1 },
            { row: 2, col: 1 }
        ];
        this.scanRotatedPatterns(offsets, { row: 1, col: 1 }, BOOSTERS.BURST_MEDIUM, accumulator);
    }

    private scanLPatterns(accumulator: MatchAccumulator): void {
        const offsets = [
            { row: 0, col: 0 },
            { row: 1, col: 0 },
            { row: 2, col: 0 },
            { row: 2, col: 1 },
            { row: 2, col: 2 }
        ];
        this.scanRotatedPatterns(offsets, { row: 2, col: 0 }, BOOSTERS.BURST_MEDIUM, accumulator);
    }

    private scanLineMatches(accumulator: MatchAccumulator): void {
        for (let r = 0; r < GRID_SIZE; r++) {
            this.checkLine(this.getRowIndices(r), accumulator, 'horizontal');
        }

        for (let c = 0; c < GRID_SIZE; c++) {
            this.checkLine(this.getColumnIndices(c), accumulator, 'vertical');
        }
    }

    private checkLine(indices: number[], accumulator: MatchAccumulator, orientation: LineOrientation): void {
        let streakStart = 0;
        let streakLength = 0;
        let streakColor = '';

        const flushStreak = (): void => {
            if (streakLength < 3) {
                streakLength = 0;
                streakColor = '';
                return;
            }
            const streakCells = indices.slice(streakStart, streakStart + streakLength);
            if (this.hasNonBombCell(streakCells)) {
                streakCells.forEach((idx) => accumulator.matched.add(idx));
                if (streakLength === 4) {
                    const lineIndex = streakCells[1];
                    if (lineIndex === undefined) {
                        throw new Error('Missing line booster index');
                    }
                    this.addBoosterSlot(lineIndex, BOOSTERS.LINE, accumulator, orientation);
                }
                if (streakLength >= 5) {
                    const centerIndex = streakCells[Math.floor(streakCells.length / 2)];
                    if (centerIndex === undefined) {
                        throw new Error('Missing large blast index');
                    }
                    this.addBoosterSlot(centerIndex, BOOSTERS.BURST_LARGE, accumulator);
                }
                accumulator.largestMatch = Math.max(accumulator.largestMatch, streakLength);
            }
            streakLength = 0;
            streakColor = '';
        };

        for (let i = 0; i <= indices.length; i++) {
            const index = i < indices.length ? indices[i] : undefined;
            const color = index !== undefined ? this.getMatchableColor(index) : '';
            const isMatchable = Boolean(color) && index !== undefined && !accumulator.matched.has(index);
            if (isMatchable && color === streakColor) {
                streakLength++;
                continue;
            }
            flushStreak();
            if (isMatchable) {
                streakColor = color;
                streakLength = 1;
                streakStart = i;
            } else {
                streakColor = '';
                streakLength = 0;
            }
        }
    }

    private scanRotatedPatterns(
        baseOffsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number },
        boosterType: BoosterType,
        accumulator: MatchAccumulator
    ): void {
        for (let rotation = 0; rotation < 4; rotation++) {
            const offsets = baseOffsets.map((offset) => this.rotateOffset(offset, rotation));
            const rotatedBoosterOffset = this.rotateOffset(boosterOffset, rotation);
            this.scanPattern(offsets, rotatedBoosterOffset, boosterType, accumulator);
        }
    }

    private scanPattern(
        offsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number } | null,
        boosterType: BoosterType | null,
        accumulator: MatchAccumulator
    ): void {
        const allOffsets = boosterOffset ? offsets.concat([boosterOffset]) : offsets;
        const maxRow = Math.max(...allOffsets.map((offset) => offset.row));
        const maxCol = Math.max(...allOffsets.map((offset) => offset.col));
        for (let r = 0; r <= GRID_SIZE - (maxRow + 1); r++) {
            for (let c = 0; c <= GRID_SIZE - (maxCol + 1); c++) {
                this.checkPatternAt(r, c, offsets, boosterOffset, boosterType, accumulator);
            }
        }
    }

    private checkPatternAt(
        originRow: number,
        originCol: number,
        offsets: { row: number; col: number }[],
        boosterOffset: { row: number; col: number } | null,
        boosterType: BoosterType | null,
        accumulator: MatchAccumulator
    ): void {
        let color = '';
        const indices: number[] = [];
        for (const offset of offsets) {
            const row = originRow + offset.row;
            const col = originCol + offset.col;
            const cellColor = this.getColorAt(row, col);
            if (!cellColor) return;
            if (!color) color = cellColor;
            if (cellColor !== color) return;
            indices.push(this.indexAt(row, col));
        }
        if (!this.hasNonBombCell(indices)) {
            return;
        }
        indices.forEach((idx) => accumulator.matched.add(idx));
        if (boosterOffset && boosterType) {
            const boosterIndex = this.indexAt(originRow + boosterOffset.row, originCol + boosterOffset.col);
            this.addBoosterSlot(boosterIndex, boosterType, accumulator);
        }
        accumulator.largestMatch = Math.max(accumulator.largestMatch, offsets.length);
    }

    private addBoosterSlot(
        index: number,
        type: BoosterType,
        accumulator: MatchAccumulator,
        orientation?: LineOrientation
    ): void {
        if (accumulator.boosterSlots.has(index)) return;
        accumulator.boosterSlots.add(index);
        const creation: BoosterCreation = { index, type };
        if (type === BOOSTERS.LINE) {
            creation.orientation = orientation ?? 'horizontal';
        }
        accumulator.boostersToCreate.push(creation);
        accumulator.createdBoosterTypes.add(type);
    }

    private hasNonBombCell(indices: number[]): boolean {
        return indices.some((index) => this.board.getCellBooster(index) === BOOSTERS.NONE);
    }

    private getMatchableColor(index: number): string {
        if (this.board.isBlockedIndex(index)) return '';
        if (this.board.isHardCandy(index)) return '';
        if (this.board.isSugarChest(index)) return '';
        const booster = this.board.getCellBooster(index);
        if (booster === BOOSTERS.BURST_LARGE) return '';
        return this.board.getCellColor(index);
    }

    private getColorAt(row: number, col: number): string {
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return '';
        return this.getMatchableColor(this.indexAt(row, col));
    }

    private rotateOffset(offset: { row: number; col: number }, times: number): { row: number; col: number } {
        let row = offset.row;
        let col = offset.col;
        for (let i = 0; i < times; i++) {
            const newRow = col;
            const newCol = 2 - row;
            row = newRow;
            col = newCol;
        }
        return { row, col };
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }

    private getRowIndices(row: number): number[] {
        const indices: number[] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            indices.push(row * GRID_SIZE + c);
        }
        return indices;
    }

    private getColumnIndices(col: number): number[] {
        const indices: number[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            indices.push(r * GRID_SIZE + col);
        }
        return indices;
    }

    private isSwappable(index: number): boolean {
        if (this.board.isBlockedIndex(index)) return false;
        if (this.board.isHardCandy(index)) return false;
        return Boolean(this.board.getCellColor(index));
    }

    private swapCreatesMatch(a: number, b: number, colors: (string | null)[]): boolean {
        const originalA = colors[a] ?? null;
        const originalB = colors[b] ?? null;
        colors[a] = originalB;
        colors[b] = originalA;
        const hasMatch = this.formsMatchAt(a, colors) || this.formsMatchAt(b, colors);
        colors[a] = originalA;
        colors[b] = originalB;
        return hasMatch;
    }

    private formsMatchAt(index: number, colors: (string | null)[]): boolean {
        const color = colors[index];
        if (!color) return false;
        const { row, col } = this.getRowCol(index);
        let horizontal = 1;
        for (let c = col - 1; c >= 0; c--) {
            const neighborColor = colors[this.indexAt(row, c)] ?? null;
            if (neighborColor !== color) break;
            horizontal++;
        }
        for (let c = col + 1; c < GRID_SIZE; c++) {
            const neighborColor = colors[this.indexAt(row, c)] ?? null;
            if (neighborColor !== color) break;
            horizontal++;
        }
        if (horizontal >= 3) return true;

        let vertical = 1;
        for (let r = row - 1; r >= 0; r--) {
            const neighborColor = colors[this.indexAt(r, col)] ?? null;
            if (neighborColor !== color) break;
            vertical++;
        }
        for (let r = row + 1; r < GRID_SIZE; r++) {
            const neighborColor = colors[this.indexAt(r, col)] ?? null;
            if (neighborColor !== color) break;
            vertical++;
        }
        return vertical >= 3;
    }

    private getMatchableColorSnapshot(): (string | null)[] {
        const snapshot: (string | null)[] = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const color = this.getMatchableColor(i);
            snapshot.push(color || null);
        }
        return snapshot;
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }
}

export { MatchScanner };
export type { MatchResult, BoosterCreation };

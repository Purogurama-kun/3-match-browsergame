import { GRID_SIZE } from './constants.js';
import { Board } from './board.js';
import { HardCandy } from './hard-candy.js';

type GeneratorOptions = {
    board: Board;
    hardCandy: HardCandy;
    getRowCol: (index: number) => { row: number; col: number };
    indexAt: (row: number, col: number) => number;
    spreadInterval: number;
    spreadRadius: number;
};

class Generator {
    private board: Board;
    private hardCandy: HardCandy;
    private getRowCol: (index: number) => { row: number; col: number };
    private indexAt: (row: number, col: number) => number;
    private spreadInterval: number;
    private spreadRadius: number;
    private moveCounter = 0;

    constructor(options: GeneratorOptions) {
        this.board = options.board;
        this.hardCandy = options.hardCandy;
        this.getRowCol = options.getRowCol;
        this.indexAt = options.indexAt;
        this.spreadInterval = options.spreadInterval;
        this.spreadRadius = options.spreadRadius;
    }

    reset(): void {
        this.moveCounter = 0;
    }

    advanceMove(): void {
        this.moveCounter++;
        this.triggerIfReady();
    }

    private triggerIfReady(): void {
        if (this.moveCounter % this.spreadInterval !== 0) return;
        const generators = this.board.getBlockerGeneratorIndices();
        generators.forEach((index) => this.hardenCellsFromGenerator(index));
    }

    private hardenCellsFromGenerator(generatorIndex: number): void {
        const { row, col } = this.getRowCol(generatorIndex);
        const target = this.collectIndicesWithinRadius(row, col, this.spreadRadius)
            .map((index) => ({ index, distance: this.getManhattanDistance(row, col, index) }))
            .filter((entry) => this.hardCandy.isValidHardeningTarget(entry.index))
            .sort((a, b) => (a.distance === b.distance ? a.index - b.index : a.distance - b.distance))[0];
        if (!target) return;
        this.hardCandy.hardenCell(target.index);
    }

    private collectIndicesWithinRadius(row: number, col: number, radius: number): number[] {
        const indices: number[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const distance = Math.abs(r - row) + Math.abs(c - col);
                if (distance <= radius) {
                    indices.push(this.indexAt(r, c));
                }
            }
        }
        return indices;
    }

    private getManhattanDistance(row: number, col: number, index: number): number {
        const position = this.getRowCol(index);
        return Math.abs(position.row - row) + Math.abs(position.col - col);
    }
}

export { Generator };

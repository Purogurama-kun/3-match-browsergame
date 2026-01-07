import { GRID_SIZE, BOOSTERS, BoosterType, COLORS, randomColor } from './constants.js';

const SUGAR_CHEST_CHANCE = 0.01;
import type { LineOrientation } from './types.js';

type CellState = {
    color: string;
    booster: BoosterType;
    lineOrientation?: LineOrientation;
    hard: boolean;
    blocked: boolean;
    generator: boolean;
    sugarChestStage?: number;
};

type ColumnEntry = {
    color: string;
    booster: BoosterType;
    lineOrientation?: LineOrientation | undefined;
    hard: boolean;
    generator: boolean;
    sugarChestStage?: number;
};

class Board {
    private cellStates: CellState[] = [];
    private blockedIndices: Set<number> = new Set();

    create(config?: { blockedCells?: number[]; hardCandies?: number[]; blockerGenerators?: number[] }): void {
        this.blockedIndices = new Set(config?.blockedCells ?? []);
        const hardCandies = new Set(config?.hardCandies ?? []);
        const blockerGenerators = new Set(config?.blockerGenerators ?? []);
        this.cellStates = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const blocked = this.blockedIndices.has(i);
            const isGenerator = blockerGenerators.has(i);
            const state: CellState = {
                color: '',
                booster: BOOSTERS.NONE,
                hard: hardCandies.has(i) || isGenerator,
                blocked,
                generator: isGenerator
            };
            const shouldSpawnChest =
                !blocked && !state.hard && !state.generator && this.shouldSpawnSugarChest();
            if (blocked) {
                state.color = '';
            } else if (shouldSpawnChest) {
                state.color = '';
            } else {
                state.color = this.pickColorForIndex(i);
            }
            this.cellStates.push(state);
            if (shouldSpawnChest) {
                this.setSugarChestStage(i, 1);
            }
        }
    }

    clear(): void {
        this.cellStates = [];
        this.blockedIndices.clear();
    }

    getCellState(index: number): CellState {
        const state = this.cellStates[index];
        if (!state) {
            throw new Error('Missing cell state at index: ' + index);
        }
        return state;
    }

    getCellColor(index: number): string {
        return this.getCellState(index).color;
    }

    setCellColor(index: number, color: string): void {
        this.getCellState(index).color = color;
    }

    getCellBooster(index: number): BoosterType {
        return this.getCellState(index).booster;
    }

    setBooster(index: number, type: BoosterType): void {
        const state = this.getCellState(index);
        state.booster = type;
        if (type !== BOOSTERS.LINE) {
            delete state.lineOrientation;
        }
    }

    getLineOrientation(index: number): LineOrientation | undefined {
        return this.getCellState(index).lineOrientation;
    }

    setLineOrientation(index: number, orientation: LineOrientation | null): void {
        const state = this.getCellState(index);
        if (orientation === null) {
            delete state.lineOrientation;
        } else {
            state.lineOrientation = orientation;
        }
    }

    isBlockedIndex(index: number): boolean {
        return this.blockedIndices.has(index);
    }

    isBlockedCell(index: number): boolean {
        return this.isBlockedIndex(index);
    }

    isHardCandy(index: number): boolean {
        return this.getCellState(index).hard;
    }

    setHardCandy(index: number, isHard: boolean): void {
        this.getCellState(index).hard = isHard;
    }

    isBlockerGenerator(index: number): boolean {
        return this.getCellState(index).generator;
    }

    setBlockerGenerator(index: number, isGenerator: boolean, isHard: boolean = true): void {
        const state = this.getCellState(index);
        state.generator = isGenerator;
        state.hard = isHard;
        state.booster = BOOSTERS.NONE;
        delete state.lineOrientation;
    }

    softenCandy(index: number): void {
        this.setHardCandy(index, false);
    }

    clearCell(index: number): void {
        const state = this.getCellState(index);
        if (state.blocked) return;
        state.color = '';
        state.booster = BOOSTERS.NONE;
        state.hard = false;
        state.generator = false;
        delete state.lineOrientation;
        delete state.sugarChestStage;
    }

    swapCells(a: number, b: number): void {
        const stateA = this.getCellState(a);
        const stateB = this.getCellState(b);
        if (stateA.blocked || stateB.blocked) return;
        const temp: CellState = { ...stateA };
        this.cellStates[a] = { ...stateB };
        this.cellStates[b] = { ...temp };
    }

    getBlockerGeneratorIndices(): number[] {
        const indices: number[] = [];
        for (let i = 0; i < this.cellStates.length; i++) {
            if (this.isBlockerGenerator(i)) {
                indices.push(i);
            }
        }
        return indices;
    }

    getCells(): CellState[] {
        return this.cellStates;
    }

    collapseColumn(col: number): number[] {
        const emptyIndices: number[] = [];
        let segmentBottom = GRID_SIZE - 1;
        for (let row = GRID_SIZE - 1; row >= -1; row--) {
            const isBoundary = row < 0 || this.isBlockedIndex(row * GRID_SIZE + col);
            if (isBoundary) {
                const segmentTop = row + 1;
                if (segmentTop <= segmentBottom) {
                    this.collapseColumnSegment(col, segmentTop, segmentBottom, emptyIndices);
                }
                segmentBottom = row - 1;
            }
        }
        return emptyIndices;
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
        const state = this.cellStates[index];
        if (!state) return null;
        if (state.blocked) return null;
        if (state.generator) return null;
        return state.color || null;
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }

    isSugarChest(index: number): boolean {
        return typeof this.getCellState(index).sugarChestStage === 'number';
    }

    getSugarChestStage(index: number): number | undefined {
        return this.getCellState(index).sugarChestStage;
    }

    setSugarChestStage(index: number, stage: number): void {
        const state = this.getCellState(index);
        state.color = '';
        state.booster = BOOSTERS.NONE;
        state.hard = false;
        state.generator = false;
        delete state.lineOrientation;
        const normalized = Math.max(1, Math.min(4, Math.floor(stage)));
        state.sugarChestStage = normalized;
    }

    spawnSugarChest(index: number): void {
        this.setSugarChestStage(index, 1);
    }

    removeSugarChest(index: number): void {
        delete this.getCellState(index).sugarChestStage;
    }

    trySpawnSugarChest(index: number): boolean {
        if (!this.shouldSpawnSugarChest()) {
            return false;
        }
        this.spawnSugarChest(index);
        return true;
    }

    private shouldSpawnSugarChest(): boolean {
        return Math.random() < SUGAR_CHEST_CHANCE;
    }

    private collapseColumnSegment(col: number, topRow: number, bottomRow: number, emptyIndices: number[]): void {
        if (topRow > bottomRow) return;
        const entries: ColumnEntry[] = [];
        for (let row = topRow; row <= bottomRow; row++) {
            const index = row * GRID_SIZE + col;
            const entry = this.captureColumnEntry(index);
            if (entry) {
                entries.push(entry);
            }
            this.clearCell(index);
        }
        let targetRow = bottomRow;
        while (entries.length > 0) {
            const entry = entries.pop()!;
            const index = targetRow * GRID_SIZE + col;
            this.placeColumnEntry(index, entry);
            targetRow--;
        }
        for (let row = targetRow; row >= topRow; row--) {
            emptyIndices.push(row * GRID_SIZE + col);
        }
    }

    private captureColumnEntry(index: number): ColumnEntry | null {
        const state = this.getCellState(index);
        if (state.blocked) return null;
        if (state.sugarChestStage !== undefined) {
            return {
                color: '',
                booster: BOOSTERS.NONE,
                hard: false,
                generator: false,
                sugarChestStage: state.sugarChestStage
            };
        }
        if (!state.color && state.booster === BOOSTERS.NONE && !state.hard && !state.generator) {
            return null;
        }
        return {
            color: state.color,
            booster: state.booster,
            lineOrientation: state.lineOrientation,
            hard: state.hard,
            generator: state.generator
        };
    }

    private placeColumnEntry(index: number, entry: ColumnEntry): void {
        this.clearCell(index);
        if (entry.sugarChestStage !== undefined) {
            this.setSugarChestStage(index, entry.sugarChestStage);
            return;
        }
        if (entry.generator) {
            this.setBlockerGenerator(index, true, entry.hard);
            return;
        }
        const state = this.getCellState(index);
        state.color = entry.color;
        state.booster = entry.booster;
        if (entry.booster === BOOSTERS.LINE) {
            state.lineOrientation = entry.lineOrientation ?? 'horizontal';
        } else {
            delete state.lineOrientation;
        }
        state.hard = entry.hard;
    }
}

export { Board, CellState };

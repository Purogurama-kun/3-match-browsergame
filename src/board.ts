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
}

export { Board, CellState };

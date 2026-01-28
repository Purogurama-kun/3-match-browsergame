import { GRID_SIZE, BOOSTERS, BoosterType, COLORS, randomColor } from './constants.js';

const SUGAR_CHEST_CHANCE = 0.01;
import type { LineOrientation } from './types.js';

type CellState = {
    color: string;
    booster: BoosterType;
    lineOrientation?: LineOrientation;
    hard: boolean;
    hardStage?: number;
    hardeningStage?: number;
    blocked: boolean;
    generator: boolean;
    sugarChestStage?: number;
    collectionItem: boolean;
    shifting: boolean;
    shiftingNextColor?: string;
};

type ColumnEntry = {
    color: string;
    booster: BoosterType;
    lineOrientation?: LineOrientation | undefined;
    hard: boolean;
    hardStage?: number;
    hardeningStage?: number;
    generator: boolean;
    sugarChestStage?: number;
    collectionItem?: boolean;
    shifting: boolean;
    shiftingNextColor?: string;
};

type DropMove = {
    from: number;
    to: number;
};

type CollapseResult = {
    emptyIndices: number[];
    moves: DropMove[];
    collectedIndices: number[];
};

class Board {
    private cellStates: CellState[] = [];
    private blockedIndices: Set<number> = new Set();
    private collectorColumns: Set<number> = new Set();

    create(config?: {
        blockedCells?: number[];
        hardCandies?: number[];
        blockerGenerators?: number[];
        collectorColumns?: number[];
        cellOverrides?: Array<{
            index: number;
            color?: string;
            hard?: boolean;
            hardStage?: number;
            hardeningStage?: number;
            blocked?: boolean;
            generator?: boolean;
            booster?: BoosterType;
            lineOrientation?: LineOrientation;
            sugarChestStage?: number;
            collectionItem?: boolean;
            shifting?: boolean;
        }>;
    }): void {
        const overrideMap = new Map<
            number,
            {
                color?: string;
                hard?: boolean;
                hardStage?: number;
                hardeningStage?: number;
                blocked?: boolean;
                generator?: boolean;
                booster?: BoosterType;
                lineOrientation?: LineOrientation;
                sugarChestStage?: number;
                collectionItem?: boolean;
                shifting?: boolean;
            }
        >();
        (config?.cellOverrides ?? []).forEach((override) => {
            overrideMap.set(override.index, override);
        });
        const blockedFromConfig = new Set(config?.blockedCells ?? []);
        const hardCandies = new Set(config?.hardCandies ?? []);
        const blockerGenerators = new Set(config?.blockerGenerators ?? []);
        const collectorColumns = config?.collectorColumns;
        if (Array.isArray(collectorColumns)) {
            this.collectorColumns = new Set(
                collectorColumns.filter((col) => Number.isInteger(col) && col >= 0 && col < GRID_SIZE)
            );
        } else {
            this.collectorColumns = new Set();
        }
        const blockedFromOverrides = new Set<number>();
        overrideMap.forEach((override, index) => {
            if (override.blocked) {
                blockedFromOverrides.add(index);
            }
        });
        this.blockedIndices = new Set([...blockedFromConfig, ...blockedFromOverrides]);
        this.cellStates = [];
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const override = overrideMap.get(i);
            const blocked = override?.blocked ?? this.blockedIndices.has(i);
            const isGenerator = override?.generator ?? blockerGenerators.has(i);
            const overrideHard = override?.hard;
            const hardStage = this.normalizeHardStage(override?.hardStage);
            const hardeningStage = this.normalizeHardeningStage(override?.hardeningStage);
            const baseHard = overrideHard ?? hardCandies.has(i);
            const hard = isGenerator ? true : (baseHard || hardStage !== null);
            const hasHardening = !hard && !blocked && !isGenerator && hardeningStage !== null;
            const hasCollectionItem = !blocked && Boolean(override?.collectionItem);
            const state: CellState = {
                color: '',
                booster: BOOSTERS.NONE,
                hard,
                blocked,
                generator: isGenerator,
                collectionItem: hasCollectionItem,
                shifting: false
            };
            if (hard) {
                state.hardStage = hardStage ?? 1;
            }
            if (hasHardening) {
                state.hardeningStage = hardeningStage ?? 1;
            }
            const hasOverrideChest = typeof override?.sugarChestStage === 'number';
            const shouldSpawnChest =
                !blocked &&
                !state.hard &&
                !state.hardeningStage &&
                !state.generator &&
                !state.collectionItem &&
                !override?.color &&
                !hasOverrideChest &&
                this.shouldSpawnSugarChest();
            if (blocked) {
                state.color = '';
            } else if (state.collectionItem) {
                state.color = '';
            } else if (override?.color) {
                state.color = override.color;
            } else if (shouldSpawnChest || hasOverrideChest) {
                state.color = '';
            } else {
                state.color = this.pickColorForIndex(i);
            }
            if (
                !blocked &&
                !state.generator &&
                !state.hardeningStage &&
                !hasOverrideChest &&
                !state.collectionItem &&
                override?.booster
            ) {
                state.booster = override.booster;
                if (override.booster === BOOSTERS.LINE && override.lineOrientation) {
                    state.lineOrientation = override.lineOrientation;
                }
            }
            const wantsShift = Boolean(override?.shifting);
            const canShift =
                wantsShift &&
                !blocked &&
                !state.generator &&
                !state.hard &&
                !state.hardeningStage &&
                !hasOverrideChest &&
                !state.collectionItem &&
                !override?.booster &&
                Boolean(state.color);
            state.shifting = canShift;
            if (state.shifting) {
                const nextColor = this.pickNextShiftColor(state.color);
                if (nextColor) {
                    state.shiftingNextColor = nextColor;
                } else {
                    delete state.shiftingNextColor;
                }
            }
            this.cellStates.push(state);
            if (hasOverrideChest && !blocked) {
                this.setSugarChestStage(i, override.sugarChestStage ?? 1);
            } else if (shouldSpawnChest) {
                this.setSugarChestStage(i, 1);
            }
        }
    }

    clear(): void {
        this.cellStates = [];
        this.blockedIndices.clear();
        this.collectorColumns.clear();
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
        const state = this.getCellState(index);
        if (state.collectionItem) return;
        state.color = color;
    }

    getCellBooster(index: number): BoosterType {
        return this.getCellState(index).booster;
    }

    setBooster(index: number, type: BoosterType): void {
        const state = this.getCellState(index);
        state.booster = type;
        if (type !== BOOSTERS.NONE) {
            state.collectionItem = false;
            state.shifting = false;
            delete state.shiftingNextColor;
            delete state.hardeningStage;
        }
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
        const state = this.cellStates[index];
        if (state?.blocked) return true;
        return this.blockedIndices.has(index);
    }

    isBlockedCell(index: number): boolean {
        return this.isBlockedIndex(index);
    }

    isHardCandy(index: number): boolean {
        return this.getCellState(index).hard;
    }

    isHardeningCandy(index: number): boolean {
        return typeof this.getCellState(index).hardeningStage === 'number';
    }

    getHardeningStage(index: number): number | undefined {
        return this.getCellState(index).hardeningStage;
    }

    setHardCandy(index: number, isHard: boolean, stage: number = 1): void {
        const state = this.getCellState(index);
        state.hard = isHard;
        if (isHard) {
            state.collectionItem = false;
        }
        delete state.hardeningStage;
        if (isHard) {
            state.shifting = false;
            delete state.shiftingNextColor;
        }
        if (isHard) {
            state.hardStage = this.normalizeHardStage(stage) ?? 1;
        } else {
            delete state.hardStage;
        }
    }

    setHardeningCandy(index: number, stage: number = 1): void {
        const state = this.getCellState(index);
        if (state.blocked || state.generator || state.hard) return;
        if (state.sugarChestStage !== undefined) return;
        if (state.collectionItem) return;
        state.booster = BOOSTERS.NONE;
        state.shifting = false;
        delete state.shiftingNextColor;
        delete state.lineOrientation;
        state.hardeningStage = this.normalizeHardeningStage(stage) ?? 1;
    }

    setHardeningStage(index: number, stage: number): void {
        const state = this.getCellState(index);
        if (state.hardeningStage === undefined) return;
        state.hardeningStage = this.normalizeHardeningStage(stage) ?? 1;
    }

    clearHardeningCandy(index: number): void {
        delete this.getCellState(index).hardeningStage;
    }

    isBlockerGenerator(index: number): boolean {
        return this.getCellState(index).generator;
    }

    setBlockerGenerator(index: number, isGenerator: boolean, isHard: boolean = true): void {
        const state = this.getCellState(index);
        state.generator = isGenerator;
        state.hard = isHard;
        if (isGenerator) {
            state.collectionItem = false;
        }
        delete state.hardeningStage;
        if (isHard) {
            state.hardStage = 1;
        } else {
            delete state.hardStage;
        }
        state.booster = BOOSTERS.NONE;
        state.shifting = false;
        delete state.shiftingNextColor;
        delete state.lineOrientation;
    }

    softenCandy(index: number): void {
        const state = this.getCellState(index);
        if (!state.hard) return;
        const stage = this.normalizeHardStage(state.hardStage) ?? 1;
        if (stage > 1) {
            state.hardStage = stage - 1;
            state.hard = true;
        } else {
            this.setHardCandy(index, false);
        }
    }

    clearCell(index: number): void {
        const state = this.getCellState(index);
        if (state.blocked) return;
        state.color = '';
        state.booster = BOOSTERS.NONE;
        state.hard = false;
        delete state.hardStage;
        delete state.hardeningStage;
        state.generator = false;
        state.collectionItem = false;
        state.shifting = false;
        delete state.shiftingNextColor;
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

    getCollectorColumns(): number[] {
        return Array.from(this.collectorColumns.values());
    }

    collapseColumn(col: number): CollapseResult {
        const emptyIndices: number[] = [];
        const moves: DropMove[] = [];
        const collectedIndices: number[] = [];
        this.collapseColumnEntries(col, emptyIndices, moves, collectedIndices);
        return { emptyIndices, moves, collectedIndices };
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

    private pickNextShiftColor(currentColor: string): string | undefined {
        if (!currentColor) return undefined;
        const candidates = COLORS.filter((color) => color !== currentColor);
        if (candidates.length === 0) return undefined;
        return candidates[Math.floor(Math.random() * candidates.length)];
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

    isCollectionItem(index: number): boolean {
        return this.getCellState(index).collectionItem;
    }

    setCollectionItem(index: number, enabled: boolean): void {
        const state = this.getCellState(index);
        if (state.blocked) return;
        state.collectionItem = enabled;
        if (enabled) {
            state.color = '';
            state.booster = BOOSTERS.NONE;
            state.hard = false;
            delete state.hardStage;
            delete state.hardeningStage;
            state.generator = false;
            state.shifting = false;
            delete state.shiftingNextColor;
            delete state.lineOrientation;
            delete state.sugarChestStage;
        }
    }

    isShiftingCandy(index: number): boolean {
        return this.getCellState(index).shifting;
    }

    getShiftingNextColor(index: number): string | undefined {
        return this.getCellState(index).shiftingNextColor;
    }

    setShiftingCandy(index: number, enabled: boolean): void {
        const state = this.getCellState(index);
        if (!enabled) {
            state.shifting = false;
            delete state.shiftingNextColor;
            return;
        }
        const canShift =
            !state.blocked &&
            !state.generator &&
            !state.hard &&
            state.hardeningStage === undefined &&
            state.sugarChestStage === undefined &&
            state.booster === BOOSTERS.NONE &&
            Boolean(state.color);
        state.shifting = canShift;
        if (canShift) {
            const nextColor = this.pickNextShiftColor(state.color);
            if (nextColor) {
                state.shiftingNextColor = nextColor;
            } else {
                delete state.shiftingNextColor;
            }
        } else {
            delete state.shiftingNextColor;
        }
    }

    setShiftingNextColor(index: number, color: string | null | undefined): void {
        const state = this.getCellState(index);
        if (!state.shifting) {
            delete state.shiftingNextColor;
            return;
        }
        const nextColor = color ?? this.pickNextShiftColor(state.color);
        if (nextColor) {
            state.shiftingNextColor = nextColor;
        } else {
            delete state.shiftingNextColor;
        }
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
        state.collectionItem = false;
        delete state.hardeningStage;
        state.shifting = false;
        delete state.shiftingNextColor;
        delete state.lineOrientation;
        const normalized = Math.max(1, Math.min(3, Math.floor(stage)));
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

    private collapseColumnEntries(
        col: number,
        emptyIndices: number[],
        moves: DropMove[],
        collectedIndices: number[]
    ): void {
        const entries: { entry: ColumnEntry; fromIndex: number }[] = [];
        const targetRows: number[] = [];
        for (let row = GRID_SIZE - 1; row >= 0; row--) {
            const index = row * GRID_SIZE + col;
            if (this.isBlockedIndex(index)) continue;
            targetRows.push(row);
        }
        for (let row = 0; row < GRID_SIZE; row++) {
            const index = row * GRID_SIZE + col;
            if (this.isBlockedIndex(index)) continue;
            const entry = this.captureColumnEntry(index);
            if (entry) {
                entries.push({ entry, fromIndex: index });
            }
            this.clearCell(index);
        }
        for (const targetRow of targetRows) {
            const nextEntry = entries.pop();
            const index = targetRow * GRID_SIZE + col;
            if (!nextEntry) {
                emptyIndices.push(index);
                continue;
            }
            if (
                nextEntry.entry.collectionItem &&
                targetRow === targetRows[0] &&
                this.collectorColumns.has(col)
            ) {
                collectedIndices.push(index);
                emptyIndices.push(index);
                continue;
            }
            this.placeColumnEntry(index, nextEntry.entry);
            if (nextEntry.fromIndex !== index) {
                moves.push({ from: nextEntry.fromIndex, to: index });
            }
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
                sugarChestStage: state.sugarChestStage,
                shifting: false
            };
        }
        if (state.collectionItem) {
            return {
                color: '',
                booster: BOOSTERS.NONE,
                hard: false,
                generator: false,
                collectionItem: true,
                shifting: false
            };
        }
        if (!state.color && state.booster === BOOSTERS.NONE && !state.hard && !state.generator) {
            return null;
        }
        const entry: ColumnEntry = {
            color: state.color,
            booster: state.booster,
            hard: state.hard,
            generator: state.generator,
            shifting: state.shifting,
            ...(state.shiftingNextColor ? { shiftingNextColor: state.shiftingNextColor } : {})
        };
        if (state.lineOrientation) {
            entry.lineOrientation = state.lineOrientation;
        }
        if (typeof state.hardStage === 'number') {
            entry.hardStage = state.hardStage;
        }
        if (typeof state.hardeningStage === 'number') {
            entry.hardeningStage = state.hardeningStage;
        }
        return entry;
    }

    private placeColumnEntry(index: number, entry: ColumnEntry): void {
        this.clearCell(index);
        if (entry.sugarChestStage !== undefined) {
            this.setSugarChestStage(index, entry.sugarChestStage);
            return;
        }
        if (entry.collectionItem) {
            this.setCollectionItem(index, true);
            return;
        }
        if (entry.generator) {
            this.setBlockerGenerator(index, true, entry.hard);
            this.getCellState(index).color = entry.color;
            return;
        }
        const state = this.getCellState(index);
        state.color = entry.color;
        state.booster = entry.booster;
        state.shifting = entry.shifting;
        if (entry.shifting && entry.shiftingNextColor) {
            state.shiftingNextColor = entry.shiftingNextColor;
        } else {
            delete state.shiftingNextColor;
        }
        if (entry.booster === BOOSTERS.LINE) {
            state.lineOrientation = entry.lineOrientation ?? 'horizontal';
        } else {
            delete state.lineOrientation;
        }
        state.hard = entry.hard;
        if (entry.hard) {
            state.hardStage = this.normalizeHardStage(entry.hardStage) ?? 1;
            delete state.hardeningStage;
        } else {
            delete state.hardStage;
        }
        if (!entry.hard && typeof entry.hardeningStage === 'number') {
            state.hardeningStage = this.normalizeHardeningStage(entry.hardeningStage) ?? 1;
        } else if (!entry.hard) {
            delete state.hardeningStage;
        }
    }

    private normalizeHardStage(stage?: number): number | null {
        if (typeof stage !== 'number' || !Number.isFinite(stage)) return null;
        const normalized = Math.floor(stage);
        if (normalized < 1 || normalized > 3) return null;
        return normalized;
    }

    private normalizeHardeningStage(stage?: number): number | null {
        if (typeof stage !== 'number' || !Number.isFinite(stage)) return null;
        const normalized = Math.floor(stage);
        if (normalized < 1 || normalized > 3) return null;
        return normalized;
    }

}

export { Board, CellState, CollapseResult, DropMove };

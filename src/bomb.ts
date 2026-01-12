import { BLACK_BOMB_COLOR, BOOSTERS, GRID_SIZE, randomColor, type BoosterType } from './constants.js';
import { Board } from './board.js';
import { SoundManager } from './sound-manager.js';
import { Renderer } from './renderer.js';
import type { LineOrientation } from './types.js';

type BombOptions = {
    board: Board;
    sounds: SoundManager;
    renderer: Renderer;
    destroyCells: (indices: Iterable<number>, sourceIndex?: number) => void;
};

class Bomb {
    private board: Board;
    private sounds: SoundManager;
    private renderer: Renderer;
    private destroyCells: (indices: Iterable<number>, sourceIndex?: number) => void;

    constructor(options: BombOptions) {
        this.board = options.board;
        this.sounds = options.sounds;
        this.renderer = options.renderer;
        this.destroyCells = options.destroyCells;
    }

    applyBoosterEffect(
        booster: BoosterType,
        row: number,
        col: number,
        isBlockerMode: boolean,
        overrideOrientation?: LineOrientation
    ): void {
        const sourceIndex = this.indexAt(row, col);

        this.renderer.animateBombActivation(sourceIndex, booster);
        this.renderer.animateBombExplosion(sourceIndex, booster);

        if (booster === BOOSTERS.LINE) {
            this.sounds.play('lineBomb');
            const orientation =
                overrideOrientation ?? this.board.getLineOrientation(sourceIndex) ?? 'horizontal';
            const affected: number[] =
                orientation === 'horizontal' ? [...this.getRowIndices(row)] : [...this.getColumnIndices(col)];
            if (isBlockerMode) {
                const secondary =
                    orientation === 'horizontal' ? this.getColumnIndices(col) : this.getRowIndices(row);
                affected.push(...secondary);
            }
            this.destroyCells(affected, sourceIndex);
            return;
        }

        if (isBlockerMode) {
            const size = this.getBlockerBoosterSize(booster);
            if (size !== null) {
                this.sounds.play('radiusBomb');
                this.destroySquareArea(row, col, size, sourceIndex);
                return;
            }
        }

        const radius = this.getBoosterRadius(booster);
        if (radius === null) return;
        this.sounds.play('radiusBomb');
        this.destroyCircularArea(row, col, radius, sourceIndex);
    }

    createBooster(index: number, type: BoosterType, orientation?: LineOrientation): void {
        if (this.board.isBlockerGenerator(index)) return;
        if (type === BOOSTERS.BURST_LARGE) {
            this.board.setCellColor(index, BLACK_BOMB_COLOR);
        } else {
            this.board.setCellColor(index, randomColor());
        }
        this.board.setBooster(index, type);
        if (type === BOOSTERS.LINE) {
            this.board.setLineOrientation(index, orientation ?? 'horizontal');
        } else {
            this.board.setLineOrientation(index, null);
        }
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    spawnFallingBomb(index: number): void {
        if (this.board.isBlockerGenerator(index)) return;
        this.board.setCellColor(index, randomColor());
        this.board.setBooster(index, BOOSTERS.BURST_SMALL);
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    combineBombs(
        centers: { row: number; col: number; booster: BoosterType; orientation?: LineOrientation }[],
        isBlockerMode: boolean
    ): void {
        if (centers.length < 2) return;

        const centerIndices = centers.map((c) => this.indexAt(c.row, c.col));
        const boosters = centers.map((c) => c.booster);
        const comboStrength = this.getComboStrength(boosters);
        this.renderer.animateBombCombo(centerIndices, comboStrength);

        const affected = new Set<number>();
        centers.forEach((center) => {
            const impact = this.collectBombImpact(center, isBlockerMode);
            impact.forEach((idx) => affected.add(idx));
        });
        if (!isBlockerMode) {
            this.addBoundingRectCells(centers, affected);
        }
        centers.forEach((center) => {
            const index = this.indexAt(center.row, center.col);
            this.board.setBooster(index, BOOSTERS.NONE);
            this.board.setLineOrientation(index, null);
        });
        this.destroyCells(affected);
    }

    private addBoundingRectCells(
        centers: { row: number; col: number }[],
        affected: Set<number>
    ): void {
        if (centers.length < 2) return;
        const rows = centers.map((center) => center.row);
        const cols = centers.map((center) => center.col);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                affected.add(this.indexAt(r, c));
            }
        }
    }

    private collectBombImpact(center: { row: number; col: number; booster: BoosterType; orientation?: LineOrientation }, isBlockerMode: boolean): Set<number> {
        if (center.booster === BOOSTERS.LINE) {
            return this.collectLineImpact(center.row, center.col, center.orientation ?? 'horizontal', isBlockerMode);
        }
        if (isBlockerMode) {
            const size = this.getBlockerBoosterSize(center.booster) ?? 3;
            return this.collectSquareArea(center.row, center.col, size);
        }
        const radius = this.getBoosterRadius(center.booster);
        if (radius === null) {
            return new Set<number>();
        }
        return this.collectCircularArea(center.row, center.col, radius);
    }

    private collectLineImpact(row: number, col: number, orientation: LineOrientation, isBlockerMode: boolean): Set<number> {
        const affected = new Set<number>();
        const primary = orientation === 'vertical' ? this.getColumnIndices(col) : this.getRowIndices(row);
        primary.forEach((idx) => affected.add(idx));
        if (isBlockerMode) {
            const secondary = orientation === 'vertical' ? this.getRowIndices(row) : this.getColumnIndices(col);
            secondary.forEach((idx) => affected.add(idx));
        }
        return affected;
    }

    private getCombinedCircularRadius(
        centers: { booster: BoosterType }[]
    ): number {
        const radii = centers
            .map((center) => this.getBoosterRadius(center.booster))
            .filter((radius): radius is number => radius !== null);
        if (radii.length === 0) {
            return 1;
        }
        const sum = radii.reduce((acc, value) => acc + value, 0);
        return Math.min(GRID_SIZE, sum + 0.5);
    }

    private getCombinedBlockSize(
        centers: { booster: BoosterType }[]
    ): number {
        const sizes = centers
            .map((center) => this.getBlockerBoosterSize(center.booster))
            .filter((size): size is number => size !== null);
        if (sizes.length === 0) {
            return 3;
        }
        const sum = sizes.reduce((acc, value) => acc + value, 0);
        const candidate = Math.max(3, sum - (sizes.length - 1));
        return Math.min(GRID_SIZE, candidate);
    }

    private getBlockerBoosterSize(booster: BoosterType): number | null {
        if (booster === BOOSTERS.BURST_SMALL) return 3;
        if (booster === BOOSTERS.BURST_MEDIUM) return 4;
        if (booster === BOOSTERS.BURST_LARGE) return 6;
        return null;
    }

    private destroySquareArea(row: number, col: number, size: number, sourceIndex?: number): void {
        const affected = this.collectSquareArea(row, col, size);
        this.destroyCells(affected, sourceIndex);
    }

    private collectSquareArea(row: number, col: number, size: number): Set<number> {
        const affected = new Set<number>();
        if (size <= 0) return affected;
        const halfBefore = Math.floor((size - 1) / 2);
        const halfAfter = size - 1 - halfBefore;
        const startRow = Math.max(0, row - halfBefore);
        const endRow = Math.min(GRID_SIZE - 1, row + halfAfter);
        const startCol = Math.max(0, col - halfBefore);
        const endCol = Math.min(GRID_SIZE - 1, col + halfAfter);
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                affected.add(this.indexAt(r, c));
            }
        }
        return affected;
    }

    private getBoosterRadius(booster: BoosterType): number | null {
        if (booster === BOOSTERS.BURST_SMALL) return 1;
        if (booster === BOOSTERS.BURST_MEDIUM) return 1.5;
        if (booster === BOOSTERS.BURST_LARGE) return 2;
        return null;
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

    private destroyCircularArea(row: number, col: number, radius: number, sourceIndex?: number): void {
        const affected = this.collectCircularArea(row, col, radius);
        this.destroyCells(affected, sourceIndex);
    }

    private collectCircularArea(row: number, col: number, radius: number): Set<number> {
        const affected = new Set<number>();
        const range = Math.ceil(radius);
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const targetRow = row + dx;
                const targetCol = col + dy;
                if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) continue;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius + 0.001) {
                    affected.add(this.indexAt(targetRow, targetCol));
                }
            }
        }
        return affected;
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }

    private getComboStrength(boosters: BoosterType[]): number {
        const getBoosterWeight = (booster: BoosterType): number => {
            if (booster === BOOSTERS.BURST_SMALL) return 1;
            if (booster === BOOSTERS.LINE) return 2;
            if (booster === BOOSTERS.BURST_MEDIUM) return 3;
            if (booster === BOOSTERS.BURST_LARGE) return 4;
            return 0;
        };

        const totalWeight = boosters.reduce((sum, b) => sum + getBoosterWeight(b), 0);
        const maxPossibleWeight = boosters.length * 4;
        return totalWeight / maxPossibleWeight;
    }
}

export { Bomb };

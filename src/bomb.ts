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
        this.board.setCellColor(index, randomColor());
        this.board.setBooster(index, BOOSTERS.BURST_SMALL);
        this.renderer.updateCell(index, this.board.getCellState(index));
    }

    private getBlockerBoosterSize(booster: BoosterType): number | null {
        if (booster === BOOSTERS.BURST_SMALL) return 3;
        if (booster === BOOSTERS.BURST_MEDIUM) return 4;
        if (booster === BOOSTERS.BURST_LARGE) return 6;
        return null;
    }

    private destroySquareArea(row: number, col: number, size: number, sourceIndex?: number): void {
        if (size <= 0) return;
        const halfBefore = Math.floor((size - 1) / 2);
        const halfAfter = size - 1 - halfBefore;
        const startRow = Math.max(0, row - halfBefore);
        const endRow = Math.min(GRID_SIZE - 1, row + halfAfter);
        const startCol = Math.max(0, col - halfBefore);
        const endCol = Math.min(GRID_SIZE - 1, col + halfAfter);
        const affected: number[] = [];
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                affected.push(this.indexAt(r, c));
            }
        }
        this.destroyCells(affected, sourceIndex);
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
        this.destroyCells(affected, sourceIndex);
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }
}

export { Bomb };

import { Board } from './board.js';
import { Renderer } from './renderer.js';

const SUGAR_CHEST_REWARD = 1;

type SugarChestManagerOptions = {
    board: Board;
    renderer: Renderer;
    isPerformanceMode: () => boolean;
    getAnimationDelay: (duration: number) => number;
    defer: (callback: () => void, delay: number) => void;
    onSugarCoins: (amount: number) => void;
    getRowCol: (index: number) => { row: number; col: number };
    getAdjacentIndices: (row: number, col: number) => number[];
};

class SugarChestManager {
    private board: Board;
    private renderer: Renderer;
    private isPerformanceMode: () => boolean;
    private getAnimationDelay: (duration: number) => number;
    private defer: (callback: () => void, delay: number) => void;
    private onSugarCoins: (amount: number) => void;
    private getRowCol: (index: number) => { row: number; col: number };
    private getAdjacentIndices: (row: number, col: number) => number[];

    constructor(options: SugarChestManagerOptions) {
        this.board = options.board;
        this.renderer = options.renderer;
        this.isPerformanceMode = options.isPerformanceMode;
        this.getAnimationDelay = options.getAnimationDelay;
        this.defer = options.defer;
        this.onSugarCoins = options.onSugarCoins;
        this.getRowCol = options.getRowCol;
        this.getAdjacentIndices = options.getAdjacentIndices;
    }

    advanceNearMatches(matched: Set<number>): void {
        if (matched.size === 0) return;
        const upgraded = new Set<number>();
        matched.forEach((idx) => {
            const { row, col } = this.getRowCol(idx);
            this.getAdjacentIndices(row, col).forEach((neighbor) => {
                if (upgraded.has(neighbor)) return;
                if (!this.board.isSugarChest(neighbor)) return;
                upgraded.add(neighbor);
                this.handleHit(neighbor, true);
            });
        });
    }

    handleHit(index: number, triggeredByMatch: boolean): boolean {
        if (!this.board.isSugarChest(index)) return false;
        const stage = this.board.getSugarChestStage(index) ?? 1;
        if (stage >= 4) {
            if (triggeredByMatch) {
                this.destroy(index);
            }
            return true;
        }
        this.board.setSugarChestStage(index, stage + 1);
        this.renderer.updateCell(index, this.board.getCellState(index));
        return true;
    }

    private destroy(index: number): void {
        if (!this.board.isSugarChest(index)) return;
        if (!this.isPerformanceMode()) {
            this.renderer.emitCellParticles(index, '#fcd34d', {
                count: 12,
                minDistance: 10,
                maxDistance: 24,
                minDuration: 0.6,
                maxDuration: 0.9
            });
        }
        this.renderer.markCellExploding(index);
        this.defer(() => {
            this.renderer.clearCellExplosion(index);
            this.board.removeSugarChest(index);
            this.board.clearCell(index);
            this.renderer.updateCell(index, this.board.getCellState(index));
            this.renderer.showSugarCoinReward(index, SUGAR_CHEST_REWARD);
            this.onSugarCoins(SUGAR_CHEST_REWARD);
        }, this.getAnimationDelay(300));
    }
}

export { SugarChestManager };

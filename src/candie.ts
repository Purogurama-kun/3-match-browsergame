import { BOOSTERS, type BoosterType } from './constants.js';
import { Board } from './board.js';
import { Renderer } from './renderer.js';
import { SugarChestManager } from './sugar-chest-manager.js';
import type { ParticleOptions } from './particle-effect.js';

type CandieOptions = {
    board: Board;
    renderer: Renderer;
    sugarChests: SugarChestManager;
    isPerformanceMode: () => boolean;
    defer: (callback: () => void, delay: number) => void;
    getAnimationDelay: (duration: number) => number;
    awardScore: (basePoints: number) => void;
    onColorCleared: (color: string) => void;
    updateHud: () => void;
    baseCellPoints: number;
};

class Candie {
    private board: Board;
    private renderer: Renderer;
    private sugarChests: SugarChestManager;
    private isPerformanceMode: () => boolean;
    private defer: (callback: () => void, delay: number) => void;
    private getAnimationDelay: (duration: number) => number;
    private awardScore: (basePoints: number) => void;
    private onColorCleared: (color: string) => void;
    private updateHud: () => void;
    private baseCellPoints: number;

    constructor(options: CandieOptions) {
        this.board = options.board;
        this.renderer = options.renderer;
        this.sugarChests = options.sugarChests;
        this.isPerformanceMode = options.isPerformanceMode;
        this.defer = options.defer;
        this.getAnimationDelay = options.getAnimationDelay;
        this.awardScore = options.awardScore;
        this.onColorCleared = options.onColorCleared;
        this.updateHud = options.updateHud;
        this.baseCellPoints = options.baseCellPoints;
    }

    destroyCell(index: number): void {
        if (this.board.isBlockedIndex(index)) return;
        if (this.board.isSugarChest(index)) {
            this.sugarChests.handleHit(index, false);
            return;
        }
        const isGenerator = this.board.isBlockerGenerator(index);
        if (this.board.isHardCandy(index)) {
            if (isGenerator) {
                this.renderer.animateGeneratorHit(index);
            }
            this.board.softenCandy(index);
            this.renderer.updateCell(index, this.board.getCellState(index));
            return;
        }
        const booster = this.board.getCellBooster(index);
        const color = this.board.getCellColor(index);
        if ((!color && booster === BOOSTERS.NONE) || this.renderer.isCellExploding(index)) return;
        if (!this.isPerformanceMode()) {
            this.renderer.emitCellParticles(index, color || null, this.getParticleOptionsForBooster(booster));
        }
        if (isGenerator) {
            this.renderer.animateGeneratorHit(index);
        }
        this.renderer.markCellExploding(index);
        this.defer(() => {
            this.renderer.clearCellExplosion(index);
            this.board.clearCell(index);
            this.awardScore(this.baseCellPoints);
            if (color) {
                this.onColorCleared(color);
            }
            this.updateHud();
            this.renderer.updateCell(index, this.board.getCellState(index));
        }, this.getAnimationDelay(300));
    }

    destroyCells(indices: Iterable<number>): void {
        const unique = new Set(indices);
        unique.forEach((idx) => this.destroyCellAndMaybeFinishGenerator(idx));
    }

    destroyCellAndMaybeFinishGenerator(index: number): void {
        const generatorWasHard = this.board.isBlockerGenerator(index) && this.board.isHardCandy(index);
        this.destroyCell(index);
        if (generatorWasHard && this.board.isBlockerGenerator(index)) {
            this.destroyCell(index);
        }
    }

    private getParticleOptionsForBooster(booster: BoosterType): ParticleOptions {
        const baseOptions: ParticleOptions = {
            count: 16,
            minDistance: 16,
            maxDistance: 28,
            minDuration: 0.58,
            maxDuration: 0.92,
            delayVariance: 0.2
        };
        if (booster === BOOSTERS.LINE) {
            return {
                ...baseOptions,
                count: 22,
                minDistance: 22,
                maxDistance: 34,
                minDuration: 0.72,
                maxDuration: 1.02,
                accentColor: '#fde047'
            };
        }
        if (booster === BOOSTERS.BURST_SMALL) {
            return {
                ...baseOptions,
                count: 24,
                minDistance: 24,
                maxDistance: 38,
                minDuration: 0.78,
                maxDuration: 1.05,
                accentColor: '#4ade80'
            };
        }
        if (booster === BOOSTERS.BURST_MEDIUM) {
            return {
                ...baseOptions,
                count: 28,
                minDistance: 28,
                maxDistance: 44,
                minDuration: 0.86,
                maxDuration: 1.18,
                delayVariance: 0.24,
                accentColor: '#fb923c'
            };
        }
        if (booster === BOOSTERS.BURST_LARGE) {
            return {
                ...baseOptions,
                count: 34,
                minDistance: 32,
                maxDistance: 52,
                minDuration: 0.95,
                maxDuration: 1.35,
                delayVariance: 0.28,
                accentColor: '#67e8f9'
            };
        }
        return baseOptions;
    }
}

export { Candie };

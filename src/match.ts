import { BOOSTERS, GRID_SIZE, type BoosterType } from './constants.js';
import { MatchScanner } from './match-scanner.js';
import { SoundManager } from './sound-manager.js';
import { Renderer } from './renderer.js';
import { Candie } from './candie.js';
import { HardCandy } from './hard-candy.js';
import { SugarChestManager } from './sugar-chest-manager.js';
import type { LineOrientation } from './types.js';
import type { MatchResult } from './match-scanner.js';

type MatchContext = {
    swap: { cellA: number; cellB: number } | null;
};

type MatchOptions = {
    matchScanner: MatchScanner;
    sounds: SoundManager;
    renderer: Renderer;
    candie: Candie;
    hardCandy: HardCandy;
    sugarChests: SugarChestManager;
    isPerformanceMode: () => boolean;
    defer: (callback: () => void, delay: number) => void;
    getAnimationDelay: (duration: number) => number;
    createBooster: (index: number, type: BoosterType, orientation?: LineOrientation) => void;
    activateBooster: (index: number) => void;
    getCellBooster: (index: number) => BoosterType;
    getCellColor: (index: number) => string;
    isBlockerGenerator: (index: number) => boolean;
    getAdjacentIndices: (row: number, col: number) => number[];
    dropCells: () => void;
    finalizeMoveScore: () => void;
    finishPowerupIfNeeded: () => void;
    onBoardSettled: () => void;
    scheduleHint: () => void;
    getMatchContext: () => MatchContext;
    onMatchesDetected?: (result: MatchResult, context: MatchContext) => void;
};

class Match {
    private matchScanner: MatchScanner;
    private sounds: SoundManager;
    private renderer: Renderer;
    private candie: Candie;
    private hardCandy: HardCandy;
    private sugarChests: SugarChestManager;
    private isPerformanceMode: () => boolean;
    private defer: (callback: () => void, delay: number) => void;
    private getAnimationDelay: (duration: number) => number;
    private createBooster: (index: number, type: BoosterType, orientation?: LineOrientation) => void;
    private activateBooster: (index: number) => void;
    private getCellBooster: (index: number) => BoosterType;
    private getCellColor: (index: number) => string;
    private isBlockerGenerator: (index: number) => boolean;
    private getAdjacentIndices: (row: number, col: number) => number[];
    private dropCells: () => void;
    private finalizeMoveScore: () => void;
    private finishPowerupIfNeeded: () => void;
    private onBoardSettled: () => void;
    private scheduleHint: () => void;
    private getMatchContext: () => MatchContext;
    private onMatchesDetected: ((result: MatchResult, context: MatchContext) => void) | null;

    constructor(options: MatchOptions) {
        this.matchScanner = options.matchScanner;
        this.sounds = options.sounds;
        this.renderer = options.renderer;
        this.candie = options.candie;
        this.hardCandy = options.hardCandy;
        this.sugarChests = options.sugarChests;
        this.isPerformanceMode = options.isPerformanceMode;
        this.defer = options.defer;
        this.getAnimationDelay = options.getAnimationDelay;
        this.createBooster = options.createBooster;
        this.activateBooster = options.activateBooster;
        this.getCellBooster = options.getCellBooster;
        this.getCellColor = options.getCellColor;
        this.isBlockerGenerator = options.isBlockerGenerator;
        this.getAdjacentIndices = options.getAdjacentIndices;
        this.dropCells = options.dropCells;
        this.finalizeMoveScore = options.finalizeMoveScore;
        this.finishPowerupIfNeeded = options.finishPowerupIfNeeded;
        this.onBoardSettled = options.onBoardSettled;
        this.scheduleHint = options.scheduleHint;
        this.getMatchContext = options.getMatchContext;
        this.onMatchesDetected = options.onMatchesDetected ?? null;
    }

    findMatches(): MatchResult {
        return this.matchScanner.findMatches();
    }

    checkMatches(): void {
        const matchResult = this.findMatches();
        const context = this.getMatchContext();
        this.onMatchesDetected?.(matchResult, context);
        const { matched, boostersToCreate } = matchResult;
        this.hardCandy.softenAdjacentHardCandies(matched);
        this.sugarChests.advanceNearMatches(matched);
        this.destroyAdjacentGenerators(matched);

        if (matched.size > 0) {
            this.sounds.play('match');
            if (!this.isPerformanceMode()) {
                this.renderer.screenShake();
            }
            matched.forEach((idx) => {
                const booster = this.getCellBooster(idx);
                if (booster !== BOOSTERS.NONE) {
                    this.activateBooster(idx);
                    return;
                }
                this.candie.destroyCell(idx);
            });
            this.defer(() => {
                boostersToCreate.forEach((b) => this.createBooster(b.index, b.type, b.orientation));
                this.dropCells();
            }, this.getAnimationDelay(350));
            return;
        }

        this.finalizeMoveScore();
        this.finishPowerupIfNeeded();
        this.onBoardSettled();
        this.scheduleHint();
    }

    private destroyAdjacentGenerators(matched: Set<number>): void {
        if (matched.size === 0) return;
        const targets = new Set<number>();
        matched.forEach((index) => {
            const color = this.getCellColor(index);
            if (!color) return;
            const { row, col } = this.getRowCol(index);
            this.getAdjacentIndices(row, col).forEach((neighbor) => {
                if (!this.isBlockerGenerator(neighbor)) return;
                if (this.getCellColor(neighbor) !== color) return;
                targets.add(neighbor);
            });
        });
        targets.forEach((index) => this.candie.destroyCellAndMaybeFinishGenerator(index));
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }
}

export { Match };
export type { MatchContext };

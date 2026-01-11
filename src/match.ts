import { BOOSTERS, type BoosterType } from './constants.js';
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
}

export { Match };
export type { MatchContext };

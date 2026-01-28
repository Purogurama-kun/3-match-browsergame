import { BoosterType, createFreshPowerupInventory } from './constants.js';
import { BoardConfig, GameModeState, ModeContext } from './game-mode-state.js';
import { getBlockerModeConfig, mapDifficultyFromTier, type BlockerModeConfig } from './mode-config.js';
import { GameState } from './types.js';
import { t } from './i18n.js';

class BlockerModeState implements GameModeState {
    readonly id = 'blocker';
    private personalBest: number;
    private moves: number;
    private difficultyTier: number;
    private hardCandyChance: number;
    private config: BlockerModeConfig;

    constructor(bestScore: number) {
        this.personalBest = Math.max(0, Math.floor(Number.isFinite(bestScore) ? bestScore : 0));
        this.moves = 0;
        this.difficultyTier = 0;
        this.hardCandyChance = 0.05;
        this.config = getBlockerModeConfig();
    }

    enter(context: ModeContext): GameState {
        this.config = getBlockerModeConfig();
        this.moves = 0;
        this.difficultyTier = 0;
        this.hardCandyChance = this.config.startingHardCandyChance;
        const state: GameState = {
            mode: 'blocker',
            selected: null,
            score: 0,
            bestScore: this.personalBest,
            level: 1,
            targetScore: this.computeBlockerTarget(this.personalBest, 0),
            movesLeft: Number.POSITIVE_INFINITY,
            goals: [],
            difficulty: 'easy',
            comboMultiplier: 1,
            comboChainBonus: 0,
            comboChainCount: 0,
            powerups: createFreshPowerupInventory()
            ,
            cellShapeMode: 'square'
        };
        context.getHud().setStatus(t('blocker.status.started'), '♾️');
        return state;
    }

    exit(_context: ModeContext): void {
        // Nothing to clean up yet.
    }

    canStartMove(_state: GameState): boolean {
        return true;
    }

    consumeMove(_state: GameState): void {
        // Blocker mode does not reduce a move counter.
    }

    handleMoveResolved(state: GameState, context: ModeContext): void {
        this.trackBlockerHighScore(state, context);
        this.moves++;
        if (this.moves % this.config.hardeningIntervalMoves === 0) {
            this.difficultyTier++;
            const hardenCount =
                this.config.hardenBaseCount + Math.floor(this.difficultyTier / this.config.hardenTierDivisor);
            context.hardenCells(hardenCount);
            this.refreshDifficulty(state);
            context.getHud().setStatus(t('blocker.status.moreHardCandy'), '🧊');
        }
        this.updateBlockerTargetScore(state);
        context.updateHud(state);
    }

    handleBoardSettled(state: GameState, context: ModeContext): void {
        this.checkForCompletion(state, context);
    }

    checkForCompletion(state: GameState, context: ModeContext): void {
        if (context.isModalVisible()) return;
        if (context.hasAnyValidMove()) return;
        this.trackBlockerHighScore(state, context);
        context.finishBlockerRun(state.score, this.personalBest);
    }

    handleColorCleared(_state: GameState, _color: string, _context: ModeContext): void {
        // Blocker mode has no color goals.
    }

    handleBoosterUsed(_state: GameState, _booster: BoosterType, _context: ModeContext): void {
        // Blocker mode has no booster goals.
    }

    handleHardCandyHit(_state: GameState, _context: ModeContext): void {
        // Blocker mode does not track hard candy goals.
    }

    handleCollectionItems(_state: GameState, _amount: number, _context: ModeContext): void {
        // Blocker mode does not track collection goals.
    }

    getBoardConfig(): BoardConfig {
        return { blockerGenerators: this.config.generatorIndices };
    }

    shouldSpawnHardCandy(_state: GameState): boolean {
        return Math.random() < this.hardCandyChance;
    }

    onBoardCreated(_state: GameState, context: ModeContext): void {
        context.ensurePlayableBoard(this.getBoardConfig());
    }

    private computeBlockerTarget(bestScore: number, currentScore: number): number {
        return Math.max(this.config.targetScoreBase, bestScore, currentScore + this.config.targetScoreStep);
    }

    private updateBlockerTargetScore(state: GameState): void {
        state.targetScore = this.computeBlockerTarget(this.personalBest, state.score);
    }

    private refreshDifficulty(state: GameState): void {
        this.hardCandyChance = Math.min(
            this.config.maxHardCandyChance,
            this.config.startingHardCandyChance + this.difficultyTier * this.config.hardCandyChancePerTier
        );
        state.level = this.difficultyTier + 1;
        state.difficulty = mapDifficultyFromTier(this.difficultyTier, this.config.difficultyTiers);
    }

    private trackBlockerHighScore(state: GameState, context: ModeContext): void {
        if (state.score <= this.personalBest) return;
        this.personalBest = state.score;
        state.bestScore = this.personalBest;
        this.updateBlockerTargetScore(state);
        context.notifyBlockerHighScore(this.personalBest);
        context.getHud().setStatus(t('blocker.status.newHighscore'), '🏆');
    }

}

export { BlockerModeState };

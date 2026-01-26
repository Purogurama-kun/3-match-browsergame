import { Renderer } from './renderer.js';
import { SoundManager } from './sound-manager.js';
import { t, TranslationKey } from './i18n.js';
import type { GameState } from './types.js';
import type { ComboChainBonusStep, ComboMultiplierStep, MoveEvaluationConfig } from './game-config.js';

type MultiplierTrackerOptions = {
    renderer: Renderer;
    sounds: SoundManager;
    minMultiplier: number;
    maxMultiplier: number;
    steps: ComboMultiplierStep[];
    chainBonuses: ComboChainBonusStep[];
    evaluation: MoveEvaluationConfig;
};

class MultiplierTracker {
    private renderer: Renderer;
    private sounds: SoundManager;
    private minMultiplier: number;
    private maxMultiplier: number;
    private steps: ComboMultiplierStep[];
    private chainBonuses: ComboChainBonusStep[];
    private evaluation: MoveEvaluationConfig;
    private state: GameState | null = null;
    private moveActive = false;
    private currentMoveScore = 0;
    private currentMoveBaseScore = 0;
    private goodMoveChain = 0;

    constructor(options: MultiplierTrackerOptions) {
        this.renderer = options.renderer;
        this.sounds = options.sounds;
        this.minMultiplier = options.minMultiplier;
        this.maxMultiplier = options.maxMultiplier;
        this.steps = options.steps;
        this.chainBonuses = options.chainBonuses;
        this.evaluation = options.evaluation;
    }

    setState(state: GameState): void {
        this.state = state;
        this.resetChain();
    }

    beginMove(): void {
        this.moveActive = true;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
    }

    resetMove(): void {
        this.moveActive = false;
        this.currentMoveScore = 0;
        this.currentMoveBaseScore = 0;
    }

    resetChain(): void {
        this.goodMoveChain = 0;
        if (this.state) {
            this.state.comboChainBonus = 0;
            this.state.comboChainCount = 0;
        }
    }

    isMoveActive(): boolean {
        return this.moveActive;
    }

    awardScore(basePoints: number, onScoreAwarded?: (basePoints: number) => void): void {
        const state = this.getState();
        const effective = Math.round(basePoints * state.comboMultiplier);
        state.score += effective;
        this.currentMoveScore += effective;
        this.currentMoveBaseScore += basePoints;
        onScoreAwarded?.(basePoints);
    }

    finalizeMoveScore(): boolean {
        if (!this.moveActive) return false;
        const state = this.getState();
        const baseDelta = this.calculateMultiplierDelta(this.currentMoveBaseScore);
        const chainBonus = this.resolveChainBonus(this.currentMoveBaseScore);
        const delta = baseDelta + chainBonus;
        state.comboMultiplier = this.clampMultiplier(state.comboMultiplier + delta);
        this.renderer.renderMultiplierStatus(state.comboMultiplier, delta, this.currentMoveScore);
        this.showMoveEvaluation(this.currentMoveBaseScore);
        this.resetMove();
        return true;
    }

    private showMoveEvaluation(baseMoveScore: number): void {
        const message = this.getMoveEvaluationMessage(baseMoveScore);
        if (!message) return;
        this.renderer.showMoveEvaluation(message, this.sounds.isEnabled());
        this.showMiraSpeech(baseMoveScore);
    }

    private getMoveEvaluationMessage(baseMoveScore: number): string {
        for (const tier of this.evaluation.tiers) {
            if (baseMoveScore >= tier.minScore) {
                return tier.label;
            }
        }
        return '';
    }

    private showMiraSpeech(baseMoveScore: number): void {
        const tier = this.getMiraTier(baseMoveScore);
        if (!tier) return;
        const index = Math.floor(Math.random() * 3);
        const key = `mira.evaluation.${tier}.${index}` as TranslationKey;
        this.renderer.showMiraSpeech(t(key), '💬');
    }

    private resolveChainBonus(baseMoveScore: number): number {
        if (this.isGoodMove(baseMoveScore)) {
            this.goodMoveChain += 1;
        } else {
            this.goodMoveChain = 0;
        }
        const bonus = this.getChainBonusForCount(this.goodMoveChain);
        if (this.state) {
            this.state.comboChainBonus = bonus;
            this.state.comboChainCount = this.goodMoveChain;
        }
        return bonus;
    }

    private isGoodMove(baseMoveScore: number): boolean {
        const threshold = this.getGoodMoveThreshold();
        return baseMoveScore >= threshold;
    }

    private getGoodMoveThreshold(): number {
        let threshold = Number.POSITIVE_INFINITY;
        this.evaluation.tiers.forEach((tier) => {
            if (
                tier.miraTier === 'decent' ||
                tier.miraTier === 'good' ||
                tier.miraTier === 'great' ||
                tier.miraTier === 'epic' ||
                tier.miraTier === 'legendary'
            ) {
                threshold = Math.min(threshold, tier.minScore);
            }
        });
        return Number.isFinite(threshold) ? threshold : Number.POSITIVE_INFINITY;
    }

    private getChainBonusForCount(chainCount: number): number {
        let resolved = 0;
        this.chainBonuses.forEach((step) => {
            if (chainCount >= step.minChain) {
                resolved = step.bonus;
            }
        });
        return resolved;
    }

    private getMiraTier(baseMoveScore: number): 'legendary' | 'epic' | 'great' | 'good' | 'decent' | null {
        for (const tier of this.evaluation.tiers) {
            if (baseMoveScore >= tier.minScore) {
                return tier.miraTier ?? null;
            }
        }
        return null;
    }

    // Base move score maps directly to cell clears, so multiplier adjustments ignore any combo boost.
    private calculateMultiplierDelta(baseMoveScore: number): number {
        for (const step of this.steps) {
            if (step.exactScore !== undefined && baseMoveScore === step.exactScore) return step.delta;
            if (step.minScore !== undefined && step.maxScore !== undefined) {
                if (baseMoveScore >= step.minScore && baseMoveScore <= step.maxScore) return step.delta;
                continue;
            }
            if (step.minScore !== undefined && baseMoveScore >= step.minScore) return step.delta;
            if (step.maxScore !== undefined && baseMoveScore <= step.maxScore) return step.delta;
        }
        return 0;
    }

    private clampMultiplier(multiplier: number): number {
        const rounded = Math.round(multiplier * 100) / 100;
        return Math.min(this.maxMultiplier, Math.max(this.minMultiplier, rounded));
    }

    private getState(): GameState {
        if (!this.state) {
            throw new Error('MultiplierTracker used before state is set');
        }
        return this.state;
    }
}

export { MultiplierTracker };

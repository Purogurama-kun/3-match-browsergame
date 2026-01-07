import { Renderer } from './renderer.js';
import { SoundManager } from './sound-manager.js';
import type { GameState } from './types.js';

type MultiplierTrackerOptions = {
    renderer: Renderer;
    sounds: SoundManager;
    minMultiplier: number;
    maxMultiplier: number;
};

class MultiplierTracker {
    private renderer: Renderer;
    private sounds: SoundManager;
    private minMultiplier: number;
    private maxMultiplier: number;
    private state: GameState | null = null;
    private moveActive = false;
    private currentMoveScore = 0;
    private currentMoveBaseScore = 0;

    constructor(options: MultiplierTrackerOptions) {
        this.renderer = options.renderer;
        this.sounds = options.sounds;
        this.minMultiplier = options.minMultiplier;
        this.maxMultiplier = options.maxMultiplier;
    }

    setState(state: GameState): void {
        this.state = state;
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
        const delta = this.calculateMultiplierDelta(this.currentMoveScore);
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
    }

    private getMoveEvaluationMessage(baseMoveScore: number): string {
        if (baseMoveScore >= 1600) return 'Candy Chaos!';
        if (baseMoveScore >= 800) return 'Sweetplosion!';
        if (baseMoveScore >= 400) return 'Candy Blast!';
        if (baseMoveScore >= 200) return 'Candy Frenzy!';
        if (baseMoveScore >= 100) return 'Sweet Heat!';
        return '';
    }

    private calculateMultiplierDelta(moveScore: number): number {
        if (moveScore >= 150) return 0.5;
        if (moveScore >= 90) return 0.35;
        if (moveScore >= 60) return 0.2;
        if (moveScore === 0) return -0.3;
        if (moveScore < 30) return -0.15;
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

import { GameState, SwapMode } from './types.js';
import { getRequiredElement } from './dom.js';

class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.target = getRequiredElement('target');
        this.moves = getRequiredElement('moves');
        this.scoreProgress = getRequiredElement('score-progress');
        this.scoreProgressFill = getRequiredElement('score-progress-fill');
        this.swapModeSelect = this.getSwapModeElement();
    }

    private score: HTMLElement;
    private level: HTMLElement;
    private target: HTMLElement;
    private moves: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private swapModeSelect: HTMLSelectElement;

    render(state: GameState): void {
        this.score.textContent = String(state.score);
        this.level.textContent = String(state.level);
        this.target.textContent = String(state.targetScore);
        this.moves.textContent = String(state.movesLeft);

        this.updateProgress(state.score, state.targetScore);
    }

    getSwapMode(): SwapMode {
        return this.swapModeSelect.value as SwapMode;
    }

    onSwapModeChange(handler: (mode: SwapMode) => void): void {
        this.swapModeSelect.addEventListener('change', () => {
            handler(this.getSwapMode());
        });
    }

    private getSwapModeElement(): HTMLSelectElement {
        const element = getRequiredElement('swap-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Swap mode element is not a select');
        }
        return element;
    }

    private updateProgress(score: number, target: number): void {
        const clampedScore = Math.max(0, score);
        const ratio = Math.min(1, clampedScore / Math.max(1, target));
        this.scoreProgress.setAttribute('aria-valuenow', clampedScore.toString());
        this.scoreProgress.setAttribute('aria-valuemax', target.toString());
        this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
    }
}

export { Hud };

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
    render(state) {
        this.score.textContent = String(state.score);
        this.level.textContent = String(state.level);
        this.target.textContent = String(state.targetScore);
        this.moves.textContent = String(state.movesLeft);
        this.updateProgress(state.score, state.targetScore);
    }
    getSwapMode() {
        return this.swapModeSelect.value;
    }
    onSwapModeChange(handler) {
        this.swapModeSelect.addEventListener('change', () => {
            handler(this.getSwapMode());
        });
    }
    getSwapModeElement() {
        const element = getRequiredElement('swap-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Swap mode element is not a select');
        }
        return element;
    }
    updateProgress(score, target) {
        const clampedScore = Math.max(0, score);
        const ratio = Math.min(1, clampedScore / Math.max(1, target));
        this.scoreProgress.setAttribute('aria-valuenow', clampedScore.toString());
        this.scoreProgress.setAttribute('aria-valuemax', target.toString());
        this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
    }
}
export { Hud };

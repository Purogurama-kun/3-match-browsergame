import { getRequiredElement } from './dom.js';
class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.target = getRequiredElement('target');
        this.moves = getRequiredElement('moves');
        this.swapModeSelect = this.getSwapModeElement();
    }
    render(state) {
        this.score.textContent = 'Punkte: ' + state.score;
        this.level.textContent = 'Level: ' + state.level;
        this.target.textContent = 'Ziel: ' + state.targetScore;
        this.moves.textContent = 'Züge: ' + state.movesLeft;
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
}
export { Hud };

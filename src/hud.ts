import { GameState, SwapMode } from './types.js';
import { getRequiredElement } from './dom.js';

class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.target = getRequiredElement('target');
        this.moves = getRequiredElement('moves');
        this.swapModeSelect = this.getSwapModeElement();
    }

    private score: HTMLElement;
    private level: HTMLElement;
    private target: HTMLElement;
    private moves: HTMLElement;
    private swapModeSelect: HTMLSelectElement;

    render(state: GameState): void {
        this.score.textContent = 'Punkte: ' + state.score;
        this.level.textContent = 'Level: ' + state.level;
        this.target.textContent = 'Ziel: ' + state.targetScore;
        this.moves.textContent = 'Züge: ' + state.movesLeft;
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
}

export { Hud };

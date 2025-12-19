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
        this.optionsToggle = this.getOptionsToggle();
        this.optionsPanel = this.getOptionsPanel();
        this.audioToggle = this.getAudioToggle();
        this.setAudioToggleState(true);
        this.setOptionsVisibility(false);
    }

    private score: HTMLElement;
    private level: HTMLElement;
    private target: HTMLElement;
    private moves: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private swapModeSelect: HTMLSelectElement;
    private optionsToggle: HTMLButtonElement;
    private optionsPanel: HTMLElement;
    private audioToggle: HTMLButtonElement;

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

    onAudioToggle(handler: (enabled: boolean) => void): void {
        this.audioToggle.addEventListener('click', () => {
            const nextState = this.audioToggle.getAttribute('aria-pressed') !== 'true';
            this.setAudioToggleState(nextState);
            handler(nextState);
        });
    }

    initOptionsMenu(): void {
        this.optionsToggle.addEventListener('click', () => {
            const isExpanded = this.optionsToggle.getAttribute('aria-expanded') === 'true';
            this.setOptionsVisibility(!isExpanded);
        });
    }

    setAudioEnabled(enabled: boolean): void {
        this.setAudioToggleState(enabled);
    }

    private getSwapModeElement(): HTMLSelectElement {
        const element = getRequiredElement('swap-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Swap mode element is not a select');
        }
        return element;
    }

    private getOptionsToggle(): HTMLButtonElement {
        const element = getRequiredElement('options-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options toggle is not a button');
        }
        return element;
    }

    private getOptionsPanel(): HTMLElement {
        return getRequiredElement('options-panel');
    }

    private getAudioToggle(): HTMLButtonElement {
        const element = getRequiredElement('audio-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Audio toggle is not a button');
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

    private setOptionsVisibility(visible: boolean): void {
        this.optionsToggle.setAttribute('aria-expanded', String(visible));
        if (visible) {
            this.optionsPanel.removeAttribute('hidden');
            this.optionsToggle.textContent = 'Menü schließen';
        } else {
            this.optionsPanel.setAttribute('hidden', 'true');
            this.optionsToggle.textContent = 'Menü öffnen';
        }
    }

    private setAudioToggleState(enabled: boolean): void {
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? 'Audio an' : 'Audio aus';
    }
}

export { Hud };

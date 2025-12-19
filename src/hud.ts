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
        this.optionsClose = this.getOptionsClose();
        this.optionsModal = this.getOptionsModal();
        this.audioToggle = this.getAudioToggle();
        this.setAudioToggleState(true);
        this.hideOptionsModal();
    }

    private score: HTMLElement;
    private level: HTMLElement;
    private target: HTMLElement;
    private moves: HTMLElement;
    private scoreProgress: HTMLElement;
    private scoreProgressFill: HTMLElement;
    private swapModeSelect: HTMLSelectElement;
    private optionsToggle: HTMLButtonElement;
    private optionsClose: HTMLButtonElement;
    private optionsModal: HTMLElement;
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
            if (isExpanded) {
                this.hideOptionsModal();
            } else {
                this.showOptionsModal();
            }
        });

        this.optionsClose.addEventListener('click', () => this.hideOptionsModal());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideOptionsModal();
            }
        });

        this.optionsModal.addEventListener('click', (event) => {
            if (event.target === this.optionsModal) {
                this.hideOptionsModal();
            }
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

    private getOptionsClose(): HTMLButtonElement {
        const element = getRequiredElement('options-close');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options close is not a button');
        }
        return element;
    }

    private getOptionsModal(): HTMLElement {
        return getRequiredElement('options-modal');
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

    private showOptionsModal(): void {
        this.optionsModal.removeAttribute('hidden');
        this.optionsModal.setAttribute('aria-hidden', 'false');
        this.optionsToggle.setAttribute('aria-expanded', 'true');
        this.optionsToggle.setAttribute('aria-pressed', 'true');
        this.optionsToggle.textContent = 'Menü schließen';
        this.optionsClose.focus();
    }

    private hideOptionsModal(): void {
        this.optionsModal.setAttribute('hidden', 'true');
        this.optionsModal.setAttribute('aria-hidden', 'true');
        this.optionsToggle.setAttribute('aria-expanded', 'false');
        this.optionsToggle.setAttribute('aria-pressed', 'false');
        this.optionsToggle.textContent = 'Menü';
        this.optionsToggle.focus();
    }

    private setAudioToggleState(enabled: boolean): void {
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? 'Audio an' : 'Audio aus';
    }
}

export { Hud };

import { getRequiredElement } from './dom.js';
class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.target = getRequiredElement('target');
        this.moves = getRequiredElement('moves');
        this.scoreProgress = getRequiredElement('score-progress');
        this.scoreProgressFill = getRequiredElement('score-progress-fill');
        this.difficulty = getRequiredElement('difficulty');
        this.goalsList = this.getGoalsListElement();
        this.swapModeSelect = this.getSwapModeElement();
        this.optionsToggle = this.getOptionsToggle();
        this.optionsClose = this.getOptionsClose();
        this.optionsModal = this.getOptionsModal();
        this.audioToggle = this.getAudioToggle();
        this.setAudioToggleState(true);
        this.hideOptionsModal();
    }
    render(state) {
        this.score.textContent = String(state.score);
        this.level.textContent = String(state.level);
        this.target.textContent = String(state.targetScore);
        this.moves.textContent = String(state.movesLeft);
        this.difficulty.textContent = String(state.difficulty);
        this.updateProgress(state.score, state.targetScore);
        this.renderGoals(state.goals);
    }
    getSwapMode() {
        return this.swapModeSelect.value;
    }
    onSwapModeChange(handler) {
        this.swapModeSelect.addEventListener('change', () => {
            handler(this.getSwapMode());
        });
    }
    onAudioToggle(handler) {
        this.audioToggle.addEventListener('click', () => {
            const nextState = this.audioToggle.getAttribute('aria-pressed') !== 'true';
            this.setAudioToggleState(nextState);
            handler(nextState);
        });
    }
    initOptionsMenu() {
        this.optionsToggle.addEventListener('click', () => {
            const isExpanded = this.optionsToggle.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                this.hideOptionsModal();
            }
            else {
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
    setAudioEnabled(enabled) {
        this.setAudioToggleState(enabled);
    }
    getSwapModeElement() {
        const element = getRequiredElement('swap-mode');
        if (!(element instanceof HTMLSelectElement)) {
            throw new Error('Swap mode element is not a select');
        }
        return element;
    }
    getOptionsToggle() {
        const element = getRequiredElement('options-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options toggle is not a button');
        }
        return element;
    }
    getOptionsClose() {
        const element = getRequiredElement('options-close');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Options close is not a button');
        }
        return element;
    }
    getOptionsModal() {
        return getRequiredElement('options-modal');
    }
    getAudioToggle() {
        const element = getRequiredElement('audio-toggle');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Audio toggle is not a button');
        }
        return element;
    }
    getGoalsListElement() {
        const element = getRequiredElement('goals-list');
        if (!(element instanceof HTMLUListElement)) {
            throw new Error('Goals list element is not a list');
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
    renderGoals(goals) {
        this.goalsList.innerHTML = '';
        goals.forEach((goal) => {
            const item = document.createElement('li');
            item.className = 'game__goal';
            const text = document.createElement('span');
            text.className = 'game__goal-text';
            text.textContent = goal.description;
            const progress = document.createElement('span');
            progress.className = 'game__goal-progress';
            progress.textContent = goal.current + '/' + goal.target;
            item.appendChild(text);
            item.appendChild(progress);
            this.goalsList.appendChild(item);
        });
    }
    showOptionsModal() {
        this.optionsModal.removeAttribute('hidden');
        this.optionsModal.setAttribute('aria-hidden', 'false');
        this.optionsToggle.setAttribute('aria-expanded', 'true');
        this.optionsToggle.setAttribute('aria-pressed', 'true');
        this.optionsToggle.textContent = 'Menü schließen';
        this.optionsClose.focus();
    }
    hideOptionsModal() {
        this.optionsModal.setAttribute('hidden', 'true');
        this.optionsModal.setAttribute('aria-hidden', 'true');
        this.optionsToggle.setAttribute('aria-expanded', 'false');
        this.optionsToggle.setAttribute('aria-pressed', 'false');
        this.optionsToggle.textContent = 'Menü';
        this.optionsToggle.focus();
    }
    setAudioToggleState(enabled) {
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? 'Audio an' : 'Audio aus';
    }
}
export { Hud };

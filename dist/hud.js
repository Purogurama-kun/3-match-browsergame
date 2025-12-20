import { BOOSTERS, getColorHex } from './constants.js';
import { getRequiredElement } from './dom.js';
class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.moves = getRequiredElement('moves');
        this.scoreProgress = getRequiredElement('score-progress');
        this.scoreProgressFill = getRequiredElement('score-progress-fill');
        this.statusText = getRequiredElement('status-text');
        this.statusIcon = getRequiredElement('status-icon');
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
        this.score.textContent = state.score + '/' + state.targetScore;
        this.level.textContent = String(state.level);
        this.moves.textContent = String(state.movesLeft);
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
    setStatus(text, icon) {
        this.statusText.textContent = text;
        this.statusIcon.textContent = icon;
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
        this.scoreProgress.setAttribute('aria-valuetext', 'Punktestand ' + clampedScore + ' von ' + target);
        this.scoreProgressFill.style.width = (ratio * 100).toFixed(1) + '%';
    }
    renderGoals(goals) {
        this.goalsList.innerHTML = '';
        goals.forEach((goal) => {
            const item = document.createElement('li');
            item.className = 'game__goal';
            const remaining = Math.max(goal.target - goal.current, 0);
            const visual = this.createGoalVisual(goal);
            const counter = document.createElement('span');
            counter.className = 'game__goal-count';
            counter.textContent = String(remaining);
            const label = document.createElement('span');
            label.className = 'game__goal-label';
            label.textContent = goal.description;
            item.setAttribute('aria-label', goal.description + ' verbleibend: ' + remaining);
            item.appendChild(visual);
            item.appendChild(counter);
            item.appendChild(label);
            this.goalsList.appendChild(item);
        });
    }
    showOptionsModal() {
        this.optionsModal.removeAttribute('hidden');
        this.optionsModal.setAttribute('aria-hidden', 'false');
        this.optionsToggle.setAttribute('aria-expanded', 'true');
        this.optionsToggle.setAttribute('aria-pressed', 'true');
        this.optionsClose.focus();
    }
    hideOptionsModal() {
        this.optionsModal.setAttribute('hidden', 'true');
        this.optionsModal.setAttribute('aria-hidden', 'true');
        this.optionsToggle.setAttribute('aria-expanded', 'false');
        this.optionsToggle.setAttribute('aria-pressed', 'false');
        this.optionsToggle.focus();
    }
    setAudioToggleState(enabled) {
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? 'Audio an' : 'Audio aus';
    }
    createGoalVisual(goal) {
        if (goal.type === 'destroy-color') {
            const chip = document.createElement('span');
            chip.className = 'game__goal-chip game__goal-chip--color';
            chip.style.setProperty('--goal-color', getColorHex(goal.color));
            chip.setAttribute('aria-hidden', 'true');
            return chip;
        }
        const chip = document.createElement('span');
        chip.className = 'game__goal-chip game__goal-chip--booster';
        chip.textContent = this.getBoosterIcon(goal.booster);
        chip.setAttribute('aria-hidden', 'true');
        return chip;
    }
    getBoosterIcon(booster) {
        if (booster === BOOSTERS.LINE)
            return '💣';
        if (booster === BOOSTERS.BURST_SMALL)
            return '🧨';
        if (booster === BOOSTERS.BURST_MEDIUM)
            return '💥';
        if (booster === BOOSTERS.BURST_LARGE)
            return '☢️';
        return '';
    }
}
export { Hud };

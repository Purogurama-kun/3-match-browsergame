function getRequiredElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error('Missing element: ' + id);
    }
    return element;
}
class Hud {
    constructor() {
        this.score = getRequiredElement('score');
        this.level = getRequiredElement('level');
        this.target = getRequiredElement('target');
        this.moves = getRequiredElement('moves');
    }
    render(state) {
        this.score.textContent = 'Punkte: ' + state.score;
        this.level.textContent = 'Level: ' + state.level;
        this.target.textContent = 'Ziel: ' + state.targetScore;
        this.moves.textContent = 'Züge: ' + state.movesLeft;
    }
}
export { Hud };

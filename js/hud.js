class Hud {
    constructor() {
        this.score = document.getElementById('score');
        this.level = document.getElementById('level');
        this.target = document.getElementById('target');
        this.moves = document.getElementById('moves');
    }

    render(state) {
        this.score.textContent = 'Punkte: ' + state.score;
        this.level.textContent = 'Level: ' + state.level;
        this.target.textContent = 'Ziel: ' + state.targetScore;
        this.moves.textContent = 'Züge: ' + state.movesLeft;
    }
}

export { Hud };

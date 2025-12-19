import { GRID_SIZE, BOOSTERS, randomColor } from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';

class Match3Game {
    constructor() {
        this.gameEl = document.getElementById('game');
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.board = new Board(this.gameEl, (cell) => this.handleCellClick(cell));

        this.state = {
            selected: null,
            score: 0,
            level: 1,
            targetScore: 300,
            movesLeft: 20
        };

        this.generation = 0;
        this.pendingTimers = [];
    }

    start() {
        this.createBoard();
    }

    screenShake() {
        this.gameEl.classList.add('shake');
        setTimeout(() => this.gameEl.classList.remove('shake'), 350);
    }

    updateHud() {
        this.hud.render(this.state);
    }

    createBoard() {
        this.generation++;
        this.clearPendingTimers();
        this.board.create();
        this.updateHud();
    }

    handleCellClick(cell) {
        if (this.state.movesLeft <= 0) return;

        if (cell.dataset.booster !== BOOSTERS.NONE) {
            this.activateBooster(cell);
            this.state.movesLeft--;
            this.updateHud();
            this.defer(() => this.dropCells(), 300);
            return;
        }

        if (!this.state.selected) {
            this.state.selected = cell;
            cell.classList.add('selected');
            return;
        }

        if (cell === this.state.selected) {
            this.state.selected.classList.remove('selected');
            this.state.selected = null;
            return;
        }

        if (!this.areAdjacent(this.state.selected, cell)) {
            this.showInvalidMove(this.state.selected);
            return;
        }

        this.board.swapCells(this.state.selected, cell);
        this.state.selected.classList.remove('selected');
        this.state.selected = null;
        this.state.movesLeft--;
        this.updateHud();
        this.defer(() => this.checkMatches(), 120);
    }

    checkMatches() {
        const matched = new Set();
        const boostersToCreate = [];

        const checkLine = (indices) => {
            let streak = 1;
            for (let i = 1; i <= indices.length; i++) {
                const curr = i < indices.length ? this.board.getCellColor(this.board.getCell(indices[i])) : null;
                const prev = this.board.getCellColor(this.board.getCell(indices[i - 1]));
                if (curr === prev && curr) {
                    streak++;
                } else {
                    if (streak >= 3 && prev) {
                        const streakCells = [];
                        for (let k = 0; k < streak; k++) streakCells.push(indices[i - 1 - k]);
                        streakCells.forEach((idx) => matched.add(idx));
                        if (streak === 4) boostersToCreate.push({ index: streakCells[1], type: BOOSTERS.LINE });
                        if (streak >= 5) boostersToCreate.push({ index: streakCells[2], type: BOOSTERS.RADIUS });
                    }
                    streak = 1;
                }
            }
        };

        for (let r = 0; r < GRID_SIZE; r++) {
            const indices = [];
            for (let c = 0; c < GRID_SIZE; c++) indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }

        for (let c = 0; c < GRID_SIZE; c++) {
            const indices = [];
            for (let r = 0; r < GRID_SIZE; r++) indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }

        if (matched.size > 0) {
            this.sounds.play('match');
            this.screenShake();
            matched.forEach((idx) => this.destroyCell(idx));
            this.defer(() => {
                boostersToCreate.forEach((b) => this.createBooster(b.index, b.type));
                this.dropCells();
            }, 350);
            return;
        }

        if (this.state.movesLeft <= 0) this.endLevel();
    }

    destroyCell(index) {
        const cell = this.board.getCell(index);
        cell.classList.add('explode');
        this.sounds.play('explosion');
        this.defer(() => {
            this.board.clearCell(cell);
            this.state.score += 10;
            this.updateHud();
            if (this.state.score >= this.state.targetScore) this.endLevel();
        }, 300);
    }

    createBooster(index, type) {
        const cell = this.board.getCell(index);
        this.board.setCellColor(cell, randomColor());
        this.board.setBooster(cell, type);
    }

    activateBooster(cell) {
        const index = Number(cell.dataset.index);
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;

        if (cell.dataset.booster === BOOSTERS.LINE) {
            for (let c = 0; c < GRID_SIZE; c++) this.destroyCell(row * GRID_SIZE + c);
        }
        if (cell.dataset.booster === BOOSTERS.RADIUS) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const r = row + dx;
                    const c = col + dy;
                    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
                        this.destroyCell(r * GRID_SIZE + c);
                    }
                }
            }
        }
    }

    dropCells() {
        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                const i = r * GRID_SIZE + c;
                const cell = this.board.getCell(i);
                if (!this.board.getCellColor(cell)) {
                    for (let k = r - 1; k >= 0; k--) {
                        const above = this.board.getCell(k * GRID_SIZE + c);
                        if (this.board.getCellColor(above)) {
                            this.board.setCellColor(cell, this.board.getCellColor(above));
                            cell.dataset.booster = above.dataset.booster;
                            this.board.updateBoosterVisual(cell);
                            this.board.clearCell(above);
                            break;
                        }
                    }
                    if (!this.board.getCellColor(cell)) {
                        this.board.setCellColor(cell, randomColor());
                    }
                }
            }
        }
        this.defer(() => this.checkMatches(), 200);
    }

    endLevel() {
        if (this.state.score >= this.state.targetScore) {
            this.sounds.play('levelUp');
            alert('Level ' + this.state.level + ' geschafft!');
            this.state.level++;
            this.state.targetScore += 200;
            this.state.movesLeft += 5;
        } else {
            this.sounds.play('levelFail');
            alert('Level verloren!');
            this.state.movesLeft = 20;
        }
        this.state.score = 0;
        this.createBoard();
    }

    areAdjacent(a, b) {
        const aIndex = Number(a.dataset.index);
        const bIndex = Number(b.dataset.index);
        const aRow = Math.floor(aIndex / GRID_SIZE);
        const aCol = aIndex % GRID_SIZE;
        const bRow = Math.floor(bIndex / GRID_SIZE);
        const bCol = bIndex % GRID_SIZE;
        return Math.abs(aRow - bRow) + Math.abs(aCol - bCol) === 1;
    }

    defer(callback, delay) {
        const gen = this.generation;
        const timerId = setTimeout(() => {
            if (this.generation !== gen) return;
            callback();
        }, delay);
        this.pendingTimers.push(timerId);
    }

    clearPendingTimers() {
        this.pendingTimers.forEach((id) => clearTimeout(id));
        this.pendingTimers = [];
    }

    showInvalidMove(cell) {
        cell.classList.add('shake');
        this.defer(() => cell.classList.remove('shake'), 350);
    }
}

export { Match3Game };

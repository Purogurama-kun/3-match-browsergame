import { GRID_SIZE, BOOSTERS, randomColor } from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { getRequiredElement } from './dom.js';
class Match3Game {
    constructor() {
        this.gameEl = getRequiredElement('game');
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.board = new Board(this.gameEl, (cell) => this.handleCellClick(cell));
        this.swapMode = this.hud.getSwapMode();
        this.hud.onSwapModeChange((mode) => {
            this.swapMode = mode;
        });
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
        this.gameEl.classList.add('game__board--shake');
        setTimeout(() => this.gameEl.classList.remove('game__board--shake'), 350);
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
        if (this.state.movesLeft <= 0)
            return;
        if (cell.dataset.booster !== BOOSTERS.NONE) {
            this.activateBooster(cell);
            this.state.movesLeft--;
            this.updateHud();
            this.defer(() => this.dropCells(), 300);
            return;
        }
        if (!this.state.selected) {
            this.state.selected = cell;
            cell.classList.add('game__cell--selected');
            return;
        }
        if (cell === this.state.selected) {
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = null;
            return;
        }
        if (!this.areAdjacent(this.state.selected, cell)) {
            this.showInvalidMove(this.state.selected);
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = cell;
            cell.classList.add('game__cell--selected');
            return;
        }
        this.board.swapCells(this.state.selected, cell);
        const firstSelected = this.state.selected;
        this.state.selected.classList.remove('game__cell--selected');
        this.state.selected = null;
        this.state.movesLeft--;
        this.updateHud();
        if (this.swapMode === 'require-match') {
            const { matched } = this.findMatches();
            if (matched.size === 0) {
                this.board.swapCells(firstSelected, cell);
                this.state.movesLeft++;
                this.updateHud();
                this.showInvalidMove(cell);
                return;
            }
        }
        this.defer(() => this.checkMatches(), 120);
    }
    findMatches() {
        const matched = new Set();
        const boostersToCreate = [];
        const checkLine = (indices) => {
            let streak = 1;
            for (let i = 1; i <= indices.length; i++) {
                const currIndex = i < indices.length ? indices[i] : undefined;
                const prevIndex = indices[i - 1];
                if (prevIndex === undefined) {
                    throw new Error('Missing index at position: ' + (i - 1));
                }
                const curr = currIndex !== undefined
                    ? this.board.getCellColor(this.board.getCell(currIndex))
                    : null;
                const prev = this.board.getCellColor(this.board.getCell(prevIndex));
                if (curr === prev && curr) {
                    streak++;
                }
                else {
                    if (streak >= 3 && prev) {
                        const streakCells = [];
                        for (let k = 0; k < streak; k++) {
                            const streakIndex = indices[i - 1 - k];
                            if (streakIndex !== undefined)
                                streakCells.push(streakIndex);
                        }
                        streakCells.forEach((idx) => matched.add(idx));
                        const lineIndex = streakCells[1];
                        const radiusIndex = streakCells[2];
                        if (streak === 4) {
                            if (lineIndex === undefined) {
                                throw new Error('Missing line booster index');
                            }
                            boostersToCreate.push({ index: lineIndex, type: BOOSTERS.LINE });
                        }
                        if (streak >= 5) {
                            if (radiusIndex === undefined) {
                                throw new Error('Missing radius booster index');
                            }
                            boostersToCreate.push({ index: radiusIndex, type: BOOSTERS.RADIUS });
                        }
                    }
                    streak = 1;
                }
            }
        };
        for (let r = 0; r < GRID_SIZE; r++) {
            const indices = [];
            for (let c = 0; c < GRID_SIZE; c++)
                indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }
        for (let c = 0; c < GRID_SIZE; c++) {
            const indices = [];
            for (let r = 0; r < GRID_SIZE; r++)
                indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }
        return { matched, boostersToCreate };
    }
    checkMatches() {
        const { matched, boostersToCreate } = this.findMatches();
        if (matched.size > 0) {
            const hasRadiusMatch = boostersToCreate.some((boost) => boost.type === BOOSTERS.RADIUS);
            const hasLineMatch = boostersToCreate.some((boost) => boost.type === BOOSTERS.LINE);
            if (hasRadiusMatch) {
                this.sounds.play('radiusBomb');
            }
            else if (hasLineMatch) {
                this.sounds.play('lineBomb');
            }
            else {
                this.sounds.play('match');
            }
            this.screenShake();
            matched.forEach((idx) => this.destroyCell(idx));
            this.defer(() => {
                boostersToCreate.forEach((b) => this.createBooster(b.index, b.type));
                this.dropCells();
            }, 350);
            return;
        }
        if (this.state.movesLeft <= 0)
            this.endLevel();
    }
    destroyCell(index) {
        const cell = this.board.getCell(index);
        cell.classList.add('game__cell--explode');
        this.defer(() => {
            this.board.clearCell(cell);
            this.state.score += 10;
            this.updateHud();
            if (this.state.score >= this.state.targetScore)
                this.endLevel();
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
            this.sounds.play('lineBomb');
            for (let c = 0; c < GRID_SIZE; c++)
                this.destroyCell(row * GRID_SIZE + c);
        }
        if (cell.dataset.booster === BOOSTERS.RADIUS) {
            this.sounds.play('radiusBomb');
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
        }
        else {
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
            if (this.generation !== gen)
                return;
            callback();
        }, delay);
        this.pendingTimers.push(timerId);
    }
    clearPendingTimers() {
        this.pendingTimers.forEach((id) => clearTimeout(id));
        this.pendingTimers = [];
    }
    showInvalidMove(cell) {
        cell.classList.add('game__cell--shake');
        this.defer(() => cell.classList.remove('game__cell--shake'), 350);
    }
}
export { Match3Game };

import { GRID_SIZE, BOOSTERS, BoosterType, randomColor } from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { GameState, SwapMode, SwipeDirection } from './types.js';
import { getRequiredElement } from './dom.js';

class Match3Game {
    constructor() {
        this.gameEl = getRequiredElement('game');
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.board = new Board(
            this.gameEl,
            (cell) => this.handleCellClick(cell),
            (cell, direction) => this.handleCellSwipe(cell, direction)
        );
        this.swapMode = this.hud.getSwapMode();
        this.hud.onSwapModeChange((mode) => {
            this.swapMode = mode;
        });
        this.hud.onAudioToggle((enabled) => {
            const active = this.sounds.setEnabled(enabled);
            if (active !== enabled) {
                this.hud.setAudioEnabled(active);
            }
        });
        this.hud.initOptionsMenu();
        this.hud.setAudioEnabled(this.sounds.isEnabled());

        this.state = {
            selected: null,
            score: 0,
            level: 1,
            targetScore: 300,
            movesLeft: 20
        };

        this.generation = 0;
        this.pendingTimers = [];

        this.modalEl = getRequiredElement('result-modal');
        this.modalTitle = getRequiredElement('result-title');
        this.modalText = getRequiredElement('result-text');
        this.modalButton = getRequiredElement('result-button');
        this.modalCallback = null;

        this.modalButton.addEventListener('click', () => this.hideResultModal());
        this.modalEl.addEventListener('click', (event) => {
            if (event.target === this.modalEl) {
                this.hideResultModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modalEl.classList.contains('game__modal--visible')) {
                this.hideResultModal();
            }
        });
    }

    private gameEl: HTMLElement;
    private sounds: SoundManager;
    private hud: Hud;
    private board: Board;
    private state: GameState;
    private swapMode: SwapMode;
    private generation: number;
    private pendingTimers: number[];
    private modalEl: HTMLElement;
    private modalTitle: HTMLElement;
    private modalText: HTMLElement;
    private modalButton: HTMLButtonElement;
    private modalCallback: (() => void) | null;

    start(): void {
        this.createBoard();
    }

    private screenShake(): void {
        this.gameEl.classList.add('game__board--shake');
        setTimeout(() => this.gameEl.classList.remove('game__board--shake'), 350);
    }

    private updateHud(): void {
        this.hud.render(this.state);
    }

    private createBoard(): void {
        this.generation++;
        this.clearPendingTimers();
        this.board.create();
        this.updateHud();
    }

    private handleCellClick(cell: HTMLDivElement): void {
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

        const firstSelected = this.state.selected;
        this.state.selected.classList.remove('game__cell--selected');
        this.state.selected = null;
        this.trySwap(firstSelected, cell);
    }

    private handleCellSwipe(cell: HTMLDivElement, direction: SwipeDirection): void {
        if (this.state.movesLeft <= 0) return;
        const neighbor = this.getNeighbor(cell, direction);
        if (!neighbor) return;
        if (this.state.selected) {
            this.state.selected.classList.remove('game__cell--selected');
            this.state.selected = null;
        }
        this.trySwap(cell, neighbor);
    }

    private findMatches(): {
        matched: Set<number>;
        boostersToCreate: { index: number; type: BoosterType }[];
    } {
        const matched = new Set<number>();
        const boostersToCreate: { index: number; type: BoosterType }[] = [];

        const checkLine = (indices: number[]): void => {
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
                } else {
                    if (streak >= 3 && prev) {
                        const streakCells: number[] = [];
                        for (let k = 0; k < streak; k++) {
                            const streakIndex = indices[i - 1 - k];
                            if (streakIndex !== undefined) streakCells.push(streakIndex);
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
            const indices: number[] = [];
            for (let c = 0; c < GRID_SIZE; c++) indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }

        for (let c = 0; c < GRID_SIZE; c++) {
            const indices: number[] = [];
            for (let r = 0; r < GRID_SIZE; r++) indices.push(r * GRID_SIZE + c);
            checkLine(indices);
        }

        return { matched, boostersToCreate };
    }

    private checkMatches(): void {
        const { matched, boostersToCreate } = this.findMatches();

        if (matched.size > 0) {
            const hasRadiusMatch = boostersToCreate.some((boost) => boost.type === BOOSTERS.RADIUS);
            const hasLineMatch = boostersToCreate.some((boost) => boost.type === BOOSTERS.LINE);
            if (hasRadiusMatch) {
                this.sounds.play('radiusBomb');
            } else if (hasLineMatch) {
                this.sounds.play('lineBomb');
            } else {
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

        if (this.state.movesLeft <= 0) this.endLevel();
    }

    private destroyCell(index: number): void {
        const cell = this.board.getCell(index);
        cell.classList.add('game__cell--explode');
        this.defer(() => {
            this.board.clearCell(cell);
            this.state.score += 10;
            this.updateHud();
            if (this.state.score >= this.state.targetScore) this.endLevel();
        }, 300);
    }

    private createBooster(index: number, type: BoosterType): void {
        const cell = this.board.getCell(index);
        this.board.setCellColor(cell, randomColor());
        this.board.setBooster(cell, type);
    }

    private activateBooster(cell: HTMLDivElement): void {
        const index = Number(cell.dataset.index);
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;

        if (cell.dataset.booster === BOOSTERS.LINE) {
            this.sounds.play('lineBomb');
            for (let c = 0; c < GRID_SIZE; c++) this.destroyCell(row * GRID_SIZE + c);
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

    private dropCells(): void {
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

    private endLevel(): void {
        const completedLevel = this.state.level;
        const isWin = this.state.score >= this.state.targetScore;
        if (isWin) {
            this.sounds.play('levelUp');
            this.state.level++;
            this.state.targetScore += 200;
            this.state.movesLeft += 5;
        } else {
            this.sounds.play('levelFail');
            this.state.movesLeft = 20;
        }
        this.state.score = 0;
        this.showResultModal(isWin ? 'win' : 'lose', completedLevel, () => this.createBoard());
    }

    private areAdjacent(a: HTMLDivElement, b: HTMLDivElement): boolean {
        const aIndex = Number(a.dataset.index);
        const bIndex = Number(b.dataset.index);
        const aRow = Math.floor(aIndex / GRID_SIZE);
        const aCol = aIndex % GRID_SIZE;
        const bRow = Math.floor(bIndex / GRID_SIZE);
        const bCol = bIndex % GRID_SIZE;
        return Math.abs(aRow - bRow) + Math.abs(aCol - bCol) === 1;
    }

    private getNeighbor(cell: HTMLDivElement, direction: SwipeDirection): HTMLDivElement | null {
        const index = Number(cell.dataset.index);
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        let targetRow = row;
        let targetCol = col;
        if (direction === 'up') targetRow--;
        if (direction === 'down') targetRow++;
        if (direction === 'left') targetCol--;
        if (direction === 'right') targetCol++;
        if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) return null;
        const targetIndex = targetRow * GRID_SIZE + targetCol;
        return this.board.getCell(targetIndex);
    }

    private trySwap(first: HTMLDivElement, second: HTMLDivElement): void {
        if (!this.areAdjacent(first, second)) {
            this.showInvalidMove(second);
            return;
        }
        this.board.swapCells(first, second);
        this.state.movesLeft--;
        this.updateHud();
        if (this.swapMode === 'require-match') {
            const { matched } = this.findMatches();
            if (matched.size === 0) {
                this.board.swapCells(first, second);
                this.state.movesLeft++;
                this.updateHud();
                this.showInvalidMove(second);
                return;
            }
        }
        this.defer(() => this.checkMatches(), 120);
    }

    private defer(callback: () => void, delay: number): void {
        const gen = this.generation;
        const timerId = setTimeout(() => {
            if (this.generation !== gen) return;
            callback();
        }, delay);
        this.pendingTimers.push(timerId);
    }

    private clearPendingTimers(): void {
        this.pendingTimers.forEach((id) => clearTimeout(id));
        this.pendingTimers = [];
    }

    private showInvalidMove(cell: HTMLDivElement): void {
        cell.classList.add('game__cell--shake');
        this.defer(() => cell.classList.remove('game__cell--shake'), 350);
    }

    private showResultModal(result: 'win' | 'lose', completedLevel: number, onClose: () => void): void {
        this.modalCallback = onClose;
        if (result === 'win') {
            this.modalTitle.textContent = 'Level ' + completedLevel + ' geschafft!';
            this.modalText.textContent = 'Weiter geht es mit Level ' + this.state.level + '.';
        } else {
            this.modalTitle.textContent = 'Level verloren!';
            this.modalText.textContent = 'Versuche es direkt noch einmal.';
        }
        this.modalEl.classList.add('game__modal--visible');
        this.modalButton.focus();
    }

    private hideResultModal(): void {
        if (!this.modalEl.classList.contains('game__modal--visible')) return;
        this.modalEl.classList.remove('game__modal--visible');
        const callback = this.modalCallback;
        this.modalCallback = null;
        if (callback) callback();
    }
}

export { Match3Game };

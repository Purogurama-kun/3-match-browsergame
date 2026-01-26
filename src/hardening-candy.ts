import { GRID_SIZE } from './constants.js';
import { Board } from './board.js';
import { Renderer } from './renderer.js';

type HardeningCandyOptions = {
    board: Board;
    renderer: Renderer;
    turnsToHarden?: number;
};

class HardeningCandy {
    private board: Board;
    private renderer: Renderer;
    private turnsToHarden: number;

    constructor(options: HardeningCandyOptions) {
        this.board = options.board;
        this.renderer = options.renderer;
        this.turnsToHarden = Math.max(1, Math.floor(options.turnsToHarden ?? 3));
    }

    advanceTurn(touched: Set<number>): boolean {
        let changed = false;
        for (let index = 0; index < GRID_SIZE * GRID_SIZE; index++) {
            if (!this.board.isHardeningCandy(index)) continue;
            const stage = this.board.getHardeningStage(index) ?? 1;
            if (touched.has(index)) {
                if (stage !== 1) {
                    this.board.setHardeningCandy(index, 1);
                    this.renderer.updateCell(index, this.board.getCellState(index));
                    changed = true;
                }
                continue;
            }
            if (stage >= this.turnsToHarden) {
                this.board.setHardCandy(index, true, 1);
                this.renderer.updateCell(index, this.board.getCellState(index));
                changed = true;
                continue;
            }
            this.board.setHardeningStage(index, stage + 1);
            this.renderer.updateCell(index, this.board.getCellState(index));
            changed = true;
        }
        return changed;
    }
}

export { HardeningCandy };

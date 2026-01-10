import { Board, CellState } from './board.js';
import { BOOSTERS, GRID_SIZE, getColorKeyFromHex, type BoosterType, type ColorKey } from './constants.js';
import type { LineOrientation } from './types.js';

type Position = {
    x: number;
    y: number;
};

type SnapshotMatchMove = {
    kind: 'match';
    matchType: 'manuell' | 'auto';
    cells: Position[];
    swap: { cellA: Position; cellB: Position } | null;
};

type SnapshotPowerupMove = {
    kind: 'powerup';
    powerupType: 'shuffle' | 'swap' | 'bomb';
    coordinates: Position[] | null;
};

type SnapshotMove = SnapshotMatchMove | SnapshotPowerupMove;

type SnapshotCell = {
    color: 'green' | 'yellow' | 'blue' | 'red' | 'pink' | 'none';
    sugarChest: 0 | 1 | 2 | 3 | 'none';
    bomb: 'small' | 'medium' | 'large' | 'line_horizontal' | 'line_vertical' | 'line_both' | 'none';
    hard: boolean;
    generator: boolean;
    position: Position;
};

type Snapshot = {
    board: SnapshotCell[];
    move: SnapshotMove | null;
    timestamp: number;
};

type SnapshotPowerupUsage = {
    powerupType: SnapshotPowerupMove['powerupType'];
    coordinates: Position[] | null;
};

type SnapshotRecordResult = {
    limitReached: boolean;
};

const COLOR_NAME_MAP: Record<ColorKey, SnapshotCell['color']> = {
    red: 'red',
    amber: 'yellow',
    blue: 'blue',
    purple: 'pink',
    green: 'green'
};

class SnapshotRecorder {
    private history: Snapshot[] = [];
    private autoMoves = 0;
    private readonly autoLimit = 50;

    reset(): void {
        this.history = [];
        this.autoMoves = 0;
        this.persistHistory();
    }

    beginManualSequence(): void {
        this.autoMoves = 0;
    }

    recordSnapshot(board: Board, move: SnapshotMove | null): SnapshotRecordResult {
        if (this.autoMoves >= this.autoLimit) {
            return { limitReached: true };
        }
        const snapshot: Snapshot = {
            board: this.buildBoardSnapshot(board),
            move: null,
            timestamp: Date.now()
        };
        const lastSnapshot = this.history[this.history.length - 1];
        if (move && lastSnapshot && this.areBoardsEqual(lastSnapshot.board, snapshot.board)) {
            return { limitReached: false };
        }
        if (move && lastSnapshot) {
            lastSnapshot.move = move;
        }
        this.history.push(snapshot);
        let limitReached = false;
        if (move?.kind === 'match' && move.matchType === 'auto') {
            this.autoMoves++;
            if (this.autoMoves >= this.autoLimit) {
                limitReached = true;
            }
        }
        this.persistHistory();
        return { limitReached };
    }

    getHistory(): Snapshot[] {
        return [...this.history];
    }

    private areBoardsEqual(a: SnapshotCell[], b: SnapshotCell[]): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            const cellA = a[i]!;
            const cellB = b[i]!;
            if (
                cellA.color !== cellB.color ||
                cellA.sugarChest !== cellB.sugarChest ||
                cellA.bomb !== cellB.bomb ||
                cellA.hard !== cellB.hard ||
                cellA.generator !== cellB.generator
            ) {
                return false;
            }
        }
        return true;
    }

    private buildBoardSnapshot(board: Board): SnapshotCell[] {
        return board.getCells().map((state, index) => this.buildCellSnapshot(state, index));
    }

    private buildCellSnapshot(state: CellState, index: number): SnapshotCell {
        const position = { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) };
        return {
            color: this.getColorName(state.color),
            sugarChest: this.normalizeSugarChest(state.sugarChestStage),
            bomb: this.getBombLabel(state.booster, state.lineOrientation),
            hard: state.hard,
            generator: state.generator,
            position
        };
    }

    private getColorName(color: string): SnapshotCell['color'] {
        if (!color) return 'none';
        const key = getColorKeyFromHex(color);
        if (!key) return 'none';
        return COLOR_NAME_MAP[key];
    }

    private normalizeSugarChest(stage?: number): SnapshotCell['sugarChest'] {
        if (typeof stage !== 'number') return 'none';
        const normalized = Math.max(0, Math.min(3, Math.floor(stage) - 1));
        return normalized as SnapshotCell['sugarChest'];
    }

    private getBombLabel(booster: BoosterType, orientation?: LineOrientation): SnapshotCell['bomb'] {
        if (booster === BOOSTERS.BURST_SMALL) return 'small';
        if (booster === BOOSTERS.BURST_MEDIUM) return 'medium';
        if (booster === BOOSTERS.BURST_LARGE) return 'large';
        if (booster === BOOSTERS.LINE) {
            if (orientation === 'vertical') return 'line_vertical';
            if (orientation === 'horizontal') return 'line_horizontal';
            return 'line_both';
        }
        return 'none';
    }

    private persistHistory(): void {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            const snapshotable = this.history.slice(-200);
            window.localStorage.setItem('match3-snapshots', JSON.stringify(snapshotable));
        } catch {
            // ignore quota issues
        }
    }
}

export type {
    Snapshot,
    SnapshotCell,
    SnapshotMove,
    SnapshotMatchMove,
    SnapshotPowerupMove,
    SnapshotPowerupUsage,
    SnapshotRecordResult,
    Position
};
export { SnapshotRecorder };

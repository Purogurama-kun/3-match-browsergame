import { Renderer } from './renderer.js';

type HintManagerOptions = {
    renderer: Renderer;
    delayMs: number;
    canSchedule: () => boolean;
    findHintMove: () => number[] | null;
};

class HintManager {
    private renderer: Renderer;
    private delayMs: number;
    private canSchedule: () => boolean;
    private findHintMove: () => number[] | null;
    private hintTimer: number | null = null;
    private hintIndices: number[] = [];

    constructor(options: HintManagerOptions) {
        this.renderer = options.renderer;
        this.delayMs = options.delayMs;
        this.canSchedule = options.canSchedule;
        this.findHintMove = options.findHintMove;
    }

    schedule(): void {
        this.clearTimer();
        if (!this.canSchedule()) return;
        this.hintTimer = window.setTimeout(() => this.showHintIfIdle(), this.delayMs);
    }

    reset(): void {
        this.clearTimer();
        this.clearDisplay();
    }

    clearDisplay(): void {
        if (this.hintIndices.length === 0) return;
        this.renderer.clearHint();
        this.hintIndices = [];
    }

    clearTimer(): void {
        if (this.hintTimer === null) return;
        clearTimeout(this.hintTimer);
        this.hintTimer = null;
    }

    private showHintIfIdle(): void {
        this.hintTimer = null;
        if (!this.canSchedule()) return;
        const hint = this.findHintMove();
        if (!hint) return;
        this.hintIndices = hint;
        this.renderer.showHint(hint);
    }
}

export { HintManager };

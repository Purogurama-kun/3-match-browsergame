class FpsMeter {
    private readonly element: HTMLElement;
    private rafId: number | null = null;
    private frameCount = 0;
    private lastFrameTime = 0;
    private lastReportTime = 0;

    constructor(element: HTMLElement) {
        this.element = element;
    }

    start(): void {
        if (this.rafId !== null) {
            return;
        }
        const now = performance.now();
        this.lastFrameTime = now;
        this.lastReportTime = now;
        this.frameCount = 0;
        this.rafId = window.requestAnimationFrame((time) => this.tick(time));
    }

    stop(): void {
        if (this.rafId === null) {
            return;
        }
        window.cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    private tick(time: number): void {
        this.frameCount++;
        const delta = time - this.lastFrameTime;
        this.lastFrameTime = time;

        if (time - this.lastReportTime >= 500) {
            const elapsed = time - this.lastReportTime;
            const fps = (this.frameCount / elapsed) * 1000;
            const frameMs = delta > 0 ? delta : 0;
            this.element.textContent = `${fps.toFixed(0)} FPS (${frameMs.toFixed(1)}ms/F)`;
            this.frameCount = 0;
            this.lastReportTime = time;
        }

        this.rafId = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
}

export { FpsMeter };

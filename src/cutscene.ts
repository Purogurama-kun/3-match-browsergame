import { getRequiredElement } from './dom.js';

export type CutsceneScene = {
    background: string;
    text: string;
    durationMs?: number;
};

export class CutsceneManager {
    private readonly overlay: HTMLElement;
    private readonly lineElement: HTMLElement;
    private resolve: (() => void) | null = null;
    private timerId: number | null = null;

    constructor() {
        this.overlay = getRequiredElement('cutscene');
        this.lineElement = getRequiredElement('cutscene-line');
        this.overlay.addEventListener('click', () => this.skip());
    }

    play(scene: CutsceneScene): Promise<void> {
        this.dismiss();
        this.overlay.style.backgroundImage = `url('${scene.background}')`;
        this.lineElement.textContent = scene.text;
        this.overlay.removeAttribute('hidden');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.overlay.classList.add('cutscene--visible');
        const duration = scene.durationMs ?? 2400;
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.timerId = window.setTimeout(() => this.finish(), duration);
        });
    }

    private finish(): void {
        if (!this.resolve) return;
        this.overlay.classList.remove('cutscene--visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.overlay.setAttribute('hidden', 'true');
        const resolve = this.resolve;
        this.resolve = null;
        this.clearTimer();
        resolve();
    }

    private skip(): void {
        this.finish();
    }

    private dismiss(): void {
        if (!this.resolve) return;
        this.finish();
    }

    private clearTimer(): void {
        if (this.timerId === null) return;
        clearTimeout(this.timerId);
        this.timerId = null;
    }
}

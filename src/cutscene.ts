import { getRequiredElement } from './dom.js';

export type CutsceneScene = {
    background: string;
    text: string;
    durationMs?: number;
};

export class CutsceneManager {
    private static readonly CUTSCENE_BODY_CLASS = 'match-app--cutscene-active';

    private readonly overlay: HTMLElement;
    private readonly lineElement: HTMLElement;
    private readonly timerButton: HTMLButtonElement;
    private readonly timerCircle: SVGCircleElement;
    private readonly circleCircumference: number;
    private resolve: (() => void) | null = null;
    private timerId: number | null = null;
    private autorunDuration = 3000;
    private autorunStartTime: number | null = null;
    private autorunFrame: number | null = null;
    private isAutorunPaused = false;

    constructor() {
        this.overlay = getRequiredElement('cutscene');
        this.lineElement = getRequiredElement('cutscene-line');
        this.timerButton = getRequiredElement('cutscene-timer-button') as HTMLButtonElement;
        this.timerCircle = getRequiredElement('cutscene-timer-ring') as SVGCircleElement;
        const radius = Number(this.timerCircle.getAttribute('r')) || 20;
        this.circleCircumference = 2 * Math.PI * radius;
        this.timerCircle.setAttribute('stroke-dasharray', `${this.circleCircumference}`);
        this.timerCircle.setAttribute('stroke-dashoffset', '0');
        this.overlay.addEventListener('click', () => this.skip());
        this.timerButton.addEventListener('click', (event) => this.handleTimerButton(event));
    }

    play(scene: CutsceneScene): Promise<void> {
        this.dismiss();
        this.overlay.style.backgroundImage = `url('${scene.background}')`;
        this.lineElement.textContent = scene.text;
        this.overlay.removeAttribute('hidden');
        this.overlay.setAttribute('aria-hidden', 'false');
        this.overlay.classList.add('cutscene--visible');
        this.setCutsceneActive(true);
        const duration = scene.durationMs ?? 6000;
        return new Promise((resolve) => {
            this.resolve = resolve;
            this.startAutorun(duration);
        });
    }

    private finish(): void {
        if (!this.resolve) return;
        this.setCutsceneActive(false);
        this.overlay.classList.remove('cutscene--visible');
        this.overlay.setAttribute('aria-hidden', 'true');
        this.overlay.setAttribute('hidden', 'true');
        const resolve = this.resolve;
        this.resolve = null;
        this.clearTimer();
        this.clearAutorunFrame();
        this.resetTimerButton();
        resolve();
    }

    private skip(): void {
        this.finish();
    }

    private dismiss(): void {
        if (!this.resolve) return;
        this.finish();
    }

    private startAutorun(duration: number): void {
        this.clearTimer();
        this.clearAutorunFrame();
        this.resetTimerButton();
        this.autorunDuration = Math.max(duration, 1);
        this.autorunStartTime = performance.now();
        this.timerId = window.setTimeout(() => this.finish(), this.autorunDuration);
        this.autorunFrame = window.requestAnimationFrame(this.updateAutorunProgress);
    }

    private handleTimerButton(event: MouseEvent): void {
        event.stopPropagation();
        if (this.isAutorunPaused) {
            this.finish();
            return;
        }
        this.pauseAutorun();
    }

    private pauseAutorun(): void {
        if (this.isAutorunPaused) return;
        this.isAutorunPaused = true;
        this.clearTimer();
        this.clearAutorunFrame();
        this.timerButton.classList.add('cutscene__timer-button--paused');
        this.timerButton.setAttribute('aria-label', 'Skip cutscene');
    }

    private resetTimerButton(): void {
        this.isAutorunPaused = false;
        this.timerButton.classList.remove('cutscene__timer-button--paused');
        this.timerButton.setAttribute('aria-label', 'Pause cutscene countdown');
        this.timerCircle.setAttribute('stroke-dashoffset', '0');
    }

    private setCutsceneActive(isActive: boolean): void {
        document.body.classList.toggle(CutsceneManager.CUTSCENE_BODY_CLASS, isActive);
    }

    private updateAutorunProgress = (timestamp: number): void => {
        if (this.isAutorunPaused || this.autorunStartTime === null) {
            return;
        }
        const elapsed = timestamp - this.autorunStartTime;
        const ratio = Math.min(elapsed / this.autorunDuration, 1);
        const offset = ratio * this.circleCircumference;
        this.timerCircle.setAttribute('stroke-dashoffset', `${offset}`);
        if (ratio < 1) {
            this.autorunFrame = window.requestAnimationFrame(this.updateAutorunProgress);
        } else {
            this.autorunFrame = null;
        }
    };

    private clearTimer(): void {
        if (this.timerId === null) return;
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    private clearAutorunFrame(): void {
        if (this.autorunFrame === null) return;
        cancelAnimationFrame(this.autorunFrame);
        this.autorunFrame = null;
        this.autorunStartTime = null;
    }
}

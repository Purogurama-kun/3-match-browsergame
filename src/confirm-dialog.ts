import { getRequiredElement } from './dom.js';

type ConfirmDialogOptions = {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
};

class ConfirmDialog {
    private modal: HTMLElement;
    private titleElement: HTMLElement;
    private textElement: HTMLElement;
    private cancelButton: HTMLButtonElement;
    private confirmButton: HTMLButtonElement;
    private resolveCallback: ((value: boolean) => void) | null = null;

    constructor() {
        this.modal = getRequiredElement('confirm-modal');
        this.titleElement = getRequiredElement('confirm-modal-title');
        this.textElement = getRequiredElement('confirm-modal-text');
        this.cancelButton = this.getButton('confirm-modal-cancel');
        this.confirmButton = this.getButton('confirm-modal-confirm');

        this.cancelButton.addEventListener('click', () => this.finish(false));
        this.confirmButton.addEventListener('click', () => this.finish(true));
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.finish(false);
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.finish(false);
            }
        });
    }

    show(options: ConfirmDialogOptions): Promise<boolean> {
        if (this.resolveCallback) {
            this.finish(false);
        }

        this.titleElement.textContent = options.title;
        this.textElement.textContent = options.message;
        this.confirmButton.textContent = options.confirmText;
        this.cancelButton.textContent = options.cancelText;
        this.open();
        return new Promise((resolve) => {
            this.resolveCallback = resolve;
        });
    }

    private open(): void {
        this.modal.removeAttribute('hidden');
        this.modal.setAttribute('aria-hidden', 'false');
        this.confirmButton.focus();
    }

    private hide(): void {
        this.modal.setAttribute('hidden', 'true');
        this.modal.setAttribute('aria-hidden', 'true');
    }

    private finish(result: boolean): void {
        if (!this.resolveCallback) {
            this.hide();
            return;
        }
        const resolve = this.resolveCallback;
        this.resolveCallback = null;
        this.hide();
        resolve(result);
    }

    private getButton(id: string): HTMLButtonElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error(`${id} is not a button`);
        }
        return element;
    }
}

export { ConfirmDialog };

import { getRequiredElement } from './dom.js';

type TutorialViewOptions = {
    onClose: () => void;
};

class TutorialView {
    constructor(options: TutorialViewOptions) {
        this.container = getRequiredElement('tutorial');
        this.backButton = this.getBackButton();
        this.onClose = options.onClose;
        this.backButton.addEventListener('click', () => this.requestClose());
    }

    private readonly container: HTMLElement;
    private readonly backButton: HTMLButtonElement;
    private onClose: () => void;

    open(): void {
        document.body.classList.add('match-app--tutorial');
        this.container.removeAttribute('hidden');
        this.backButton.focus();
    }

    hide(): void {
        this.container.setAttribute('hidden', 'true');
        document.body.classList.remove('match-app--tutorial');
    }

    private requestClose(): void {
        this.hide();
        this.onClose();
    }

    private getBackButton(): HTMLButtonElement {
        const element = getRequiredElement('tutorial-back');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Tutorial back button is not a button');
        }
        return element;
    }
}

export { TutorialView };

import { getRequiredElement } from './dom.js';
import { t } from './i18n.js';

type AccountProfileSource = 'google' | 'guest';

type AccountProfileData = {
    name: string;
    source: AccountProfileSource;
};

type ProfileStateOptions = {
    onExit: () => void;
};

class ProfileState {
    private readonly root: HTMLElement;
    private readonly nameInput: HTMLInputElement;
    private readonly statusElement: HTMLElement;
    private readonly backButton: HTMLButtonElement;
    private readonly saveButton: HTMLButtonElement;
    private readonly feedbackElement: HTMLElement;
    private currentProfile: AccountProfileData = { name: '', source: 'guest' };
    private readonly onExit: () => void;
    private nameSaveHandler: ((value: string) => void) | null = null;

    constructor(options: ProfileStateOptions) {
        this.root = getRequiredElement('account');
        this.nameInput = getRequiredElement('account-name');
        this.statusElement = getRequiredElement('account-status');
        this.backButton = this.getButton('account-back');
        this.saveButton = this.getButton('account-save-name');
        this.feedbackElement = getRequiredElement('account-feedback');
        this.onExit = options.onExit;
        this.backButton.addEventListener('click', () => {
            this.onExit();
        });
        this.saveButton.addEventListener('click', () => {
            this.nameSaveHandler?.(this.nameInput.value);
        });
        this.nameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.saveButton.click();
            }
        });
        this.applyLocale();
    }

    enter(profile: AccountProfileData): void {
        this.currentProfile = profile;
        this.render();
        this.root.removeAttribute('hidden');
        this.root.scrollTop = 0;
        this.clearFeedback();
        this.saveButton.disabled = false;
        this.saveButton.focus();
    }

    update(profile: AccountProfileData): void {
        this.currentProfile = profile;
        if (this.root.hasAttribute('hidden')) {
            return;
        }
        this.render();
    }

    exit(): void {
        this.root.setAttribute('hidden', 'true');
    }

    private render(): void {
        this.nameInput.value = this.currentProfile.name;
        this.saveButton.textContent = t('account.name.saveButton');
        this.statusElement.textContent =
            this.currentProfile.source === 'google'
                ? t('account.status.google')
                : t('account.status.guest');
    }

    applyLocale(): void {
        this.saveButton.textContent = t('account.name.saveButton');
        this.statusElement.textContent =
            this.currentProfile.source === 'google'
                ? t('account.status.google')
                : t('account.status.guest');
    }

    onNameSave(handler: (value: string) => void): void {
        this.nameSaveHandler = handler;
    }

    setNameSaving(saving: boolean): void {
        this.saveButton.disabled = saving;
        this.saveButton.setAttribute('aria-busy', saving ? 'true' : 'false');
    }

    setFeedback(message: string, type: 'error' | 'success' | 'info' = 'info'): void {
        this.feedbackElement.textContent = message;
        this.feedbackElement.classList.remove(
            'account__feedback--error',
            'account__feedback--success'
        );
        if (type === 'error') {
            this.feedbackElement.classList.add('account__feedback--error');
        } else if (type === 'success') {
            this.feedbackElement.classList.add('account__feedback--success');
        }
    }

    clearFeedback(): void {
        this.setFeedback('', 'info');
    }

    private getButton(id: string): HTMLButtonElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Account back button is not a button');
        }
        return element;
    }
}

export { ProfileState };
export type { AccountProfileData, AccountProfileSource };

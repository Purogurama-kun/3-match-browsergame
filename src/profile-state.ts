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
    private readonly deleteAccountButton: HTMLButtonElement;
    private readonly feedbackElement: HTMLElement;
    private readonly editButton: HTMLButtonElement;
    private isEditing = false;
    private isNameSaving = false;
    private currentProfile: AccountProfileData = { name: '', source: 'guest' };
    private readonly onExit: () => void;
    private nameSaveHandler: ((value: string) => void) | null = null;
    private deleteAccountHandler: (() => void) | null = null;

    constructor(options: ProfileStateOptions) {
        this.root = getRequiredElement('account');
        this.nameInput = getRequiredElement('account-name');
        this.statusElement = getRequiredElement('account-status');
        this.backButton = this.getButton('account-back');
        this.saveButton = this.getButton('account-save-name');
        this.deleteAccountButton = this.getButton('delete-account');
        this.feedbackElement = getRequiredElement('account-feedback');
        this.onExit = options.onExit;
        this.editButton = this.getButton('account-edit');
        this.editButton.setAttribute('aria-pressed', 'false');
        this.editButton.addEventListener('click', () => {
            if (this.isNameSaving) {
                return;
            }
            this.setEditing(!this.isEditing);
        });
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
        this.deleteAccountButton.addEventListener('click', () => {
            this.deleteAccountHandler?.();
        });
        const initialDeleteEnabled = this.currentProfile.source === 'google';
        this.deleteAccountButton.disabled = !initialDeleteEnabled;
        this.deleteAccountButton.setAttribute('aria-disabled', initialDeleteEnabled ? 'false' : 'true');
        this.applyLocale();
        this.updateInteractionState();
    }

    enter(profile: AccountProfileData): void {
        this.isNameSaving = false;
        this.setEditing(false);
        this.currentProfile = profile;
        this.render();
        this.root.removeAttribute('hidden');
        this.root.scrollTop = 0;
        this.clearFeedback();
        this.editButton.focus();
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
        const deleteEnabled = this.currentProfile.source === 'google';
        this.deleteAccountButton.disabled = !deleteEnabled;
        this.deleteAccountButton.setAttribute('aria-disabled', deleteEnabled ? 'false' : 'true');
        this.updateInteractionState();
    }

    applyLocale(): void {
        this.saveButton.textContent = t('account.name.saveButton');
        this.statusElement.textContent =
            this.currentProfile.source === 'google'
                ? t('account.status.google')
                : t('account.status.guest');
        this.deleteAccountButton.textContent = t('account.deleteAccount');
        const editLabel = t('account.editButton');
        this.editButton.setAttribute('aria-label', editLabel);
        this.editButton.setAttribute('title', editLabel);
    }

    onNameSave(handler: (value: string) => void): void {
        this.nameSaveHandler = handler;
    }

    setNameSaving(saving: boolean): void {
        this.isNameSaving = saving;
        this.updateInteractionState();
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

    onDeleteAccount(handler: () => void): void {
        this.deleteAccountHandler = handler;
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

    private setEditing(active: boolean): void {
        this.isEditing = active;
        this.editButton.setAttribute('aria-pressed', active ? 'true' : 'false');
        this.editButton.classList.toggle('account__edit-button--active', active);
        this.updateInteractionState();
        if (active) {
            this.nameInput.focus();
        }
    }

    private updateInteractionState(): void {
        this.nameInput.disabled = !this.isEditing;
        const saveDisabled = this.isNameSaving || !this.isEditing;
        this.saveButton.disabled = saveDisabled;
        this.saveButton.setAttribute('aria-busy', this.isNameSaving ? 'true' : 'false');
    }
}

export { ProfileState };
export type { AccountProfileData, AccountProfileSource };

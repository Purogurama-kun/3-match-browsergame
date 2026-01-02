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
    private readonly nameElement: HTMLElement;
    private readonly statusElement: HTMLElement;
    private readonly backButton: HTMLButtonElement;
    private currentProfile: AccountProfileData = { name: '', source: 'guest' };
    private readonly onExit: () => void;

    constructor(options: ProfileStateOptions) {
        this.root = getRequiredElement('account');
        this.nameElement = getRequiredElement('account-name');
        this.statusElement = getRequiredElement('account-status');
        this.backButton = this.getButton('account-back');
        this.onExit = options.onExit;
        this.backButton.addEventListener('click', () => {
            this.onExit();
        });
    }

    enter(profile: AccountProfileData): void {
        this.currentProfile = profile;
        this.render();
        this.root.removeAttribute('hidden');
        this.root.scrollTop = 0;
        this.backButton.focus();
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
        this.nameElement.textContent = this.currentProfile.name;
        this.statusElement.textContent =
            this.currentProfile.source === 'google'
                ? t('account.status.google')
                : t('account.status.guest');
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

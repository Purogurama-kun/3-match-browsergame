import { getRequiredElement } from './dom.js';

type GoogleJwtPayload = {
    sub: string;
    name?: string;
    email?: string;
};

type GoogleCredentialResponse = {
    credential: string;
};

type GoogleAuthConfig = {
    loginButtonId: string;
    statusId: string;
    progressId: string;
    errorId: string;
    onLogin: (user: GoogleUser) => void;
};

type GoogleUser = {
    id: string;
    name: string;
    email?: string;
};

type GoogleId = {
    accounts: {
        id: {
            initialize(config: {
                client_id: string;
                callback: (response: GoogleCredentialResponse) => void;
                ux_mode?: 'popup' | 'redirect';
                auto_select?: boolean;
                cancel_on_tap_outside?: boolean;
            }): void;
            prompt(
                callback?: (notification: {
                    isNotDisplayed(): boolean;
                    getNotDisplayedReason(): string;
                    isSkippedMoment(): boolean;
                    getSkippedReason(): string;
                }) => void
            ): void;
        };
    };
};

declare global {
    interface Window {
        google?: GoogleId;
    }
}

class GoogleAuth {
    constructor(config: GoogleAuthConfig) {
        this.loginButton = this.getLoginButton(config.loginButtonId);
        this.statusLabel = getRequiredElement(config.statusId);
        this.progressLabel = getRequiredElement(config.progressId);
        this.errorLabel = getRequiredElement(config.errorId);
        this.onLogin = config.onLogin;
        this.disableLogin();
        this.attachButtonHandler();
        this.initializeGoogle();
    }

    private readonly clientId =
        '276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com';
    private loginButton: HTMLButtonElement;
    private statusLabel: HTMLElement;
    private progressLabel: HTMLElement;
    private errorLabel: HTMLElement;
    private onLogin: (user: GoogleUser) => void;
    private googleReady = false;

    setProgressLevel(level: number): void {
        const normalized = Math.max(1, Math.min(Number.isFinite(level) ? level : 1, 50));
        this.progressLabel.textContent = 'Fortschritt: Level ' + normalized;
    }

    setLoggedOut(): void {
        this.statusLabel.textContent = 'Nicht angemeldet';
        this.setProgressLevel(1);
        this.enableLogin();
    }

    private attachButtonHandler(): void {
        this.loginButton.addEventListener('click', () => {
            this.clearError();
            if (!this.googleReady) {
                this.showError('Google Login lädt noch. Bitte kurz warten.');
                return;
            }
            if (!window.google || !window.google.accounts || !window.google.accounts.id) {
                this.showError('Google Login konnte nicht initialisiert werden.');
                return;
            }
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed()) {
                    this.showError(
                        'Google Login kann nicht angezeigt werden: ' + notification.getNotDisplayedReason()
                    );
                }
                if (notification.isSkippedMoment()) {
                    this.showError('Login wurde übersprungen: ' + notification.getSkippedReason());
                }
            });
        });
    }

    private initializeGoogle(): void {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            window.setTimeout(() => this.initializeGoogle(), 200);
            return;
        }
        window.google.accounts.id.initialize({
            client_id: this.clientId,
            ux_mode: 'popup',
            cancel_on_tap_outside: true,
            callback: (response) => this.handleCredential(response)
        });
        this.googleReady = true;
        this.enableLogin();
    }

    private handleCredential(response: GoogleCredentialResponse): void {
        const payload = this.decodeCredential(response.credential);
        if (!payload) {
            this.showError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
            return;
        }
        this.clearError();
        const user: GoogleUser = {
            id: payload.sub,
            name: payload.name || payload.email || 'Spieler',
            ...(payload.email ? { email: payload.email } : {})
        };
        this.statusLabel.textContent = 'Angemeldet als ' + user.name;
        this.onLogin(user);
        this.disableLogin();
    }

    private decodeCredential(credential: string): GoogleJwtPayload | null {
        try {
            const payload = credential.split('.')[1];
            if (!payload) return null;
            const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(json) as GoogleJwtPayload;
        } catch (error) {
            console.error('Failed to decode Google credential', error);
            return null;
        }
    }

    private showError(message: string): void {
        this.errorLabel.textContent = message;
        this.errorLabel.removeAttribute('hidden');
    }

    private clearError(): void {
        this.errorLabel.textContent = '';
        this.errorLabel.setAttribute('hidden', 'true');
    }

    private disableLogin(): void {
        this.loginButton.disabled = true;
    }

    private enableLogin(): void {
        this.loginButton.disabled = false;
    }

    private getLoginButton(id: string): HTMLButtonElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Google login trigger is not a button');
        }
        return element;
    }
}

export { GoogleAuth };
export type { GoogleUser };

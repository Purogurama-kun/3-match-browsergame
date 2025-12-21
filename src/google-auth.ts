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
    blockerProgressId: string;
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
                use_fedcm_for_prompt?: boolean;
            }): void;
            renderButton(element: HTMLElement, options: GoogleButtonOptions): void;
        };
    };
};

type GoogleButtonOptions = {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
    locale?: string;
};

declare global {
    interface Window {
        google?: GoogleId;
    }
}

class GoogleAuth {
    constructor(config: GoogleAuthConfig) {
        this.loginContainer = this.getLoginContainer(config.loginButtonId);
        this.statusLabel = getRequiredElement(config.statusId);
        this.progressLabel = getRequiredElement(config.progressId);
        this.blockerProgressLabel = getRequiredElement(config.blockerProgressId);
        this.errorLabel = getRequiredElement(config.errorId);
        this.onLogin = config.onLogin;
        this.disableLogin();
        this.initializeGoogle();
    }

    private readonly clientId =
        '276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com';
    private loginContainer: HTMLElement;
    private statusLabel: HTMLElement;
    private progressLabel: HTMLElement;
    private blockerProgressLabel: HTMLElement;
    private errorLabel: HTMLElement;
    private onLogin: (user: GoogleUser) => void;

    setProgress(progress: { level?: number; highestLevel?: number; blockerHighScore: number }): void {
        const levelValue = Math.max(1, progress.level ?? progress.highestLevel ?? 1);
        this.setProgressLevel(levelValue);
        this.setBlockerHighScore(progress.blockerHighScore);
    }

    setProgressLevel(level: number): void {
        const normalized = Math.max(1, Math.min(Number.isFinite(level) ? level : 1, 50));
        this.progressLabel.textContent = 'Fortschritt: Level ' + normalized;
    }

    setBlockerHighScore(score: number): void {
        const normalized = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
        this.blockerProgressLabel.textContent = 'Blocker-Highscore: ' + normalized;
    }

    showProgressLoading(): void {
        this.progressLabel.textContent = 'Fortschritt wird geladen...';
        this.blockerProgressLabel.textContent = 'Blocker-Highscore wird geladen...';
    }

    setLoggedOut(level: number = 1, blockerHighScore: number = 0): void {
        this.statusLabel.textContent = 'Nicht angemeldet';
        this.setProgress({ level, blockerHighScore });
        this.enableLogin();
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
            use_fedcm_for_prompt: true,
            callback: (response) => this.handleCredential(response)
        });
        this.loginContainer.textContent = '';
        window.google.accounts.id.renderButton(this.loginContainer, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            locale: 'de',
            logo_alignment: 'left',
            width: 320
        });
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

    showError(message: string): void {
        this.errorLabel.textContent = message;
        this.errorLabel.removeAttribute('hidden');
    }

    clearError(): void {
        this.errorLabel.textContent = '';
        this.errorLabel.setAttribute('hidden', 'true');
    }

    private disableLogin(): void {
        this.loginContainer.classList.add('auth__button--disabled');
        this.loginContainer.setAttribute('aria-disabled', 'true');
    }

    private enableLogin(): void {
        this.loginContainer.classList.remove('auth__button--disabled');
        this.loginContainer.removeAttribute('aria-disabled');
    }

    private getLoginContainer(id: string): HTMLElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLElement)) {
            throw new Error('Google login container is not an element');
        }
        return element;
    }
}

export { GoogleAuth };
export type { GoogleUser };

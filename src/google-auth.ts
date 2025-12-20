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
                use_fedcm_for_prompt?: boolean;
            }): void;
            renderButton(element: HTMLElement, options: GoogleButtonOptions): void;
        };
        oauth2: {
            initTokenClient(config: {
                client_id: string;
                scope: string;
                prompt?: string;
                callback: (response: GoogleTokenResponse) => void;
            }): GoogleTokenClient;
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

type GoogleTokenClient = {
    callback: (response: GoogleTokenResponse) => void;
    requestAccessToken(options?: { prompt?: string }): void;
};

type GoogleTokenResponse = {
    access_token: string;
    expires_in?: number;
    error?: string;
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
        this.errorLabel = getRequiredElement(config.errorId);
        this.onLogin = config.onLogin;
        this.disableLogin();
        this.initializeGoogle();
    }

    private readonly clientId =
        '276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com';
    private readonly driveScope = 'https://www.googleapis.com/auth/drive.appdata';
    private loginContainer: HTMLElement;
    private statusLabel: HTMLElement;
    private progressLabel: HTMLElement;
    private errorLabel: HTMLElement;
    private onLogin: (user: GoogleUser) => void;
    private tokenClient: GoogleTokenClient | null = null;
    private accessToken: string | null = null;
    private accessTokenExpiresAt: number | null = null;
    private pendingTokenRequest: Promise<string> | null = null;

    setProgressLevel(level: number): void {
        const normalized = Math.max(1, Math.min(Number.isFinite(level) ? level : 1, 50));
        this.progressLabel.textContent = 'Fortschritt: Level ' + normalized;
    }

    setProgressMessage(message: string): void {
        this.progressLabel.textContent = message;
    }

    setLoggedOut(): void {
        this.statusLabel.textContent = 'Nicht angemeldet';
        this.setProgressLevel(1);
        this.enableLogin();
        this.accessToken = null;
        this.accessTokenExpiresAt = null;
        this.pendingTokenRequest = null;
    }

    private initializeGoogle(): void {
        if (
            !window.google ||
            !window.google.accounts ||
            !window.google.accounts.id ||
            !window.google.accounts.oauth2
        ) {
            window.setTimeout(() => this.initializeGoogle(), 200);
            return;
        }
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: this.driveScope,
            callback: () => {}
        });
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

    private async handleCredential(response: GoogleCredentialResponse): Promise<void> {
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
        try {
            await this.requestAccessToken(true);
            this.statusLabel.textContent = 'Angemeldet als ' + user.name;
            this.onLogin(user);
            this.disableLogin();
        } catch (error) {
            console.error('Failed to obtain Google Drive access token', error);
            this.showError('Google Drive Zugriff fehlgeschlagen. Bitte erlaube den Zugriff und versuche es erneut.');
            this.enableLogin();
        }
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
        this.loginContainer.classList.add('game__auth-button--disabled');
        this.loginContainer.setAttribute('aria-disabled', 'true');
    }

    private enableLogin(): void {
        this.loginContainer.classList.remove('game__auth-button--disabled');
        this.loginContainer.removeAttribute('aria-disabled');
    }

    async getAccessToken(forcePrompt = false): Promise<string | null> {
        if (this.hasValidAccessToken()) {
            return this.accessToken;
        }
        try {
            return await this.requestAccessToken(forcePrompt);
        } catch (error) {
            console.warn('Token request failed', error);
            return null;
        }
    }

    private async requestAccessToken(forcePrompt: boolean): Promise<string> {
        if (!this.tokenClient) {
            throw new Error('Google OAuth client not initialized');
        }
        if (this.pendingTokenRequest) {
            return this.pendingTokenRequest;
        }
        this.pendingTokenRequest = new Promise<string>((resolve, reject) => {
            this.tokenClient!.callback = (tokenResponse) => {
                this.pendingTokenRequest = null;
                if (tokenResponse.error || !tokenResponse.access_token) {
                    reject(tokenResponse.error || 'Token response missing access token');
                    return;
                }
                this.accessToken = tokenResponse.access_token;
                this.accessTokenExpiresAt = this.computeExpiry(tokenResponse.expires_in);
                resolve(tokenResponse.access_token);
            };
            try {
                this.tokenClient!.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
            } catch (error) {
                this.pendingTokenRequest = null;
                reject(error);
            }
        });
        return this.pendingTokenRequest;
    }

    private computeExpiry(expiresIn?: number): number {
        const defaultLifetimeMs = 50 * 60 * 1000;
        if (!expiresIn || expiresIn <= 0) {
            return Date.now() + defaultLifetimeMs;
        }
        return Date.now() + expiresIn * 1000;
    }

    private hasValidAccessToken(): boolean {
        if (!this.accessToken || !this.accessTokenExpiresAt) {
            return false;
        }
        return Date.now() < this.accessTokenExpiresAt - 5000;
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

import { getRequiredElement } from './dom.js';
import { Locale, onLocaleChange, t } from './i18n.js';

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
            disableAutoSelect?(): void;
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
        this.errorLabel = getRequiredElement(config.errorId);
        this.onLogin = config.onLogin;
        this.disableLogin();
        this.initializeGoogle();
        onLocaleChange((locale) => this.handleLocaleChange(locale));
    }

    private readonly credentialStorageKey = 'match3-google-credential';
    private readonly clientId =
        '276995857018-9foeghnr835nqq9kc2dpbl5j9ibljodg.apps.googleusercontent.com';
    private loginContainer: HTMLElement;
    private errorLabel: HTMLElement;
    private onLogin: (user: GoogleUser) => void;
    private currentLocale: Locale = 'en';

    applyLocale(): void {
        this.renderGoogleButton();
    }

    setLoggedOut(): void {
        this.clearError();
        this.enableLogin();
        this.setLoginVisible(true);
        this.renderGoogleButton();
    }

    signOut(): void {
        try {
            window.google?.accounts?.id?.disableAutoSelect?.();
        } catch (error) {
            console.warn('Failed to disable auto-select after logout', error);
        }
        this.storeCredential(null);
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
        this.renderGoogleButton();
        this.enableLogin();
    }

    private renderGoogleButton(): void {
        if (!window.google?.accounts?.id) {
            return;
        }
        this.loginContainer.innerHTML = '';
        // see all options for the GsiButtonConfiguration: https://developers.google.com/identity/gsi/web/reference/js-reference#type
        window.google.accounts.id.renderButton(this.loginContainer, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            locale: this.currentLocale,
            logo_alignment: 'left',
            width: 200
        });
        //console.log("INFO: render google auth btn (locale: " + this.currentLocale + ")");
    }

    private handleLocaleChange(locale: Locale): void {
        if (locale === this.currentLocale) return;
        this.currentLocale = locale;
        this.renderGoogleButton();
    }

    private handleCredential(response: GoogleCredentialResponse): void {
        this.processCredential(response.credential, false);
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

    private setLoginVisible(visible: boolean): void {
        if (visible) {
            this.loginContainer.removeAttribute('hidden');
        } else {
            this.loginContainer.setAttribute('hidden', 'true');
        }
    }

    private getLoginContainer(id: string): HTMLElement {
        const element = getRequiredElement(id);
        if (!(element instanceof HTMLElement)) {
            throw new Error('Google login container is not an element');
        }
        return element;
    }

    trySilentLogin(): void {
        this.attemptSilentLogin();
    }

    private attemptSilentLogin(): void {
        const stored = this.readStoredCredential();
        if (!stored) {
            return;
        }
        this.disableLogin();
        this.setLoginVisible(false);
        this.processCredential(stored, true);
    }

    private processCredential(credential: string, silent: boolean): void {
        const payload = this.decodeCredential(credential);
        if (!payload) {
            if (!silent) {
                this.showError(t('auth.error.loginFailed'));
            } else {
                this.enableLogin();
                this.setLoginVisible(true);
            }
            this.storeCredential(null);
            return;
        }
        this.clearError();
        this.storeCredential(credential);
        const user: GoogleUser = {
            id: payload.sub,
            name: payload.name || payload.email || 'Spieler',
            ...(payload.email ? { email: payload.email } : {})
        };
        this.onLogin(user);
        this.disableLogin();
        this.setLoginVisible(false);
    }

    private storeCredential(value: string | null): void {
        try {
            if (value === null) {
                window.localStorage.removeItem(this.credentialStorageKey);
            } else {
                window.localStorage.setItem(this.credentialStorageKey, value);
            }
        } catch (error) {
            console.warn('Local storage unavailable for Google credential', error);
        }
    }

    private readStoredCredential(): string | null {
        try {
            return window.localStorage.getItem(this.credentialStorageKey);
        } catch (error) {
            console.warn('Local storage unavailable for Google credential', error);
            return null;
        }
    }
}

export { GoogleAuth };
export type { GoogleUser };

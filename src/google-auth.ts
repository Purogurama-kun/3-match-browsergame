import { getRequiredElement } from './dom.js';
import { t } from './i18n.js';

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
    timeProgressId: string;
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
        this.statusLabel = getRequiredElement(config.statusId);
        this.progressLabel = getRequiredElement(config.progressId);
        this.blockerProgressLabel = getRequiredElement(config.blockerProgressId);
        this.timeProgressLabel = getRequiredElement(config.timeProgressId);
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
    private timeProgressLabel: HTMLElement;
    private errorLabel: HTMLElement;
    private onLogin: (user: GoogleUser) => void;
    private progressState = { level: 1, blockerHighScore: 0, timeSurvival: 0 };
    private isProgressLoading = false;
    private currentUserName: string | null = null;

    setProgress(progress: {
        level?: number;
        highestLevel?: number;
        blockerHighScore: number;
        timeSurvival: number;
    }): void {
        const levelValue = Math.max(1, progress.level ?? progress.highestLevel ?? 1);
        this.progressState.level = levelValue;
        this.progressState.blockerHighScore = Math.max(0, Math.floor(Number.isFinite(progress.blockerHighScore) ? progress.blockerHighScore : 0));
        this.progressState.timeSurvival = Math.max(0, Math.floor(Number.isFinite(progress.timeSurvival) ? progress.timeSurvival : 0));
        this.isProgressLoading = false;
        this.updateProgressTexts();
    }

    setProgressLevel(level: number): void {
        const normalized = Math.max(1, Math.min(Number.isFinite(level) ? level : 1, 50));
        this.progressState.level = normalized;
        this.progressLabel.textContent = t('auth.progress.level', { level: normalized });
    }

    setBlockerHighScore(score: number): void {
        const normalized = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
        this.progressState.blockerHighScore = normalized;
        this.blockerProgressLabel.textContent = t('auth.progress.blocker', { score: normalized });
    }

    setTimeBest(time: number): void {
        const normalized = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
        this.progressState.timeSurvival = normalized;
        const minutes = Math.floor(normalized / 60)
            .toString()
            .padStart(2, '0');
        const seconds = (normalized % 60).toString().padStart(2, '0');
        this.timeProgressLabel.textContent = t('auth.progress.time', {
            time: minutes + ':' + seconds
        });
    }

    private updateProgressTexts(): void {
        this.setProgressLevel(this.progressState.level);
        this.setBlockerHighScore(this.progressState.blockerHighScore);
        this.setTimeBest(this.progressState.timeSurvival);
    }

    showProgressLoading(): void {
        this.isProgressLoading = true;
        this.progressLabel.textContent = t('auth.progress.loading');
        this.blockerProgressLabel.textContent = t('auth.progress.blocker.loading');
        this.timeProgressLabel.textContent = t('auth.progress.time.loading');
    }

    applyLocale(): void {
        if (this.isProgressLoading) {
            this.showProgressLoading();
            return;
        }
        this.statusLabel.textContent = this.currentUserName
            ? t('auth.status.signedIn', { name: this.currentUserName })
            : t('auth.status.notSignedIn');
        this.updateProgressTexts();
    }

    setLoggedOut(level: number = 1, blockerHighScore: number = 0, timeSurvival: number = 0): void {
        this.currentUserName = null;
        this.isProgressLoading = false;
        this.statusLabel.textContent = t('auth.status.notSignedIn');
        this.setProgress({ level, blockerHighScore, timeSurvival });
        this.enableLogin();
        this.setLoginVisible(true);
    }

    signOut(): void {
        try {
            window.google?.accounts?.id?.disableAutoSelect?.();
        } catch (error) {
            console.warn('Failed to disable auto-select after logout', error);
        }
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
            locale: 'en',
            logo_alignment: 'left',
            width: 200
        });
        this.enableLogin();
    }

    private handleCredential(response: GoogleCredentialResponse): void {
        const payload = this.decodeCredential(response.credential);
        if (!payload) {
            this.showError(t('auth.error.loginFailed'));
            return;
        }
        this.clearError();
        const user: GoogleUser = {
            id: payload.sub,
            name: payload.name || payload.email || 'Spieler',
            ...(payload.email ? { email: payload.email } : {})
        };
        this.currentUserName = user.name;
        this.statusLabel.textContent = t('auth.status.signedIn', { name: user.name });
        this.onLogin(user);
        this.disableLogin();
        this.setLoginVisible(false);
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
}

export { GoogleAuth };
export type { GoogleUser };

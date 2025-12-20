import { Match3Game } from './match3-game.js';
import { getRequiredElement } from './dom.js';
import { GoogleAuth, GoogleUser } from './google-auth.js';
import { ProgressStore } from './progress-store.js';

class GameApp {
    constructor() {
        this.body = document.body;
        this.mainMenu = getRequiredElement('main-menu');
        this.startButton = this.getStartButton();
        this.progressStore = new ProgressStore();
        this.googleAuth = new GoogleAuth({
            loginButtonId: 'google-login',
            statusId: 'auth-status',
            progressId: 'auth-progress',
            errorId: 'auth-error',
            onLogin: (user) => {
                void this.handleLogin(user);
            }
        });
        this.game = new Match3Game();

        this.startButton.addEventListener('click', () => this.startGame());
        this.game.onExitGameRequested(() => this.returnToMenu());
        this.game.onProgressChange((level) => this.saveProgress(level));

        this.showMainMenu();
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startButton: HTMLButtonElement;
    private googleAuth: GoogleAuth;
    private progressStore: ProgressStore;
    private currentUser: GoogleUser | null = null;
    private highestUnlockedLevel = 1;
    private isSyncingProgress = false;
    private game: Match3Game;

    private startGame(): void {
        if (!this.currentUser || this.isSyncingProgress) return;
        this.hideMainMenu();
        this.game.start(this.highestUnlockedLevel);
    }

    private returnToMenu(): void {
        this.game.stop();
        this.showMainMenu();
        this.startButton.focus();
    }

    private showMainMenu(): void {
        this.body.classList.add('game--menu');
        this.mainMenu.removeAttribute('hidden');
        this.game.closeOptions();
        this.updateStartButtonState();
    }

    private hideMainMenu(): void {
        this.body.classList.remove('game--menu');
        this.mainMenu.setAttribute('hidden', 'true');
    }

    private getStartButton(): HTMLButtonElement {
        const element = getRequiredElement('start-level');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start level button is not a button');
        }
        return element;
    }

    private async handleLogin(user: GoogleUser): Promise<void> {
        this.currentUser = user;
        this.highestUnlockedLevel = 1;
        this.isSyncingProgress = true;
        this.googleAuth.setProgressMessage('Fortschritt wird synchronisiert...');
        this.updateStartButtonState();
        try {
            const accessToken = await this.googleAuth.getAccessToken(true);
            const stored = await this.progressStore.load(user.id, accessToken);
            this.highestUnlockedLevel = stored.highestLevel;
            if (accessToken) {
                this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
            } else {
                this.googleAuth.setProgressMessage('Fortschritt wird lokal gespeichert');
            }
        } catch (error) {
            console.error('Failed to load or synchronize progress', error);
            const local = await this.progressStore.load(user.id, null);
            this.highestUnlockedLevel = local.highestLevel;
            this.googleAuth.setProgressMessage('Fortschritt wird lokal gespeichert');
        } finally {
            this.isSyncingProgress = false;
            this.updateStartButtonState();
        }
    }

    private saveProgress(unlockedLevel: number): void {
        if (!this.currentUser) return;
        this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, unlockedLevel);
        this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
        this.updateStartButtonState();
        void this.persistProgress();
    }

    private async persistProgress(): Promise<void> {
        if (!this.currentUser) return;
        try {
            const accessToken = await this.googleAuth.getAccessToken();
            await this.progressStore.save(this.currentUser.id, accessToken, this.highestUnlockedLevel);
        } catch (error) {
            console.warn('Failed to persist progress', error);
        }
    }

    private updateStartButtonState(): void {
        const isAuthenticated = Boolean(this.currentUser);
        this.startButton.disabled = !isAuthenticated || this.isSyncingProgress;
        if (!isAuthenticated) {
            this.startButton.textContent = 'Level Modus';
            return;
        }
        if (this.isSyncingProgress) {
            this.startButton.textContent = 'Level Modus (Synchronisierung...)';
            return;
        }
        const labelLevel = Math.max(1, this.highestUnlockedLevel);
        this.startButton.textContent = 'Level Modus (Start bei Level ' + labelLevel + ')';
    }
}

new GameApp();

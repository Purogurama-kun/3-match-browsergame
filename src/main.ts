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
            onLogin: (user) => this.handleLogin(user)
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
    private isProgressLoading = false;
    private highestUnlockedLevel = 1;
    private game: Match3Game;

    private startGame(): void {
        if (!this.currentUser || this.isProgressLoading) return;
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

    private handleLogin(user: GoogleUser): void {
        this.isProgressLoading = true;
        this.currentUser = user;
        this.highestUnlockedLevel = 1;
        this.googleAuth.clearError();
        this.googleAuth.showProgressLoading();
        this.updateStartButtonState();
        void this.loadProgress(user.id);
    }

    private async loadProgress(userId: string): Promise<void> {
        try {
            const stored = await this.progressStore.load(userId);
            if (!this.isCurrentUser(userId)) return;
            this.highestUnlockedLevel = stored.highestLevel;
            this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
            this.googleAuth.clearError();
        } catch (error) {
            console.error('Failed to load progress', error);
            if (this.isCurrentUser(userId)) {
                this.highestUnlockedLevel = 1;
                this.googleAuth.showError(
                    'Fortschritt konnte nicht geladen werden. Standard-Level 1 wird verwendet.'
                );
                this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
            }
        } finally {
            if (this.isCurrentUser(userId)) {
                this.isProgressLoading = false;
                this.updateStartButtonState();
            }
        }
    }

    private saveProgress(unlockedLevel: number): void {
        if (!this.currentUser) return;
        this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, unlockedLevel);
        this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
        this.updateStartButtonState();
        void this.persistProgress(this.currentUser.id, this.highestUnlockedLevel);
    }

    private async persistProgress(userId: string, highestLevel: number): Promise<void> {
        try {
            const stored = await this.progressStore.save(userId, highestLevel);
            if (!this.isCurrentUser(userId)) return;
            this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, stored.highestLevel);
            this.googleAuth.setProgressLevel(this.highestUnlockedLevel);
            this.googleAuth.clearError();
        } catch (error) {
            console.error('Failed to save progress', error);
            if (this.isCurrentUser(userId)) {
                this.googleAuth.showError(
                    'Fortschritt konnte nicht gespeichert werden. Bitte Verbindung prüfen.'
                );
            }
        }
    }

    private isCurrentUser(userId: string): boolean {
        return Boolean(this.currentUser && this.currentUser.id === userId);
    }

    private updateStartButtonState(): void {
        const isAuthenticated = Boolean(this.currentUser);
        const isLoading = this.isProgressLoading;
        this.startButton.disabled = !isAuthenticated || isLoading;
        if (!isAuthenticated) {
            this.startButton.textContent = 'Level Modus';
            return;
        }
        if (isLoading) {
            this.startButton.textContent = 'Fortschritt wird geladen...';
            return;
        }
        const labelLevel = Math.max(1, this.highestUnlockedLevel);
        this.startButton.textContent = 'Level Modus (Start bei Level ' + labelLevel + ')';
    }
}

new GameApp();

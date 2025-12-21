import { Match3Game } from './match3-game.js';
import { getRequiredElement } from './dom.js';
import { GoogleAuth, GoogleUser } from './google-auth.js';
import { ProgressStore, StoredProgress } from './progress-store.js';
import { LocalProgressStore } from './local-progress-store.js';

class GameApp {
    constructor() {
        this.body = document.body;
        this.mainMenu = getRequiredElement('main-menu');
        this.startLevelButton = this.getLevelButton();
        this.startBlockerButton = this.getBlockerButton();
        this.progress = { highestLevel: 1, blockerHighScore: 0 };
        this.progressStore = new ProgressStore();
        this.localProgress = new LocalProgressStore();
        this.googleAuth = new GoogleAuth({
            loginButtonId: 'google-login',
            statusId: 'auth-status',
            progressId: 'auth-progress',
            blockerProgressId: 'auth-progress-blocker',
            errorId: 'auth-error',
            onLogin: (user) => this.handleLogin(user)
        });
        this.game = new Match3Game();

        this.loadLocalProgress();

        this.startLevelButton.addEventListener('click', () => this.startLevelGame());
        this.startBlockerButton.addEventListener('click', () => this.startBlockerGame());
        this.game.onExitGameRequested(() => this.returnToMenu());
        this.game.onProgressChange((level) => this.saveProgress(level));
        this.game.onBlockerHighScore((score) => this.saveBlockerHighScore(score));

        this.showMainMenu();
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startLevelButton: HTMLButtonElement;
    private startBlockerButton: HTMLButtonElement;
    private googleAuth: GoogleAuth;
    private progressStore: ProgressStore;
    private localProgress: LocalProgressStore;
    private currentUser: GoogleUser | null = null;
    private isProgressLoading = false;
    private progress: StoredProgress;
    private game: Match3Game;

    private startLevelGame(): void {
        if (this.isProgressLoading) return;
        this.hideMainMenu();
        this.game.startLevel(this.progress.highestLevel);
    }

    private startBlockerGame(): void {
        if (this.isProgressLoading) return;
        this.hideMainMenu();
        this.game.startBlocker(this.progress.blockerHighScore);
    }

    private returnToMenu(): void {
        this.game.stop();
        this.showMainMenu();
        this.startLevelButton.focus();
    }

    private showMainMenu(): void {
        this.body.classList.add('match-app--menu');
        this.mainMenu.removeAttribute('hidden');
        this.game.closeOptions();
        this.updateStartButtonState();
    }

    private hideMainMenu(): void {
        this.body.classList.remove('match-app--menu');
        this.mainMenu.setAttribute('hidden', 'true');
    }

    private loadLocalProgress(): void {
        const stored = this.localProgress.load();
        this.progress = this.mergeProgress(this.progress, stored);
        this.googleAuth.setLoggedOut(this.progress.highestLevel, this.progress.blockerHighScore);
        this.updateStartButtonState();
    }

    private getLevelButton(): HTMLButtonElement {
        const element = getRequiredElement('start-level');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start level button is not a button');
        }
        return element;
    }

    private getBlockerButton(): HTMLButtonElement {
        const element = getRequiredElement('start-blocker');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start blocker button is not a button');
        }
        return element;
    }

    private handleLogin(user: GoogleUser): void {
        const localProgress = this.progress;
        this.isProgressLoading = true;
        this.currentUser = user;
        this.googleAuth.clearError();
        this.googleAuth.showProgressLoading();
        this.updateStartButtonState();
        void this.loadProgress(user.id, localProgress);
    }

    private async loadProgress(userId: string, localProgress: StoredProgress): Promise<void> {
        try {
            const stored = await this.progressStore.load(userId, localProgress);
            if (!this.isCurrentUser(userId)) return;
            const mergedProgress = this.mergeProgress(localProgress, stored);
            this.progress = mergedProgress;
            this.googleAuth.setProgress(mergedProgress);
            this.googleAuth.clearError();
            if (this.shouldPersistMergedProgress(stored, mergedProgress)) {
                void this.persistProgress(userId, mergedProgress);
            }
        } catch (error) {
            console.error('Failed to load progress', error);
            if (this.isCurrentUser(userId)) {
                this.progress = localProgress;
                this.googleAuth.showError(
                    'Fortschritt konnte nicht geladen werden. Standard-Level 1 wird verwendet.'
                );
                this.googleAuth.setProgress(this.progress);
            }
        } finally {
            if (this.isCurrentUser(userId)) {
                this.isProgressLoading = false;
                this.updateStartButtonState();
            }
        }
    }

    private saveProgress(unlockedLevel: number): void {
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: unlockedLevel,
            blockerHighScore: this.progress.blockerHighScore
        });
        this.googleAuth.setProgress(this.progress);
        this.updateStartButtonState();
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress);
    }

    private saveBlockerHighScore(score: number): void {
        if (score <= this.progress.blockerHighScore) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            blockerHighScore: score
        });
        this.googleAuth.setProgress(this.progress);
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress);
    }

    private async persistProgress(userId: string, progress: StoredProgress): Promise<void> {
        try {
            const stored = await this.progressStore.save(userId, progress);
            if (!this.isCurrentUser(userId)) return;
            this.progress = this.mergeProgress(this.progress, stored);
            this.googleAuth.setProgress(this.progress);
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
        this.startLevelButton.disabled = isLoading;
        this.startBlockerButton.disabled = isLoading;
        const labelLevel = Math.max(1, this.progress.highestLevel);
        const blockerScore = Math.max(0, this.progress.blockerHighScore);
        this.startBlockerButton.textContent = isLoading
            ? 'Blocker Modus wird geladen...'
            : 'Blocker Modus (Best: ' + blockerScore + ')';
        if (!isAuthenticated) {
            this.startLevelButton.textContent = 'Level Modus (Gast)';
            return;
        }
        if (isLoading) {
            this.startLevelButton.textContent = 'Fortschritt wird geladen...';
            return;
        }
        this.startLevelButton.textContent = 'Level Modus (Start bei Level ' + labelLevel + ')';
    }

    private mergeProgress(current: StoredProgress, incoming: StoredProgress): StoredProgress {
        return {
            highestLevel: Math.max(current.highestLevel, incoming.highestLevel),
            blockerHighScore: Math.max(current.blockerHighScore, incoming.blockerHighScore)
        };
    }

    private shouldPersistMergedProgress(stored: StoredProgress, merged: StoredProgress): boolean {
        return (
            merged.highestLevel > stored.highestLevel ||
            merged.blockerHighScore > stored.blockerHighScore
        );
    }
}

new GameApp();

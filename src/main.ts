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
        this.startEndlessButton = this.getEndlessButton();
        this.progress = { highestLevel: 1, endlessHighScore: 0 };
        this.progressStore = new ProgressStore();
        this.localProgress = new LocalProgressStore();
        this.googleAuth = new GoogleAuth({
            loginButtonId: 'google-login',
            statusId: 'auth-status',
            progressId: 'auth-progress',
            endlessProgressId: 'auth-progress-endless',
            errorId: 'auth-error',
            onLogin: (user) => this.handleLogin(user)
        });
        this.game = new Match3Game();

        this.loadLocalProgress();

        this.startLevelButton.addEventListener('click', () => this.startLevelGame());
        this.startEndlessButton.addEventListener('click', () => this.startEndlessGame());
        this.game.onExitGameRequested(() => this.returnToMenu());
        this.game.onProgressChange((level) => this.saveProgress(level));
        this.game.onEndlessHighScore((score) => this.saveEndlessHighScore(score));

        this.showMainMenu();
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startLevelButton: HTMLButtonElement;
    private startEndlessButton: HTMLButtonElement;
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

    private startEndlessGame(): void {
        if (this.isProgressLoading) return;
        this.hideMainMenu();
        this.game.startEndless(this.progress.endlessHighScore);
    }

    private returnToMenu(): void {
        this.game.stop();
        this.showMainMenu();
        this.startLevelButton.focus();
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

    private loadLocalProgress(): void {
        const stored = this.localProgress.load();
        this.progress = this.mergeProgress(this.progress, stored);
        this.googleAuth.setLoggedOut(this.progress.highestLevel, this.progress.endlessHighScore);
        this.updateStartButtonState();
    }

    private getLevelButton(): HTMLButtonElement {
        const element = getRequiredElement('start-level');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start level button is not a button');
        }
        return element;
    }

    private getEndlessButton(): HTMLButtonElement {
        const element = getRequiredElement('start-endless');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start endless button is not a button');
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
            endlessHighScore: this.progress.endlessHighScore
        });
        this.googleAuth.setProgress(this.progress);
        this.updateStartButtonState();
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress);
    }

    private saveEndlessHighScore(score: number): void {
        if (score <= this.progress.endlessHighScore) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            endlessHighScore: score
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
        this.startEndlessButton.disabled = isLoading;
        const labelLevel = Math.max(1, this.progress.highestLevel);
        const endlessScore = Math.max(0, this.progress.endlessHighScore);
        this.startEndlessButton.textContent = isLoading
            ? 'Endlos Modus wird geladen...'
            : 'Endlos Modus (Best: ' + endlessScore + ')';
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
            endlessHighScore: Math.max(current.endlessHighScore, incoming.endlessHighScore)
        };
    }

    private shouldPersistMergedProgress(stored: StoredProgress, merged: StoredProgress): boolean {
        return (
            merged.highestLevel > stored.highestLevel ||
            merged.endlessHighScore > stored.endlessHighScore
        );
    }
}

new GameApp();

import { Match3Game } from './match3-game.js';
import { getRequiredElement } from './dom.js';
import { GoogleAuth, GoogleUser } from './google-auth.js';
import { ProgressStore, StoredProgress } from './progress-store.js';
import { LocalProgressStore } from './local-progress-store.js';
import { onLocaleChange, setLocale, t } from './i18n.js';
import type { Locale } from './i18n.js';
import type { LeaderboardIdentity, LeaderboardMode } from './types.js';

class GameApp {
    constructor() {
        this.body = document.body;
        this.mainMenu = getRequiredElement('main-menu');
        this.startLevelButton = this.getLevelButton();
        this.startBlockerButton = this.getBlockerButton();
        this.startTimeButton = this.getTimeButton();
        this.startLeaderboardButton = this.getLeaderboardButton();
        this.leaderboard = getRequiredElement('leaderboard');
        this.coinIcon = this.getCoinIcon();
        this.coinLabel = this.getCoinLabel();
        this.progress = { highestLevel: 1, blockerHighScore: 0, timeSurvival: 0, sugarCoins: 0 };
        this.progressStore = new ProgressStore();
        this.localProgress = new LocalProgressStore();
        this.googleAuth = new GoogleAuth({
            loginButtonId: 'google-login',
            statusId: 'auth-status',
            progressId: 'auth-progress',
            blockerProgressId: 'auth-progress-blocker',
            timeProgressId: 'auth-progress-time',
            errorId: 'auth-error',
            onLogin: (user) => this.handleLogin(user)
        });
        this.game = new Match3Game();
        this.game.onLanguageChange((locale) => setLocale(locale));
        onLocaleChange((locale) => this.handleLocaleChange(locale));

        this.loadLocalProgress();

        this.startLevelButton.addEventListener('click', () => this.startLevelGame());
        this.startBlockerButton.addEventListener('click', () => this.startBlockerGame());
        this.startTimeButton.addEventListener('click', () => this.startTimeGame());
        this.startLeaderboardButton.addEventListener('click', () => this.showLeaderboard());
        this.game.onExitGameRequested(() => this.returnToMenu());
        this.game.onProgressChange((level) => this.saveProgress(level));
        this.game.onBlockerHighScore((score) => this.saveBlockerHighScore(score));
        this.game.onTimeBest((time) => this.saveTimeBest(time));
        this.game.onSugarCoinsEarned((amount) => this.grantSugarCoins(amount));

        this.showMainMenu();
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startLevelButton: HTMLButtonElement;
    private startBlockerButton: HTMLButtonElement;
    private startTimeButton: HTMLButtonElement;
    private startLeaderboardButton: HTMLButtonElement;
    private leaderboard: HTMLElement;
    private coinIcon: HTMLImageElement;
    private coinLabel: HTMLElement;
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

    private startTimeGame(): void {
        if (this.isProgressLoading) return;
        this.hideMainMenu();
        this.game.startTime(this.progress.timeSurvival);
    }

    private showLeaderboard(): void {
        if (this.isProgressLoading) return;
        this.hideMainMenu();
        this.body.classList.add('match-app--leaderboard');
        this.leaderboard.removeAttribute('hidden');
        this.game.showLeaderboard({
            identity: this.getIdentity(),
            onExit: () => this.returnToMenu()
        });
    }

    private returnToMenu(): void {
        this.hideLeaderboard();
        this.game.stop();
        this.showMainMenu();
        this.startLevelButton.focus();
    }

    private handleLocaleChange(locale: Locale): void {
        this.updateStartButtonState();
        this.googleAuth.applyLocale();
        this.updateSugarCoinDisplay();
        this.game.handleLocaleChange(locale);
    }

    private showMainMenu(): void {
        this.hideLeaderboard();
        this.body.classList.add('match-app--menu');
        this.mainMenu.removeAttribute('hidden');
        this.game.closeOptions();
        this.updateStartButtonState();
    }

    private hideMainMenu(): void {
        this.body.classList.remove('match-app--menu');
        this.mainMenu.setAttribute('hidden', 'true');
    }

    private hideLeaderboard(): void {
        this.body.classList.remove('match-app--leaderboard');
        this.leaderboard.setAttribute('hidden', 'true');
    }

    private getIdentity(): LeaderboardIdentity | null {
        if (!this.currentUser) return null;
        return {
            id: this.currentUser.id,
            name: this.currentUser.name
        };
    }

    private loadLocalProgress(): void {
        const stored = this.localProgress.load();
        this.progress = this.mergeProgress(this.progress, stored);
        this.googleAuth.setLoggedOut(
            this.progress.highestLevel,
            this.progress.blockerHighScore,
            this.progress.timeSurvival
        );
        this.updateSugarCoinDisplay();
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

    private getTimeButton(): HTMLButtonElement {
        const element = getRequiredElement('start-time');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start time button is not a button');
        }
        return element;
    }

    private getLeaderboardButton(): HTMLButtonElement {
        const element = getRequiredElement('open-leaderboard');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Leaderboard button is not a button');
        }
        return element;
    }

    private getCoinIcon(): HTMLImageElement {
        const element = getRequiredElement('auth-coin-icon');
        if (!(element instanceof HTMLImageElement)) {
            throw new Error('Sugar coin icon is not an image');
        }
        return element;
    }

    private getCoinLabel(): HTMLElement {
        const element = getRequiredElement('auth-coin-count');
        if (!(element instanceof HTMLElement)) {
            throw new Error('Sugar coin label is not an element');
        }
        return element;
    }

    private handleLogin(user: GoogleUser): void {
        const localProgress = this.progress;
        this.isProgressLoading = true;
        this.currentUser = user;
        this.googleAuth.clearError();
        this.googleAuth.showProgressLoading();
        this.coinLabel.textContent = t('auth.progress.coins.loading');
        this.coinIcon.src = 'assets/images/sugar_coin_icon.png';
        this.coinIcon.alt = t('auth.progress.coins.loading');
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
            this.updateSugarCoinDisplay();
            if (this.shouldPersistMergedProgress(stored, mergedProgress)) {
                void this.persistProgress(userId, mergedProgress, 'both');
            }
        } catch (error) {
            console.error('Failed to load progress', error);
            if (this.isCurrentUser(userId)) {
                this.progress = localProgress;
                this.googleAuth.showError(t('auth.error.progressLoad'));
                this.googleAuth.setProgress(this.progress);
                this.updateSugarCoinDisplay();
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
            blockerHighScore: this.progress.blockerHighScore,
            timeSurvival: this.progress.timeSurvival,
            sugarCoins: this.progress.sugarCoins
        });
        this.googleAuth.setProgress(this.progress);
        this.updateStartButtonState();
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'level');
        this.updateSugarCoinDisplay();
    }

    private saveBlockerHighScore(score: number): void {
        if (score <= this.progress.blockerHighScore) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            blockerHighScore: score,
            timeSurvival: this.progress.timeSurvival,
            sugarCoins: this.progress.sugarCoins
        });
        this.googleAuth.setProgress(this.progress);
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'blocker');
        this.updateSugarCoinDisplay();
    }

    private saveTimeBest(time: number): void {
        if (time <= this.progress.timeSurvival) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            blockerHighScore: this.progress.blockerHighScore,
            timeSurvival: time,
            sugarCoins: this.progress.sugarCoins
        });
        this.googleAuth.setProgress(this.progress);
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'time');
        this.updateSugarCoinDisplay();
    }

    private async persistProgress(
        userId: string,
        progress: StoredProgress,
        mode: LeaderboardMode | 'both'
    ): Promise<void> {
        try {
            const stored = await this.progressStore.save(userId, progress, mode, this.getIdentity());
            if (!this.isCurrentUser(userId)) return;
            this.progress = this.mergeProgress(this.progress, stored);
            this.googleAuth.setProgress(this.progress);
            this.googleAuth.clearError();
            this.updateSugarCoinDisplay();
        } catch (error) {
            console.error('Failed to save progress', error);
            if (this.isCurrentUser(userId)) {
                this.googleAuth.showError(t('auth.error.progressSave'));
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
        this.startTimeButton.disabled = isLoading;
        this.startLeaderboardButton.disabled = isLoading;
        const labelLevel = Math.max(1, this.progress.highestLevel);
        const blockerScore = Math.max(0, this.progress.blockerHighScore);
        const timeBest = Math.max(0, this.progress.timeSurvival);
        this.startTimeButton.textContent = isLoading
            ? t('mainMenu.start.timeLoading')
            : t('mainMenu.start.timeBest', { time: this.formatTime(timeBest) });
        this.startBlockerButton.textContent = isLoading
            ? t('mainMenu.start.blockerLoading')
            : t('mainMenu.start.blockerBest', { score: blockerScore });
        if (!isAuthenticated) {
            this.startLevelButton.textContent = t('mainMenu.start.levelGuest');
            return;
        }
        if (isLoading) {
            this.startLevelButton.textContent = t('mainMenu.start.progressLoading');
            return;
        }
        this.startLevelButton.textContent = t('mainMenu.start.levelAt', { level: labelLevel });
    }

    private updateSugarCoinDisplay(): void {
        const coins = Math.max(0, Math.floor(Number.isFinite(this.progress.sugarCoins) ? this.progress.sugarCoins : 0));
        const label = t('auth.progress.coins', { coins });
        this.coinLabel.textContent = label;
        this.coinIcon.src = coins === 1 ? 'assets/images/sugar_coin.png' : 'assets/images/sugar_coin_icon.png';
        this.coinIcon.alt = label;
    }

    private mergeProgress(current: StoredProgress, incoming: StoredProgress): StoredProgress {
        return {
            highestLevel: Math.max(current.highestLevel, incoming.highestLevel),
            blockerHighScore: Math.max(current.blockerHighScore, incoming.blockerHighScore),
            timeSurvival: Math.max(current.timeSurvival, incoming.timeSurvival),
            sugarCoins: Math.max(current.sugarCoins, incoming.sugarCoins)
        };
    }

    private shouldPersistMergedProgress(stored: StoredProgress, merged: StoredProgress): boolean {
        return (
            merged.highestLevel > stored.highestLevel ||
            merged.blockerHighScore > stored.blockerHighScore ||
            merged.timeSurvival > stored.timeSurvival ||
            merged.sugarCoins > stored.sugarCoins
        );
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    grantSugarCoins(amount: number): void {
        const rounded = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
        if (rounded === 0) return;
        const nextCoins = Math.max(0, this.progress.sugarCoins + rounded);
        this.progress = this.localProgress.save({ ...this.progress, sugarCoins: nextCoins });
        this.updateSugarCoinDisplay();
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'both');
    }
}

setLocale('en');
new GameApp();

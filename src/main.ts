import { Match3Game } from './match3-game.js';
import { ConfirmDialog } from './confirm-dialog.js';
import { getRequiredElement } from './dom.js';
import { GoogleAuth, GoogleUser } from './google-auth.js';
import { ProgressStore, StoredProgress } from './progress-store.js';
import { LocalProgressStore } from './local-progress-store.js';
import { LocalOptionsStore } from './local-options-store.js';
import { LocalAttemptStore } from './local-attempt-store.js';
import { ShopView, getNextPowerupPrice, type ShopState } from './shop.js';
import {
    createFreshPowerupInventory,
    createMaxPowerupInventory,
    MAX_TACTICAL_POWERUP_STOCK,
    TACTICAL_POWERUPS,
    type TacticalPowerup
} from './constants.js';
import { GuestProfileStore } from './profile-store.js';
import { ProfileState, type AccountProfileData } from './profile-state.js';
import { LevelSelectView } from './level-select.js';
import { TutorialView } from './tutorial.js';
import { onLocaleChange, setLocale, t } from './i18n.js';
import type { Locale } from './i18n.js';
import { OptionsStore } from './options-store.js';
import { normalizeGameOptions, type GameOptions } from './game-options.js';
import type { GameMode, LeaderboardIdentity, LeaderboardMode, PowerupInventory } from './types.js';
import { isDebugMode, isLocalDebugHost } from './debug.js';
import { FpsMeter } from './fps-meter.js';

class GameApp {
    constructor() {
        this.body = document.body;
        this.mainMenu = getRequiredElement('main-menu');
        this.startLevelButton = this.getLevelButton();
        this.startBlockerButton = this.getBlockerButton();
        this.startTimeButton = this.getTimeButton();
        this.startLeaderboardButton = this.getLeaderboardButton();
        this.leaderboard = getRequiredElement('leaderboard');
        this.shopButton = this.getShopButton();
        this.tutorialButton = this.getTutorialButton();
        this.profileButton = this.getProfileButton();
        this.progress = {
            highestLevel: 1,
            blockerHighScore: 0,
            timeSurvival: 0,
            sugarCoins: 0,
            powerups: createFreshPowerupInventory()
        };
        this.progressStore = new ProgressStore();
        this.localProgress = new LocalProgressStore();
        this.localAttemptStore = new LocalAttemptStore();
        this.localOptionsStore = new LocalOptionsStore();
        this.optionsStore = new OptionsStore();
        this.options = this.localOptionsStore.load();
        this.guestProfileStore = new GuestProfileStore();
        this.profileState = new ProfileState({
            onExit: () => this.handleAccountExit()
        });
        this.profileState.onNameSave((value) => {
            void this.handleProfileNameSave(value);
        });
        this.profileState.onDeleteAccount(() => {
            void this.handleDeleteAccount();
        });
        this.game = new Match3Game();
        this.game.onLanguageChange((locale) => {
            this.handleOptionsChange({ locale });
            setLocale(locale);
        });
        this.game.onOptionsChange((change) => this.handleOptionsChange(change));
        this.googleAuth = new GoogleAuth({
            loginButtonId: 'google-login',
            errorId: 'auth-error',
            onLogin: (user) => this.handleLogin(user)
        });

        this.shopView = new ShopView({
            onBuy: (type) => this.handleShopPurchase(type),
            onClose: () => this.showMainMenu()
        });
        this.tutorialView = new TutorialView({
            onClose: () => this.showMainMenu()
        });
        this.levelSelectView = new LevelSelectView({
            onStart: (level) => this.startLevelGame(level),
            onClose: () => this.showMainMenu()
        });
        this.confirmDialog = new ConfirmDialog();

        this.loadLocalProgress();
        this.googleLoginInfoButton = this.getGoogleLoginInfoButton();
        this.googleLoginTooltip = this.getGoogleLoginTooltip();
        this.googleLoginTooltipPrefix = this.getGoogleLoginTooltipPrefix();
        this.googleLoginTooltipLink = this.getGoogleLoginTooltipLink();
        this.googleLoginTooltipSuffix = this.getGoogleLoginTooltipSuffix();
        this.setupGoogleLoginTooltip();
        this.game.setLogoutEnabled(false);
        this.googleAuth.trySilentLogin();

        this.startLevelButton.addEventListener('click', () => this.showLevelSelect());
        this.startBlockerButton.addEventListener('click', () => this.startBlockerGame());
        this.startTimeButton.addEventListener('click', () => this.startTimeGame());
        this.startLeaderboardButton.addEventListener('click', () => this.showLeaderboard());
        this.shopButton.addEventListener('click', () => this.showShop());
        this.tutorialButton.addEventListener('click', () => this.showTutorial());
        this.profileButton.addEventListener('click', () => this.showProfile());
        this.game.onExitGameRequested(() => this.handleExitGame());
        this.game.onLevelSelectRequested(() => this.returnToLevelSelect());
        this.game.onDeleteProgressRequested(() => {
            void this.handleDeleteProgress();
        });
        this.game.onLogoutRequested(() => {
            this.handleLogout();
        });
        this.game.onProgressChange((level) => this.saveProgress(level));
        this.game.onBlockerHighScore((score) => this.saveBlockerHighScore(score));
        this.game.onTimeBest((time) => this.saveTimeBest(time));
        this.game.onLevelAttempt((level) => this.recordLevelAttempt(level));
        this.game.onBlockerAttempt((score) => this.recordBlockerAttempt(score));
        this.game.onTimeAttempt((time) => this.recordTimeAttempt(time));
        this.game.onSugarCoinsEarned((amount) => this.grantSugarCoins(amount));
        this.game.onPowerupInventoryChange((inventory) => this.handlePowerupInventoryChange(inventory));

        onLocaleChange((locale) => this.handleLocaleChange(locale));
        this.applyOptions(this.options);
        setLocale(this.options.locale);
        this.showMainMenu();

        if (isDebugMode()) {
            const fpsElement = getRequiredElement<HTMLElement>('hud-fps');
            fpsElement.removeAttribute('hidden');
            this.fpsMeter = new FpsMeter(fpsElement);
            this.fpsMeter.start();
        }
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startLevelButton: HTMLButtonElement;
    private startBlockerButton: HTMLButtonElement;
    private startTimeButton: HTMLButtonElement;
    private startLeaderboardButton: HTMLButtonElement;
    private leaderboard: HTMLElement;
    private shopButton: HTMLButtonElement;
    private tutorialButton: HTMLButtonElement;
    private shopView: ShopView;
    private tutorialView: TutorialView;
    private levelSelectView: LevelSelectView;
    private confirmDialog: ConfirmDialog;
    private googleAuth: GoogleAuth;
    private progressStore: ProgressStore;
    private localProgress: LocalProgressStore;
    private localAttemptStore: LocalAttemptStore;
    private localOptionsStore: LocalOptionsStore;
    private optionsStore: OptionsStore;
    private currentUser: GoogleUser | null = null;
    private isProgressLoading = false;
    private isProfileNameSaving = false;
    private progress: StoredProgress;
    private options: GameOptions;
    private game: Match3Game;
    private googleLoginInfoButton: HTMLButtonElement;
    private googleLoginTooltip: HTMLElement;
    private googleLoginTooltipPrefix: HTMLElement;
    private googleLoginTooltipLink: HTMLAnchorElement;
    private googleLoginTooltipSuffix: HTMLElement;
    private profileButton: HTMLButtonElement;
    private guestProfileStore: GuestProfileStore;
    private profileState: ProfileState;
    private isProfileVisible = false;
    private fpsMeter: FpsMeter | null = null;

    private startLevelGame(level: number): void {
        if (this.isProgressLoading) return;
        this.hideLevelSelect();
        this.hideMainMenu();
        this.game.startLevel(level);
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
        this.hideLevelSelect();
        this.hideMainMenu();
        this.body.classList.add('match-app--leaderboard');
        this.leaderboard.removeAttribute('hidden');
        const guestProfile = this.guestProfileStore.load();
        this.game.showLeaderboard({
            identity: this.getIdentity(),
            localProgress: {
                highestLevel: this.progress.highestLevel,
                blockerHighScore: this.progress.blockerHighScore,
                timeSurvival: this.progress.timeSurvival
            },
            guestName: guestProfile.name,
            attemptStore: this.localAttemptStore,
            onExit: () => this.returnToMenu()
        });
    }

    private showShop(): void {
        if (this.isProgressLoading) return;
        this.hideLevelSelect();
        this.hideMainMenu();
        this.shopView.open(this.buildShopState());
    }

    private showTutorial(): void {
        if (this.isProgressLoading) return;
        this.hideLevelSelect();
        this.hideLeaderboard();
        this.shopView.hide();
        this.hideProfile();
        this.hideMainMenu();
        this.tutorialView.open();
    }

    private showProfile(): void {
        if (this.isProgressLoading) return;
        this.hideLevelSelect();
        this.hideLeaderboard();
        this.shopView.hide();
        this.tutorialView.hide();
        this.hideMainMenu();
        this.body.classList.add('match-app--account');
        this.isProfileVisible = true;
        this.profileState.enter(this.buildAccountProfile());
    }

    private buildShopState(): ShopState {
        const coins = isDebugMode() ? 9999 : Math.max(0, Math.floor(this.progress.sugarCoins));
        return {
            coins,
            powerups: this.getDisplayedPowerups()
        };
    }

    private updateShopState(): void {
        this.shopView.update(this.buildShopState());
    }

    private returnToMenu(): void {
        this.hideLeaderboard();
        this.game.stop();
        this.showMainMenu();
        this.startLevelButton.focus();
    }

    private handleExitGame(): void {
        const mode: GameMode | null = this.game.getCurrentMode();
        if (mode === 'level') {
            this.returnToLevelSelect();
            return;
        }
        this.returnToMenu();
    }

    private returnToLevelSelect(): void {
        this.body.classList.remove('match-app--playing');
        this.body.classList.remove('match-app--menu');
        this.hideLeaderboard();
        this.hideMainMenu();
        this.game.stop();
        this.showLevelSelect();
    }

    private handleLocaleChange(locale: Locale): void {
        this.updateStartButtonState();
        this.googleAuth.applyLocale();
        this.game.handleLocaleChange(locale);
        this.updateGoogleLoginTooltip(locale);
        this.profileState.applyLocale();
        this.levelSelectView.applyLocale();
        this.refreshProfileView();
    }

    private showMainMenu(): void {
        this.shopView.hide();
        this.tutorialView.hide();
        this.hideLevelSelect();
        this.hideLeaderboard();
        this.hideProfile();
        this.body.classList.add('match-app--menu');
        this.mainMenu.removeAttribute('hidden');
        this.game.closeOptions();
        this.updateStartButtonState();
    }

    private hideMainMenu(): void {
        this.body.classList.remove('match-app--menu');
        this.mainMenu.setAttribute('hidden', 'true');
    }

    private showLevelSelect(): void {
        if (this.isProgressLoading) return;
        this.hideLeaderboard();
        this.shopView.hide();
        this.hideProfile();
        this.hideMainMenu();
        this.levelSelectView.open(this.progress.highestLevel);
    }

    private hideLevelSelect(): void {
        this.levelSelectView.hide();
    }

    private hideLeaderboard(): void {
        this.body.classList.remove('match-app--leaderboard');
        this.leaderboard.setAttribute('hidden', 'true');
    }

    private hideProfile(): void {
        if (!this.isProfileVisible) {
            return;
        }
        this.isProfileVisible = false;
        this.profileState.exit();
        this.body.classList.remove('match-app--account');
    }

    private handleAccountExit(): void {
        this.hideProfile();
        this.showMainMenu();
    }
    private refreshProfileView(): void {
        this.profileState.update(this.buildAccountProfile());
    }

    private async handleProfileNameSave(rawName: string): Promise<void> {
        if (this.isProfileNameSaving) return;
        const normalized = this.normalizeProfileName(rawName);
        if (normalized === '') {
            this.profileState.setFeedback(t('account.name.error.empty'), 'error');
            return;
        }
        this.profileState.clearFeedback();
        this.profileState.setNameSaving(true);
        this.isProfileNameSaving = true;
        try {
            if (this.currentUser) {
                await this.persistGoogleDisplayName(normalized);
                this.currentUser.name = normalized;
            } else {
                this.guestProfileStore.save({ name: normalized });
            }
            this.refreshProfileView();
            this.profileState.setFeedback(t('account.name.saved'), 'success');
        } catch (error) {
            console.error('Failed to update profile name', error);
            this.profileState.setFeedback(t('account.name.error.generic'), 'error');
        } finally {
            this.isProfileNameSaving = false;
            this.profileState.setNameSaving(false);
        }
    }

    private async persistGoogleDisplayName(name: string): Promise<void> {
        if (!this.currentUser) {
            throw new Error('No logged in user.');
        }
        const identity = this.getIdentity();
        const identityWithName =
            identity !== null
                ? { ...identity, name }
                : {
                      id: this.currentUser.id,
                      name
                  };
        const updatedProgress = await this.progressStore.save(
            this.currentUser.id,
            this.progress,
            'both',
            identityWithName
        );
        this.progress = updatedProgress;
        this.game.setPowerupInventory(this.progress.powerups);
        this.updateShopState();
    }

    private normalizeProfileName(rawName: string): string {
        const trimmed = rawName.trim();
        if (trimmed.length <= 128) {
            return trimmed;
        }
        return trimmed.substring(0, 128);
    }

    private buildAccountProfile(): AccountProfileData {
        if (this.currentUser) {
            const name = this.currentUser.name.trim();
            return {
                source: 'google',
                name: name || t('account.guestDefaultName')
            };
        }
        const guest = this.guestProfileStore.load();
        const guestName = guest.name.trim();
        const defaultNames = ['Guest', 'Gast'];
        const displayName =
            guestName && !defaultNames.includes(guestName) ? guestName : t('account.guestDefaultName');
        return {
            source: 'guest',
            name: displayName
        };
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
        this.googleAuth.setLoggedOut();
        this.updateStartButtonState();
        this.refreshPowerupsAndShop();
    }

    private applyOptions(options: GameOptions): void {
        const normalized = normalizeGameOptions(options);
        const audioEnabled = this.game.setAudioEnabled(normalized.audioEnabled);
        this.game.setPerformanceMode(normalized.performanceModeEnabled);
        this.game.setRecordingEnabled(normalized.recordingEnabled);
        this.game.setCellShapeMode(normalized.cellShapeMode);
        this.options = normalizeGameOptions({
            ...normalized,
            audioEnabled
        });
    }

    private handleOptionsChange(change: Partial<GameOptions>): void {
        const next = normalizeGameOptions({ ...this.options, ...change });
        if (this.areOptionsEqual(this.options, next)) {
            return;
        }
        this.options = next;
        if (this.currentUser) {
            void this.persistOptions(this.currentUser.id, next);
            return;
        }
        this.localOptionsStore.save(next);
    }

    private areOptionsEqual(left: GameOptions, right: GameOptions): boolean {
        return (
            left.locale === right.locale &&
            left.cellShapeMode === right.cellShapeMode &&
            left.audioEnabled === right.audioEnabled &&
            left.performanceModeEnabled === right.performanceModeEnabled &&
            left.recordingEnabled === right.recordingEnabled
        );
    }

    private async loadOptions(userId: string): Promise<void> {
        try {
            const result = await this.optionsStore.load(userId, this.options);
            if (!this.isCurrentUser(userId)) {
                return;
            }
            this.options = result.options;
            this.applyOptions(this.options);
            setLocale(this.options.locale);
            if (!result.hasRemote) {
                void this.persistOptions(userId, this.options);
            }
        } catch (error) {
            console.error('Failed to load options', error);
        }
    }

    private async persistOptions(userId: string, options: GameOptions): Promise<void> {
        try {
            const stored = await this.optionsStore.save(userId, options);
            if (!this.isCurrentUser(userId)) {
                return;
            }
            this.options = stored;
        } catch (error) {
            console.error('Failed to save options', error);
        }
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

    private getShopButton(): HTMLButtonElement {
        const element = getRequiredElement('open-shop');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Shop button is not a button');
        }
        return element;
    }

    private getTutorialButton(): HTMLButtonElement {
        const element = getRequiredElement('open-tutorial');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Tutorial button is not a button');
        }
        return element;
    }

    private getProfileButton(): HTMLButtonElement {
        const element = getRequiredElement('open-account');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Account button is not a button');
        }
        return element;
    }

    private getGoogleLoginInfoButton(): HTMLButtonElement {
        const element = getRequiredElement('google-login-info');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Google login info button is not a button');
        }
        return element;
    }

    private getGoogleLoginTooltip(): HTMLElement {
        return getRequiredElement('auth-info-tooltip');
    }

    private getGoogleLoginTooltipPrefix(): HTMLElement {
        return getRequiredElement('auth-info-tooltip-prefix');
    }

    private getGoogleLoginTooltipLink(): HTMLAnchorElement {
        const element = getRequiredElement('auth-info-tooltip-link');
        if (!(element instanceof HTMLAnchorElement)) {
            throw new Error('Google login tooltip link is not an anchor');
        }
        return element;
    }

    private getGoogleLoginTooltipSuffix(): HTMLElement {
        return getRequiredElement('auth-info-tooltip-suffix');
    }

    private getGoogleLoginInfoWrapper(): HTMLElement {
        return getRequiredElement('google-login-info-wrapper');
    }

    private handleLogin(user: GoogleUser): void {
        const localProgress = this.progress;
        this.isProgressLoading = true;
        this.currentUser = user;
        this.refreshProfileView();
        this.game.setLogoutEnabled(true);
        this.googleAuth.clearError();
        this.getGoogleLoginInfoWrapper().hidden = true;
        this.updateStartButtonState();
        void this.loadOptions(user.id);
        void this.loadProgress(user.id, localProgress);
    }

    private async loadProgress(userId: string, localProgress: StoredProgress): Promise<void> {
        try {
            const stored = await this.progressStore.load(userId, localProgress);
            if (!this.isCurrentUser(userId)) return;
            const mergedProgress = this.mergeProgress(localProgress, stored);
            this.progress = mergedProgress;
            this.googleAuth.clearError();
            this.refreshPowerupsAndShop();
            if (this.shouldPersistMergedProgress(stored, mergedProgress)) {
                void this.persistProgress(userId, mergedProgress, 'both');
            }
        } catch (error) {
            console.error('Failed to load progress', error);
            if (this.isCurrentUser(userId)) {
                this.progress = localProgress;
                this.googleAuth.showError(t('auth.error.progressLoad'));
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
            sugarCoins: this.progress.sugarCoins,
            powerups: this.progress.powerups
        });
        this.updateStartButtonState();
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'level');
    }

    private saveBlockerHighScore(score: number): void {
        if (score <= this.progress.blockerHighScore) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            blockerHighScore: score,
            timeSurvival: this.progress.timeSurvival,
            sugarCoins: this.progress.sugarCoins,
            powerups: this.progress.powerups
        });
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'both');
    }

    private saveTimeBest(time: number): void {
        if (time <= this.progress.timeSurvival) return;
        this.progress = this.mergeProgress(this.progress, {
            highestLevel: this.progress.highestLevel,
            blockerHighScore: this.progress.blockerHighScore,
            timeSurvival: time,
            sugarCoins: this.progress.sugarCoins,
            powerups: this.progress.powerups
        });
        this.progress = this.localProgress.save(this.progress);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'time');
    }

    private recordLevelAttempt(level: number): void {
        this.localAttemptStore.record('level', level);
    }

    private recordBlockerAttempt(score: number): void {
        this.localAttemptStore.record('blocker', score);
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'blocker', score);
    }

    private recordTimeAttempt(time: number): void {
        this.localAttemptStore.record('time', time);
    }

    private async persistProgress(
        userId: string,
        progress: StoredProgress,
        mode: LeaderboardMode | 'both',
        attemptScore?: number
    ): Promise<void> {
        try {
            const stored = await this.progressStore.save(
                userId,
                progress,
                mode,
                this.getIdentity(),
                attemptScore
            );
            if (!this.isCurrentUser(userId)) return;
            this.progress = this.mergeProgress(this.progress, stored);
            this.googleAuth.clearError();
            this.refreshPowerupsAndShop();
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
        const isLoading = this.isProgressLoading;
        this.startLevelButton.disabled = isLoading;
        this.startBlockerButton.disabled = isLoading;
        this.startTimeButton.disabled = isLoading;
        this.startLeaderboardButton.disabled = isLoading;
        this.shopButton.disabled = isLoading;
        this.startLevelButton.textContent = t('button.levelMode');
        this.startBlockerButton.textContent = t('button.blockerMode');
        this.startTimeButton.textContent = t('button.timeMode');
        this.levelSelectView.update(this.progress.highestLevel);
    }

    private setupGoogleLoginTooltip(): void {
        this.googleLoginInfoButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleGoogleLoginTooltip();
        });
        this.googleLoginTooltip.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        document.addEventListener('click', () => this.hideGoogleLoginTooltip());
    }

    private toggleGoogleLoginTooltip(): void {
        if (this.googleLoginTooltip.hasAttribute('hidden')) {
            this.showGoogleLoginTooltip();
            return;
        }
        this.hideGoogleLoginTooltip();
    }

    private showGoogleLoginTooltip(): void {
        this.googleLoginTooltip.removeAttribute('hidden');
        this.googleLoginInfoButton.setAttribute('aria-expanded', 'true');
    }

    private hideGoogleLoginTooltip(): void {
        if (this.googleLoginTooltip.hasAttribute('hidden')) {
            return;
        }
        this.googleLoginTooltip.setAttribute('hidden', 'true');
        this.googleLoginInfoButton.setAttribute('aria-expanded', 'false');
    }

    private updateGoogleLoginTooltip(locale: Locale): void {
        const prefix = t('auth.googleInfo.prefix');
        const linkText = t('auth.googleInfo.link');
        const suffix = t('auth.googleInfo.suffix');
        const href = locale === 'de' ? '/html/de/privacy-policy.html' : '/html/en/privacy-policy.html';
        this.googleLoginTooltipPrefix.textContent = prefix + ' ';
        this.googleLoginTooltipLink.textContent = linkText;
        this.googleLoginTooltipLink.href = href;
        this.googleLoginTooltipSuffix.textContent = suffix;
    }

    private mergeProgress(current: StoredProgress, incoming: StoredProgress): StoredProgress {
        return {
            highestLevel: Math.max(current.highestLevel, incoming.highestLevel),
            blockerHighScore: Math.max(current.blockerHighScore, incoming.blockerHighScore),
            timeSurvival: Math.max(current.timeSurvival, incoming.timeSurvival),
            sugarCoins: Math.max(current.sugarCoins, incoming.sugarCoins),
            powerups: this.mergePowerups(current.powerups, incoming.powerups)
        };
    }

    private mergePowerups(current: PowerupInventory, incoming: PowerupInventory): PowerupInventory {
        const merged = {} as PowerupInventory;
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const currentValue = current[type] ?? 0;
            const incomingValue = incoming[type] ?? 0;
            merged[type] = Math.max(currentValue, incomingValue);
        });
        return merged;
    }

    private shouldPersistMergedProgress(stored: StoredProgress, merged: StoredProgress): boolean {
        return (
            merged.highestLevel > stored.highestLevel ||
            merged.blockerHighScore > stored.blockerHighScore ||
            merged.timeSurvival > stored.timeSurvival ||
            merged.sugarCoins > stored.sugarCoins
            || this.hasMorePowerups(stored, merged)
        );
    }

    private hasMorePowerups(stored: StoredProgress, merged: StoredProgress): boolean {
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        return powerupTypes.some((type) => (merged.powerups[type] ?? 0) > (stored.powerups[type] ?? 0));
    }

    private async handleDeleteProgress(): Promise<void> {
        const confirmed = await this.confirmDialog.show({
            title: t('options.deleteProgress'),
            message: t('options.deleteProgress.confirm'),
            confirmText: t('options.deleteProgress.confirmButton'),
            cancelText: t('options.deleteProgress.cancelButton')
        });
        if (!confirmed) {
            return;
        }
        this.game.closeOptions();
        this.localProgress.clear();
        this.localAttemptStore.clear();
        this.progress = this.localProgress.load();
        this.updateShopState();
        this.game.setPowerupInventory(this.progress.powerups);
        this.updateStartButtonState();
        if (!this.currentUser) {
            return;
        }
        try {
            await this.progressStore.delete(this.currentUser.id);
            this.googleAuth.clearError();
        } catch (error) {
            console.error('Failed to delete progress', error);
            this.googleAuth.showError(t('auth.error.progressDelete'));
        }
    }

    private async handleDeleteAccount(): Promise<void> {
        if (!this.currentUser) {
            return;
        }
        const confirmed = await this.confirmDialog.show({
            title: t('account.deleteAccount'),
            message: t('account.deleteAccount.confirm'),
            confirmText: t('account.deleteAccount.confirmButton'),
            cancelText: t('options.deleteProgress.cancelButton')
        });
        if (!confirmed) {
            return;
        }
        try {
            await this.progressStore.deleteAccount(this.currentUser.id);
            this.googleAuth.clearError();
        } catch (error) {
            console.error('Failed to delete account', error);
            this.googleAuth.showError(t('auth.error.accountDelete'));
            return;
        }
        this.localProgress.clear();
        this.localAttemptStore.clear();
        this.progress = this.localProgress.load();
        this.handleLogout();
        this.handleAccountExit();
    }

    private handleLogout(): void {
        if (!this.currentUser) {
            return;
        }
        this.game.closeOptions();
        this.progress = this.localProgress.save(this.progress);
        this.options = this.localOptionsStore.save(this.options);
        this.currentUser = null;
        this.googleAuth.signOut();
        this.googleAuth.setLoggedOut();
        this.getGoogleLoginInfoWrapper().hidden = false;
        this.game.setLogoutEnabled(false);
        this.isProgressLoading = false;
        this.refreshPowerupsAndShop();
        this.updateStartButtonState();
        this.refreshProfileView();
    }

    private handleShopPurchase(type: TacticalPowerup): void {
        const owned = Math.max(0, this.progress.powerups[type] ?? 0);
        if (owned >= MAX_TACTICAL_POWERUP_STOCK) {
            this.shopView.showFeedback(t('shop.feedback.maxed'));
            return;
        }
        const price = getNextPowerupPrice(owned);
        if (price === null) return;
        if (this.progress.sugarCoins < price) {
            this.shopView.showFeedback(t('shop.feedback.insufficient'));
            return;
        }
        const nextCoins = this.progress.sugarCoins - price;
        const updatedPowerups = { ...this.progress.powerups, [type]: owned + 1 };
        this.progress = this.localProgress.save({
            ...this.progress,
            sugarCoins: nextCoins,
            powerups: updatedPowerups
        });
        this.refreshPowerupsAndShop();
        if (this.currentUser) {
            void this.persistProgress(this.currentUser.id, this.progress, 'both');
        }
    }

    private handlePowerupInventoryChange(inventory: PowerupInventory): void {
        if (isDebugMode()) {
            this.refreshPowerupsAndShop();
            return;
        }
        this.progress = this.localProgress.save({
            ...this.progress,
            powerups: inventory
        });
        this.refreshPowerupsAndShop();
        if (this.currentUser) {
            void this.persistProgress(this.currentUser.id, this.progress, 'both');
        }
    }

    grantSugarCoins(amount: number): void {
        const rounded = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
        if (rounded === 0) return;
        const nextCoins = Math.max(0, this.progress.sugarCoins + rounded);
        this.progress = this.localProgress.save({ ...this.progress, sugarCoins: nextCoins });
        this.refreshPowerupsAndShop();
        if (!this.currentUser) return;
        void this.persistProgress(this.currentUser.id, this.progress, 'both');
    }

    private getDisplayedPowerups(): PowerupInventory {
        if (isDebugMode()) {
            return createMaxPowerupInventory();
        }
        return this.progress.powerups;
    }

    private refreshPowerupsAndShop(): void {
        this.game.setPowerupInventory(this.getDisplayedPowerups());
        this.updateShopState();
    }
}

new GameApp();

if ('serviceWorker' in navigator && !isLocalDebugHost()) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker
            .register('/service-worker.js', { scope: '/' })
            .catch((error) => {
                console.error('Service worker registration failed', error);
            });
    });
}

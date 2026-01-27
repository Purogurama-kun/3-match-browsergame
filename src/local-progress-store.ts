import {
    TACTICAL_POWERUPS,
    TacticalPowerup,
    createFreshPowerupInventory,
    getMaxPowerupStock
} from './constants.js';
import type { StoredProgress } from './progress-store.js';
import type { PowerupInventory } from './types.js';

class LocalProgressStore {
    private readonly progressKey = 'match3-progress';
    private readonly maxLevel = 50;
    private readonly maxBlockerScore = 1000000000;
    private readonly maxTimeSeconds = 86400;
    private readonly defaultProgress: StoredProgress = {
        highestLevel: 1,
        blockerHighScore: 0,
        timeSurvival: 0,
        sugarCoins: 0,
        powerups: createFreshPowerupInventory(),
        extraPowerupSlotUnlocked: false,
        completedLevels: []
    };

    load(): StoredProgress {
        const stored = this.readStoredProgress();
        return this.normalizeProgress(stored);
    }

    save(progress: StoredProgress): StoredProgress {
        const normalized = this.normalizeProgress(progress);
        this.writeStoredProgress(normalized);
        return normalized;
    }

    clear(): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.removeItem(this.progressKey);
        } catch (error) {
            console.warn('Could not clear local progress', error);
        }
    }

    private readStoredProgress(): Partial<StoredProgress> {
        const storage = this.getStorage();
        if (!storage) return this.defaultProgress;

        const raw = storage.getItem(this.progressKey);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as Partial<StoredProgress>;
                return parsed;
            } catch (error) {
                console.warn('Failed to parse stored progress', error);
            }
        }

        return this.defaultProgress;
    }

    private writeStoredProgress(progress: StoredProgress): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.setItem(this.progressKey, JSON.stringify(progress));
        } catch (error) {
            console.warn('Could not persist local progress', error);
        }
    }

    private getStorage(): Storage | null {
        try {
            return window.localStorage;
        } catch (error) {
            console.warn('Local storage unavailable', error);
            return null;
        }
    }

    private normalizeProgress(progress?: Partial<StoredProgress>): StoredProgress {
        const highestLevel = this.normalizeLevel(progress?.highestLevel);
        const blockerHighScore = this.normalizeScore(progress?.blockerHighScore);
        const timeSurvival = this.normalizeTime(progress?.timeSurvival);
        const sugarCoins = this.normalizeCoins(progress?.sugarCoins);
        const extraPowerupSlotUnlocked = this.normalizeExtraPowerupSlot(progress?.extraPowerupSlotUnlocked);
        const powerups = this.normalizePowerups(progress?.powerups, extraPowerupSlotUnlocked);
        const completedLevels = this.ensureCompletedLevels(
            this.normalizeCompletedLevels(progress?.completedLevels),
            highestLevel
        );
        return {
            highestLevel,
            blockerHighScore,
            timeSurvival,
            sugarCoins,
            powerups,
            extraPowerupSlotUnlocked,
            completedLevels
        };
    }

    private normalizeLevel(level: unknown): number {
        if (typeof level !== 'number' || !Number.isFinite(level)) return this.defaultProgress.highestLevel;
        const normalized = Math.floor(level);
        return Math.max(1, Math.min(normalized, this.maxLevel));
    }

    private normalizeScore(score: unknown): number {
        if (typeof score !== 'number' || !Number.isFinite(score)) return this.defaultProgress.blockerHighScore;
        const normalized = Math.floor(score);
        return Math.max(0, Math.min(normalized, this.maxBlockerScore));
    }

    private normalizeTime(time: unknown): number {
        if (typeof time !== 'number' || !Number.isFinite(time)) return this.defaultProgress.timeSurvival;
        const normalized = Math.floor(time);
        return Math.max(0, Math.min(normalized, this.maxTimeSeconds));
    }

    private normalizeCoins(amount: unknown): number {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) return this.defaultProgress.sugarCoins;
        const normalized = Math.floor(amount);
        return Math.max(0, normalized);
    }

    private normalizePowerups(
        powerups: Partial<Record<TacticalPowerup, number>> | undefined,
        extraPowerupSlotUnlocked: boolean
    ): PowerupInventory {
        const maxStock = getMaxPowerupStock(extraPowerupSlotUnlocked);
        const inventory = createFreshPowerupInventory();
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            inventory[type] = this.clampPowerup(powerups?.[type], maxStock);
        });
        return inventory;
    }

    private clampPowerup(value: unknown, maxStock: number): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const normalized = Math.floor(value);
        return Math.max(0, Math.min(maxStock, normalized));
    }

    private normalizeExtraPowerupSlot(value: unknown): boolean {
        return typeof value === 'boolean' ? value : false;
    }

    private normalizeCompletedLevels(levels: unknown): number[] {
        if (!Array.isArray(levels)) return [];
        const unique = new Set<number>();
        levels.forEach((value) => {
            if (typeof value !== 'number' || !Number.isFinite(value)) return;
            const normalized = Math.floor(value);
            if (normalized < 1 || normalized > this.maxLevel) return;
            unique.add(normalized);
        });
        return Array.from(unique).sort((a, b) => a - b);
    }

    private ensureCompletedLevels(levels: number[], highestLevel: number): number[] {
        const merged = new Set<number>(levels);
        for (let level = 1; level < highestLevel; level++) {
            merged.add(level);
        }
        return Array.from(merged).sort((a, b) => a - b);
    }
}

export { LocalProgressStore };

import type { StoredProgress } from './progress-store.js';

class LocalProgressStore {
    private readonly progressKey = 'match3-progress';
    private readonly legacyLevelKey = 'match3-highest-level';
    private readonly maxLevel = 50;
    private readonly maxEndlessScore = 1000000000;
    private readonly defaultProgress: StoredProgress = {
        highestLevel: 1,
        endlessHighScore: 0
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

        const legacyLevel = storage.getItem(this.legacyLevelKey);
        const parsedLevel = legacyLevel ? Number.parseInt(legacyLevel, 10) : null;
        if (parsedLevel !== null && Number.isFinite(parsedLevel)) {
            return { highestLevel: parsedLevel };
        }

        return this.defaultProgress;
    }

    private writeStoredProgress(progress: StoredProgress): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.setItem(this.progressKey, JSON.stringify(progress));
            storage.setItem(this.legacyLevelKey, String(progress.highestLevel));
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
        const endlessHighScore = this.normalizeScore(progress?.endlessHighScore);
        return {
            highestLevel,
            endlessHighScore
        };
    }

    private normalizeLevel(level: unknown): number {
        if (typeof level !== 'number' || !Number.isFinite(level)) return this.defaultProgress.highestLevel;
        const normalized = Math.floor(level);
        return Math.max(1, Math.min(normalized, this.maxLevel));
    }

    private normalizeScore(score: unknown): number {
        if (typeof score !== 'number' || !Number.isFinite(score)) return this.defaultProgress.endlessHighScore;
        const normalized = Math.floor(score);
        return Math.max(0, Math.min(normalized, this.maxEndlessScore));
    }
}

export { LocalProgressStore };

import type { StoredProgress } from './progress-store.js';

class LocalProgressStore {
    private readonly storageKey = 'match3-highest-level';
    private readonly maxLevel = 50;

    load(): StoredProgress {
        const storedLevel = this.readStoredLevel();
        return { highestLevel: this.normalizeLevel(storedLevel) };
    }

    save(highestLevel: number): StoredProgress {
        const normalizedLevel = this.normalizeLevel(highestLevel);
        this.writeStoredLevel(normalizedLevel);
        return { highestLevel: normalizedLevel };
    }

    private readStoredLevel(): number {
        const storage = this.getStorage();
        if (!storage) return 1;

        const value = storage.getItem(this.storageKey);
        const parsed = value ? Number.parseInt(value, 10) : 1;
        return Number.isFinite(parsed) ? parsed : 1;
    }

    private writeStoredLevel(level: number): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.setItem(this.storageKey, String(level));
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

    private normalizeLevel(level: unknown): number {
        if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
        const normalized = Math.floor(level);
        return Math.max(1, Math.min(normalized, this.maxLevel));
    }
}

export { LocalProgressStore };

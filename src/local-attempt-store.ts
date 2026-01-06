import type { LeaderboardMode } from './types.js';

type Attempt = {
    value: number;
    completedAt: string;
};

type AttemptHistory = {
    level: Attempt[];
    blocker: Attempt[];
    time: Attempt[];
};

const MAX_ATTEMPTS = 10;
const MAX_LEVEL = 50;
const MAX_SCORE = 1000000000;
const MAX_TIME = 86400;

class LocalAttemptStore {
    private readonly storageKey = 'match3-attempts';
    private readonly defaultHistory: AttemptHistory = {
        level: [],
        blocker: [],
        time: []
    };

    load(mode: LeaderboardMode): Attempt[] {
        const history = this.readHistory();
        return history[mode];
    }

    record(mode: LeaderboardMode, value: number): Attempt[] {
        const history = this.readHistory();
        const normalized = this.normalizeValue(value, mode);
        if (normalized <= 0 && mode !== 'level') return history[mode];
        if (mode === 'level' && normalized <= 1) return history[mode];

        const attempt: Attempt = {
            value: normalized,
            completedAt: new Date().toISOString()
        };

        const attempts = [...history[mode], attempt];
        attempts.sort((a, b) => b.value - a.value);
        const trimmed = attempts.slice(0, MAX_ATTEMPTS);

        history[mode] = trimmed;
        this.writeHistory(history);

        return trimmed;
    }

    clear(): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Could not clear attempt history', error);
        }
    }

    private readHistory(): AttemptHistory {
        const storage = this.getStorage();
        if (!storage) return { ...this.defaultHistory };

        const raw = storage.getItem(this.storageKey);
        if (!raw) return { ...this.defaultHistory };

        try {
            const parsed = JSON.parse(raw) as Partial<AttemptHistory>;
            return {
                level: this.normalizeAttempts(parsed.level, 'level'),
                blocker: this.normalizeAttempts(parsed.blocker, 'blocker'),
                time: this.normalizeAttempts(parsed.time, 'time')
            };
        } catch (error) {
            console.warn('Failed to parse attempt history', error);
            return { ...this.defaultHistory };
        }
    }

    private writeHistory(history: AttemptHistory): void {
        const storage = this.getStorage();
        if (!storage) return;

        try {
            storage.setItem(this.storageKey, JSON.stringify(history));
        } catch (error) {
            console.warn('Could not persist attempt history', error);
        }
    }

    private normalizeAttempts(attempts: unknown, mode: LeaderboardMode): Attempt[] {
        if (!Array.isArray(attempts)) return [];

        const valid: Attempt[] = [];
        for (const item of attempts) {
            if (!this.isValidAttempt(item)) continue;
            const normalized = this.normalizeValue(item.value, mode);
            if (normalized <= 0 && mode !== 'level') continue;
            if (mode === 'level' && normalized <= 1) continue;
            valid.push({
                value: normalized,
                completedAt: this.normalizeDate(item.completedAt)
            });
        }

        valid.sort((a, b) => b.value - a.value);
        return valid.slice(0, MAX_ATTEMPTS);
    }

    private isValidAttempt(item: unknown): item is { value: number; completedAt: string } {
        if (typeof item !== 'object' || item === null) return false;
        const record = item as Record<string, unknown>;
        return typeof record.value === 'number' && typeof record.completedAt === 'string';
    }

    private normalizeValue(value: number, mode: LeaderboardMode): number {
        if (!Number.isFinite(value)) return 0;
        const floored = Math.floor(value);
        if (mode === 'level') {
            return Math.max(1, Math.min(MAX_LEVEL, floored));
        }
        if (mode === 'time') {
            return Math.max(0, Math.min(MAX_TIME, floored));
        }
        return Math.max(0, Math.min(MAX_SCORE, floored));
    }

    private normalizeDate(value: unknown): string {
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
        return new Date().toISOString();
    }

    private getStorage(): Storage | null {
        try {
            return window.localStorage;
        } catch (error) {
            console.warn('Local storage unavailable', error);
            return null;
        }
    }
}

export { LocalAttemptStore };
export type { Attempt, AttemptHistory };

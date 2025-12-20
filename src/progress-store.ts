type StoredProgress = {
    highestLevel: number;
};

class ProgressStore {
    private readonly storageKey = 'explosive-candy-progress';

    load(userId: string): StoredProgress {
        const store = this.readStore();
        const entry = store[userId];
        if (!entry) {
            return { highestLevel: 1 };
        }
        return {
            highestLevel: Math.max(1, Math.min(entry.highestLevel || 1, 50))
        };
    }

    save(userId: string, highestLevel: number): void {
        const normalized = Math.max(1, Math.min(Math.floor(highestLevel), 50));
        const store = this.readStore();
        const previous = store[userId]?.highestLevel ?? 1;
        store[userId] = { highestLevel: Math.max(previous, normalized) };
        localStorage.setItem(this.storageKey, JSON.stringify(store));
    }

    private readStore(): Record<string, StoredProgress> {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, StoredProgress>;
            return parsed || {};
        } catch (error) {
            console.warn('Failed to read progress store', error);
            return {};
        }
    }
}

export { ProgressStore };
export type { StoredProgress };

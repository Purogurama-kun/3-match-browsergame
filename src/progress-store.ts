type StoredProgress = {
    highestLevel: number;
};

type ProgressResponse = {
    highestLevel?: number;
};

class ProgressStore {
    private readonly endpoint = '/backend/progress.php';
    private readonly maxLevel = 50;

    async load(userId: string, localHighestLevel?: number): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalizedLocalLevel = this.normalizeLevel(localHighestLevel);
        const query = new URLSearchParams({
            userId: normalizedUserId,
            localLevel: String(normalizedLocalLevel)
        });
        const url = this.endpoint + '?' + query.toString();

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load progress: ' + response.status);
        }

        const payload = (await response.json()) as ProgressResponse;
        return { highestLevel: this.normalizeLevel(payload.highestLevel) };
    }

    async save(userId: string, highestLevel: number): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalizedLevel = this.normalizeLevel(highestLevel);

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: normalizedUserId,
                highestLevel: normalizedLevel
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save progress: ' + response.status);
        }

        const payload = (await response.json()) as ProgressResponse;
        return { highestLevel: this.normalizeLevel(payload.highestLevel) };
    }

    private requireUserId(userId: string): string {
        const trimmed = userId.trim();
        if (!trimmed) {
            throw new Error('User ID is required for progress operations.');
        }
        if (trimmed.length > 128) {
            throw new Error('User ID is too long.');
        }
        return trimmed;
    }

    private normalizeLevel(level: unknown): number {
        if (typeof level !== 'number' || !Number.isFinite(level)) {
            return 1;
        }
        const normalized = Math.floor(level);
        return Math.max(1, Math.min(normalized, this.maxLevel));
    }
}

export { ProgressStore };
export type { StoredProgress };

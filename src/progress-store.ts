type ProgressData = {
    blockerHighScore: number;
};

type StoredProgress = {
    highestLevel: number;
    blockerHighScore: number;
};

type ProgressResponse = {
    highestLevel?: number;
    data?: Partial<ProgressData>;
};

class ProgressStore {
    private readonly endpoint = '/backend/progress.php';
    private readonly maxLevel = 50;
    private readonly maxBlockerScore = 1000000000;

    async load(userId: string, localProgress?: StoredProgress): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalizedLocalLevel = this.normalizeLevel(localProgress?.highestLevel);
        const url = this.endpoint + '?' + new URLSearchParams({
            userId: normalizedUserId,
            localLevel: String(normalizedLocalLevel)
        }).toString();

        const response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load progress: ' + response.status);
        }

        const payload = (await response.json()) as ProgressResponse;
        return this.normalizeProgress(payload, localProgress);
    }

    async save(userId: string, progress: StoredProgress): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalized = this.normalizeProgress(
            { highestLevel: progress.highestLevel, data: { blockerHighScore: progress.blockerHighScore } },
            progress
        );

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: normalizedUserId,
                highestLevel: normalized.highestLevel,
                data: { blockerHighScore: normalized.blockerHighScore }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save progress: ' + response.status);
        }

        const payload = (await response.json()) as ProgressResponse;
        return this.normalizeProgress(payload, normalized);
    }

    private normalizeProgress(payload?: ProgressResponse, fallback?: StoredProgress): StoredProgress {
        const highestLevel = this.normalizeLevel(payload?.highestLevel ?? fallback?.highestLevel);
        const blockerHighScore = this.normalizeScore(
            payload?.data?.blockerHighScore ?? fallback?.blockerHighScore
        );
        return { highestLevel, blockerHighScore };
    }

    private normalizeScore(score: unknown): number {
        if (typeof score !== 'number' || !Number.isFinite(score)) return 0;
        const normalized = Math.floor(score);
        return Math.max(0, Math.min(normalized, this.maxBlockerScore));
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
export type { StoredProgress, ProgressData };

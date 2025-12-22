import type { LeaderboardIdentity, LeaderboardMode } from './types.js';

type ProgressData = {
    blockerHighScore: number;
    timeSurvival: number;
};

type StoredProgress = {
    highestLevel: number;
    blockerHighScore: number;
    timeSurvival: number;
};

type ProgressResponse = {
    highestLevel?: unknown;
    blockerHighScore?: unknown;
    bestScore?: unknown;
    data?: Partial<ProgressData> | null;
    timeSurvival?: unknown;
};

type HistoryResponse = {
    entries?: unknown;
};

type HistoryRow = {
    highestLevel?: unknown;
    score?: unknown;
};

class ProgressStore {
    private readonly endpoint = '/backend/progress.php';
    private readonly maxLevel = 50;
    private readonly maxBlockerScore = 1000000000;
    private readonly maxTimeSeconds = 86400;

    async load(userId: string, localProgress?: StoredProgress): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalizedLocal = this.normalizeProgress(localProgress);

        const [bestLevel, bestBlockerScore, bestTime] = await Promise.all([
            this.fetchBestFromHistory('level', normalizedUserId),
            this.fetchBestFromHistory('blocker', normalizedUserId),
            this.fetchBestFromHistory('time', normalizedUserId)
        ]);

        return {
            highestLevel: Math.max(normalizedLocal.highestLevel, bestLevel),
            blockerHighScore: Math.max(normalizedLocal.blockerHighScore, bestBlockerScore),
            timeSurvival: Math.max(normalizedLocal.timeSurvival, bestTime)
        };
    }

    async save(
        userId: string,
        progress: StoredProgress,
        mode: LeaderboardMode | 'both' = 'both',
        identity?: LeaderboardIdentity | null
    ): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalized = this.normalizeProgress(progress);
        const scorePayload =
            mode === 'time' ? normalized.timeSurvival : normalized.blockerHighScore;
        const payload = {
            userId: normalizedUserId,
            highestLevel: normalized.highestLevel,
            score: scorePayload,
            blockerHighScore: normalized.blockerHighScore,
            data: { blockerHighScore: normalized.blockerHighScore, timeSurvival: normalized.timeSurvival },
            completedAt: new Date().toISOString(),
            ...(identity
                ? {
                      displayName: identity.name,
                      nationality: identity.nationality ?? undefined
                  }
                : {}),
            ...(mode !== 'both' ? { mode: this.mapMode(mode) } : {})
        };

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to save progress: ' + response.status);
        }

        const serverPayload = (await response.json()) as ProgressResponse;
        return this.normalizeProgress(serverPayload, normalized);
    }

    private async fetchBestFromHistory(mode: LeaderboardMode, userId: string): Promise<number> {
        const response = await fetch(
            this.endpoint +
                '?' +
                new URLSearchParams({
                    action: 'history',
                    mode: this.mapMode(mode),
                    userId,
                    limit: '1',
                    offset: '0'
                }).toString(),
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load history: ' + response.status);
        }

        const payload = (await response.json()) as HistoryResponse;
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const [best] = entries as HistoryRow[];

        if (!best) {
            return mode === 'level' ? 1 : 0;
        }

        if (mode === 'level') {
            return this.normalizeLevel(best.highestLevel);
        }
        if (mode === 'time') {
            return this.normalizeTime(best.score);
        }
        return this.normalizeScore(best.score);
    }

    private normalizeProgress(payload?: ProgressResponse, fallback?: StoredProgress): StoredProgress {
        const highestLevel = this.normalizeLevel(
            payload?.highestLevel ?? fallback?.highestLevel
        );
        const blockerHighScore = this.normalizeScore(
            payload?.blockerHighScore ??
                payload?.bestScore ??
                payload?.data?.blockerHighScore ??
                fallback?.blockerHighScore
        );
        const timeSurvival = this.normalizeTime(
            payload?.timeSurvival ?? payload?.data?.timeSurvival ?? fallback?.timeSurvival
        );
        return { highestLevel, blockerHighScore, timeSurvival };
    }

    private normalizeScore(score: unknown): number {
        if (typeof score !== 'number' || !Number.isFinite(score)) return 0;
        const normalized = Math.floor(score);
        return Math.max(0, Math.min(normalized, this.maxBlockerScore));
    }

    private normalizeTime(time: unknown): number {
        if (typeof time !== 'number' || !Number.isFinite(time)) return 0;
        const normalized = Math.floor(time);
        return Math.max(0, Math.min(normalized, this.maxTimeSeconds));
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

    private mapMode(mode: LeaderboardMode): 'LevelMode' | 'BlockerMode' | 'TimeMode' {
        if (mode === 'level') return 'LevelMode';
        if (mode === 'time') return 'TimeMode';
        return 'BlockerMode';
    }
}

export { ProgressStore };
export type { StoredProgress, ProgressData };

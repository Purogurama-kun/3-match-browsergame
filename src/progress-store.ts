import {
    TACTICAL_POWERUPS,
    TacticalPowerup,
    createFreshPowerupInventory,
    MAX_TACTICAL_POWERUP_STOCK
} from './constants.js';
import type { LeaderboardIdentity, LeaderboardMode, PowerupInventory } from './types.js';

const POWERUP_TYPES = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];

type ProgressData = {
    blockerHighScore: number;
    timeSurvival: number;
    sugarCoins: number;
    powerups: PowerupInventory;
};

type StoredProgress = {
    highestLevel: number;
    blockerHighScore: number;
    timeSurvival: number;
    sugarCoins: number;
    powerups: PowerupInventory;
};

type ProgressResponse = {
    highestLevel?: unknown;
    blockerHighScore?: unknown;
    bestScore?: unknown;
    data?: Partial<ProgressData> | null;
    timeSurvival?: unknown;
    sugarCoins?: unknown;
};

class ProgressStore {
    private readonly endpoint = '/backend/progress.php';
    private readonly maxLevel = 50;
    private readonly maxBlockerScore = 1000000000;
    private readonly maxTimeSeconds = 86400;

    async load(userId: string, localProgress?: StoredProgress): Promise<StoredProgress> {
        const normalizedUserId = this.requireUserId(userId);
        const normalizedLocal = this.normalizeProgress(localProgress);

        const serverProgress = await this.fetchProgress(
            normalizedUserId,
            normalizedLocal.highestLevel,
            normalizedLocal.sugarCoins
        );
        return this.normalizeProgress(serverProgress, normalizedLocal);
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
        const payloadData = {
            blockerHighScore: normalized.blockerHighScore,
            timeSurvival: normalized.timeSurvival,
            sugarCoins: normalized.sugarCoins,
            powerups: normalized.powerups
        };
        const payload = {
            userId: normalizedUserId,
            highestLevel: normalized.highestLevel,
            score: scorePayload,
            blockerHighScore: normalized.blockerHighScore,
            data: payloadData,
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

    async delete(userId: string): Promise<void> {
        await this.sendDeleteRequest(userId, 'progress');
    }

    async deleteAccount(userId: string): Promise<void> {
        await this.sendDeleteRequest(userId, 'account');
    }

    private async sendDeleteRequest(userId: string, scope: 'progress' | 'account'): Promise<void> {
        const normalizedUserId = this.requireUserId(userId);
        const query = new URLSearchParams({ userId: normalizedUserId });
        if (scope === 'account') {
            query.set('scope', 'account');
        }
        const response = await fetch(`${this.endpoint}?${query.toString()}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            const message =
                scope === 'account'
                    ? 'Failed to delete account: '
                    : 'Failed to delete progress: ';
            throw new Error(`${message}${response.status}`);
        }
    }

    private async fetchProgress(userId: string, localLevel: number, localCoins: number): Promise<ProgressResponse> {
        const response = await fetch(
            this.endpoint +
                '?' +
                new URLSearchParams({
                    userId,
                    localLevel: String(localLevel),
                    localCoins: String(localCoins)
                }).toString(),
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load progress: ' + response.status);
        }

        return (await response.json()) as ProgressResponse;
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
        const sugarCoins = this.normalizeCoins(
            payload?.sugarCoins ?? payload?.data?.sugarCoins ?? fallback?.sugarCoins
        );
        const powerups = this.normalizePowerups(payload?.data?.powerups ?? null, fallback?.powerups);
        return { highestLevel, blockerHighScore, timeSurvival, sugarCoins, powerups };
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

    private normalizeCoins(amount: unknown): number {
        if (typeof amount !== 'number' || !Number.isFinite(amount)) return 0;
        const normalized = Math.floor(amount);
        return Math.max(0, normalized);
    }

    private normalizePowerups(
        powerups: PowerupInventory | null | undefined,
        fallback?: PowerupInventory
    ): PowerupInventory {
        const baseline = fallback ?? createFreshPowerupInventory();
        const inventory = createFreshPowerupInventory();
        POWERUP_TYPES.forEach((type) => {
            const fallbackValue = baseline[type] ?? 0;
            const candidate =
                powerups && typeof powerups[type] === 'number'
                    ? this.clampPowerup(powerups[type])
                    : fallbackValue;
            inventory[type] = Math.max(fallbackValue, candidate);
        });
        return inventory;
    }

    private clampPowerup(value: unknown): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const normalized = Math.floor(value);
        return Math.max(0, Math.min(MAX_TACTICAL_POWERUP_STOCK, normalized));
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

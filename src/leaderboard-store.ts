import type {
    LeaderboardEntry,
    LeaderboardIdentity,
    LeaderboardMode,
    LeaderboardScope
} from './types.js';

type LeaderboardResponse = {
    entries?: unknown;
};

type LeaderboardRow = {
    displayName?: unknown;
    completedAt?: unknown;
    nationality?: unknown;
    highestLevel?: unknown;
    score?: unknown;
    timeSurvival?: unknown;
};

type HistoryResponse = {
    entries?: unknown;
};

type HistoryRow = {
    highestLevel?: unknown;
    score?: unknown;
    completedAt?: unknown;
};

class LeaderboardStore {
    private readonly endpoint = '/backend/progress.php';
    private readonly defaultLimit = 20;
    private readonly maxTimeSeconds = 86400;

    async load(
        mode: LeaderboardMode,
        scope: LeaderboardScope,
        identity?: LeaderboardIdentity | null
    ): Promise<LeaderboardEntry[]> {
        if (scope === 'global') {
            return this.fetchGlobal(mode);
        }
        if (!identity) {
            return [];
        }
        return this.fetchPersonal(mode, identity);
    }

    private async fetchGlobal(mode: LeaderboardMode): Promise<LeaderboardEntry[]> {
        const response = await fetch(
            this.endpoint +
                '?' +
                new URLSearchParams({
                    action: 'leaderboard',
                    mode: this.mapMode(mode),
                    limit: String(this.defaultLimit),
                    offset: '0'
                }).toString(),
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load leaderboard: ' + response.status);
        }

        const payload = (await response.json()) as LeaderboardResponse;
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        return entries.map((row) => this.normalizeLeaderboardRow(row as LeaderboardRow, mode));
    }

    private async fetchPersonal(
        mode: LeaderboardMode,
        identity: LeaderboardIdentity
    ): Promise<LeaderboardEntry[]> {
        const response = await fetch(
            this.endpoint +
                '?' +
                new URLSearchParams({
                    action: 'history',
                    mode: this.mapMode(mode),
                    userId: identity.id,
                    limit: String(this.defaultLimit),
                    offset: '0'
                }).toString(),
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load personal results: ' + response.status);
        }

        const payload = (await response.json()) as HistoryResponse;
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        return entries.map((row) =>
            this.normalizeHistoryRow(row as HistoryRow, mode, identity)
        );
    }

    private normalizeLeaderboardRow(row: LeaderboardRow, mode: LeaderboardMode): LeaderboardEntry {
        const base: LeaderboardEntry = {
            playerName: typeof row.displayName === 'string' ? row.displayName : 'Unbekannt',
            nationality: this.normalizeNationality(row.nationality),
            completedAt: this.normalizeDate(row.completedAt)
        };
        if (mode === 'level') {
            return {
                ...base,
                level: this.normalizeLevel(row.highestLevel)
            };
        }
        if (mode === 'time') {
            return {
                ...base,
                timeSeconds: this.normalizeTime(row.score)
            };
        }
        return {
            ...base,
            score: this.normalizeScore(row.score)
        };
    }

    private normalizeHistoryRow(
        row: HistoryRow,
        mode: LeaderboardMode,
        identity: LeaderboardIdentity
    ): LeaderboardEntry {
        const base: LeaderboardEntry = {
            playerName: identity.name,
            nationality: identity.nationality ?? null,
            completedAt: this.normalizeDate(row.completedAt)
        };
        if (mode === 'level') {
            return {
                ...base,
                level: this.normalizeLevel(row.highestLevel)
            };
        }
        if (mode === 'time') {
            return {
                ...base,
                timeSeconds: this.normalizeTime(row.score)
            };
        }
        return {
            ...base,
            score: this.normalizeScore(row.score)
        };
    }

    private normalizeLevel(value: unknown): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
        const normalized = Math.floor(value);
        return Math.max(1, Math.min(50, normalized));
    }

    private normalizeScore(value: unknown): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const normalized = Math.floor(value);
        return Math.max(0, Math.min(1000000000, normalized));
    }

    private normalizeTime(value: unknown): number {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const normalized = Math.floor(value);
        return Math.max(0, Math.min(this.maxTimeSeconds, normalized));
    }

    private normalizeDate(value: unknown): string {
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
        return new Date().toISOString();
    }

    private normalizeNationality(value: unknown): string | null {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        return trimmed.slice(0, 3).toUpperCase();
    }

    private mapMode(mode: LeaderboardMode): 'LevelMode' | 'BlockerMode' | 'TimeMode' {
        if (mode === 'level') return 'LevelMode';
        if (mode === 'time') return 'TimeMode';
        return 'BlockerMode';
    }
}

export { LeaderboardStore };

import { normalizeGameOptions, type GameOptions } from './game-options.js';

type OptionsResponse = {
    options?: Partial<GameOptions> | null;
};

type OptionsLoadResult = {
    options: GameOptions;
    hasRemote: boolean;
};

class OptionsStore {
    private readonly endpoint = '/backend/options.php';

    async load(userId: string, fallback: GameOptions): Promise<OptionsLoadResult> {
        const normalizedUserId = this.requireUserId(userId);
        const response = await fetch(
            this.endpoint +
                '?' +
                new URLSearchParams({
                    userId: normalizedUserId
                }).toString(),
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load options: ' + response.status);
        }

        const payload = (await response.json()) as OptionsResponse;
        if (!payload?.options) {
            return {
                options: normalizeGameOptions(fallback),
                hasRemote: false
            };
        }

        return {
            options: normalizeGameOptions({ ...fallback, ...payload.options }),
            hasRemote: true
        };
    }

    async save(userId: string, options: GameOptions): Promise<GameOptions> {
        const normalizedUserId = this.requireUserId(userId);
        const normalized = normalizeGameOptions(options);
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: normalizedUserId,
                options: normalized
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save options: ' + response.status);
        }

        const payload = (await response.json()) as OptionsResponse;
        const merged = payload?.options ? { ...normalized, ...payload.options } : normalized;
        return normalizeGameOptions(merged);
    }

    private requireUserId(userId: string): string {
        const trimmed = userId.trim();
        if (!trimmed) {
            throw new Error('User ID is required for options operations.');
        }
        if (trimmed.length > 128) {
            throw new Error('User ID is too long.');
        }
        return trimmed;
    }
}

export { OptionsStore };
export type { OptionsLoadResult };

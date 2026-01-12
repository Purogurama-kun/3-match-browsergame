import { DEFAULT_GAME_OPTIONS, normalizeGameOptions, type GameOptions } from './game-options.js';

class LocalOptionsStore {
    private readonly optionsKey = 'match3-options';

    load(): GameOptions {
        const storage = this.getStorage();
        if (!storage) {
            return { ...DEFAULT_GAME_OPTIONS };
        }
        const raw = storage.getItem(this.optionsKey);
        if (!raw) {
            return { ...DEFAULT_GAME_OPTIONS };
        }
        try {
            const parsed = JSON.parse(raw) as Partial<GameOptions>;
            return normalizeGameOptions(parsed);
        } catch (error) {
            console.warn('Failed to parse stored options', error);
            return { ...DEFAULT_GAME_OPTIONS };
        }
    }

    save(options: GameOptions): GameOptions {
        const normalized = normalizeGameOptions(options);
        const storage = this.getStorage();
        if (!storage) {
            return normalized;
        }
        try {
            storage.setItem(this.optionsKey, JSON.stringify(normalized));
        } catch (error) {
            console.warn('Could not persist options', error);
        }
        return normalized;
    }

    clear(): void {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.removeItem(this.optionsKey);
        } catch (error) {
            console.warn('Could not clear options', error);
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
}

export { LocalOptionsStore };

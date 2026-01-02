type GuestProfile = {
    name: string;
};

class GuestProfileStore {
    private readonly storageKey = 'match3-guest-profile';
    private readonly defaultProfile: GuestProfile = {
        name: 'Guest'
    };

    load(): GuestProfile {
        const storage = this.getStorage();
        if (!storage) {
            return { ...this.defaultProfile };
        }
        const raw = storage.getItem(this.storageKey);
        if (!raw) {
            this.save(this.defaultProfile);
            return { ...this.defaultProfile };
        }
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.name === 'string' && parsed.name.trim().length > 0) {
                return { name: parsed.name };
            }
        } catch (error) {
            console.warn('Failed to parse guest profile', error);
        }
        return { ...this.defaultProfile };
    }

    save(profile: GuestProfile): void {
        const storage = this.getStorage();
        if (!storage) {
            return;
        }
        try {
            storage.setItem(
                this.storageKey,
                JSON.stringify({
                    name: profile.name
                })
            );
        } catch (error) {
            console.warn('Could not persist guest profile', error);
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

export { GuestProfileStore };
export type { GuestProfile };

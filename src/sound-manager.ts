type SoundKey = 'match' | 'lineBomb' | 'radiusBomb' | 'levelUp' | 'levelFail';
const SOUND_FILES: Record<SoundKey, string> = {
    match: 'assets/sounds/match.ogg',
    lineBomb: 'assets/sounds/line-bomb.ogg',
    radiusBomb: 'assets/sounds/radius-bomb.ogg',
    levelUp: 'assets/sounds/level-up.ogg',
    levelFail: 'assets/sounds/level-fail.ogg'
};

class SoundManager {
    private sounds: Record<SoundKey, HTMLAudioElement>;
    private enabled: boolean;
    private unlocked: boolean;

    constructor() {
        this.enabled = this.supportsOgg();
        this.unlocked = false;
        this.sounds = {
            match: this.createAudio('match'),
            lineBomb: this.createAudio('lineBomb'),
            radiusBomb: this.createAudio('radiusBomb'),
            levelUp: this.createAudio('levelUp'),
            levelFail: this.createAudio('levelFail')
        };
        if (this.enabled) {
            this.addUnlockListeners();
        }
    }

    setEnabled(enabled: boolean): boolean {
        this.enabled = enabled && this.supportsOgg();
        if (this.enabled && !this.unlocked) {
            this.addUnlockListeners();
        }
        return this.enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    play(key: SoundKey): void {
        if (!this.enabled) return;
        this.unlockIfNeeded();
        const sound = this.sounds[key];
        if (!sound) return;
        const instance = sound.cloneNode(true) as HTMLAudioElement;
        instance.currentTime = 0;
        const playPromise = instance.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((error: Error) => {
                console.error('Failed to play sound:', key, error);
            });
        }
    }

    private createAudio(key: SoundKey): HTMLAudioElement {
        const audio = new Audio(SOUND_FILES[key]);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.load();
        return audio;
    }

    private supportsOgg(): boolean {
        const probe = document.createElement('audio');
        return probe.canPlayType('audio/ogg; codecs=\"vorbis\"') !== '';
    }

    private addUnlockListeners(): void {
        const unlock = (): void => {
            this.unlockSounds();
        };
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }

    private unlockIfNeeded(): void {
        if (!this.unlocked) {
            this.unlockSounds();
        }
    }

    private unlockSounds(): void {
        if (this.unlocked || !this.enabled) return;
        this.unlocked = true;
        Object.values(this.sounds).forEach((audio) => {
            try {
                audio.muted = true;
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise
                        .then(() => {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.muted = false;
                        })
                        .catch(() => {
                            audio.muted = false;
                        });
                } else {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = false;
                }
            } catch {
                audio.muted = false;
            }
        });
    }
}

export { SoundManager, SoundKey };

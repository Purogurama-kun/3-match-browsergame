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
    private primed: boolean;

    constructor() {
        this.enabled = this.canPlayOgg();
        this.primed = false;
        this.sounds = this.createSounds();
        if (this.enabled) {
            this.bindUnlock();
        }
    }

    setEnabled(enabled: boolean): boolean {
        this.enabled = enabled && this.canPlayOgg();
        if (this.enabled && !this.primed) {
            this.bindUnlock();
        }
        if (!this.enabled) {
            this.stopAll();
        }
        return this.enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    play(key: SoundKey): void {
        if (!this.enabled) return;
        this.ensurePrimed();
        const sound = this.sounds[key];
        if (!sound) return;
        sound.currentTime = 0;
        const playPromise = sound.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    }

    private createSounds(): Record<SoundKey, HTMLAudioElement> {
        return {
            match: this.createAudio('match'),
            lineBomb: this.createAudio('lineBomb'),
            radiusBomb: this.createAudio('radiusBomb'),
            levelUp: this.createAudio('levelUp'),
            levelFail: this.createAudio('levelFail')
        };
    }

    private createAudio(key: SoundKey): HTMLAudioElement {
        const audio = new Audio(SOUND_FILES[key]);
        audio.preload = 'auto';
        return audio;
    }

    private canPlayOgg(): boolean {
        const probe = document.createElement('audio');
        return probe.canPlayType('audio/ogg; codecs=\"vorbis\"') !== '';
    }

    private bindUnlock(): void {
        const unlock = (): void => this.prime();
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }

    private ensurePrimed(): void {
        if (!this.primed) {
            this.prime();
        }
    }

    private prime(): void {
        if (this.primed || !this.enabled) return;
        this.primed = true;
        Object.values(this.sounds).forEach((audio) => {
            audio.muted = true;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.finally === 'function') {
                playPromise.finally(() => this.resetAudio(audio));
            } else {
                this.resetAudio(audio);
            }
        });
    }

    private resetAudio(audio: HTMLAudioElement): void {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
    }

    private stopAll(): void {
        Object.values(this.sounds).forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
    }
}

export { SoundManager, SoundKey };

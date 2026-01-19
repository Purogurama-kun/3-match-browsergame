type SoundKey = 'match' | 'lineBomb' | 'radiusBomb' | 'levelUp' | 'levelFail' | 'lowMoves';
const SOUND_FILES: Record<SoundKey, string> = {
    match: 'assets/sounds/match.ogg',
    lineBomb: 'assets/sounds/line-bomb.ogg',
    radiusBomb: 'assets/sounds/radius-bomb.ogg',
    levelUp: 'assets/sounds/level-up.ogg',
    levelFail: 'assets/sounds/level-fail.ogg',
    lowMoves: 'assets/sounds/low-moves.ogg'
};

const SOUND_VOLUMES: Record<SoundKey, number> = {
    match: 0.35,
    lineBomb: 0.6,
    radiusBomb: 0.6,
    levelUp: 0.7,
    levelFail: 0.7,
    lowMoves: 0.5
};

class SoundManager {
    private sounds: Record<SoundKey, [HTMLAudioElement, ...HTMLAudioElement[]]>;
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
        const pool = this.sounds[key];
        if (!pool || pool.length === 0) return;
        const sound = this.getAvailableAudio(pool, key);
        sound.currentTime = 0;
        const playPromise = sound.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    }

    private createSounds(): Record<SoundKey, [HTMLAudioElement, ...HTMLAudioElement[]]> {
        return {
            match: this.createAudioPool('match'),
            lineBomb: this.createAudioPool('lineBomb'),
            radiusBomb: this.createAudioPool('radiusBomb'),
            levelUp: this.createAudioPool('levelUp'),
            levelFail: this.createAudioPool('levelFail'),
            lowMoves: this.createAudioPool('lowMoves')
        };
    }

    private createAudioPool(key: SoundKey): [HTMLAudioElement, ...HTMLAudioElement[]] {
        const pool: [HTMLAudioElement, ...HTMLAudioElement[]] = [this.createAudioInstance(key)];
        for (let i = 0; i < 3; i++) {
            pool.push(this.createAudioInstance(key));
        }
        return pool;
    }

    private createAudioInstance(key: SoundKey): HTMLAudioElement {
        const audio = new Audio(SOUND_FILES[key]);
        audio.preload = 'auto';
        return audio;
    }

    private getAvailableAudio(pool: [HTMLAudioElement, ...HTMLAudioElement[]], key: SoundKey): HTMLAudioElement {
        const available = pool.find((audio) => audio.paused || audio.ended);
        if (available) {
            this.prepareForPlayback(available, key);
            return available;
        }
        const fallback = pool[0];
        this.prepareForPlayback(fallback, key);
        return fallback;
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
        Object.values(this.sounds).forEach((pool) => {
            pool.forEach((audio) => {
                audio.muted = true;
                audio.volume = 0;
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
                if (playPromise && typeof playPromise.finally === 'function') {
                    playPromise.finally(() => this.resetAudio(audio, true));
                } else {
                    this.resetAudio(audio, true);
                }
            });
        });
    }

    private prepareForPlayback(audio: HTMLAudioElement, key: SoundKey): void {
        this.resetAudio(audio);
        audio.muted = false;
        audio.volume = SOUND_VOLUMES[key];
    }

    private resetAudio(audio: HTMLAudioElement, keepMuted: boolean = false): void {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = keepMuted;
        audio.volume = keepMuted ? 0 : 1;
    }

    private stopAll(): void {
        Object.values(this.sounds).forEach((pool) => {
            pool.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0;
            });
        });
    }
}

export { SoundManager, SoundKey };

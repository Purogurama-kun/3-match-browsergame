const SOUND_FILES = {
    match: 'assets/sounds/match.ogg',
    lineBomb: 'assets/sounds/line-bomb.ogg',
    radiusBomb: 'assets/sounds/radius-bomb.ogg',
    levelUp: 'assets/sounds/level-up.ogg',
    levelFail: 'assets/sounds/level-fail.ogg'
};
class SoundManager {
    constructor() {
        this.enabled = this.canPlayOgg();
        this.primed = false;
        this.sounds = this.createSounds();
        if (this.enabled) {
            this.bindUnlock();
        }
    }
    setEnabled(enabled) {
        this.enabled = enabled && this.canPlayOgg();
        if (this.enabled && !this.primed) {
            this.bindUnlock();
        }
        if (!this.enabled) {
            this.stopAll();
        }
        return this.enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    play(key) {
        if (!this.enabled)
            return;
        this.ensurePrimed();
        const pool = this.sounds[key];
        if (!pool || pool.length === 0)
            return;
        const sound = this.getAvailableAudio(pool);
        sound.currentTime = 0;
        const playPromise = sound.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
        }
    }
    createSounds() {
        return {
            match: this.createAudioPool('match'),
            lineBomb: this.createAudioPool('lineBomb'),
            radiusBomb: this.createAudioPool('radiusBomb'),
            levelUp: this.createAudioPool('levelUp'),
            levelFail: this.createAudioPool('levelFail')
        };
    }
    createAudioPool(key) {
        const pool = [this.createAudioInstance(key)];
        for (let i = 0; i < 3; i++) {
            pool.push(this.createAudioInstance(key));
        }
        return pool;
    }
    createAudioInstance(key) {
        const audio = new Audio(SOUND_FILES[key]);
        audio.preload = 'auto';
        return audio;
    }
    getAvailableAudio(pool) {
        const available = pool.find((audio) => audio.paused || audio.ended);
        if (available) {
            this.resetAudio(available);
            return available;
        }
        return pool[0];
    }
    canPlayOgg() {
        const probe = document.createElement('audio');
        return probe.canPlayType('audio/ogg; codecs=\"vorbis\"') !== '';
    }
    bindUnlock() {
        const unlock = () => this.prime();
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }
    ensurePrimed() {
        if (!this.primed) {
            this.prime();
        }
    }
    prime() {
        if (this.primed || !this.enabled)
            return;
        this.primed = true;
        Object.values(this.sounds).forEach((pool) => {
            pool.forEach((audio) => {
                audio.muted = true;
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.finally === 'function') {
                    playPromise.finally(() => this.resetAudio(audio));
                }
                else {
                    this.resetAudio(audio);
                }
            });
        });
    }
    resetAudio(audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
    }
    stopAll() {
        Object.values(this.sounds).forEach((pool) => {
            pool.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0;
            });
        });
    }
}
export { SoundManager };

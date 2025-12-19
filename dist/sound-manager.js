const SOUND_FILES = {
    match: 'assets/sounds/match.ogg',
    lineBomb: 'assets/sounds/line-bomb.ogg',
    radiusBomb: 'assets/sounds/radius-bomb.ogg',
    levelUp: 'assets/sounds/level-up.ogg',
    levelFail: 'assets/sounds/level-fail.ogg'
};
class SoundManager {
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
    setEnabled(enabled) {
        this.enabled = enabled && this.supportsOgg();
        if (this.enabled && !this.unlocked) {
            this.addUnlockListeners();
        }
        return this.enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    play(key) {
        if (!this.enabled)
            return;
        this.unlockIfNeeded();
        const sound = this.sounds[key];
        if (!sound)
            return;
        const instance = sound.cloneNode(true);
        instance.currentTime = 0;
        const playPromise = instance.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((error) => {
                console.error('Failed to play sound:', key, error);
            });
        }
    }
    createAudio(key) {
        const audio = new Audio(SOUND_FILES[key]);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.load();
        return audio;
    }
    supportsOgg() {
        const probe = document.createElement('audio');
        return probe.canPlayType('audio/ogg; codecs=\"vorbis\"') !== '';
    }
    addUnlockListeners() {
        const unlock = () => {
            this.unlockSounds();
        };
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
    }
    unlockIfNeeded() {
        if (!this.unlocked) {
            this.unlockSounds();
        }
    }
    unlockSounds() {
        if (this.unlocked || !this.enabled)
            return;
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
                }
                else {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = false;
                }
            }
            catch {
                audio.muted = false;
            }
        });
    }
}
export { SoundManager };

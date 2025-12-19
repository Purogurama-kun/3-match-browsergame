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
        this.sounds = {
            match: this.createAudio('match'),
            lineBomb: this.createAudio('lineBomb'),
            radiusBomb: this.createAudio('radiusBomb'),
            levelUp: this.createAudio('levelUp'),
            levelFail: this.createAudio('levelFail')
        };
    }
    setEnabled(enabled) {
        this.enabled = enabled && this.supportsOgg();
        return this.enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    play(key) {
        if (!this.enabled)
            return;
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
        return audio;
    }
    supportsOgg() {
        const probe = document.createElement('audio');
        return probe.canPlayType('audio/ogg; codecs=\"vorbis\"') !== '';
    }
}
export { SoundManager };

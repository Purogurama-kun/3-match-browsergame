class SoundManager {
    constructor() {
        this.sounds = {
            match: new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg'),
            explosion: new Audio('https://actions.google.com/sounds/v1/explosions/explosion.ogg'),
            levelUp: new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'),
            levelFail: new Audio('https://actions.google.com/sounds/v1/cartoon/boing.ogg')
        };
    }

    play(key) {
        const sound = this.sounds[key];
        if (!sound) return;
        sound.currentTime = 0;
        sound.play();
    }
}

export { SoundManager };

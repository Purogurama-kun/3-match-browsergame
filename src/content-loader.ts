import { setLevelsFromData } from './levels.js';
import { setStoryActsFromData } from './story.js';
import {
    setBlockerModeConfigFromData,
    setTimeModeConfigFromData,
    setLevelModeConfigFromData
} from './mode-config.js';
import { setGameConfigFromData } from './game-config.js';

const LEVELS_DATA_URL = 'assets/data/levels.json';
const STORY_DATA_URL = 'assets/data/story-acts.json';
const BLOCKER_MODE_DATA_URL = 'assets/data/blocker-mode.json';
const TIME_MODE_DATA_URL = 'assets/data/time-mode.json';
const LEVEL_MODE_DATA_URL = 'assets/data/level-mode.json';
const GAME_DATA_URL = 'assets/data/game.json';

async function loadGameContent(): Promise<void> {
    await Promise.all([
        loadJson(LEVELS_DATA_URL, setLevelsFromData),
        loadJson(STORY_DATA_URL, setStoryActsFromData),
        loadJson(BLOCKER_MODE_DATA_URL, setBlockerModeConfigFromData),
        loadJson(TIME_MODE_DATA_URL, setTimeModeConfigFromData),
        loadJson(LEVEL_MODE_DATA_URL, setLevelModeConfigFromData),
        loadJson(GAME_DATA_URL, setGameConfigFromData)
    ]);
}

async function loadJson(path: string, handler: (data: unknown) => boolean): Promise<void> {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            console.warn(`Failed to load ${path}. Using bundled defaults.`);
            return;
        }
        const payload = (await response.json()) as unknown;
        handler(payload);
    } catch (error) {
        console.warn(`Failed to load ${path}. Using bundled defaults.`, error);
    }
}

export { loadGameContent };

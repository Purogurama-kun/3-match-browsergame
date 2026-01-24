import { setLevelsFromData } from './levels.js';
import { setStoryActsFromData } from './story.js';

const LEVELS_DATA_URL = 'assets/data/levels.json';
const STORY_DATA_URL = 'assets/data/story-acts.json';

async function loadGameContent(): Promise<void> {
    await Promise.all([loadJson(LEVELS_DATA_URL, setLevelsFromData), loadJson(STORY_DATA_URL, setStoryActsFromData)]);
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

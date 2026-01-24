import { CutsceneScene } from './cutscene.js';
import { getLocale, Locale } from './i18n.js';

type LocalizedText = string | Partial<Record<Locale, string>>;

type StoryCutsceneDefinition = {
    imagePath: string;
    text: LocalizedText;
    durationMs?: number;
};

type StoryAct = {
    id: string;
    label: LocalizedText;
    startLevel: number;
    endLevel: number;
    cutscene?: StoryCutsceneDefinition;
    endCutscene?: StoryCutsceneDefinition;
};

const DEFAULT_STORY_ACTS: StoryAct[] = [
    {
        id: 'setup',
        label: { en: 'Act 1 - Setup', de: 'Akt 1 - Auftakt' },
        startLevel: 1,
        endLevel: 5,
        cutscene: {
            imagePath: 'assets/images/vendor-plaza.png',
            text: {
                en: 'Mira: Tiny bursts keep the plaza spotless.',
                de: 'Mira: Kleine Explosionen halten den Platz sauber.'
            },
            durationMs: 4400
        }
    },
    {
        id: 'plaza',
        label: { en: 'Act 2 - Plaza', de: 'Akt 2 - Platz' },
        startLevel: 6,
        endLevel: 15,
        cutscene: {
            imagePath: 'assets/images/vendor-plaza.png',
            text: {
                en: 'Mira: Hard candies vanish with a sparkle.',
                de: 'Mira: Harte Bonbons verschwinden mit einem Funkeln.'
            },
            durationMs: 4400
        }
    },
    {
        id: 'ribbon',
        label: { en: 'Act 3 - Ribbon Alley', de: 'Akt 3 - Bandgasse' },
        startLevel: 16,
        endLevel: 25,
        cutscene: {
            imagePath: 'assets/images/ribbon-alley.png',
            text: {
                en: 'Mira: Sticky ribbons stay calm while I sweep.',
                de: 'Mira: Klebrige Baender bleiben ruhig, waehrend ich fege.'
            }
        }
    },
    {
        id: 'lantern',
        label: { en: 'Act 4 - Lantern Bridge', de: 'Akt 4 - Laternenbruecke' },
        startLevel: 26,
        endLevel: 49,
        cutscene: {
            imagePath: 'assets/images/lantern-bridge.png',
            text: {
                en: 'Mira: Syrup clears without dimming the lanterns.',
                de: 'Mira: Der Sirup verschwindet, ohne die Laternen zu trueben.'
            }
        }
    },
    {
        id: 'finale',
        label: { en: 'Act 5 - Finale', de: 'Akt 5 - Finale' },
        startLevel: 50,
        endLevel: 50,
        cutscene: {
            imagePath: 'assets/images/festival.png',
            text: {
                en: 'Mira: One choreographed burst for the crowd.',
                de: 'Mira: Eine choreografierte Explosion fuer das Publikum.'
            }
        },
        endCutscene: {
            imagePath: 'assets/images/festival.png',
            text: {
                en: 'Mira: Candy fireworks bloom; the festival cheers.',
                de: 'Mira: Bonbon-Feuerwerk erblueht; das Festival jubelt.'
            }
        }
    }
];

let STORY_ACTS: StoryAct[] = [...DEFAULT_STORY_ACTS];
const FALLBACK_STORY_ACT: StoryAct = {
    id: 'fallback',
    label: 'Act',
    startLevel: 1,
    endLevel: 1
};

function setStoryActsFromData(raw: unknown): boolean {
    const inputs = extractStoryActInputs(raw);
    if (!inputs || inputs.length === 0) {
        console.warn('Story act data file is missing or empty. Using bundled defaults.');
        return false;
    }
    const parsed = inputs
        .map((input, index) => parseStoryAct(input, index))
        .filter((act): act is StoryAct => Boolean(act));
    if (parsed.length === 0) {
        console.warn('Story act data file contained no valid acts. Using bundled defaults.');
        return false;
    }
    STORY_ACTS = parsed;
    return true;
}

function extractStoryActInputs(raw: unknown): unknown[] | null {
    if (Array.isArray(raw)) {
        return raw;
    }
    if (raw && typeof raw === 'object' && Array.isArray((raw as { acts?: unknown }).acts)) {
        return (raw as { acts: unknown[] }).acts;
    }
    return null;
}

function parseStoryAct(input: unknown, index: number): StoryAct | null {
    if (!input || typeof input !== 'object') {
        return null;
    }
    const data = input as Record<string, unknown>;
    const startLevel = Number(data.start_level);
    const endLevel = Number(data.end_level);
    if (!Number.isFinite(startLevel) || !Number.isFinite(endLevel)) {
        console.warn(`Story act ${index + 1} is missing a valid level range.`);
        return null;
    }
    const label = normalizeLocalizedText(data.label ?? `Act ${index + 1}`);
    const id = typeof data.id === 'string' && data.id.trim() ? data.id : `act-${index + 1}`;
    const cutscene = buildCutscene(data.cutscene_image_path, data.cutscene_text, data.cutscene_duration_ms);
    const endCutscene = buildCutscene(
        data.end_cutscene_image_path,
        data.end_cutscene_text,
        data.end_cutscene_duration_ms
    );
    return {
        id,
        label,
        startLevel: Math.floor(startLevel),
        endLevel: Math.floor(endLevel),
        ...(cutscene ? { cutscene } : {}),
        ...(endCutscene ? { endCutscene } : {})
    };
}

function buildCutscene(
    imagePath: unknown,
    text: unknown,
    duration: unknown
): StoryCutsceneDefinition | undefined {
    if (!imagePath || !text) {
        return undefined;
    }
    const path = String(imagePath);
    const normalizedText = normalizeLocalizedText(text);
    if (!path.trim() || !normalizedText) {
        return undefined;
    }
    const cutscene: StoryCutsceneDefinition = {
        imagePath: path,
        text: normalizedText
    };
    const durationValue = Number(duration);
    if (Number.isFinite(durationValue) && durationValue > 0) {
        cutscene.durationMs = durationValue;
    }
    return cutscene;
}

function normalizeLocalizedText(value: unknown): LocalizedText {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object') {
        const record = value as Partial<Record<Locale, string>>;
        return record;
    }
    return '';
}

function getStoryActs(): StoryAct[] {
    return STORY_ACTS;
}

function getStoryActForLevel(level: number): StoryAct {
    let active = STORY_ACTS[0] ?? DEFAULT_STORY_ACTS[0] ?? FALLBACK_STORY_ACT;
    STORY_ACTS.forEach((act) => {
        if (level >= act.startLevel && level <= act.endLevel) {
            active = act;
        }
    });
    return active;
}

function getStoryActLabel(level: number): string {
    const act = getStoryActForLevel(level);
    return resolveLocalizedText(act.label);
}

function getStoryCutscene(level: number, timing: 'before' | 'after'): CutsceneScene | null {
    const act = getStoryActForLevel(level);
    const scene = timing === 'before'
        ? level === act.startLevel
            ? act.cutscene
            : undefined
        : level === act.endLevel
            ? act.endCutscene
            : undefined;
    if (!scene) return null;
    const payload: CutsceneScene = {
        background: scene.imagePath,
        text: resolveLocalizedText(scene.text)
    };
    if (scene.durationMs !== undefined) {
        payload.durationMs = scene.durationMs;
    }
    return payload;
}

function resolveLocalizedText(text: LocalizedText): string {
    if (typeof text === 'string') {
        return text;
    }
    const locale = getLocale();
    return text[locale] ?? text.en ?? Object.values(text)[0] ?? '';
}

export { getStoryActs, getStoryActForLevel, getStoryActLabel, getStoryCutscene, setStoryActsFromData };
export type { StoryAct, StoryCutsceneDefinition, LocalizedText };

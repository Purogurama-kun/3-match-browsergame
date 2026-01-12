import type { Locale } from './i18n.js';
import type { CellShapeMode } from './types.js';

type GameOptions = {
    locale: Locale;
    cellShapeMode: CellShapeMode;
    audioEnabled: boolean;
    performanceModeEnabled: boolean;
    recordingEnabled: boolean;
};

const DEFAULT_GAME_OPTIONS: GameOptions = {
    locale: 'en',
    cellShapeMode: 'square',
    audioEnabled: true,
    performanceModeEnabled: false,
    recordingEnabled: true
};

const SUPPORTED_LOCALES: Locale[] = ['en', 'de'];

function normalizeGameOptions(candidate?: Partial<GameOptions>): GameOptions {
    const locale =
        candidate?.locale && SUPPORTED_LOCALES.includes(candidate.locale)
            ? candidate.locale
            : DEFAULT_GAME_OPTIONS.locale;
    const cellShapeMode =
        candidate?.cellShapeMode === 'square' || candidate?.cellShapeMode === 'shaped'
            ? candidate.cellShapeMode
            : DEFAULT_GAME_OPTIONS.cellShapeMode;
    const audioEnabled =
        typeof candidate?.audioEnabled === 'boolean'
            ? candidate.audioEnabled
            : DEFAULT_GAME_OPTIONS.audioEnabled;
    const performanceModeEnabled =
        typeof candidate?.performanceModeEnabled === 'boolean'
            ? candidate.performanceModeEnabled
            : DEFAULT_GAME_OPTIONS.performanceModeEnabled;
    const recordingEnabled =
        typeof candidate?.recordingEnabled === 'boolean'
            ? candidate.recordingEnabled
            : DEFAULT_GAME_OPTIONS.recordingEnabled;

    return {
        locale,
        cellShapeMode,
        audioEnabled,
        performanceModeEnabled,
        recordingEnabled
    };
}

export { DEFAULT_GAME_OPTIONS, normalizeGameOptions };
export type { GameOptions };

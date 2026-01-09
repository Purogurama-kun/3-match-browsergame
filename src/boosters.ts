import { ActivatableBoosterType } from './types.js';
import { BOOSTERS } from './constants.js';

function getBoosterIcon(booster: ActivatableBoosterType): string {
    if (booster === BOOSTERS.LINE) return '💣';
    if (booster === BOOSTERS.BURST_SMALL) return '🧨';
    if (booster === BOOSTERS.BURST_MEDIUM) return '💥';
    if (booster === BOOSTERS.BURST_LARGE) return '☢️';
    return '💣';
}

export { getBoosterIcon };

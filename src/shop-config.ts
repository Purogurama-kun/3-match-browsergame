import { getMaxPowerupStock } from './constants.js';

type ShopConfig = {
    powerupPrices: number[];
    extraSlotPrice: number;
};

const DEFAULT_SHOP_CONFIG: ShopConfig = {
    powerupPrices: [5, 20],
    extraSlotPrice: 50
};

let shopConfig: ShopConfig = cloneShopConfig(DEFAULT_SHOP_CONFIG);

function getShopConfig(): ShopConfig {
    return cloneShopConfig(shopConfig);
}

function setShopConfigFromData(raw: unknown): boolean {
    const parsed = parseShopConfig(raw);
    if (!parsed) {
        console.warn('Shop config file is missing or invalid. Using bundled defaults.');
        return false;
    }
    shopConfig = parsed;
    return true;
}

function parseShopConfig(raw: unknown): ShopConfig | null {
    const data = extractConfigObject(raw);
    if (!data) return null;

    return {
        powerupPrices: readPriceList(data.powerupPrices, DEFAULT_SHOP_CONFIG.powerupPrices),
        extraSlotPrice: readInt(data.extraSlotPrice, DEFAULT_SHOP_CONFIG.extraSlotPrice, { min: 0 })
    };
}

function extractConfigObject(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    const data = raw as Record<string, unknown>;
    if (data.config && typeof data.config === 'object' && !Array.isArray(data.config)) {
        return data.config as Record<string, unknown>;
    }
    return data;
}

function readPriceList(value: unknown, fallback: number[]): number[] {
    if (!Array.isArray(value)) {
        return [...fallback];
    }
    const parsed = value
        .map((entry) => readInt(entry, NaN, { min: 0 }))
        .filter((entry) => Number.isFinite(entry));
    if (parsed.length === 0) {
        return [...fallback];
    }
    const maxStock = getMaxPowerupStock(true);
    return parsed.slice(0, Math.max(1, maxStock));
}

function readInt(value: unknown, fallback: number, options?: { min?: number; max?: number }): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    let resolved = Math.floor(numeric);
    if (options?.min !== undefined) {
        resolved = Math.max(options.min, resolved);
    }
    if (options?.max !== undefined) {
        resolved = Math.min(options.max, resolved);
    }
    return resolved;
}

function cloneShopConfig(config: ShopConfig): ShopConfig {
    return {
        powerupPrices: [...config.powerupPrices],
        extraSlotPrice: config.extraSlotPrice
    };
}

export { ShopConfig, getShopConfig, setShopConfigFromData };

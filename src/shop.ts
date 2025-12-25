import {
    MAX_TACTICAL_POWERUP_STOCK,
    TACTICAL_POWERUPS,
    TacticalPowerup
} from './constants.js';
import { t } from './i18n.js';
import { getRequiredElement } from './dom.js';
import type { PowerupInventory } from './types.js';

const FIRST_POWERUP_PRICE = 5;
const SECOND_POWERUP_PRICE = 20;

type ShopState = {
    coins: number;
    powerups: PowerupInventory;
};

type ShopEntry = {
    button: HTMLButtonElement;
    price: HTMLElement;
    count: HTMLElement;
};

function getNextPowerupPrice(owned: number): number | null {
    if (owned < 0) {
        return null;
    }
    if (owned === 0) {
        return FIRST_POWERUP_PRICE;
    }
    if (owned === 1) {
        return SECOND_POWERUP_PRICE;
    }
    return null;
}

class ShopView {
    constructor(options: { onBuy: (type: TacticalPowerup) => void; onClose: () => void }) {
        this.container = getRequiredElement('shop');
        this.itemsContainer = getRequiredElement('shop-items');
        this.coinLabel = getRequiredElement('shop-coin-count');
        this.feedback = getRequiredElement('shop-feedback');
        this.closeButton = getRequiredElement('shop-close');
        this.onBuy = options.onBuy;
        this.onClose = options.onClose;
        this.entries = {} as Record<TacticalPowerup, ShopEntry>;
        this.buildEntries();
        this.closeButton.addEventListener('click', () => this.requestClose());
    }

    private readonly container: HTMLElement;
    private readonly itemsContainer: HTMLElement;
    private readonly coinLabel: HTMLElement;
    private readonly feedback: HTMLElement;
    private readonly closeButton: HTMLButtonElement;
    private readonly onBuy: (type: TacticalPowerup) => void;
    private readonly onClose: () => void;
    private entries: Record<TacticalPowerup, ShopEntry>;
    private currentState: ShopState | null = null;

    open(state: ShopState): void {
        this.currentState = state;
        document.body.classList.add('match-app--shop');
        this.container.removeAttribute('hidden');
        this.render();
    }

    hide(): void {
        this.container.setAttribute('hidden', 'true');
        document.body.classList.remove('match-app--shop');
        this.clearFeedback();
    }

    private requestClose(): void {
        this.hide();
        this.onClose();
    }

    update(state: ShopState): void {
        this.currentState = state;
        this.render();
    }

    showFeedback(message: string): void {
        this.feedback.textContent = message;
        this.feedback.removeAttribute('hidden');
    }

    private render(): void {
        if (!this.currentState) return;
        const coins = Math.max(0, Math.floor(this.currentState.coins));
        this.clearFeedback();
        this.coinLabel.textContent = t('auth.progress.coins', { coins });
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const meta = TACTICAL_POWERUPS[type];
            const entry = this.entries[type];
            const owned = Math.max(0, this.currentState?.powerups[type] ?? 0);
            const price = getNextPowerupPrice(owned);
            if (entry) {
                entry.count.textContent = t('shop.count', { count: owned, max: MAX_TACTICAL_POWERUP_STOCK });
                if (price === null) {
                    entry.price.textContent = t('shop.priceMaxed');
                    entry.button.disabled = true;
                } else {
                    entry.price.textContent = t('shop.price', { price });
                    entry.button.disabled = coins < price;
                }
                entry.button.textContent = t('shop.button.buy');
                entry.button.setAttribute(
                    'aria-label',
                    `${t(meta.labelKey)} · ${entry.count.textContent}`
                );
            }
        });
    }

    private clearFeedback(): void {
        this.feedback.textContent = '';
        this.feedback.setAttribute('hidden', 'true');
    }

    private buildEntries(): void {
        const powerupTypes = Object.entries(
            TACTICAL_POWERUPS
        ) as [TacticalPowerup, typeof TACTICAL_POWERUPS[TacticalPowerup]][];
        powerupTypes.forEach(([type, meta]) => {
            const item = document.createElement('article');
            item.className = 'shop__item';

            const metaContainer = document.createElement('div');
            metaContainer.className = 'shop__meta';

            const icon = document.createElement('span');
            icon.className = 'shop__icon';
            icon.textContent = meta.icon;

            const label = document.createElement('p');
            label.className = 'shop__label';
            label.textContent = t(meta.labelKey);

            const description = document.createElement('p');
            description.className = 'shop__description';
            description.textContent = t(meta.descriptionKey);

            const metaText = document.createElement('div');
            metaText.appendChild(label);
            metaText.appendChild(description);
            metaContainer.appendChild(icon);
            metaContainer.appendChild(metaText);

            const controls = document.createElement('div');
            controls.className = 'shop__controls';

            const priceNode = document.createElement('span');
            priceNode.className = 'shop__price';

            const countNode = document.createElement('span');
            countNode.className = 'shop__owned';

            const button = document.createElement('button');
            button.className = 'shop__buy';
            button.type = 'button';
            button.addEventListener('click', () => this.onBuy(type));

            controls.appendChild(priceNode);
            controls.appendChild(countNode);
            controls.appendChild(button);

            item.appendChild(metaContainer);
            item.appendChild(controls);
            this.itemsContainer.appendChild(item);

            this.entries[type] = {
                button,
                price: priceNode,
                count: countNode
            };
        });
    }
}

export { ShopView, getNextPowerupPrice };
export type { ShopState };

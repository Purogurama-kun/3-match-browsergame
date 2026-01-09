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
    ownedValue: HTMLElement;
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
        const coinAnnouncement = t('auth.progress.coins', { coins });
        this.coinLabel.textContent = String(coins);
        this.coinLabel.setAttribute('aria-label', coinAnnouncement);
        const powerupTypes = Object.keys(TACTICAL_POWERUPS) as TacticalPowerup[];
        powerupTypes.forEach((type) => {
            const meta = TACTICAL_POWERUPS[type];
            const entry = this.entries[type];
            const owned = Math.max(0, this.currentState?.powerups[type] ?? 0);
            const price = getNextPowerupPrice(owned);
            if (entry) {
                const ownedText = t('shop.count', { count: owned, max: MAX_TACTICAL_POWERUP_STOCK });
                const priceText = price === null ? t('shop.priceMaxed') : String(price);
                entry.ownedValue.textContent = String(owned);
                entry.price.textContent = priceText;
                const isMaxed = price === null;
                entry.button.classList.toggle('shop__buy--maxed', isMaxed);
                if (isMaxed) {
                    entry.button.disabled = true;
                } else {
                    entry.button.disabled = coins < price;
                }
                const priceSpeech = isMaxed ? t('shop.priceMaxed') : t('shop.priceAria', { price });
                entry.button.setAttribute(
                    'aria-label',
                    `${t('shop.button.buy')} ${t(meta.labelKey)} · ${ownedText} · ${priceSpeech}`
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

            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'shop__item-icon';

            const icon = document.createElement('span');
            icon.className = 'shop__icon';
            icon.textContent = meta.icon;
            iconWrapper.appendChild(icon);

            const info = document.createElement('div');
            info.className = 'shop__item-info';

            const label = document.createElement('p');
            label.className = 'shop__label';
            label.textContent = t(meta.labelKey);

            const owned = document.createElement('p');
            owned.className = 'shop__owned';

            const ownedLabel = document.createElement('span');
            ownedLabel.className = 'shop__owned-label';
            ownedLabel.textContent = t('shop.ownedLabel');

            const ownedValue = document.createElement('span');
            ownedValue.className = 'shop__owned-value';

            const ownedDelimiter = document.createElement('span');
            ownedDelimiter.className = 'shop__owned-delimiter';
            ownedDelimiter.textContent = '/';

            const ownedMax = document.createElement('span');
            ownedMax.className = 'shop__owned-max';
            ownedMax.textContent = String(MAX_TACTICAL_POWERUP_STOCK);

            owned.appendChild(ownedLabel);
            owned.appendChild(ownedValue);
            owned.appendChild(ownedDelimiter);
            owned.appendChild(ownedMax);

            const description = document.createElement('p');
            description.className = 'shop__description';
            description.textContent = t(meta.descriptionKey);

            info.appendChild(label);
            info.appendChild(owned);
            info.appendChild(description);

            const button = document.createElement('button');
            button.className = 'shop__buy';
            button.type = 'button';
            button.addEventListener('click', () => this.onBuy(type));

            const buyCost = document.createElement('span');
            buyCost.className = 'shop__buy-cost';

            const coinIcon = document.createElement('img');
            coinIcon.className = 'shop__buy-coin';
            coinIcon.src = 'assets/images/sugar_coin.webp';
            coinIcon.alt = '';
            coinIcon.setAttribute('aria-hidden', 'true');

            const priceNode = document.createElement('span');
            priceNode.className = 'shop__buy-price';

            const maxLabel = document.createElement('span');
            maxLabel.className = 'shop__buy-max';
            maxLabel.textContent = t('shop.maxLabel');

            buyCost.appendChild(coinIcon);
            buyCost.appendChild(priceNode);
            button.appendChild(buyCost);
            button.appendChild(maxLabel);

            item.appendChild(iconWrapper);
            item.appendChild(info);
            item.appendChild(button);
            this.itemsContainer.appendChild(item);

            this.entries[type] = {
                button,
                price: priceNode,
                ownedValue
            };
        });
    }
}

export { ShopView, getNextPowerupPrice };
export type { ShopState };

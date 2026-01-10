import { getRequiredElement } from './dom.js';
import { CellShapeMode } from './types.js';
import { t, Locale, type TranslationKey } from './i18n.js';

type InfoLink = {
    labelKey: TranslationKey;
    href: string;
};

const INFO_LINKS: Record<Locale, InfoLink[]> = {
    en: [
        { labelKey: 'options.infoLink.legal', href: '/html/en/legal-notice.html' },
        { labelKey: 'options.infoLink.privacy', href: '/html/en/privacy-policy.html' }
    ],
    de: [
        { labelKey: 'options.infoLink.legal', href: '/html/de/legal-notice.html' },
        { labelKey: 'options.infoLink.privacy', href: '/html/de/privacy-policy.html' }
    ]
};

class OptionsMenu {
    constructor() {
        this.optionsToggle = this.getOptionsToggle();
        this.optionsClose = this.getOptionsClose();
        this.optionsModal = this.getOptionsModal();
        this.infoButton = this.getInfoButton();
        this.infoPanel = this.getInfoPanel();
        this.infoPanelList = this.getInfoPanelList();
        this.audioToggle = this.getAudioToggle();
        this.performanceToggle = this.getPerformanceToggle();
        this.cellShapeSelect = this.getCellShapeSelect();
        this.languageSelect = this.getLanguageSelect();
        this.exitButton = this.getExitButton();
        this.deleteProgressButton = this.getDeleteProgressButton();
        this.logoutButton = this.getLogoutButton();
        this.recordingToggle = this.getRecordingToggle();

        this.setAudioToggleState(true);
        this.setLanguage('en');
        this.setPerformanceModeEnabled(false);
        this.setRecordingEnabled(true);
        this.hideOptionsModal();
        this.setLogoutEnabled(false);
    }

    private readonly optionsToggle: HTMLButtonElement;
    private readonly optionsClose: HTMLButtonElement;
    private readonly optionsModal: HTMLElement;
    private readonly infoButton: HTMLButtonElement;
    private readonly infoPanel: HTMLElement;
    private readonly infoPanelList: HTMLElement;
    private readonly audioToggle: HTMLButtonElement;
    private readonly performanceToggle: HTMLButtonElement;
    private readonly cellShapeSelect: HTMLSelectElement;
    private readonly languageSelect: HTMLSelectElement;
    private readonly exitButton: HTMLButtonElement;
    private readonly deleteProgressButton: HTMLButtonElement;
    private readonly logoutButton: HTMLButtonElement;
    private readonly recordingToggle: HTMLButtonElement;
    private performanceModeEnabled = false;
    private performanceModeHandler: ((enabled: boolean) => void) | null = null;
    private audioEnabled = true;
    private currentLocale: Locale = 'en';
    private recordingEnabled = true;
    private recordingToggleHandler: ((enabled: boolean) => void) | null = null;
    private readonly handleDocumentClick = (event: MouseEvent): void => {
        if (this.infoPanel.hasAttribute('hidden')) {
            return;
        }
        const target = event.target as Node | null;
        if (target && (this.infoPanel.contains(target) || this.infoButton.contains(target))) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.hideInfoPanel();
    };
    private readonly handleEscape = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            this.hideOptionsModal();
        }
    };

    initialize(): void {
        this.optionsToggle.addEventListener('click', () => {
            const isExpanded = this.optionsToggle.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                this.hideOptionsModal();
            } else {
                this.showOptionsModal();
            }
        });

        this.infoButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleInfoPanel();
        });

        this.infoPanel.addEventListener('click', (event) => event.stopPropagation());

        this.optionsClose.addEventListener('click', () => this.hideOptionsModal());

        document.addEventListener('keydown', this.handleEscape);

        this.optionsModal.addEventListener('click', (event) => {
            if (event.target === this.optionsModal) {
                this.hideOptionsModal();
            }
        });

        document.addEventListener('click', this.handleDocumentClick, true);

        this.performanceToggle.addEventListener('click', () => {
            const nextState = this.performanceToggle.getAttribute('aria-pressed') !== 'true';
            this.setPerformanceModeEnabled(nextState);
            this.performanceModeHandler?.(nextState);
        });
        this.recordingToggle.addEventListener('click', () => {
            const nextState = this.recordingToggle.getAttribute('aria-pressed') !== 'true';
            this.setRecordingEnabled(nextState);
            this.recordingToggleHandler?.(nextState);
        });
    }

    applyLocale(): void {
        this.setAudioToggleState(this.audioEnabled);
        this.setPerformanceModeEnabled(this.performanceModeEnabled);
        this.setRecordingEnabled(this.recordingEnabled);
        this.infoButton.setAttribute('aria-label', t('options.info'));
        this.updateInfoLinks(this.currentLocale);
        this.logoutButton.textContent = t('account.logoutGoogle');
    }

    setCellShapeMode(mode: CellShapeMode): void {
        this.cellShapeSelect.value = mode;
    }

    onCellShapeModeChange(handler: (mode: CellShapeMode) => void): void {
        this.cellShapeSelect.addEventListener('change', () => {
            handler(this.cellShapeSelect.value as CellShapeMode);
        });
    }

    setLanguage(locale: Locale): void {
        this.languageSelect.value = locale;
        this.currentLocale = locale;
        this.updateInfoLinks(locale);
    }

    onLanguageChange(handler: (locale: Locale) => void): void {
        this.languageSelect.addEventListener('change', () => {
            handler(this.languageSelect.value as Locale);
        });
    }

    setAudioEnabled(enabled: boolean): void {
        this.setAudioToggleState(enabled);
    }

    onAudioToggle(handler: (enabled: boolean) => void): void {
        this.audioToggle.addEventListener('click', () => {
            const nextState = this.audioToggle.getAttribute('aria-pressed') !== 'true';
            this.setAudioToggleState(nextState);
            handler(nextState);
        });
    }

    setPerformanceModeEnabled(enabled: boolean): void {
        this.performanceModeEnabled = enabled;
        this.performanceToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        this.performanceToggle.textContent = enabled
            ? t('options.performance.low')
            : t('options.performance.high');
    }

    onPerformanceModeChange(handler: (enabled: boolean) => void): void {
        this.performanceModeHandler = handler;
    }

    setRecordingEnabled(enabled: boolean): void {
        this.recordingEnabled = enabled;
        this.recordingToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        this.recordingToggle.textContent = enabled
            ? t('options.recording.on')
            : t('options.recording.off');
    }

    onRecordingToggle(handler: (enabled: boolean) => void): void {
        this.recordingToggleHandler = handler;
    }

    onExitGame(handler: () => void): void {
        this.exitButton.addEventListener('click', () => {
            this.hideOptionsModal();
            handler();
        });
    }

    onDeleteProgress(handler: () => void): void {
        this.deleteProgressButton.addEventListener('click', () => handler());
    }

    onLogout(handler: () => void): void {
        this.logoutButton.addEventListener('click', () => {
            this.hideOptionsModal();
            handler();
        });
    }

    setLogoutEnabled(enabled: boolean): void {
        this.logoutButton.disabled = !enabled;
        this.logoutButton.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    close(): void {
        this.hideOptionsModal();
    }

    isOpen(): boolean {
        return !this.optionsModal.hasAttribute('hidden');
    }

    private toggleInfoPanel(): void {
        if (this.infoPanel.hasAttribute('hidden')) {
            this.showInfoPanel();
            return;
        }
        this.hideInfoPanel();
    }

    private showInfoPanel(): void {
        this.infoPanel.removeAttribute('hidden');
        this.infoPanel.setAttribute('aria-hidden', 'false');
        this.infoButton.setAttribute('aria-expanded', 'true');
    }

    private hideInfoPanel(): void {
        if (this.infoPanel.hasAttribute('hidden')) {
            return;
        }
        this.infoPanel.setAttribute('hidden', 'true');
        this.infoPanel.setAttribute('aria-hidden', 'true');
        this.infoButton.setAttribute('aria-expanded', 'false');
    }

    private updateInfoLinks(locale: Locale): void {
        const links = INFO_LINKS[locale] ?? INFO_LINKS['en'];
        this.infoPanelList.innerHTML = '';
        links.forEach((link) => {
            const item = document.createElement('li');
            item.className = 'options-info-panel__list-item';
            const anchor = document.createElement('a');
            anchor.className = 'options-info-panel__link';
            anchor.textContent = t(link.labelKey);
            anchor.href = link.href;
            anchor.target = '_blank';
            anchor.rel = 'noreferrer noopener';
            item.appendChild(anchor);
            this.infoPanelList.appendChild(item);
        });
    }

    private showOptionsModal(): void {
        this.optionsModal.removeAttribute('hidden');
        this.optionsModal.setAttribute('aria-hidden', 'false');
        this.optionsToggle.setAttribute('aria-expanded', 'true');
        this.optionsToggle.setAttribute('aria-pressed', 'true');
        this.optionsClose.focus();
    }

    private hideOptionsModal(): void {
        this.optionsModal.setAttribute('hidden', 'true');
        this.optionsModal.setAttribute('aria-hidden', 'true');
        this.optionsToggle.setAttribute('aria-expanded', 'false');
        this.optionsToggle.setAttribute('aria-pressed', 'false');
        this.optionsToggle.focus();
        this.hideInfoPanel();
    }

    private setAudioToggleState(enabled: boolean): void {
        this.audioEnabled = enabled;
        this.audioToggle.setAttribute('aria-pressed', String(enabled));
        this.audioToggle.textContent = enabled ? t('hud.audio.on') : t('hud.audio.off');
    }

    private getOptionsToggle(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('options-toggle');
    }

    private getOptionsClose(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('options-close');
    }

    private getOptionsModal(): HTMLElement {
        return getRequiredElement<HTMLElement>('options-modal');
    }

    private getInfoButton(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('options-info');
    }

    private getInfoPanel(): HTMLElement {
        return getRequiredElement<HTMLElement>('options-info-panel');
    }

    private getInfoPanelList(): HTMLElement {
        return getRequiredElement<HTMLElement>('options-info-list');
    }

    private getAudioToggle(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('audio-toggle');
    }

    private getPerformanceToggle(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('performance-toggle');
    }

    private getCellShapeSelect(): HTMLSelectElement {
        return getRequiredElement<HTMLSelectElement>('cell-shape-mode');
    }

    private getLanguageSelect(): HTMLSelectElement {
        return getRequiredElement<HTMLSelectElement>('language-select');
    }

    private getExitButton(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('exit-game');
    }

    private getDeleteProgressButton(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('delete-progress');
    }

    private getLogoutButton(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('logout-button');
    }

    private getRecordingToggle(): HTMLButtonElement {
        return getRequiredElement<HTMLButtonElement>('recording-toggle');
    }
}

export { OptionsMenu };

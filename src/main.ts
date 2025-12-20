import { Match3Game } from './match3-game.js';
import { getRequiredElement } from './dom.js';

class GameApp {
    constructor() {
        this.body = document.body;
        this.mainMenu = getRequiredElement('main-menu');
        this.startButton = this.getStartButton();
        this.game = new Match3Game();

        this.startButton.addEventListener('click', () => this.startGame());
        this.game.onExitGameRequested(() => this.returnToMenu());

        this.showMainMenu();
    }

    private body: HTMLElement;
    private mainMenu: HTMLElement;
    private startButton: HTMLButtonElement;
    private game: Match3Game;

    private startGame(): void {
        this.hideMainMenu();
        this.game.start();
    }

    private returnToMenu(): void {
        this.game.stop();
        this.showMainMenu();
        this.startButton.focus();
    }

    private showMainMenu(): void {
        this.body.classList.add('game--menu');
        this.mainMenu.removeAttribute('hidden');
        this.game.closeOptions();
    }

    private hideMainMenu(): void {
        this.body.classList.remove('game--menu');
        this.mainMenu.setAttribute('hidden', 'true');
    }

    private getStartButton(): HTMLButtonElement {
        const element = getRequiredElement('start-level');
        if (!(element instanceof HTMLButtonElement)) {
            throw new Error('Start level button is not a button');
        }
        return element;
    }
}

new GameApp();

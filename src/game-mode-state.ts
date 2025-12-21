import { BoosterType } from './constants.js';
import { Board } from './board.js';
import { Hud } from './hud.js';
import { SoundManager } from './sound-manager.js';
import { GameMode, GameState } from './types.js';

type BoardConfig = { blockedCells?: number[]; hardCandies?: number[] };

/** Defines the services a game mode needs to interact with shared systems. */
interface ModeContext {
    getHud(): Hud;
    getBoard(): Board;
    getSounds(): SoundManager;
    finishLevel(result: 'win' | 'lose', completedLevel: number): void;
    finishBlockerRun(finalScore: number, bestScore: number): void;
    notifyProgress(unlockedLevel: number): void;
    notifyBlockerHighScore(score: number): void;
    hardenCells(amount: number): void;
    ensurePlayableBoard(config: BoardConfig): void;
    updateHud(state: GameState): void;
    hasAnyValidMove(): boolean;
    isModalVisible(): boolean;
}

/** Represents a concrete game mode handled by the state machine. */
interface GameModeState {
    readonly id: GameMode;
    enter(context: ModeContext): GameState;
    exit(context: ModeContext): void;
    canStartMove(state: GameState): boolean;
    consumeMove(state: GameState): void;
    handleMoveResolved(state: GameState, context: ModeContext): void;
    handleBoardSettled(state: GameState, context: ModeContext): void;
    checkForCompletion(state: GameState, context: ModeContext): void;
    handleColorCleared(state: GameState, color: string, context: ModeContext): void;
    handleBoosterUsed(state: GameState, booster: BoosterType, context: ModeContext): void;
    getBoardConfig(): BoardConfig;
    shouldSpawnHardCandy(state: GameState): boolean;
    onBoardCreated?(state: GameState, context: ModeContext): void;
}

export { BoardConfig, GameModeState, ModeContext };

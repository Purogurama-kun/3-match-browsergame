import { Board } from './board.js';
import { GRID_SIZE, TACTICAL_POWERUPS, type TacticalPowerup } from './constants.js';
import { Hud } from './hud.js';
import { Renderer } from './renderer.js';
import { SoundManager } from './sound-manager.js';
import { t } from './i18n.js';
import type { GameState, PowerupInventory } from './types.js';
import type { SnapshotPowerupUsage } from './snapshot-recorder.js';

type PowerupManagerOptions = {
    board: Board;
    hud: Hud;
    renderer: Renderer;
    sounds: SoundManager;
    getState: () => GameState;
    updateHud: () => void;
    defer: (callback: () => void, delay: number) => void;
    getAnimationDelay: (duration: number) => number;
    rearrangeBoardColors: () => boolean;
    dropCells: () => void;
    checkMatches: () => void;
    destroyCells: (indices: Iterable<number>) => void;
    getRowCol: (index: number) => { row: number; col: number };
    areAdjacent: (a: number, b: number) => boolean;
    resetHintState: () => void;
    onLockChange: () => void;
    isPerformanceMode: () => boolean;
    recordPowerupUsage?: (usage: SnapshotPowerupUsage) => void;
};

type PowerupActionResult = 'none' | 'canceled' | 'activated';

class PowerupManager {
    private board: Board;
    private hud: Hud;
    private renderer: Renderer;
    private sounds: SoundManager;
    private getState: () => GameState;
    private updateHud: () => void;
    private defer: (callback: () => void, delay: number) => void;
    private getAnimationDelay: (duration: number) => number;
    private rearrangeBoardColors: () => boolean;
    private dropCells: () => void;
    private checkMatches: () => void;
    private destroyCells: (indices: Iterable<number>) => void;
    private getRowCol: (index: number) => { row: number; col: number };
    private areAdjacent: (a: number, b: number) => boolean;
    private resetHintState: () => void;
    private onLockChange: () => void;
    private isPerformanceMode: () => boolean;
    private recordPowerupUsage: ((usage: SnapshotPowerupUsage) => void) | null;
    private pendingPowerup: TacticalPowerup | null = null;
    private pendingPowerupSelections: number[] = [];
    private powerupInProgress = false;
    private powerupInventory: PowerupInventory;
    private powerupInventoryListener: ((inventory: PowerupInventory) => void) | null = null;

    constructor(options: PowerupManagerOptions, inventory: PowerupInventory) {
        this.board = options.board;
        this.hud = options.hud;
        this.renderer = options.renderer;
        this.sounds = options.sounds;
        this.getState = options.getState;
        this.updateHud = options.updateHud;
        this.defer = options.defer;
        this.getAnimationDelay = options.getAnimationDelay;
        this.rearrangeBoardColors = options.rearrangeBoardColors;
        this.dropCells = options.dropCells;
        this.checkMatches = options.checkMatches;
        this.destroyCells = options.destroyCells;
        this.getRowCol = options.getRowCol;
        this.areAdjacent = options.areAdjacent;
        this.resetHintState = options.resetHintState;
        this.onLockChange = options.onLockChange;
        this.isPerformanceMode = options.isPerformanceMode;
        this.recordPowerupUsage = options.recordPowerupUsage ?? null;
        this.powerupInventory = { ...inventory };
    }

    setPowerupInventoryListener(handler: (inventory: PowerupInventory) => void): void {
        this.powerupInventoryListener = handler;
    }

    setPowerupInventory(inventory: PowerupInventory): void {
        this.powerupInventory = { ...inventory };
        this.applyInventoryToState();
        this.updateHud();
    }

    applyInventoryToState(): void {
        const state = this.getState();
        state.powerups = this.powerupInventory;
    }

    hasPowerup(type: TacticalPowerup): boolean {
        const state = this.getState();
        return (state.powerups[type] ?? 0) > 0;
    }

    isInProgress(): boolean {
        return this.powerupInProgress;
    }

    hasPendingPowerup(): boolean {
        return this.pendingPowerup !== null;
    }

    handleCellSelection(index: number): boolean {
        if (!this.pendingPowerup) return false;
        this.resetHintState();
        if (this.pendingPowerup === 'bomb') {
            const { row, col } = this.getRowCol(index);
            this.pendingPowerup = null;
            this.renderer.clearSelection();
            this.hud.setPendingPowerup(null);
            this.applyBombPowerup(row, col);
            return true;
        }
        if (this.pendingPowerup === 'switch') {
            const selection = this.pendingPowerupSelections;
            if (selection.length === 0) {
                this.pendingPowerupSelections = [index];
                this.renderer.selectCell(index);
                this.hud.setStatus(t('hud.status.chooseAdjacent'), TACTICAL_POWERUPS.switch.icon);
                return true;
            }
            const first = selection[0]!;
            if (!this.areAdjacent(first, index)) {
                this.hud.setStatus(t('hud.status.targetAdjacent'), '⚠️');
                this.pendingPowerupSelections = [];
                this.renderer.clearSelection();
                return true;
            }
            this.pendingPowerupSelections = [];
            this.pendingPowerup = null;
            this.renderer.clearSelection();
            this.hud.setPendingPowerup(null);
            this.executeSwitchPowerup(first, index);
            return true;
        }
        return false;
    }

    handleTacticalPowerup(type: TacticalPowerup): PowerupActionResult {
        if (!this.hasPowerup(type)) return 'none';
        this.resetHintState();
        if (this.pendingPowerup === type) {
            this.cancelPendingPowerup();
            return 'canceled';
        }
        if (this.pendingPowerup) {
            this.clearPendingPowerup();
        }
        if (this.powerupInProgress) return 'none';

        const meta = TACTICAL_POWERUPS[type];
        if (!meta) return 'none';

        this.powerupInProgress = true;
        this.onLockChange();
        this.renderer.clearSelection();
        this.getState().selected = null;
        const localizedLabel = t(meta.labelKey);

        if (type === 'shuffle') {
            this.consumePowerup(type);
            this.hud.setStatus(t('hud.status.powerupActivated', { powerup: localizedLabel }), meta.icon ?? '✨');
            this.hud.setPendingPowerup(null);
            this.pendingPowerup = null;
            this.applyShufflePowerup();
        } else {
            this.pendingPowerup = type;
            this.pendingPowerupSelections = [];
            this.hud.setPendingPowerup(type);
            this.hud.setStatus(t('hud.status.chooseTarget', { powerup: localizedLabel }), meta.icon ?? '✨');
        }
        this.updateHud();
        return 'activated';
    }

    finishPowerupIfNeeded(): void {
        if (!this.powerupInProgress) return;
        this.powerupInProgress = false;
        this.onLockChange();
    }

    clearPendingPowerup(showStatus = false): void {
        if (!this.pendingPowerup) return;
        this.pendingPowerup = null;
        this.pendingPowerupSelections = [];
        this.powerupInProgress = false;
        this.onLockChange();
        this.hud.setPendingPowerup(null);
        this.renderer.clearSelection();
        if (showStatus) {
            this.hud.setStatus(t('hud.status.powerupCanceled'), '✖️');
        }
    }

    private cancelPendingPowerup(): void {
        this.clearPendingPowerup(true);
    }

    private consumePowerup(type: TacticalPowerup): boolean {
        const state = this.getState();
        const remaining = state.powerups[type] ?? 0;
        if (remaining <= 0) return false;
        state.powerups[type] = remaining - 1;
        this.notifyPowerupInventoryChange();
        return true;
    }

    private notifyPowerupInventoryChange(): void {
        if (!this.powerupInventoryListener) return;
        this.powerupInventoryListener(this.getCurrentPowerups());
    }

    private getCurrentPowerups(): PowerupInventory {
        return { ...this.powerupInventory };
    }

    private applyShufflePowerup(): void {
        if (!this.rearrangeBoardColors()) {
            this.releasePowerupLock();
            return;
        }
        this.emitPowerupUsage({ powerupType: 'shuffle', coordinates: null });
        this.defer(() => {
            this.checkMatches();
            this.releasePowerupLock();
        }, this.getAnimationDelay(150));
    }

    private applyBombPowerup(row: number, col: number): void {
        if (!this.consumePowerup('bomb')) {
            this.releasePowerupLock();
            return;
        }
        this.updateHud();
        const startRow = Math.min(Math.max(row - 1, 0), GRID_SIZE - 4);
        const startCol = Math.min(Math.max(col - 1, 0), GRID_SIZE - 4);
        const affected: number[] = [];
        this.pendingPowerupSelections = [];
        this.hud.setStatus(
            t('hud.status.powerupUnleashed', { powerup: t(TACTICAL_POWERUPS.bomb.labelKey) }),
            TACTICAL_POWERUPS.bomb.icon
        );
        for (let r = startRow; r < startRow + 4; r++) {
            for (let c = startCol; c < startCol + 4; c++) {
                affected.push(r * GRID_SIZE + c);
            }
        }
        this.emitPowerupUsage({ powerupType: 'bomb', coordinates: [{ x: col, y: row }] });
        this.sounds.play('radiusBomb');
        if (!this.isPerformanceMode()) {
            this.renderer.screenShake();
        }
        this.destroyCells(affected);
        this.defer(() => {
            this.dropCells();
            this.releasePowerupLock();
        }, this.getAnimationDelay(320));
    }

    private executeSwitchPowerup(firstIndex: number, secondIndex: number): void {
        if (!this.consumePowerup('switch')) {
            this.releasePowerupLock();
            return;
        }
        this.updateHud();
        this.board.swapCells(firstIndex, secondIndex);
        const firstPos = this.getRowCol(firstIndex);
        const secondPos = this.getRowCol(secondIndex);
        this.emitPowerupUsage({
            powerupType: 'swap',
            coordinates: [
                { x: firstPos.col, y: firstPos.row },
                { x: secondPos.col, y: secondPos.row }
            ]
        });
        this.renderer.refreshBoard(this.board);
        this.hud.setStatus(t('hud.status.switchExecuted'), TACTICAL_POWERUPS.switch.icon);
        this.defer(() => {
            this.checkMatches();
            this.releasePowerupLock();
        }, this.getAnimationDelay(120));
    }

    private releasePowerupLock(): void {
        if (!this.powerupInProgress) return;
        this.powerupInProgress = false;
        this.onLockChange();
    }

    private emitPowerupUsage(usage: SnapshotPowerupUsage): void {
        this.recordPowerupUsage?.(usage);
    }
}

export { PowerupManager };

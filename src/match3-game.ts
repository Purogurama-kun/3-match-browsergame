import {
    GRID_SIZE,
    BOOSTERS,
    randomColor,
    TacticalPowerup,
    createFreshPowerupInventory,
    type BoosterType
} from './constants.js';
import { SoundManager } from './sound-manager.js';
import { Hud } from './hud.js';
import { Board } from './board.js';
import { CellShapeMode, GameMode, GameState, PowerupInventory, SwipeDirection } from './types.js';
import type { LineOrientation } from './types.js';
import { Renderer } from './renderer.js';
import { CutsceneManager, type CutsceneScene } from './cutscene.js';
import { describeGoal, LEVELS } from './levels.js';
import { GameModeState, ModeContext, BoardConfig } from './game-mode-state.js';
import { LevelModeState } from './level-mode-state.js';
import { BlockerModeState } from './blocker-mode-state.js';
import { LeaderboardState, LeaderboardStateOptions } from './leaderboard-state.js';
import { TimeModeState } from './time-mode-state.js';
import { t, Locale } from './i18n.js';
import { HintManager } from './hint-manager.js';
import { MatchScanner } from './match-scanner.js';
import { MultiplierTracker } from './multiplier-tracker.js';
import { PowerupManager } from './powerup-manager.js';
import { SugarChestManager } from './sugar-chest-manager.js';
import { Bomb } from './bomb.js';
import { Candie } from './candie.js';
import { Generator } from './generator.js';
import { HardCandy } from './hard-candy.js';
import { getRequiredElement } from './dom.js';
import { Match, type MatchContext } from './match.js';
import type { MatchResult } from './match-scanner.js';
import {
    SnapshotRecorder,
    type Snapshot,
    type SnapshotCell,
    type SnapshotMatchMove,
    type SnapshotMove,
    type SnapshotPowerupUsage,
    type Position
} from './snapshot-recorder.js';

type BoosterActivationOverride = {
    booster: BoosterType;
    orientation?: LineOrientation;
};

type ChainBoosterInfo = BoosterActivationOverride & { index: number };

type StoryTiming = 'before' | 'after';

type StoryCutsceneDefinition = {
    level: number;
    timing: StoryTiming;
    background: string;
    text: string;
    durationMs?: number;
};

const FINAL_LEVEL = LEVELS.length;

const STORY_CUTSCENES: StoryCutsceneDefinition[] = [
    {
        level: 1,
        timing: 'before',
        background: 'assets/images/vendor-plaza.png',
        text: 'Mira: Tiny bursts keep the plaza spotless.',
        durationMs: 2200
    },
    {
        level: 6,
        timing: 'before',
        background: 'assets/images/vendor-plaza.png',
        text: 'Mira: Hard candies vanish with a sparkle.',
        durationMs: 2200
    },
    {
        level: 16,
        timing: 'before',
        background: 'assets/images/ribbon-alley.png',
        text: 'Mira: Sticky ribbons stay calm while I sweep.'
    },
    {
        level: 26,
        timing: 'before',
        background: 'assets/images/lantern-bridge.png',
        text: 'Mira: Syrup clears without dimming the lanterns.'
    },
    {
        level: FINAL_LEVEL,
        timing: 'before',
        background: 'assets/images/festival.png',
        text: 'Mira: One choreographed burst for the crowd.'
    },
    {
        level: FINAL_LEVEL,
        timing: 'after',
        background: 'assets/images/festival.png',
        text: 'Mira: Candy fireworks bloom; the festival cheers.'
    }
];

const RECORDING_COLOR_HEX: Record<SnapshotCell['color'], string> = {
    red: '#ff7b7b',
    yellow: '#ffd166',
    blue: '#7dd3fc',
    pink: '#a78bfa',
    green: '#6ee7b7',
    none: '#14182f'
};

const RECORDING_BOMB_ICONS: Record<SnapshotCell['bomb'], { center: string; corner: string }> = {
    small: { center: '🧨', corner: '' },
    medium: { center: '💥', corner: '' },
    large: { center: '☢️', corner: '' },
    line_horizontal: { center: '💣', corner: '↔️' },
    line_vertical: { center: '💣', corner: '↕️' },
    line_both: { center: '💣', corner: '✛' },
    none: { center: '', corner: '' }
};

class Match3Game implements ModeContext {
    constructor() {
        this.sounds = new SoundManager();
        this.hud = new Hud();
        this.renderer = new Renderer(this.hud);
        this.cutsceneManager = new CutsceneManager();
        this.board = new Board();
        this.matchScanner = new MatchScanner(this.board);
        this.multiplierTracker = new MultiplierTracker({
            renderer: this.renderer,
            sounds: this.sounds,
            minMultiplier: this.minMultiplier,
            maxMultiplier: this.maxMultiplier
        });
        this.powerups = new PowerupManager(
            {
                board: this.board,
                hud: this.hud,
                renderer: this.renderer,
                sounds: this.sounds,
                getState: () => this.state,
                updateHud: () => this.updateHud(),
                defer: (callback, delay) => this.defer(callback, delay),
                getAnimationDelay: (duration) => this.getAnimationDelay(duration),
                rearrangeBoardColors: () => this.rearrangeBoardColors(),
                dropCells: () => this.dropCells(),
                checkMatches: () => this.checkMatches(),
                destroyCellAndMaybeFinishGenerator: (index) => this.candie.destroyCellAndMaybeFinishGenerator(index),
                getRowCol: (index) => this.getRowCol(index),
                areAdjacent: (a, b) => this.areAdjacent(a, b),
                resetHintState: () => this.resetHintState(),
                onLockChange: () => this.syncPowerupToolbarLock(),
                isPerformanceMode: () => this.performanceMode,
                recordPowerupUsage: (usage) => this.handlePowerupTriggered(usage)
            },
            createFreshPowerupInventory()
        );
        this.sugarChests = new SugarChestManager({
            board: this.board,
            renderer: this.renderer,
            isPerformanceMode: () => this.performanceMode,
            getAnimationDelay: (duration) => this.getAnimationDelay(duration),
            defer: (callback, delay) => this.defer(callback, delay),
            onSugarCoins: (amount) => this.sugarCoinListener?.(amount),
            getRowCol: (index) => this.getRowCol(index),
            getAdjacentIndices: (row, col) => this.getAdjacentIndices(row, col)
        });
        this.hardCandy = new HardCandy({
            board: this.board,
            renderer: this.renderer,
            getRowCol: (index) => this.getRowCol(index),
            getAdjacentIndices: (row, col) => this.getAdjacentIndices(row, col)
        });
        this.candie = new Candie({
            board: this.board,
            renderer: this.renderer,
            sugarChests: this.sugarChests,
            isPerformanceMode: () => this.performanceMode,
            defer: (callback, delay) => this.defer(callback, delay),
            getAnimationDelay: (duration) => this.getAnimationDelay(duration),
            awardScore: (points) => this.awardScore(points),
            onColorCleared: (color) => this.modeState.handleColorCleared(this.state, color, this),
            updateHud: () => this.updateHud(),
            baseCellPoints: this.baseCellPoints
        });
        this.bomb = new Bomb({
            board: this.board,
            sounds: this.sounds,
            renderer: this.renderer,
            destroyCells: (indices, sourceIndex) => this.handleBombDestruction(indices, sourceIndex)
        });
        this.generator = new Generator({
            board: this.board,
            hardCandy: this.hardCandy,
            getRowCol: (index) => this.getRowCol(index),
            indexAt: (row, col) => this.indexAt(row, col),
            spreadInterval: this.generatorSpreadInterval,
            spreadRadius: this.generatorSpreadRadius
        });
        this.hintManager = new HintManager({
            renderer: this.renderer,
            delayMs: this.hintDelayMs,
            canSchedule: () => this.canScheduleHint(),
            findHintMove: () => this.matchScanner.findHintMove()
        });
        this.matchFlow = new Match({
            matchScanner: this.matchScanner,
            sounds: this.sounds,
            renderer: this.renderer,
            candie: this.candie,
            hardCandy: this.hardCandy,
            sugarChests: this.sugarChests,
            isPerformanceMode: () => this.performanceMode,
            defer: (callback, delay) => this.defer(callback, delay),
            getAnimationDelay: (duration) => this.getAnimationDelay(duration),
            createBooster: (index, type, orientation) => this.bomb.createBooster(index, type, orientation),
            activateBooster: (index) => this.activateBooster(index, false),
            getCellBooster: (index) => this.board.getCellBooster(index),
            dropCells: () => this.dropCells(),
            finalizeMoveScore: () => this.finalizeMoveScore(),
            finishPowerupIfNeeded: () => this.powerups.finishPowerupIfNeeded(),
            onBoardSettled: () => this.modeState.handleBoardSettled(this.state, this),
            getMatchContext: () => this.matchContext,
            onMatchesDetected: (result, context) => this.handleMatchesDetected(result, context),
            scheduleHint: () => this.scheduleHint()
        });
        this.snapshotRecorder = new SnapshotRecorder();
        this.initRecordingView();
        this.renderer.onRecordingRequested(() => this.openRecordingState());
        this.renderer.setRecordingButtonVisible(false);
        this.hud.onTacticalPowerup((type) => this.handleTacticalPowerup(type));
        this.hud.onAudioToggle((enabled) => {
            const active = this.sounds.setEnabled(enabled);
            if (active !== enabled) {
                this.hud.setAudioEnabled(active);
            }
        });
        this.hud.onRecordingToggle((enabled) => this.setRecordingEnabled(enabled));
        this.hud.onCellShapeModeChange((mode) => this.updateCellShapeMode(mode));
        this.hud.onPerformanceModeChange((enabled) => this.setPerformanceMode(enabled));
        this.setPerformanceMode(this.loadPerformanceModeSetting());
        this.hud.initOptionsMenu();
        this.hud.setAudioEnabled(this.sounds.isEnabled());
        this.renderer.setCellShapesEnabled(true);
        this.hud.setCellShapeMode(this.cellShapeMode);
        this.modeState = new LevelModeState(1);
        this.state = this.modeState.enter(this);
        this.candie.setHardCandyHitHandler(() => this.modeState.handleHardCandyHit(this.state, this));
        this.hardCandy.setSoftenedHandler(() => this.modeState.handleHardCandyHit(this.state, this));
        this.powerups.applyInventoryToState();
        this.multiplierTracker.setState(this.state);
        this.refreshGoalDescriptions();
        this.updateCellShapeMode(this.state.cellShapeMode);

        this.generation = 0;
        this.pendingTimers = [];
        this.boardAnimating = false;
        this.syncPowerupToolbarLock();
    }

    private sounds: SoundManager;
    private hud: Hud;
    private readonly renderer: Renderer;
    private cutsceneManager: CutsceneManager;
    private board: Board;
    private matchScanner: MatchScanner;
    private hintManager: HintManager;
    private powerups: PowerupManager;
    private sugarChests: SugarChestManager;
    private multiplierTracker: MultiplierTracker;
    private candie: Candie;
    private hardCandy: HardCandy;
    private bomb: Bomb;
    private generator: Generator;
    private matchFlow: Match;
    private snapshotRecorder: SnapshotRecorder;
    private recordingOverlay!: HTMLElement;
    private recordingBoard!: HTMLElement;
    private recordingCells: HTMLDivElement[] = [];
    private recordingProgress!: HTMLElement;
    private recordingDescription!: HTMLElement;
    private recordingPrevButton!: HTMLButtonElement;
    private recordingNextButton!: HTMLButtonElement;
    private recordingAutoButton!: HTMLButtonElement;
    private recordingCloseButton!: HTMLButtonElement;
    private recordingLabelsToggle!: HTMLButtonElement;
    private recordingAxisToggle!: HTMLButtonElement;
    private recordingBoardWrapper!: HTMLElement;
    private recordingColumnLabels!: HTMLElement;
    private recordingRowLabels!: HTMLElement;
    private recordingShowLabels = false;
    private recordingShowAxis = false;
    private recordingHistory: Snapshot[] = [];
    private recordingIndex = 0;
    private recordingAutoPlay = false;
    private recordingAutoTimer: number | null = null;
    private recordingAvailable = false;
    private pendingSnapshotMoves: SnapshotMove[] = [];
    private matchContext: MatchContext = { swap: null };
    private autoLimitExceeded = false;
    private recordingEnabled = true;
    private gameActive = false;
    private state: GameState;
    private modeState: GameModeState;
    private currentGameMode: GameMode | null = null;
    private generation: number;
    private pendingTimers: number[];
    private readonly baseCellPoints = 10;
    private readonly minMultiplier = 0.5;
    private readonly maxMultiplier = 5;
    private readonly maxBombDropChance = 0.05; // 5%
    private boardAnimating: boolean;
    private cellShapeMode: CellShapeMode = 'square';
    private sugarCoinListener: ((amount: number) => void) | null = null;
    private progressListener: ((level: number) => void) | null = null;
    private blockerHighScoreListener: ((score: number) => void) | null = null;
    private timeBestListener: ((time: number) => void) | null = null;
    private levelAttemptListener: ((level: number) => void) | null = null;
    private blockerAttemptListener: ((score: number) => void) | null = null;
    private timeAttemptListener: ((time: number) => void) | null = null;
    private exitGameListener: (() => void) | null = null;
    private levelSelectListener: (() => void) | null = null;
    private leaderboardState: LeaderboardState | null = null;
    private readonly generatorSpreadInterval = 2;
    private readonly generatorSpreadRadius = 3;
    private performanceMode = false;
    private readonly performanceModeStorageKey = 'match3-performance-mode';
    private readonly hintDelayMs = 10000;

    async startLevel(level: number): Promise<void> {
        this.hud.closeOptions();
        await this.displayStoryCutscene(level, 'before');
        this.switchMode(new LevelModeState(level));
        this.createBoard();
    }

    private async displayStoryCutscene(level: number, timing: StoryTiming): Promise<void> {
        const scene = this.findStoryCutscene(level, timing);
        if (!scene) return;
        await this.cutsceneManager.play(this.toCutsceneScene(scene));
    }

    private toCutsceneScene(scene: StoryCutsceneDefinition): CutsceneScene {
        const payload: CutsceneScene = {
            background: scene.background,
            text: scene.text
        };
        if (scene.durationMs !== undefined) {
            payload.durationMs = scene.durationMs;
        }
        return payload;
    }

    startBlocker(bestScore: number): void {
        this.hud.closeOptions();
        this.switchMode(new BlockerModeState(bestScore));
        this.createBoard();
    }

    startTime(bestSurvival: number): void {
        this.hud.closeOptions();
        this.switchMode(new TimeModeState(bestSurvival));
        this.createBoard();
    }

    stop(): void {
        this.generation++;
        this.updateRecordingLock(false);
        if (this.modeState) {
            this.modeState.exit(this);
            this.currentGameMode = null;
        }
        this.clearPendingTimers();
        this.snapshotRecorder.reset();
        this.clearPendingSnapshotMoves();
        this.autoLimitExceeded = false;
        this.matchContext.swap = null;
        this.resetHintState();
        this.board.clear();
        this.resetMoveTracking();
        this.renderer.resetMoveEvaluation();
        this.renderer.hideModal(false);
        this.renderer.setBackground(undefined);
        this.powerups.clearPendingPowerup();
        this.hud.resetStatus();
    }

    onExitGameRequested(handler: () => void): void {
        this.exitGameListener = handler;
        this.hud.onExitGame(handler);
    }

    onLevelSelectRequested(handler: () => void): void {
        this.levelSelectListener = handler;
    }

    onDeleteProgressRequested(handler: () => void): void {
        this.hud.onDeleteProgress(handler);
    }

    onLogoutRequested(handler: () => void): void {
        this.hud.onLogout(handler);
    }

    setLogoutEnabled(enabled: boolean): void {
        this.hud.setLogoutEnabled(enabled);
    }

    getCurrentMode(): GameMode | null {
        return this.currentGameMode;
    }

    onLanguageChange(handler: (locale: Locale) => void): void {
        this.hud.onLanguageChange(handler);
    }

    onProgressChange(handler: (highestUnlockedLevel: number) => void): void {
        this.progressListener = handler;
    }

    onBlockerHighScore(handler: (score: number) => void): void {
        this.blockerHighScoreListener = handler;
    }

    onTimeBest(handler: (time: number) => void): void {
        this.timeBestListener = handler;
    }

    onLevelAttempt(handler: (level: number) => void): void {
        this.levelAttemptListener = handler;
    }

    onBlockerAttempt(handler: (score: number) => void): void {
        this.blockerAttemptListener = handler;
    }

    onTimeAttempt(handler: (time: number) => void): void {
        this.timeAttemptListener = handler;
    }

    onSugarCoinsEarned(handler: (amount: number) => void): void {
        this.sugarCoinListener = handler;
    }

    onPowerupInventoryChange(handler: (inventory: PowerupInventory) => void): void {
        this.powerups.setPowerupInventoryListener(handler);
    }

    setPowerupInventory(inventory: PowerupInventory): void {
        this.powerups.setPowerupInventory(inventory);
    }

    showLeaderboard(options: LeaderboardStateOptions): void {
        this.stop();
        if (this.leaderboardState) {
            this.leaderboardState.update(options);
        } else {
            this.leaderboardState = new LeaderboardState(options);
        }
        this.switchMode(this.leaderboardState);
    }

    closeOptions(): void {
        this.hud.closeOptions();
    }

    private switchMode(modeState: GameModeState): void {
        if (this.modeState) {
            this.modeState.exit(this);
        }
        this.modeState = modeState;
        this.state = this.modeState.enter(this);
        this.currentGameMode = this.state.mode;
        this.powerups.applyInventoryToState();
        this.multiplierTracker.setState(this.state);
        this.renderer.setGameMode(this.state.mode);
        this.refreshGoalDescriptions();
        this.updateCellShapeMode(this.cellShapeMode);
    }

    updateHud(state: GameState = this.state): void {
        this.hud.render(state);
    }

    handleLocaleChange(locale: Locale): void {
        this.hud.setLanguage(locale);
        this.hud.applyLocale();
        this.refreshGoalDescriptions();
        this.updateHud();
        this.hud.resetStatus();
    }

    private refreshGoalDescriptions(): void {
        if (!this.state) return;
        this.state.goals = this.state.goals.map((goal) => ({
            ...goal,
            description: describeGoal(goal)
        }));
    }

    private updateCellShapeMode(mode: CellShapeMode): void {
        this.cellShapeMode = mode;
        if (this.state) {
            this.state.cellShapeMode = mode;
        }
        this.renderer.setCellShapesEnabled(mode === 'shaped');
        this.hud.setCellShapeMode(mode);
        if (this.board.getCells().length > 0) {
            this.renderer.refreshBoard(this.board);
        }
        this.updateHud();
    }

    private syncPowerupToolbarLock(): void {
        this.hud.setPowerupToolbarBlocked(
            this.boardAnimating || this.multiplierTracker.isMoveActive() || this.powerups.isInProgress()
        );
    }

    private createBoard(): void {
        this.generation++;
        this.clearPendingTimers();
        this.resetHintState();
        this.boardAnimating = true;
        this.syncPowerupToolbarLock();
        document.body.classList.add('match-app--playing');
        const boardConfig = this.modeState.getBoardConfig();
        this.board.create(boardConfig);
        if ('getBackground' in this.modeState && typeof this.modeState.getBackground === 'function') {
            this.renderer.setBackground(this.modeState.getBackground());
        }
        this.renderer.renderBoard(
            this.board,
            (index) => this.handleCellClick(index),
            (index, direction) => this.handleCellSwipe(index, direction)
        );
        this.renderer.setRecordingButtonVisible(false);
        this.recordingAvailable = false;
        this.closeRecordingState();
        this.snapshotRecorder.reset();
        this.clearPendingSnapshotMoves();
        this.autoLimitExceeded = false;
        this.captureSnapshot(null);
        this.generator.reset();
        if (this.modeState.onBoardCreated) {
            this.modeState.onBoardCreated(this.state, this);
        }
        this.resetMoveTracking();
        this.renderer.renderMultiplierStatus(this.state.comboMultiplier, 0, 0);
        this.updateHud();
        this.updateRecordingLock(true);
        this.animateBoardEntry();
    }

    ensurePlayableBoard(boardConfig: BoardConfig): void {
        let attempts = 0;
        while (!this.hasAnyValidMove() && attempts < 5) {
            this.board.create(boardConfig);
            attempts++;
        }
    }

    shuffleBoardWithNotice(message: string): void {
        if (this.boardAnimating || this.powerups.isInProgress()) return;
        if (!this.rearrangeBoardColors()) return;
        this.renderer.showShuffleNotice(message);
        this.defer(() => this.checkMatches(), this.getAnimationDelay(150));
    }

    private handleCellClick(index: number): void {
        if (this.boardAnimating) return;
        if (this.powerups.handleCellSelection(index)) return;
        if (this.powerups.isInProgress()) return;
        if (this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        this.resetHintState();

        const booster = this.board.getCellBooster(index);
        if (booster === BOOSTERS.BURST_LARGE) {
            this.activateBooster(index, true);
            return;
        }

        if (this.state.selected === null) {
            this.state.selected = index;
            this.renderer.selectCell(index);
            return;
        }

        if (index === this.state.selected) {
            this.renderer.clearSelection();
            this.state.selected = null;
            this.scheduleHint();
            return;
        }

        if (this.state.selected !== null && !this.areAdjacent(this.state.selected, index)) {
            this.showInvalidMove(this.state.selected);
            this.renderer.clearSelection();
            this.state.selected = index;
            this.renderer.selectCell(index);
            return;
        }

        const firstSelected = this.state.selected;
        this.renderer.clearSelection();
        this.state.selected = null;
        this.trySwap(firstSelected, index);
    }

    private handleCellSwipe(index: number, direction: SwipeDirection): void {
        if (this.boardAnimating) return;
        if (this.powerups.hasPendingPowerup()) return;
        if (this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        this.resetHintState();
        const neighbor = this.getNeighbor(index, direction);
        if (!neighbor) return;
        if (this.state.selected) {
            this.renderer.clearSelection();
            this.state.selected = null;
        }
        this.trySwap(index, neighbor);
    }

    private handleTacticalPowerup(type: TacticalPowerup): void {
        if (this.boardAnimating || this.multiplierTracker.isMoveActive()) return;
        if (!this.modeState.canStartMove(this.state)) return;
        const result = this.powerups.handleTacticalPowerup(type);
        if (result === 'canceled') {
            this.scheduleHint();
        }
    }

    private findMatches(): MatchResult {
        return this.matchFlow.findMatches();
    }

    private checkMatches(): void {
        this.matchFlow.checkMatches();
        this.matchContext.swap = null;
    }

    private setMatchSwap(swap: { cellA: number; cellB: number } | null): void {
        this.matchContext.swap = swap;
    }

    private activateBooster(index: number, consumesMove: boolean, override?: BoosterActivationOverride): void {
        const { row, col } = this.getRowCol(index);
        const booster = override?.booster ?? this.board.getCellBooster(index);
        if (booster === BOOSTERS.NONE) return;
        this.modeState.handleBoosterUsed(this.state, booster, this);

        if (consumesMove) {
            this.modeState.consumeMove(this.state);
            this.beginMove();
        }

        this.bomb.applyBoosterEffect(booster, row, col, this.state.mode === 'blocker', override?.orientation);

        if (consumesMove) {
            this.defer(() => this.dropCells(), this.getAnimationDelay(300));
        } else {
            this.defer(() => this.dropCells(), this.getAnimationDelay(300));
        }
        this.updateHud();
    }

    private handleBombDestruction(indices: Iterable<number>, sourceIndex?: number): void {
        const boosters: ChainBoosterInfo[] = [];
        const seen = new Set<number>();
        for (const index of indices) {
            if (index === sourceIndex || seen.has(index)) continue;
            seen.add(index);
            const booster = this.board.getCellBooster(index);
            if (booster === BOOSTERS.NONE) continue;
            const orientation =
                booster === BOOSTERS.LINE ? this.board.getLineOrientation(index) ?? 'horizontal' : undefined;
            const entry: ChainBoosterInfo = { index, booster };
            if (orientation) {
                entry.orientation = orientation;
            }
            boosters.push(entry);
        }
        this.candie.destroyCells(indices);
        if (boosters.length === 0) {
            return;
        }
        const immediate = boosters.filter((info) => info.booster !== BOOSTERS.BURST_LARGE);
        const large = boosters.filter((info) => info.booster === BOOSTERS.BURST_LARGE);
        immediate.forEach((info, offset) => this.scheduleChainBoosterActivation(info, 200, offset));
        const nextOffset = immediate.length;
        large.forEach((info, offset) =>
            this.scheduleChainBoosterActivation(info, 360, nextOffset + offset)
        );
    }

    private scheduleChainBoosterActivation(info: ChainBoosterInfo, baseDelay: number, offset: number): void {
        this.defer(() => {
            const override: BoosterActivationOverride = { booster: info.booster };
            if (info.orientation) {
                override.orientation = info.orientation;
            }
            this.activateBooster(info.index, false, override);
        }, this.getAnimationDelay(baseDelay + offset * 30));
    }

    private rearrangeBoardColors(): boolean {
        const candidateIndices: number[] = [];
        const colors: string[] = [];
        for (let index = 0; index < GRID_SIZE * GRID_SIZE; index++) {
            if (this.board.isBlockedIndex(index)) continue;
            if (this.board.isBlockerGenerator(index)) continue;
            const color = this.board.getCellColor(index);
            if (!color) continue;
            candidateIndices.push(index);
            colors.push(color);
        }
        if (colors.length === 0) {
            return false;
        }
        this.shuffleArray(colors);
        candidateIndices.forEach((index, idx) => {
            const color = colors[idx];
            if (!color) return;
            this.board.setCellColor(index, color);
        });
        this.renderer.refreshBoard(this.board);
        return true;
    }

    private shuffleArray<T>(items: T[]): void {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = items[i];
            const candidate = items[j];
            if (temp === undefined || candidate === undefined) {
                continue;
            }
            items[i] = candidate;
            items[j] = temp;
        }
    }

    private shouldSpawnBombFromDrop(): boolean {
        const normalizedMultiplier = Math.min(Math.max(this.state.comboMultiplier, 0), this.maxMultiplier);
        const chance = (normalizedMultiplier / this.maxMultiplier) * this.maxBombDropChance;
        return Math.random() < chance;
    }

    private shouldSpawnHardCandy(): boolean {
        return this.modeState.shouldSpawnHardCandy(this.state);
    }

    private dropCells(): void {
        for (let col = 0; col < GRID_SIZE; col++) {
            const emptyIndices = this.board.collapseColumn(col);
            emptyIndices.forEach((index) => {
                if (this.board.trySpawnSugarChest(index)) return;
                const spawnHardCandy = this.shouldSpawnHardCandy();
                if (this.shouldSpawnBombFromDrop()) {
                    this.bomb.spawnFallingBomb(index);
                    this.board.setHardCandy(index, false);
                } else {
                    this.board.setCellColor(index, randomColor());
                    this.board.setBooster(index, BOOSTERS.NONE);
                    this.board.setHardCandy(index, spawnHardCandy);
                }
            });
        }
        this.renderer.refreshBoard(this.board);
        this.captureSnapshot();
        this.defer(() => {
            this.setMatchSwap(null);
            this.checkMatches();
        }, this.getAnimationDelay(200));
    }

    private areAdjacent(aIndex: number, bIndex: number): boolean {
        const { row: aRow, col: aCol } = this.getRowCol(aIndex);
        const { row: bRow, col: bCol } = this.getRowCol(bIndex);
        return Math.abs(aRow - bRow) + Math.abs(aCol - bCol) === 1;
    }

    private getNeighbor(index: number, direction: SwipeDirection): number | null {
        const { row, col } = this.getRowCol(index);
        let targetRow = row;
        let targetCol = col;
        if (direction === 'up') targetRow--;
        if (direction === 'down') targetRow++;
        if (direction === 'left') targetCol--;
        if (direction === 'right') targetCol++;
        if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) return null;
        const targetIndex = targetRow * GRID_SIZE + targetCol;
        if (this.board.isBlockedIndex(targetIndex)) return null;
        return targetIndex;
    }

    private trySwap(firstIndex: number, secondIndex: number): void {
        this.resetHintState();
        const firstIsLocked =
            this.board.isBlockedCell(firstIndex) ||
            this.board.isHardCandy(firstIndex) ||
            this.board.isBlockerGenerator(firstIndex);
        const secondIsLocked =
            this.board.isBlockedCell(secondIndex) ||
            this.board.isHardCandy(secondIndex) ||
            this.board.isBlockerGenerator(secondIndex);
        if (firstIsLocked || secondIsLocked) {
            this.showInvalidMove(firstIsLocked ? firstIndex : secondIndex);
            return;
        }
        if (!this.areAdjacent(firstIndex, secondIndex)) {
            this.showInvalidMove(secondIndex);
            return;
        }
        this.board.swapCells(firstIndex, secondIndex);
        this.renderer.refreshBoard(this.board);
        if (this.tryHandleBombCombination(firstIndex, secondIndex)) {
            return;
        }
        const { matched } = this.findMatches();
        if (matched.size === 0) {
            this.board.swapCells(firstIndex, secondIndex);
            this.renderer.refreshBoard(this.board);
            this.resetMoveTracking();
            this.showInvalidMove(secondIndex);
            this.scheduleHint();
            return;
        }
        this.autoLimitExceeded = false;
        this.snapshotRecorder.beginManualSequence();
        this.clearPendingSnapshotMoves();
        this.setMatchSwap({ cellA: firstIndex, cellB: secondIndex });
        this.modeState.consumeMove(this.state);
        this.beginMove();
        this.updateHud();
        this.defer(() => this.checkMatches(), this.getAnimationDelay(120));
    }

    private tryHandleBombCombination(firstIndex: number, secondIndex: number): boolean {
        const firstInfo = this.getBombInfo(firstIndex);
        const secondInfo = this.getBombInfo(secondIndex);
        if (!firstInfo || !secondInfo) {
            return false;
        }
        this.modeState.consumeMove(this.state);
        this.beginMove();
        this.updateHud();
        this.sounds.play('radiusBomb');
        if (!this.performanceMode) {
            this.renderer.screenShake();
        }
        this.bomb.combineBombs([firstInfo, secondInfo], this.state.mode === 'blocker');
        this.defer(() => this.dropCells(), this.getAnimationDelay(300));
        return true;
    }

    private getBombInfo(
        index: number
    ): { row: number; col: number; booster: BoosterType; orientation?: LineOrientation } | null {
        const booster = this.board.getCellBooster(index);
        if (!this.isBombBooster(booster)) {
            return null;
        }
        const { row, col } = this.getRowCol(index);
        const info: { row: number; col: number; booster: BoosterType; orientation?: LineOrientation } = {
            row,
            col,
            booster
        };
        if (booster === BOOSTERS.LINE) {
            info.orientation = this.board.getLineOrientation(index) ?? 'horizontal';
        }
        return info;
    }

    private isBombBooster(booster: BoosterType): boolean {
        return (
            booster === BOOSTERS.LINE ||
            booster === BOOSTERS.BURST_SMALL ||
            booster === BOOSTERS.BURST_MEDIUM ||
            booster === BOOSTERS.BURST_LARGE
        );
    }

    private defer(callback: () => void, delay: number): void {
        const gen = this.generation;
        const timerId = setTimeout(() => {
            if (this.generation !== gen) return;
            callback();
        }, delay);
        this.pendingTimers.push(timerId);
    }

    private clearPendingTimers(): void {
        this.pendingTimers.forEach((id) => clearTimeout(id));
        this.pendingTimers = [];
    }

    private showInvalidMove(index: number): void {
        this.renderer.showInvalidMove(index);
        this.defer(() => this.renderer.clearInvalidMove(index), this.getAnimationDelay(350));
    }

    finishLevel(result: 'win' | 'lose', completedLevel: number): void {
        this.updateRecordingLock(false);
        this.showRecordingButtonIfAvailable();
        const rawNextLevel = result === 'win' ? completedLevel + 1 : completedLevel;
        const nextLevel = Math.min(rawNextLevel, LEVELS.length);
        if (result === 'win') {
            this.sounds.play('levelUp');
            this.notifyProgress(nextLevel);
            this.notifyLevelAttempt(completedLevel);
        } else {
            this.sounds.play('levelFail');
        }
        const title =
            result === 'win'
                ? t('result.level.winTitle', { level: completedLevel })
                : t('result.level.loseTitle');
        const hasMoreLevels = nextLevel > completedLevel;
        const text =
            result === 'win'
                ? hasMoreLevels
                    ? t('result.level.winNext', { level: nextLevel })
                    : t('result.level.winAll', { count: LEVELS.length })
                : t('result.level.loseText');
        const showResultModal = (): void => {
            this.renderer.showModal({
                title,
                text,
                buttonText: t('button.continue'),
                secondaryButtonText: t('button.candyWorld'),
                onSecondary: () => this.requestLevelSelect(),
                onClose: () => {
                    this.switchMode(new LevelModeState(nextLevel));
                    this.createBoard();
                }
            });
        };
        const postScene =
            result === 'win' ? this.findStoryCutscene(completedLevel, 'after') : undefined;
        if (postScene) {
            void this.cutsceneManager.play(this.toCutsceneScene(postScene)).then(showResultModal);
            return;
        }
        showResultModal();
    }

    private findStoryCutscene(level: number, timing: StoryTiming): StoryCutsceneDefinition | undefined {
        return STORY_CUTSCENES.find((scene) => scene.level === level && scene.timing === timing);
    }

    finishBlockerRun(finalScore: number, bestScore: number): void {
        this.updateRecordingLock(false);
        this.showRecordingButtonIfAvailable();
        this.sounds.play('levelFail');
        this.notifyBlockerAttempt(finalScore);
        const isNewBest = finalScore >= bestScore;
        const title = isNewBest ? t('result.blocker.newHighscore') : t('result.blocker.gameOver');
        const text = t('result.blocker.text', { score: finalScore, best: bestScore });
        this.renderer.showModal({
            title,
            text,
            buttonText: t('button.restart'),
            secondaryButtonText: t('button.home'),
            onSecondary: () => this.requestExitGame(),
            onClose: () => {
                this.switchMode(new BlockerModeState(bestScore));
                this.createBoard();
            }
        });
    }

    finishTimeRun(finalTime: number, bestTime: number): void {
        this.updateRecordingLock(false);
        this.showRecordingButtonIfAvailable();
        this.sounds.play('levelFail');
        this.notifyTimeAttempt(finalTime);
        const isNewBest = finalTime >= bestTime;
        const finalLabel = this.formatTime(Math.max(0, finalTime));
        const bestLabel = this.formatTime(Math.max(0, bestTime));
        const title = isNewBest ? t('result.time.newBest') : t('result.time.timeUp');
        const text = t('result.time.text', { survived: finalLabel, best: bestLabel });
        this.renderer.showModal({
            title,
            text,
            buttonText: t('button.restart'),
            secondaryButtonText: t('button.home'),
            onSecondary: () => this.requestExitGame(),
            onClose: () => {
                this.switchMode(new TimeModeState(bestTime));
                this.createBoard();
            }
        });
    }

    private requestExitGame(): void {
        this.exitGameListener?.();
    }

    private requestLevelSelect(): void {
        this.levelSelectListener?.();
    }

    private awardScore(basePoints: number): void {
        this.multiplierTracker.awardScore(basePoints, (points) => {
            if (this.modeState.handleScoreAwarded) {
                this.modeState.handleScoreAwarded(this.state, points, this);
            }
        });
    }

    private beginMove(): void {
        this.resetHintState();
        this.multiplierTracker.beginMove();
        this.syncPowerupToolbarLock();
    }

    private resetMoveTracking(): void {
        this.multiplierTracker.resetMove();
        this.syncPowerupToolbarLock();
    }

    private finalizeMoveScore(): void {
        if (!this.multiplierTracker.finalizeMoveScore()) return;
        this.syncPowerupToolbarLock();
        this.generator.advanceMove();
        this.updateHud();
        this.modeState.handleMoveResolved(this.state, this);
        this.modeState.checkForCompletion(this.state, this);
    }

    private hardenRandomCells(amount: number): void {
        this.hardCandy.hardenRandomCells(amount);
    }

    private indexAt(row: number, col: number): number {
        return row * GRID_SIZE + col;
    }

    private getAdjacentIndices(row: number, col: number): number[] {
        return [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 }
        ]
            .filter((pos) => pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE)
            .map((pos) => this.indexAt(pos.row, pos.col));
    }

    hasAnyValidMove(): boolean {
        return this.matchScanner.hasAnyValidMove();
    }

    private scheduleHint(): void {
        this.hintManager.schedule();
    }

    private canScheduleHint(): boolean {
        if (this.boardAnimating) return false;
        if (this.multiplierTracker.isMoveActive()) return false;
        if (this.powerups.hasPendingPowerup()) return false;
        if (this.powerups.isInProgress()) return false;
        if (this.state.selected !== null) return false;
        if (this.renderer.isModalVisible()) return false;
        return true;
    }

    private resetHintState(): void {
        this.hintManager.reset();
    }

    private animateBoardEntry(): void {
        const duration = this.renderer.playSpawnAnimation();
        this.defer(() => {
            this.boardAnimating = false;
            this.syncPowerupToolbarLock();
            this.scheduleHint();
        }, this.getAnimationDelay(duration));
    }

    private setPerformanceMode(enabled: boolean): void {
        this.performanceMode = enabled;
        this.hud.setPerformanceModeEnabled(enabled);
        this.renderer.setAnimationsEnabled(!enabled);
        this.savePerformanceModeSetting(enabled);
    }

    private savePerformanceModeSetting(enabled: boolean): void {
        try {
            window.localStorage.setItem(this.performanceModeStorageKey, enabled ? 'true' : 'false');
        } catch {
            // ignore quota or permission issues
        }
    }

    private loadPerformanceModeSetting(): boolean {
        try {
            return window.localStorage.getItem(this.performanceModeStorageKey) === 'true';
        } catch {
            return false;
        }
    }

    private setRecordingEnabled(enabled: boolean): void {
        if (enabled && this.gameActive) {
            this.hud.setRecordingEnabled(false);
            return;
        }
        if (this.recordingEnabled === enabled) return;
        this.recordingEnabled = enabled;
        this.stopRecordingAutoPlay();
        this.recordingHistory = [];
        this.recordingIndex = 0;
        this.recordingAvailable = false;
        this.renderer.setRecordingButtonVisible(false);
        this.snapshotRecorder.reset();
        this.clearPendingSnapshotMoves();
        this.autoLimitExceeded = false;
    }

    private updateRecordingLock(active: boolean): void {
        this.gameActive = active;
        this.hud.setRecordingToggleLocked(active);
    }

    private getAnimationDelay(duration: number): number {
        if (duration <= 0) return 0;
        if (!this.performanceMode) return duration;
        return Math.max(0, Math.round(duration * 0.35));
    }

    private initRecordingView(): void {
        this.recordingOverlay = getRequiredElement('recording-state');
        this.recordingBoard = getRequiredElement('recording-board');
        this.recordingProgress = getRequiredElement('recording-progress');
        this.recordingDescription = getRequiredElement('recording-description');
        this.recordingPrevButton = getRequiredElement('recording-prev');
        this.recordingNextButton = getRequiredElement('recording-next');
        this.recordingAutoButton = getRequiredElement('recording-auto');
        this.recordingCloseButton = getRequiredElement('recording-close');
        this.recordingLabelsToggle = getRequiredElement('recording-labels-toggle') as HTMLButtonElement;
        this.recordingAxisToggle = getRequiredElement('recording-axis-toggle') as HTMLButtonElement;
        this.recordingBoardWrapper = getRequiredElement('recording-board-wrapper');
        this.recordingColumnLabels = getRequiredElement('recording-column-labels');
        this.recordingRowLabels = getRequiredElement('recording-row-labels');
        this.recordingPrevButton.addEventListener('click', () => this.advanceRecordingIndex(-1));
        this.recordingNextButton.addEventListener('click', () => this.advanceRecordingIndex(1));
        this.recordingAutoButton.addEventListener('click', () => this.toggleRecordingAutoPlay());
        this.recordingCloseButton.addEventListener('click', () => this.closeRecordingState());
        this.recordingLabelsToggle.addEventListener('click', () => this.toggleRecordingLabels());
        this.recordingAxisToggle.addEventListener('click', () => this.toggleRecordingAxis());
        this.recordingOverlay.addEventListener('click', (event) => {
            if (event.target === this.recordingOverlay) {
                this.closeRecordingState();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.recordingOverlay.hasAttribute('hidden')) {
                this.closeRecordingState();
            }
        });
        this.recordingBoard.innerHTML = '';
        this.recordingCells.length = 0;
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'recording-state__cell';
            this.recordingBoard.appendChild(cell);
            this.recordingCells.push(cell);
        }
    }

    private openRecordingState(): void {
        if (!this.recordingEnabled) return;
        const history = this.snapshotRecorder.getHistory();
        if (history.length === 0) {
            this.recordingAvailable = false;
            this.renderer.setRecordingButtonVisible(false);
            return;
        }
        this.recordingHistory = history;
        this.recordingIndex = 0;
        this.stopRecordingAutoPlay();
        this.recordingOverlay.removeAttribute('hidden');
        this.recordingCloseButton.focus();
        this.renderRecordingSnapshot();
    }

    private closeRecordingState(): void {
        if (this.recordingOverlay.hasAttribute('hidden')) return;
        this.recordingOverlay.setAttribute('hidden', 'true');
        this.stopRecordingAutoPlay();
    }

    private advanceRecordingIndex(delta: number): void {
        if (this.recordingHistory.length === 0) return;
        this.stopRecordingAutoPlay();
        const nextIndex = Math.max(
            0,
            Math.min(this.recordingHistory.length - 1, this.recordingIndex + delta)
        );
        if (nextIndex === this.recordingIndex) return;
        this.recordingIndex = nextIndex;
        this.renderRecordingSnapshot();
    }

    private toggleRecordingAutoPlay(): void {
        if (this.recordingAutoPlay) {
            this.stopRecordingAutoPlay();
        } else {
            this.startRecordingAutoPlay();
        }
    }

    private startRecordingAutoPlay(): void {
        if (this.recordingHistory.length <= 1) return;
        this.stopRecordingAutoPlay();
        this.recordingAutoPlay = true;
        this.recordingAutoButton.textContent = 'Pause';
        this.recordingAutoTimer = window.setInterval(() => {
            if (this.recordingIndex >= this.recordingHistory.length - 1) {
                this.stopRecordingAutoPlay();
                return;
            }
            this.recordingIndex++;
            this.renderRecordingSnapshot();
            if (this.recordingIndex >= this.recordingHistory.length - 1) {
                this.stopRecordingAutoPlay();
            }
        }, 650);
    }

    private stopRecordingAutoPlay(): void {
        if (this.recordingAutoTimer !== null) {
            clearInterval(this.recordingAutoTimer);
            this.recordingAutoTimer = null;
        }
        this.recordingAutoPlay = false;
        this.recordingAutoButton.textContent = 'Auto play';
    }

    private toggleRecordingLabels(): void {
        this.recordingShowLabels = !this.recordingShowLabels;
        this.recordingLabelsToggle.textContent = this.recordingShowLabels ? 'Show board' : 'Show cell labels';
        this.recordingLabelsToggle.classList.toggle('recording-state__toggle--active', this.recordingShowLabels);
        this.renderRecordingSnapshot();
    }

    private toggleRecordingAxis(): void {
        this.recordingShowAxis = !this.recordingShowAxis;
        this.recordingAxisToggle.textContent = this.recordingShowAxis ? 'Hide axis labels' : 'Show axis labels';
        this.recordingAxisToggle.classList.toggle('recording-state__toggle--active', this.recordingShowAxis);
        this.recordingBoardWrapper.classList.toggle('recording-state__board-wrapper--no-axis', !this.recordingShowAxis);
        this.recordingColumnLabels.classList.toggle('recording-state__column-labels--hidden', !this.recordingShowAxis);
        this.recordingRowLabels.classList.toggle('recording-state__row-labels--hidden', !this.recordingShowAxis);
    }

    private renderRecordingSnapshot(): void {
        const snapshot = this.recordingHistory[this.recordingIndex];
        if (!snapshot) {
            this.recordingProgress.textContent = '';
            this.recordingDescription.textContent = '';
            return;
        }
        const highlightIndices = this.buildHighlightIndices(snapshot);
        const swapIndices = this.buildSwapIndices(snapshot);
        this.recordingCells.forEach((cell, idx) => {
            const state = snapshot.board[idx];
            cell.classList.remove(
                'recording-state__cell--sugar-chest',
                'recording-state__cell--hard',
                'recording-state__cell--swap'
            );
            cell.style.removeProperty('--recording-sugar-chest-image');
            cell.style.removeProperty('--recording-cell-color');

            if (this.recordingShowLabels) {
                this.renderCellLabel(cell, idx);
                cell.classList.remove('recording-state__cell--highlight');
                return;
            }

            if (!state) {
                cell.style.backgroundColor = RECORDING_COLOR_HEX.none;
                cell.textContent = '';
                cell.classList.remove('recording-state__cell--highlight');
                return;
            }
            if (state.sugarChest !== 'none') {
                const stageIndex = String(state.sugarChest + 1).padStart(2, '0');
                cell.classList.add('recording-state__cell--sugar-chest');
                cell.style.setProperty(
                    '--recording-sugar-chest-image',
                    `url(/assets/images/sugar-chest-${stageIndex}.png)`
                );
                cell.style.backgroundColor = 'transparent';
                cell.textContent = '';
            } else {
                const color = RECORDING_COLOR_HEX[state.color] ?? RECORDING_COLOR_HEX.none;
                const isHardCandy = state.hard && state.bomb === 'none' && !state.generator;
                if (isHardCandy) {
                    cell.classList.add('recording-state__cell--hard');
                    cell.style.setProperty('--recording-cell-color', color);
                    cell.style.removeProperty('background-color');
                    cell.textContent = '';
                } else {
                    cell.style.backgroundColor = color;
                    this.renderCellIcon(cell, state);
                }
            }
            cell.classList.toggle('recording-state__cell--highlight', highlightIndices.has(idx));
            cell.classList.toggle('recording-state__cell--swap', swapIndices.has(idx));
        });
        this.recordingProgress.textContent = `Snapshot ${this.recordingIndex + 1} / ${this.recordingHistory.length}`;
        this.recordingDescription.textContent = this.describeSnapshot(snapshot);
        this.recordingPrevButton.disabled = this.recordingIndex === 0;
        this.recordingNextButton.disabled = this.recordingIndex >= this.recordingHistory.length - 1;
    }

    private describeSnapshot(snapshot: Snapshot): string {
        if (!snapshot.move) {
            return 'Initial board';
        }
        if (snapshot.move.kind === 'match') {
            const matchType = snapshot.move.matchType === 'manuell' ? 'Manual match' : 'Auto match';
            const swapInfo = snapshot.move.swap
                ? ` · swapped ${this.describePosition(snapshot.move.swap.cellA)} + ${this.describePosition(
                      snapshot.move.swap.cellB
                  )}`
                : '';
            return `${matchType} · ${snapshot.move.cells.length} tiles matched${swapInfo}`;
        }
        const label =
            snapshot.move.powerupType === 'shuffle'
                ? 'Shuffle powerup'
                : snapshot.move.powerupType === 'swap'
                ? 'Swap powerup'
                : 'Bomb powerup';
        if (snapshot.move.coordinates && snapshot.move.coordinates.length > 0) {
            const coords = snapshot.move.coordinates.map((position) => this.describePosition(position));
            return `${label} · ${coords.join(' + ')}`;
        }
        return label;
    }

    private describePosition(position: Position): string {
        const columnLetter = String.fromCharCode(65 + position.x);
        const rowNumber = position.y + 1;
        return `${columnLetter}${rowNumber}`;
    }

    private buildHighlightIndices(snapshot: Snapshot): Set<number> {
        const highlighted = new Set<number>();
        if (snapshot.move?.kind === 'match') {
            snapshot.move.cells.forEach((pos) => {
                highlighted.add(pos.y * GRID_SIZE + pos.x);
            });
            if (snapshot.move.swap) {
                highlighted.add(snapshot.move.swap.cellA.y * GRID_SIZE + snapshot.move.swap.cellA.x);
                highlighted.add(snapshot.move.swap.cellB.y * GRID_SIZE + snapshot.move.swap.cellB.x);
            }
        } else if (snapshot.move?.kind === 'powerup' && snapshot.move.coordinates) {
            snapshot.move.coordinates.forEach((pos) => {
                highlighted.add(pos.y * GRID_SIZE + pos.x);
            });
        }
        return highlighted;
    }

    private buildSwapIndices(snapshot: Snapshot): Set<number> {
        const swapIndices = new Set<number>();
        if (snapshot.move?.kind === 'match' && snapshot.move.swap) {
            swapIndices.add(snapshot.move.swap.cellA.y * GRID_SIZE + snapshot.move.swap.cellA.x);
            swapIndices.add(snapshot.move.swap.cellB.y * GRID_SIZE + snapshot.move.swap.cellB.x);
        } else if (
            snapshot.move?.kind === 'powerup' &&
            snapshot.move.powerupType === 'swap' &&
            snapshot.move.coordinates
        ) {
            snapshot.move.coordinates.forEach((pos) => {
                swapIndices.add(pos.y * GRID_SIZE + pos.x);
            });
        }
        return swapIndices;
    }

    private renderCellIcon(cell: HTMLElement, state: SnapshotCell): void {
        cell.textContent = '';
        if (state.bomb !== 'none') {
            const icons = RECORDING_BOMB_ICONS[state.bomb];
            if (icons.center) {
                const centerSpan = document.createElement('span');
                centerSpan.className = 'recording-state__bomb-center';
                centerSpan.textContent = icons.center;
                cell.appendChild(centerSpan);
            }
            if (icons.corner) {
                const cornerSpan = document.createElement('span');
                cornerSpan.className = 'recording-state__bomb-corner';
                cornerSpan.textContent = icons.corner;
                cell.appendChild(cornerSpan);
            }
            return;
        }
        if (state.generator) {
            cell.textContent = '⚙️';
        }
    }

    private renderCellLabel(cell: HTMLElement, index: number): void {
        const { row, col } = this.getRowCol(index);
        const columnLetter = String.fromCharCode(65 + col);
        const rowNumber = row + 1;
        cell.textContent = '';
        cell.style.backgroundColor = '#1e2444';
        const label = document.createElement('span');
        label.className = 'recording-state__cell-label';
        label.textContent = `${columnLetter}${rowNumber}`;
        cell.appendChild(label);
    }

    private getRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / GRID_SIZE),
            col: index % GRID_SIZE
        };
    }

    private handleMatchesDetected(result: MatchResult, context: MatchContext): void {
        if (result.matched.size === 0) return;
        const cells = this.buildMatchCells(result);
        const swap =
            context.swap !== null
                ? {
                      cellA: this.getCellPosition(context.swap.cellA),
                      cellB: this.getCellPosition(context.swap.cellB)
                  }
                : null;
        const matchType = context.swap ? 'manuell' : 'auto';
        const move: SnapshotMatchMove = {
            kind: 'match',
            matchType,
            cells,
            swap
        };
        this.enqueuePendingSnapshotMove(move);
        if (matchType === 'manuell') {
            this.autoLimitExceeded = false;
            this.snapshotRecorder.beginManualSequence();
        }
    }

    private buildMatchCells(result: MatchResult): Position[] {
        const matchedIndices = Array.from(result.matched);
        if (matchedIndices.length === 0) return [];

        const squareIndices = this.collectBurstSmallIndices(result);
        if (squareIndices.size === 0) {
            return matchedIndices.map((index) => this.getCellPosition(index));
        }

        const extraIndices = matchedIndices.filter((index) => !squareIndices.has(index));
        if (extraIndices.length > 0 && extraIndices.length < 3) {
            return Array.from(squareIndices).map((index) => this.getCellPosition(index));
        }

        const combined = new Set<number>(squareIndices);
        extraIndices.forEach((index) => combined.add(index));
        return Array.from(combined).map((index) => this.getCellPosition(index));
    }

    private collectBurstSmallIndices(result: MatchResult): Set<number> {
        const squareIndices = new Set<number>();
        result.boostersToCreate.forEach((creation) => {
            if (creation.type !== BOOSTERS.BURST_SMALL) return;
            const { row, col } = this.getRowCol(creation.index);
            for (let rowOffset = 0; rowOffset <= 1; rowOffset++) {
                for (let colOffset = 0; colOffset <= 1; colOffset++) {
                    const cellRow = row + rowOffset;
                    const cellCol = col + colOffset;
                    if (cellRow >= GRID_SIZE || cellCol >= GRID_SIZE) continue;
                    squareIndices.add(this.indexAt(cellRow, cellCol));
                }
            }
        });
        return squareIndices;
    }

    private handlePowerupTriggered(usage: SnapshotPowerupUsage): void {
        const move: SnapshotMove = {
            kind: 'powerup',
            powerupType: usage.powerupType,
            coordinates: usage.coordinates
        };
        this.autoLimitExceeded = false;
        this.snapshotRecorder.beginManualSequence();
        if (usage.powerupType === 'shuffle') {
            this.captureSnapshot(move);
            return;
        }
        this.enqueuePendingSnapshotMove(move);
    }

    private enqueuePendingSnapshotMove(move: SnapshotMove): void {
        this.pendingSnapshotMoves.push(move);
    }

    private dequeuePendingSnapshotMove(): SnapshotMove | null {
        return this.pendingSnapshotMoves.shift() ?? null;
    }

    private clearPendingSnapshotMoves(): void {
        this.pendingSnapshotMoves.length = 0;
    }

    private captureSnapshot(move?: SnapshotMove | null): void {
        const moveToRecord = move === undefined ? this.dequeuePendingSnapshotMove() : move;
        if (move === undefined && moveToRecord === null) {
            return;
        }
        this.pushSnapshot(moveToRecord);
    }

    private pushSnapshot(move: SnapshotMove | null): void {
        if (this.autoLimitExceeded || !this.recordingEnabled) return;
        const result = this.snapshotRecorder.recordSnapshot(this.board, move);
        if (result.limitReached) {
            this.autoLimitExceeded = true;
            this.handleAutoLimitReached();
        }
    }

    private showRecordingButtonIfAvailable(): void {
        const shouldShow = this.recordingEnabled && this.snapshotRecorder.getHistory().length > 0;
        this.recordingAvailable = shouldShow;
        this.renderer.setRecordingButtonVisible(shouldShow);
    }

    private handleAutoLimitReached(): void {
        this.updateRecordingLock(false);
        const state = this.state;
        if (!state) return;
        this.showRecordingButtonIfAvailable();
        this.clearPendingTimers();
        if (state.mode === 'blocker') {
            this.finishBlockerRun(state.score, state.bestScore);
            return;
        }
        if (state.mode === 'time') {
            const finalTime = Math.floor(state.survivalTime ?? 0);
            this.finishTimeRun(finalTime, state.bestScore);
            return;
        }
        this.finishLevel('lose', state.level);
    }

    private getCellPosition(index: number): Position {
        const { row, col } = this.getRowCol(index);
        return { x: col, y: row };
    }

    private formatTime(totalSeconds: number): string {
        const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
    }

    getHud(): Hud {
        return this.hud;
    }

    getBoard(): Board {
        return this.board;
    }

    getSounds(): SoundManager {
        return this.sounds;
    }

    hardenCells(amount: number): void {
        this.hardenRandomCells(amount);
    }

    isModalVisible(): boolean {
        return this.renderer.isModalVisible() || this.hud.isOptionsOpen();
    }

    notifyBlockerHighScore(score: number): void {
        if (this.blockerHighScoreListener) {
            this.blockerHighScoreListener(score);
        }
    }

    notifyTimeBest(time: number): void {
        if (this.timeBestListener) {
            this.timeBestListener(time);
        }
    }

    notifyProgress(unlockedLevel: number): void {
        if (this.progressListener) {
            this.progressListener(unlockedLevel);
        }
    }

    private notifyLevelAttempt(level: number): void {
        if (this.levelAttemptListener) {
            this.levelAttemptListener(level);
        }
    }

    private notifyBlockerAttempt(score: number): void {
        if (this.blockerAttemptListener) {
            this.blockerAttemptListener(score);
        }
    }

    private notifyTimeAttempt(time: number): void {
        if (this.timeAttemptListener) {
            this.timeAttemptListener(time);
        }
    }
}

export { Match3Game };

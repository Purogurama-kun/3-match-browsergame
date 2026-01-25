const GRID_SIZE = 8;
const COLORS = ['red', 'amber', 'blue', 'purple', 'green'];
const BOOSTERS = ['line', 'burstSmall', 'burstMedium', 'burstLarge'];
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'nightmare'];
const GOAL_TYPES = ['destroy-color', 'activate-booster', 'destroy-hard-candies'];

const BOARD_TOKENS = [
    { token: '.', label: 'Any', className: 'any', swatch: '#ffffff' },
    { token: 'X', label: 'Missing', className: 'void', swatch: '#3f3f46' },
    { token: 'H', label: 'Hard', className: 'hard', swatch: '#f5d27a' },
    { token: 'T', label: 'Generator', className: 'generator', swatch: '#fca5a5' },
    { token: 'L', label: 'Line bomb', className: 'bomb-line bomb-line-horizontal', swatch: '#fde68a' },
    { token: 'V', label: 'Line bomb vertical', className: 'bomb-line bomb-line-vertical', swatch: '#fde68a' },
    { token: 'S', label: 'Burst small', className: 'bomb-small', swatch: '#86efac' },
    { token: 'M', label: 'Burst medium', className: 'bomb-medium', swatch: '#fdba74' },
    { token: 'U', label: 'Burst large', className: 'bomb-large', swatch: '#67e8f9' },
    { token: '1', label: 'Sugar chest I', className: 'sugar-chest sugar-chest-1', swatch: '#ffffff' },
    { token: '2', label: 'Sugar chest II', className: 'sugar-chest sugar-chest-2', swatch: '#ffffff' },
    { token: '3', label: 'Sugar chest III', className: 'sugar-chest sugar-chest-3', swatch: '#ffffff' },
    { token: 'R', label: 'Red', className: 'red', swatch: '#ff7b7b' },
    { token: 'A', label: 'Amber', className: 'amber', swatch: '#ffd166' },
    { token: 'B', label: 'Blue', className: 'blue', swatch: '#7dd3fc' },
    { token: 'P', label: 'Purple', className: 'purple', swatch: '#a78bfa' },
    { token: 'G', label: 'Green', className: 'green', swatch: '#6ee7b7' }
];

const BOARD_TOKEN_SET = new Set(BOARD_TOKENS.map((entry) => entry.token));
const TOKEN_CLASS_MAP = BOARD_TOKENS.reduce((acc, entry) => {
    acc[entry.token] = entry.className;
    return acc;
}, {});
const COLOR_HEX_TO_TOKEN = {
    '#ff7b7b': 'R',
    '#ffd166': 'A',
    '#7dd3fc': 'B',
    '#a78bfa': 'P',
    '#6ee7b7': 'G'
};

const TOKEN_TO_COLOR = {
    R: '#ff7b7b',
    A: '#ffd166',
    B: '#7dd3fc',
    P: '#a78bfa',
    G: '#6ee7b7'
};

const NATURAL_COLORS = Object.values(TOKEN_TO_COLOR);
const SUGAR_CHEST_STAGE_TO_TOKEN = {
    1: '1',
    2: '2',
    3: '3'
};

const DEFAULT_LEVEL = {
    id: 1,
    moves: 20,
    targetScore: 300,
    difficulty: 'easy',
    goals: [{ type: 'destroy-color', color: 'red', target: 10 }],
    background: ''
};

const state = {
    levels: [],
    selectedIndex: -1,
    fileHandle: null,
    fileName: '',
    dirty: false,
    boardToken: '.',
    boardSync: false
};

const ui = {
    status: document.getElementById('status'),
    openFile: document.getElementById('open-file'),
    loadProject: document.getElementById('load-project'),
    saveFile: document.getElementById('save-file'),
    saveAs: document.getElementById('save-as'),
    addLevel: document.getElementById('add-level'),
    duplicateLevel: document.getElementById('duplicate-level'),
    deleteLevel: document.getElementById('delete-level'),
    moveLevelUp: document.getElementById('move-level-up'),
    moveLevelDown: document.getElementById('move-level-down'),
    renumberLevels: document.getElementById('renumber-levels'),
    levelList: document.getElementById('level-list'),
    levelCount: document.getElementById('level-count'),
    emptyState: document.getElementById('empty-state'),
    levelEditor: document.getElementById('level-editor'),
    levelTitle: document.getElementById('level-title'),
    dirtyIndicator: document.getElementById('dirty-indicator'),
    levelId: document.getElementById('level-id'),
    levelMoves: document.getElementById('level-moves'),
    levelTarget: document.getElementById('level-target'),
    levelTime: document.getElementById('level-time'),
    levelDifficulty: document.getElementById('level-difficulty'),
    levelBackground: document.getElementById('level-background'),
    goals: document.getElementById('goals'),
    addGoal: document.getElementById('add-goal'),
    boardEnabled: document.getElementById('board-enabled'),
    boardPanel: document.getElementById('board-panel'),
    boardPalette: document.getElementById('board-palette'),
    boardGrid: document.getElementById('board-grid'),
    boardRows: document.getElementById('board-rows'),
    clearBoard: document.getElementById('clear-board'),
    fillBoard: document.getElementById('fill-board'),
    fileInput: document.getElementById('file-input')
};

function getErrorMessage(error) {
    if (error instanceof Error) return getErrorMessage(error);
    return String(error);
}

function setStatus(message, isWarn = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle('editor__status--warn', isWarn);
}

function setDirty(isDirty) {
    state.dirty = isDirty;
    ui.dirtyIndicator.textContent = isDirty ? 'Unsaved' : 'Saved';
    ui.dirtyIndicator.classList.toggle('editor__chip--dirty', isDirty);
}

function markDirty() {
    if (!state.dirty) {
        setDirty(true);
    }
}

function normalizeLevelData(level) {
    const normalized = { ...level };
    if (!Array.isArray(normalized.goals)) {
        normalized.goals = [];
    }
    if (typeof normalized.background !== 'string') {
        normalized.background = '';
    }
    return normalized;
}

function loadLevels(levels, fileHandle, fileName) {
    state.levels = levels.map((level) => normalizeLevelData(level));
    state.fileHandle = fileHandle || null;
    state.fileName = fileName || '';
    state.selectedIndex = state.levels.length ? 0 : -1;
    renderLevelList();
    selectLevel(state.selectedIndex);
    setDirty(false);
    const nameLabel = state.fileName ? ` (${state.fileName})` : '';
    setStatus(`Loaded ${state.levels.length} levels${nameLabel}.`);
}

function parseLevelsPayload(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.levels)) {
        throw new Error('The file must contain a "levels" array.');
    }
    return data.levels;
}

function createDefaultLevel() {
    const nextId = Math.max(0, ...state.levels.map((level) => level.id || 0)) + 1;
    return { ...JSON.parse(JSON.stringify(DEFAULT_LEVEL)), id: nextId };
}

function renderLevelList() {
    ui.levelList.innerHTML = '';
    ui.levelCount.textContent = String(state.levels.length);

    state.levels.forEach((level, index) => {
        const item = document.createElement('li');
        item.className = 'editor__level-item' + (index === state.selectedIndex ? ' editor__level-item--active' : '');
        item.addEventListener('click', () => selectLevel(index));

        const id = document.createElement('span');
        id.className = 'editor__level-item-id';
        id.textContent = `#${level.id ?? index + 1}`;

        const meta = document.createElement('span');
        meta.className = 'editor__level-item-meta';
        const moves = typeof level.moves === 'number' ? `${level.moves} moves` : 'no moves';
        const score = typeof level.targetScore === 'number' ? `${level.targetScore} pts` : 'no score';
        meta.textContent = `${moves} · ${score}`;

        item.append(id, meta);
        ui.levelList.appendChild(item);
    });

    ui.emptyState.classList.toggle('editor__panel--hidden', state.levels.length > 0);
    ui.levelEditor.classList.toggle('editor__panel--hidden', state.levels.length === 0);
}

function selectLevel(index) {
    if (index < 0 || index >= state.levels.length) {
        ui.levelEditor.classList.add('editor__panel--hidden');
        ui.emptyState.classList.remove('editor__panel--hidden');
        state.selectedIndex = -1;
        return;
    }
    state.selectedIndex = index;
    renderLevelList();
    renderLevelForm();
}

function renderDifficultyOptions() {
    ui.levelDifficulty.innerHTML = '';
    DIFFICULTIES.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        ui.levelDifficulty.appendChild(option);
    });
}

function renderLevelForm() {
    const level = state.levels[state.selectedIndex];
    if (!level) return;

    ui.levelTitle.textContent = `Level ${level.id ?? state.selectedIndex + 1}`;

    ui.levelId.value = level.id ?? '';
    ui.levelMoves.value = level.moves ?? '';
    ui.levelTarget.value = level.targetScore ?? '';
    ui.levelTime.value = level.timeGoalSeconds ?? '';
    ui.levelDifficulty.value = level.difficulty ?? 'easy';
    ui.levelBackground.value = level.background ?? '';

    ui.boardEnabled.checked = true;
    if (!level.board) {
        level.board = { rows: createBoardRowsFromLevel(level) };
    }
    renderGoals(level);
    renderBoard(level);
}

function updateNumberField(input, setter, { optional = false } = {}) {
    const raw = input.value.trim();
    if (!raw) {
        input.classList.toggle('editor__input--invalid', !optional);
        if (optional) {
            setter(undefined);
            markDirty();
        }
        return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        input.classList.add('editor__input--invalid');
        return;
    }
    input.classList.remove('editor__input--invalid');
    setter(Math.floor(value));
    markDirty();
}

function updateTextField(input, setter) {
    setter(input.value);
    markDirty();
}

function renderGoals(level) {
    ui.goals.innerHTML = '';

    level.goals.forEach((goal, index) => {
        const row = document.createElement('div');
        row.className = 'editor__goal';

        const typeField = document.createElement('label');
        typeField.className = 'editor__field';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'editor__label';
        typeLabel.textContent = 'Type';
        const typeSelect = document.createElement('select');
        typeSelect.className = 'editor__input';
        GOAL_TYPES.forEach((type) => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
        typeSelect.value = goal.type;
        typeSelect.addEventListener('change', () => {
            goal.type = typeSelect.value;
            if (goal.type === 'destroy-color') {
                goal.color = COLORS[0];
                delete goal.booster;
            } else if (goal.type === 'activate-booster') {
                goal.booster = BOOSTERS[0];
                delete goal.color;
            } else {
                delete goal.color;
                delete goal.booster;
            }
            renderGoals(level);
            markDirty();
        });
        typeField.append(typeLabel, typeSelect);

        const targetField = document.createElement('label');
        targetField.className = 'editor__field';
        const targetLabel = document.createElement('span');
        targetLabel.className = 'editor__label';
        targetLabel.textContent = 'Target';
        const targetInput = document.createElement('input');
        targetInput.className = 'editor__input';
        targetInput.type = 'number';
        targetInput.min = '1';
        targetInput.step = '1';
        targetInput.value = goal.target ?? '';
        targetInput.addEventListener('input', () => {
            updateNumberField(targetInput, (value) => {
                goal.target = value ?? goal.target;
            });
        });
        targetField.append(targetLabel, targetInput);

        row.append(typeField);

        if (goal.type === 'destroy-color') {
            const colorField = document.createElement('label');
            colorField.className = 'editor__field';
            const colorLabel = document.createElement('span');
            colorLabel.className = 'editor__label';
            colorLabel.textContent = 'Color';
            const colorSelect = document.createElement('select');
            colorSelect.className = 'editor__input';
            COLORS.forEach((color) => {
                const option = document.createElement('option');
                option.value = color;
                option.textContent = color;
                colorSelect.appendChild(option);
            });
            colorSelect.value = goal.color ?? COLORS[0];
            colorSelect.addEventListener('change', () => {
                goal.color = colorSelect.value;
                markDirty();
            });
            colorField.append(colorLabel, colorSelect);
            row.append(colorField);
        }

        if (goal.type === 'activate-booster') {
            const boosterField = document.createElement('label');
            boosterField.className = 'editor__field';
            const boosterLabel = document.createElement('span');
            boosterLabel.className = 'editor__label';
            boosterLabel.textContent = 'Booster';
            const boosterSelect = document.createElement('select');
            boosterSelect.className = 'editor__input';
            BOOSTERS.forEach((booster) => {
                const option = document.createElement('option');
                option.value = booster;
                option.textContent = booster;
                boosterSelect.appendChild(option);
            });
            boosterSelect.value = goal.booster ?? BOOSTERS[0];
            boosterSelect.addEventListener('change', () => {
                goal.booster = boosterSelect.value;
                markDirty();
            });
            boosterField.append(boosterLabel, boosterSelect);
            row.append(boosterField);
        }

        row.append(targetField);

        const actions = document.createElement('div');
        actions.className = 'editor__goal-actions';
        const removeButton = document.createElement('button');
        removeButton.className = 'editor__button editor__button--ghost';
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            level.goals.splice(index, 1);
            renderGoals(level);
            markDirty();
        });
        actions.appendChild(removeButton);
        row.appendChild(actions);

        ui.goals.appendChild(row);
    });
}

function ensureBoard(level) {
    if (!level.board || !Array.isArray(level.board.rows)) {
        level.board = { rows: createEmptyBoardRows() };
        return;
    }
    level.board.rows = normalizeBoardRows(level.board.rows);
}

function createEmptyBoardRows() {
    return Array.from({ length: GRID_SIZE }, () => '.'.repeat(GRID_SIZE));
}

function createBoardRowsFromLevel(level) {
    const rows = createEmptyBoardRows().map((row) => row.split(''));
    const setToken = (index, token) => {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        if (!rows[row]) return;
        rows[row][col] = token;
    };

    if (Array.isArray(level.cellOverrides)) {
        level.cellOverrides.forEach((override) => {
            if (!override || typeof override.index !== 'number') return;
            if (override.blocked) {
                setToken(override.index, 'X');
                return;
            }
            if (override.sugarChestStage) {
                const token = SUGAR_CHEST_STAGE_TO_TOKEN[override.sugarChestStage];
                if (token) {
                    setToken(override.index, token);
                }
                return;
            }
            if (override.generator) {
                setToken(override.index, 'T');
                return;
            }
            if (override.hard) {
                setToken(override.index, 'H');
                return;
            }
            if (override.booster) {
                if (override.booster === 'line') {
                    setToken(override.index, override.lineOrientation === 'vertical' ? 'V' : 'L');
                } else if (override.booster === 'burstSmall') {
                    setToken(override.index, 'S');
                } else if (override.booster === 'burstMedium') {
                    setToken(override.index, 'M');
                } else if (override.booster === 'burstLarge') {
                    setToken(override.index, 'U');
                }
                return;
            }
            if (override.color) {
                const token = COLOR_HEX_TO_TOKEN[override.color.toLowerCase()];
                if (token) {
                    setToken(override.index, token);
                }
            }
        });
    }

    if (Array.isArray(level.hardCandies)) {
        level.hardCandies.forEach((index) => setToken(index, 'H'));
    }

    if (Array.isArray(level.blockerGenerators)) {
        level.blockerGenerators.forEach((index) => setToken(index, 'T'));
    }

    if (Array.isArray(level.missingCells)) {
        level.missingCells.forEach((index) => setToken(index, 'X'));
    }

    return rows.map((row) => row.join(''));
}

function normalizeBoardRows(rows) {
    return Array.from({ length: GRID_SIZE }, (_, rowIndex) => {
        const raw = typeof rows[rowIndex] === 'string' ? rows[rowIndex] : '';
        const tokens = raw.replace(/\s+/g, '').split('');
        const normalized = [];
        for (let col = 0; col < GRID_SIZE; col += 1) {
            const token = tokens[col] ?? '.';
            normalized.push(BOARD_TOKEN_SET.has(token) ? token : '.');
        }
        return normalized.join('');
    });
}

function renderBoard(level) {
    const enabled = ui.boardEnabled.checked && Boolean(level.board);
    ui.boardPanel.classList.toggle('editor__board--hidden', !enabled);
    if (!enabled) {
        return;
    }
    if (!level.board) {
        level.board = { rows: createBoardRowsFromLevel(level) };
    }
    ensureBoard(level);
    applyBoardBackground(level);
    renderBoardGrid(level.board.rows);
    syncBoardTextarea(level.board.rows);
}

function getTokenDisplay(token) {
    if (token === 'X' || token === '.') return '';
    if (token === 'H') return '';
    if (token === 'T') return '⛓️';
    if (token === 'L' || token === 'V') return '💣';
    if (token === 'S') return '🧨';
    if (token === 'M') return '💥';
    if (token === 'U') return '☢️';
    if (token === '1' || token === '2' || token === '3') return '';
    return '';
}

function getTokenColor(token, index) {
    const color = TOKEN_TO_COLOR[token];
    if (color) return color;
    if (token === 'X' || token === '1' || token === '2' || token === '3') return '';
    return NATURAL_COLORS[(index * 7 + 3) % NATURAL_COLORS.length];
}

function getBackgroundForLevelId(levelId) {
    if (levelId >= 1 && levelId <= 15) {
        return '/assets/images/vendor-plaza.png';
    }
    if (levelId >= 16 && levelId <= 25) {
        return '/assets/images/ribbon-alley.png';
    }
    if (levelId >= 26 && levelId <= 49) {
        return '/assets/images/lantern-bridge.png';
    }
    if (levelId === 50) {
        return '/assets/images/festival.png';
    }
    return '/assets/images/vendor-plaza.png';
}

function applyBoardBackground(level) {
    const fallbackId = typeof level.id === 'number' ? level.id : state.selectedIndex + 1;
    const background = level.background && level.background.trim().length > 0
        ? level.background
        : getBackgroundForLevelId(fallbackId || 1);
    ui.boardGrid.style.setProperty('--board-background', `url(${background})`);
}

function renderBoardGrid(rows) {
    ui.boardGrid.innerHTML = '';
    rows.forEach((row, rowIndex) => {
        row.split('').forEach((token, colIndex) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = getTokenClassName(token);
            cell.textContent = getTokenDisplay(token);
            cell.dataset.row = String(rowIndex);
            cell.dataset.col = String(colIndex);
            cell.dataset.token = token;
            const color = getTokenColor(token, rowIndex * GRID_SIZE + colIndex);
            if (color) {
                cell.style.setProperty('--cell-color', color);
            } else {
                cell.style.removeProperty('--cell-color');
            }
            cell.addEventListener('click', () => {
                applyTokenToCell(Number(cell.dataset.row), Number(cell.dataset.col), state.boardToken);
            });
            ui.boardGrid.appendChild(cell);
        });
    });
}

function applyTokenToCell(row, col, token) {
    const level = state.levels[state.selectedIndex];
    if (!level || !level.board) return;
    ensureBoard(level);
    const rows = level.board.rows;
    const rowTokens = rows[row].split('');
    rowTokens[col] = token;
    rows[row] = rowTokens.join('');
    const cellIndex = row * GRID_SIZE + col;
    const cell = ui.boardGrid.children[cellIndex];
    if (cell) {
        cell.className = getTokenClassName(token);
        cell.textContent = getTokenDisplay(token);
        cell.dataset.token = token;
        const color = getTokenColor(token, cellIndex);
        if (color) {
            cell.style.setProperty('--cell-color', color);
        } else {
            cell.style.removeProperty('--cell-color');
        }
    }
    syncBoardTextarea(rows);
    syncBoardDerivedFields(level);
    markDirty();
}

function getTokenClassName(token) {
    const tokenClass = TOKEN_CLASS_MAP[token] || 'any';
    const classList = tokenClass.split(' ').map((name) => `editor__cell--${name}`);
    return ['editor__cell', ...classList].join(' ');
}

function syncBoardDerivedFields(level) {
    if (!level.board || !Array.isArray(level.board.rows)) return;
    const missing = [];
    const hard = [];
    const generators = [];
    const overrides = [];
    level.board.rows.forEach((row, rowIndex) => {
        row.split('').forEach((token, colIndex) => {
            const index = rowIndex * GRID_SIZE + colIndex;
            if (token === 'X') {
                missing.push(index);
                return;
            }
            if (token === 'H') {
                hard.push(index);
                return;
            }
            if (token === 'T') {
                generators.push(index);
                return;
            }
            if (token === 'R' || token === 'A' || token === 'B' || token === 'P' || token === 'G') {
                overrides.push({ index, color: TOKEN_TO_COLOR[token] });
                return;
            }
            if (token === 'L') {
                overrides.push({ index, booster: 'line', lineOrientation: 'horizontal' });
                return;
            }
            if (token === 'V') {
                overrides.push({ index, booster: 'line', lineOrientation: 'vertical' });
                return;
            }
            if (token === 'S') {
                overrides.push({ index, booster: 'burstSmall' });
                return;
            }
            if (token === 'M') {
                overrides.push({ index, booster: 'burstMedium' });
                return;
            }
            if (token === 'U') {
                overrides.push({ index, booster: 'burstLarge' });
                return;
            }
            if (token === '1' || token === '2' || token === '3') {
                overrides.push({ index, sugarChestStage: Number(token) });
            }
        });
    });
    if (missing.length) {
        level.missingCells = missing;
    } else {
        delete level.missingCells;
    }
    if (hard.length) {
        level.hardCandies = hard;
    } else {
        delete level.hardCandies;
    }
    if (generators.length) {
        level.blockerGenerators = generators;
    } else {
        delete level.blockerGenerators;
    }
    if (overrides.length) {
        level.cellOverrides = overrides;
    } else {
        delete level.cellOverrides;
    }
}

function syncBoardTextarea(rows) {
    if (state.boardSync) return;
    state.boardSync = true;
    ui.boardRows.value = rows.join('\n');
    state.boardSync = false;
}

function parseBoardTextarea(value) {
    const lines = value.split(/\r?\n/).map((line) => line.trim());
    return normalizeBoardRows(lines);
}

function setupPalette() {
    ui.boardPalette.innerHTML = '';
    BOARD_TOKENS.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'editor__palette-button' + (entry.token === state.boardToken ? ' editor__palette-button--active' : '');
        button.dataset.token = entry.token;

        const swatch = document.createElement('span');
        swatch.className = 'editor__palette-swatch';
        swatch.style.background = entry.swatch;
        if (entry.token === '1') {
            swatch.style.backgroundImage = 'url(/assets/images/sugar-chest-01.webp)';
        }
        if (entry.token === '2') {
            swatch.style.backgroundImage = 'url(/assets/images/sugar-chest-02.webp)';
        }
        if (entry.token === '3') {
            swatch.style.backgroundImage = 'url(/assets/images/sugar-chest-03.webp)';
        }
        if (entry.token === '1' || entry.token === '2' || entry.token === '3') {
            swatch.style.backgroundSize = 'contain';
            swatch.style.backgroundPosition = 'center';
            swatch.style.backgroundRepeat = 'no-repeat';
        }

        const label = document.createElement('span');
        label.textContent = `${entry.label} (${entry.token})`;

        button.append(swatch, label);
        button.addEventListener('click', () => {
            state.boardToken = entry.token;
            setupPalette();
        });

        ui.boardPalette.appendChild(button);
    });
}

function buildPayload() {
    const levels = state.levels.map((level) => {
        if (level.board && Array.isArray(level.board.rows)) {
            const cleaned = { ...level };
            delete cleaned.missingCells;
            delete cleaned.hardCandies;
            delete cleaned.blockerGenerators;
            delete cleaned.cellOverrides;
            return cleaned;
        }
        return level;
    });
    return JSON.stringify({ levels }, null, 2) + '\n';
}

async function saveToHandle(handle) {
    const writable = await handle.createWritable();
    await writable.write(buildPayload());
    await writable.close();
}

async function saveFile() {
    await saveToProject();
}

async function saveAsFile() {
    if (!state.levels.length) {
        setStatus('Nothing to save yet.', true);
        return;
    }
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'levels.json',
                types: [
                    {
                        description: 'JSON',
                        accept: { 'application/json': ['.json'] }
                    }
                ]
            });
            await saveToHandle(handle);
            state.fileHandle = handle;
            state.fileName = handle.name;
            setDirty(false);
            setStatus(`Saved to ${handle.name}.`);
        } catch (error) {
            if (error.name !== 'AbortError') {
                setStatus(`Save failed: ${getErrorMessage(error)}`, true);
            }
        }
        return;
    }

    const blob = new Blob([buildPayload()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'levels.json';
    link.click();
    URL.revokeObjectURL(url);
    setDirty(false);
    setStatus('Downloaded levels.json.');
}

async function saveToProject() {
    if (!state.levels.length) {
        setStatus('Nothing to save yet.', true);
        return;
    }
    try {
        const response = await fetch('/backend/save-levels.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: buildPayload()
        });
        if (!response.ok) {
            throw new Error('Save failed with status ' + response.status);
        }
        const payload = await response.json();
        if (!payload || payload.status !== 'ok') {
            throw new Error(payload?.message || 'Save failed');
        }
        setDirty(false);
        setStatus('Saved to assets/data/levels.json.');
    } catch (error) {
        setStatus(`Save failed: ${getErrorMessage(error)}`, true);
    }
}

async function openFilePicker() {
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'JSON',
                        accept: { 'application/json': ['.json'] }
                    }
                ],
                multiple: false
            });
            const file = await handle.getFile();
            const text = await file.text();
            const levels = parseLevelsPayload(text);
            loadLevels(levels, handle, handle.name);
        } catch (error) {
            if (error.name !== 'AbortError') {
                setStatus(`Open failed: ${getErrorMessage(error)}`, true);
            }
        }
        return;
    }
    ui.fileInput.click();
}

async function loadFromProject() {
    try {
        const response = await fetch('/assets/data/levels.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Could not load /assets/data/levels.json');
        }
        const text = await response.text();
        const levels = parseLevelsPayload(text);
        loadLevels(levels, null, 'assets/data/levels.json');
        setStatus('Loaded from project. Save as to write a new file.');
    } catch (error) {
        setStatus(`Load failed: ${getErrorMessage(error)}`, true);
    }
}

ui.fileInput.addEventListener('change', () => {
    const file = ui.fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const levels = parseLevelsPayload(String(reader.result));
            loadLevels(levels, null, file.name);
        } catch (error) {
            setStatus(`Open failed: ${getErrorMessage(error)}`, true);
        }
    };
    reader.readAsText(file);
    ui.fileInput.value = '';
});

ui.openFile.addEventListener('click', () => openFilePicker());
ui.loadProject.addEventListener('click', () => loadFromProject());
ui.saveFile.addEventListener('click', () => saveFile());
ui.saveAs.addEventListener('click', () => saveAsFile());

ui.addLevel.addEventListener('click', () => {
    state.levels.push(createDefaultLevel());
    selectLevel(state.levels.length - 1);
    renderLevelList();
    markDirty();
});

ui.duplicateLevel.addEventListener('click', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    const clone = JSON.parse(JSON.stringify(level));
    clone.id = Math.max(0, ...state.levels.map((item) => item.id || 0)) + 1;
    state.levels.splice(state.selectedIndex + 1, 0, clone);
    selectLevel(state.selectedIndex + 1);
    renderLevelList();
    markDirty();
});

ui.deleteLevel.addEventListener('click', () => {
    if (state.selectedIndex < 0) return;
    state.levels.splice(state.selectedIndex, 1);
    const nextIndex = Math.min(state.selectedIndex, state.levels.length - 1);
    selectLevel(nextIndex);
    renderLevelList();
    markDirty();
});

ui.moveLevelUp.addEventListener('click', () => {
    const index = state.selectedIndex;
    if (index <= 0) return;
    const [level] = state.levels.splice(index, 1);
    state.levels.splice(index - 1, 0, level);
    selectLevel(index - 1);
    renderLevelList();
    markDirty();
});

ui.moveLevelDown.addEventListener('click', () => {
    const index = state.selectedIndex;
    if (index < 0 || index >= state.levels.length - 1) return;
    const [level] = state.levels.splice(index, 1);
    state.levels.splice(index + 1, 0, level);
    selectLevel(index + 1);
    renderLevelList();
    markDirty();
});

ui.renumberLevels.addEventListener('click', () => {
    state.levels.forEach((level, index) => {
        level.id = index + 1;
    });
    renderLevelList();
    renderLevelForm();
    markDirty();
});

ui.addGoal.addEventListener('click', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    level.goals.push({ type: 'destroy-color', color: COLORS[0], target: 10 });
    renderGoals(level);
    markDirty();
});

ui.boardEnabled.addEventListener('change', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    if (ui.boardEnabled.checked) {
        level.board = { rows: createBoardRowsFromLevel(level) };
    } else {
        delete level.board;
    }
    renderBoard(level);
    markDirty();
});

ui.clearBoard.addEventListener('click', () => {
    const level = state.levels[state.selectedIndex];
    if (!level || !level.board) return;
    level.board.rows = createEmptyBoardRows();
    renderBoard(level);
    syncBoardDerivedFields(level);
    markDirty();
});

ui.fillBoard.addEventListener('click', () => {
    const level = state.levels[state.selectedIndex];
    if (!level || !level.board) return;
    const rows = Array.from({ length: GRID_SIZE }, () => {
        const tokens = [];
        for (let col = 0; col < GRID_SIZE; col += 1) {
            const token = ['R', 'A', 'B', 'P', 'G'][Math.floor(Math.random() * COLORS.length)];
            tokens.push(token);
        }
        return tokens.join('');
    });
    level.board.rows = rows;
    renderBoard(level);
    syncBoardDerivedFields(level);
    markDirty();
});

ui.boardRows.addEventListener('input', () => {
    if (state.boardSync) return;
    const level = state.levels[state.selectedIndex];
    if (!level || !level.board) return;
    const rows = parseBoardTextarea(ui.boardRows.value);
    level.board.rows = rows;
    renderBoardGrid(rows);
    syncMissingCells(level);
    markDirty();
});

ui.levelId.addEventListener('input', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    updateNumberField(ui.levelId, (value) => {
        level.id = value ?? level.id;
        ui.levelTitle.textContent = `Level ${level.id ?? state.selectedIndex + 1}`;
        renderLevelList();
    });
});

ui.levelMoves.addEventListener('input', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    updateNumberField(ui.levelMoves, (value) => {
        level.moves = value ?? level.moves;
        renderLevelList();
    });
});

ui.levelTarget.addEventListener('input', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    updateNumberField(ui.levelTarget, (value) => {
        level.targetScore = value ?? level.targetScore;
        renderLevelList();
    });
});

ui.levelTime.addEventListener('input', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    updateNumberField(ui.levelTime, (value) => {
        if (typeof value === 'number') {
            level.timeGoalSeconds = value;
        } else {
            delete level.timeGoalSeconds;
        }
    }, { optional: true });
});

ui.levelDifficulty.addEventListener('change', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    level.difficulty = ui.levelDifficulty.value;
    renderLevelList();
    markDirty();
});

ui.levelBackground.addEventListener('input', () => {
    const level = state.levels[state.selectedIndex];
    if (!level) return;
    updateTextField(ui.levelBackground, (value) => {
        level.background = value;
    });
    if (level.board) {
        applyBoardBackground(level);
    }
});

window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
});

async function tryAutoLoad() {
    try {
        await loadFromProject();
    } catch (error) {
        setStatus(`Auto-load failed: ${getErrorMessage(error)}`, true);
    }
}

renderDifficultyOptions();
setupPalette();
setStatus('Loading levels from project...');
void tryAutoLoad();

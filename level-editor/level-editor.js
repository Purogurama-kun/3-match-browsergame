const GRID_SIZE = 8;
const COLORS = ['red', 'amber', 'blue', 'purple', 'green'];
const BOOSTERS = ['line', 'burstSmall', 'burstMedium', 'burstLarge'];
const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'nightmare'];
const GOAL_TYPES = ['destroy-color', 'activate-booster', 'destroy-hard-candies'];

const BOARD_TOKENS = [
    { token: '.', label: 'Any', className: 'any', swatch: '#ffffff' },
    { token: 'X', label: 'Missing', className: 'blocked', swatch: '#3f3f46' },
    { token: 'H', label: 'Hard', className: 'hard', swatch: '#f5d27a' },
    { token: 'T', label: 'Generator', className: 'generator', swatch: '#fca5a5' },
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
    const enabled = Boolean(level.board);
    ui.boardEnabled.checked = enabled;
    ui.boardPanel.classList.toggle('editor__board--hidden', !enabled);
    if (!enabled) {
        return;
    }
    if (!level.board) {
        level.board = { rows: createBoardRowsFromLevel(level) };
    }
    ensureBoard(level);
    renderBoardGrid(level.board.rows);
    syncBoardTextarea(level.board.rows);
    syncMissingCells(level);
}

function renderBoardGrid(rows) {
    ui.boardGrid.innerHTML = '';
    rows.forEach((row, rowIndex) => {
        row.split('').forEach((token, colIndex) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = `editor__cell editor__cell--${TOKEN_CLASS_MAP[token] || 'any'}`;
            cell.textContent = token;
            cell.dataset.row = String(rowIndex);
            cell.dataset.col = String(colIndex);
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
        cell.className = `editor__cell editor__cell--${TOKEN_CLASS_MAP[token] || 'any'}`;
        cell.textContent = token;
    }
    syncBoardTextarea(rows);
    syncMissingCells(level);
    markDirty();
}

function syncMissingCells(level) {
    if (!level.board || !Array.isArray(level.board.rows)) return;
    const missing = [];
    level.board.rows.forEach((row, rowIndex) => {
        row.split('').forEach((token, colIndex) => {
            if (token === 'X') {
                missing.push(rowIndex * GRID_SIZE + colIndex);
            }
        });
    });
    if (missing.length) {
        level.missingCells = missing;
    } else {
        delete level.missingCells;
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
    return JSON.stringify({ levels: state.levels }, null, 2) + '\n';
}

async function saveToHandle(handle) {
    const writable = await handle.createWritable();
    await writable.write(buildPayload());
    await writable.close();
}

async function saveFile() {
    if (!state.levels.length) {
        setStatus('Nothing to save yet.', true);
        return;
    }
    if (state.fileHandle && state.fileHandle.createWritable) {
        try {
            await saveToHandle(state.fileHandle);
            setDirty(false);
            setStatus(`Saved to ${state.fileHandle.name}.`);
        } catch (error) {
            setStatus(`Save failed: ${getErrorMessage(error)}`, true);
        }
        return;
    }
    await saveAsFile();
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

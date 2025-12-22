<?php
declare(strict_types=1);

const PROGRESS_DB_PATH = __DIR__ . '/progress.sqlite';
const MAX_LEVEL = 50;
const MAX_TIME = 86400;
const MODE_LEVEL = 'LevelMode';
const MODE_BLOCKER = 'BlockerMode';
const MODE_TIME = 'TimeMode';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

header('Content-Type: application/json');
header('Cache-Control: no-store');

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $database = openDatabase();

    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'progress';

        if ($action === 'leaderboard') {
            handleLeaderboardRequest($database);
        } elseif ($action === 'history') {
            handleHistoryRequest($database);
        } else {
            handleGet($database);
        }
    } elseif ($method === 'POST') {
        handlePost($database);
    } else {
        respond(405, ['error' => 'Method not allowed.']);
    }
} catch (InvalidArgumentException $exception) {
    respond(400, ['error' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('Progress API error: ' . $exception->getMessage());
    respond(500, ['error' => 'Internal server error.']);
}

function openDatabase(): PDO
{
    $database = new PDO(
        'sqlite:' . PROGRESS_DB_PATH,
        '',
        '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    $database->exec('PRAGMA foreign_keys = ON;');
    $database->exec('PRAGMA journal_mode = WAL;');
    ensureSchema($database);
    return $database;
}

function ensureSchema(PDO $database): void
{
    $database->exec(
        'CREATE TABLE IF NOT EXISTS user_progress (
            user_id TEXT PRIMARY KEY,
            highest_level INTEGER NOT NULL DEFAULT 1,
            data TEXT NOT NULL DEFAULT "{}",
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );

    $columns = fetchExistingColumns($database);

    if (!isset($columns['data'])) {
        $database->exec('ALTER TABLE user_progress ADD COLUMN data TEXT NOT NULL DEFAULT "{}"');
        $database->exec('UPDATE user_progress SET data = "{}" WHERE data IS NULL');
    }

    if (!isset($columns['updated_at'])) {
        $database->exec(
            'ALTER TABLE user_progress ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
        );
        $database->exec(
            'UPDATE user_progress SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL'
        );
    }

    $database->exec(
        'CREATE TABLE IF NOT EXISTS users (
            google_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            nationality TEXT NULL
        )'
    );

    $database->exec(
        'CREATE TABLE IF NOT EXISTS run_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            highest_level INTEGER NULL,
            score INTEGER NULL,
            completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(google_id) ON DELETE CASCADE,
            CHECK(mode IN ("' . MODE_LEVEL . '", "' . MODE_BLOCKER . '", "' . MODE_TIME . '"))
        )'
    );

    $database->exec('CREATE INDEX IF NOT EXISTS idx_run_results_user_mode ON run_results(user_id, mode)');
    $database->exec('CREATE INDEX IF NOT EXISTS idx_run_results_mode_value ON run_results(mode, highest_level, score)');

    migrateRunResultsForTimeMode($database);
    migrateLegacyProgress($database);
}

function migrateRunResultsForTimeMode(PDO $database): void
{
    $tableSql = fetchTableSql($database, 'run_results');
    if ($tableSql === null || str_contains($tableSql, MODE_TIME)) {
        return;
    }

    $database->exec('DROP TABLE IF EXISTS run_results_legacy');
    $database->exec('ALTER TABLE run_results RENAME TO run_results_legacy');
    $database->exec(
        'CREATE TABLE run_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            highest_level INTEGER NULL,
            score INTEGER NULL,
            completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(google_id) ON DELETE CASCADE,
            CHECK(mode IN ("' . MODE_LEVEL . '", "' . MODE_BLOCKER . '", "' . MODE_TIME . '"))
        )'
    );
    $database->exec(
        'INSERT INTO run_results (user_id, mode, highest_level, score, completed_at)
         SELECT user_id, mode, highest_level, score, completed_at FROM run_results_legacy'
    );
    $database->exec('DROP TABLE run_results_legacy');
    $database->exec('CREATE INDEX IF NOT EXISTS idx_run_results_user_mode ON run_results(user_id, mode)');
    $database->exec('CREATE INDEX IF NOT EXISTS idx_run_results_mode_value ON run_results(mode, highest_level, score)');
}

function fetchExistingColumns(PDO $database): array
{
    $statement = $database->query('PRAGMA table_info(user_progress)');
    $columns = [];

    foreach ($statement->fetchAll() as $column) {
        if (isset($column['name'])) {
            $columns[(string) $column['name']] = true;
        }
    }

    return $columns;
}

function fetchTableSql(PDO $database, string $table): ?string
{
    $statement = $database->prepare('SELECT sql FROM sqlite_master WHERE type = "table" AND name = :name');
    $statement->bindValue(':name', $table, PDO::PARAM_STR);
    $statement->execute();
    $row = $statement->fetch();
    return $row !== false && isset($row['sql']) ? (string) $row['sql'] : null;
}

function handleGet(PDO $database): void
{
    $userId = requireUserId($_GET['userId'] ?? null);
    $localLevel = clampLevel($_GET['localLevel'] ?? 1);
    $progress = fetchProgress($database, $userId);

    if (!$progress) {
        registerProgress($database, $userId, $localLevel);
        $progress = fetchProgress($database, $userId);
    }

    $existingLevel = isset($progress['highest_level'])
        ? clampLevel($progress['highest_level'])
        : $localLevel;
    $data = decodeData($progress['data'] ?? '{}');
    $existingScore = clampScore($data['blockerHighScore'] ?? 0);
    $existingTime = clampTime($data['timeSurvival'] ?? 0);

    $bestLevel = max($localLevel, $existingLevel, fetchBestLevelFromRuns($database, $userId));
    $bestScore = max($existingScore, fetchBestScoreFromRuns($database, $userId, MODE_BLOCKER));
    $bestTime = max($existingTime, fetchBestScoreFromRuns($database, $userId, MODE_TIME));

    $normalizedData = normalizeData(
        ['blockerHighScore' => $bestScore, 'timeSurvival' => $bestTime],
        $data
    );

    if ($bestLevel !== $existingLevel || $bestScore !== $existingScore || $bestTime !== $existingTime) {
        saveProgress($database, $userId, $bestLevel, json_encode($normalizedData, JSON_THROW_ON_ERROR));
    }

    respond(200, [
        'highestLevel' => $bestLevel,
        'data' => $normalizedData
    ]);
}

function handlePost(PDO $database): void
{
    $payload = decodeJsonRequest();
    $userId = requireUserId($payload['userId'] ?? null);
    $submittedLevel = clampLevel($payload['highestLevel'] ?? 1);
    $mode = isset($payload['mode']) ? requireMode($payload['mode']) : null;
    $data = array_key_exists('data', $payload) && is_array($payload['data']) ? $payload['data'] : [];
    $scores = determineScores($data, $payload, $mode);
    $submittedScore = clampScore($scores['blocker']);
    $submittedTime = clampTime($scores['time']);
    $displayName = sanitizeDisplayName($payload['displayName'] ?? $userId);
    $nationality = sanitizeNationality($payload['nationality'] ?? null);
    $completedAt = sanitizeCompletedAt($payload['completedAt'] ?? null);

    $progress = fetchProgress($database, $userId);
    $existingLevel = isset($progress['highest_level']) ? clampLevel($progress['highest_level']) : 1;
    $existingData = decodeData($progress['data'] ?? '{}');
    $existingScore = clampScore($existingData['blockerHighScore'] ?? 0);
    $existingTime = clampTime($existingData['timeSurvival'] ?? 0);

    $highestLevel = max($existingLevel, $submittedLevel);
    $normalizedData = normalizeData(
        [
            'blockerHighScore' => max($existingScore, $submittedScore),
            'timeSurvival' => max($existingTime, $submittedTime)
        ],
        $existingData
    );
    $encodedData = json_encode($normalizedData, JSON_THROW_ON_ERROR);

    saveProgress($database, $userId, $highestLevel, $encodedData);
    upsertUser($database, $userId, $displayName, $nationality);

    if ($mode === MODE_LEVEL) {
        recordLevelRun($database, $userId, $submittedLevel, $completedAt);
    } elseif ($mode === MODE_BLOCKER) {
        recordBlockerRun($database, $userId, $submittedScore, $completedAt);
    } elseif ($mode === MODE_TIME) {
        recordTimeRun($database, $userId, $submittedTime, $completedAt);
    } else {
        if ($submittedLevel > 0) {
            recordLevelRun($database, $userId, $submittedLevel, $completedAt);
        }
        if ($submittedScore > 0) {
            recordBlockerRun($database, $userId, $submittedScore, $completedAt);
        }
        if ($submittedTime > 0) {
            recordTimeRun($database, $userId, $submittedTime, $completedAt);
        }
    }

    $bestLevel = max($highestLevel, fetchBestLevelFromRuns($database, $userId));
    $bestScore = max($normalizedData['blockerHighScore'], fetchBestScoreFromRuns($database, $userId, MODE_BLOCKER));
    $bestTime = max($normalizedData['timeSurvival'], fetchBestScoreFromRuns($database, $userId, MODE_TIME));

    respond(200, [
        'highestLevel' => $bestLevel,
        'data' => ['blockerHighScore' => $bestScore, 'timeSurvival' => $bestTime]
    ]);
}

function fetchProgress(PDO $database, string $userId): array
{
    $statement = $database->prepare(
        'SELECT user_id, highest_level, data FROM user_progress WHERE user_id = :user_id'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->execute();
    $row = $statement->fetch();

    return $row ?: [];
}

function saveProgress(PDO $database, string $userId, int $highestLevel, string $data): void
{
    $statement = $database->prepare(
        'INSERT INTO user_progress (user_id, highest_level, data, updated_at)
         VALUES (:user_id, :highest_level, :data, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
            highest_level = excluded.highest_level,
            data = excluded.data,
            updated_at = excluded.updated_at'
    );

    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':highest_level', $highestLevel, PDO::PARAM_INT);
    $statement->bindValue(':data', $data, PDO::PARAM_STR);
    $statement->execute();
}

function registerProgress(PDO $database, string $userId, int $localLevel): void
{
    $data = json_encode(normalizeData([]), JSON_THROW_ON_ERROR);
    saveProgress($database, $userId, $localLevel, $data);
}

function requireUserId(?string $rawUserId): string
{
    if ($rawUserId === null) {
        throw new InvalidArgumentException('User ID missing.');
    }

    $userId = trim($rawUserId);
    if ($userId === '') {
        throw new InvalidArgumentException('User ID must not be empty.');
    }

    if (strlen($userId) > 128) {
        throw new InvalidArgumentException('User ID too long.');
    }

    return $userId;
}

function clampLevel(mixed $level): int
{
    if (!is_numeric($level)) {
        return 1;
    }

    $normalized = (int) floor((float) $level);
    return max(1, min(MAX_LEVEL, $normalized));
}

function decodeData(string $data): array
{
    try {
        $decoded = json_decode($data, true, 512, JSON_THROW_ON_ERROR);
        return is_array($decoded) ? $decoded : [];
    } catch (Throwable) {
        return [];
    }
}

function decodeJsonRequest(): array
{
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false) {
        throw new InvalidArgumentException('Failed to read request body.');
    }

    if ($rawBody === '') {
        return [];
    }

    try {
        $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        throw new InvalidArgumentException('Invalid JSON payload.');
    }

    return is_array($decoded) ? $decoded : [];
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalizeData(array $data, array $existing = []): array
{
    $currentScore = clampScore($existing['blockerHighScore'] ?? 0);
    $submittedScore = clampScore($data['blockerHighScore'] ?? 0);
    $blockerHighScore = max($currentScore, $submittedScore);

    $currentTime = clampTime($existing['timeSurvival'] ?? 0);
    $submittedTime = clampTime($data['timeSurvival'] ?? 0);
    $timeSurvival = max($currentTime, $submittedTime);

    return [
        'blockerHighScore' => $blockerHighScore,
        'timeSurvival' => $timeSurvival
    ];
}

function clampScore(mixed $score): int
{
    if (!is_numeric($score)) {
        return 0;
    }

    $normalized = (int) floor((float) $score);
    return max(0, min(1000000000, $normalized));
}

function clampTime(mixed $time): int
{
    if (!is_numeric($time)) {
        return 0;
    }

    $normalized = (int) floor((float) $time);
    return max(0, min(MAX_TIME, $normalized));
}

function sanitizeDisplayName(?string $rawDisplayName): string
{
    $normalized = trim((string) ($rawDisplayName ?? ''));
    $normalized = preg_replace('/[\x00-\x1F\x7F]+/', '', $normalized ?? '') ?? '';

    if ($normalized === '') {
        return 'Player';
    }

    if (mb_strlen($normalized) > 128) {
        $normalized = mb_substr($normalized, 0, 128);
    }

    return $normalized;
}

function sanitizeNationality(mixed $rawNationality): ?string
{
    if (!is_string($rawNationality)) {
        return null;
    }

    $trimmed = strtoupper(trim($rawNationality));
    $lettersOnly = preg_replace('/[^A-Z]/', '', $trimmed);
    if ($lettersOnly === null || $lettersOnly === '') {
        return null;
    }

    $normalized = substr($lettersOnly, 0, 3);
    return $normalized === '' ? null : $normalized;
}

function sanitizeCompletedAt(mixed $rawCompletedAt): string
{
    if (is_string($rawCompletedAt)) {
        try {
            $timestamp = new DateTimeImmutable($rawCompletedAt);
            return $timestamp->format(DateTimeInterface::ATOM);
        } catch (Throwable) {
            // Fall through to current time when parsing fails.
        }
    }

    return gmdate(DateTimeInterface::ATOM);
}

function upsertUser(PDO $database, string $userId, string $displayName, ?string $nationality): void
{
    $statement = $database->prepare(
        'INSERT INTO users (google_id, display_name, nationality)
         VALUES (:google_id, :display_name, :nationality)
         ON CONFLICT(google_id) DO UPDATE SET
            display_name = excluded.display_name,
            nationality = excluded.nationality'
    );

    $statement->bindValue(':google_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':display_name', $displayName, PDO::PARAM_STR);
    $statement->bindValue(':nationality', $nationality, $nationality === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $statement->execute();
}

function determineScores(array $data, array $payload, ?string $mode): array
{
    $blocker = 0;
    $time = 0;

    if (array_key_exists('blockerHighScore', $data)) {
        $blocker = clampScore($data['blockerHighScore']);
    } elseif (isset($payload['blockerHighScore'])) {
        $blocker = clampScore($payload['blockerHighScore']);
    } elseif ($mode === MODE_BLOCKER && isset($payload['score'])) {
        $blocker = clampScore($payload['score']);
    }

    if (array_key_exists('timeSurvival', $data)) {
        $time = clampTime($data['timeSurvival']);
    } elseif (isset($payload['timeSurvival'])) {
        $time = clampTime($payload['timeSurvival']);
    } elseif ($mode === MODE_TIME && isset($payload['score'])) {
        $time = clampTime($payload['score']);
    }

    return ['blocker' => $blocker, 'time' => $time];
}

function recordLevelRun(PDO $database, string $userId, int $highestLevel, string $completedAt): void
{
    if ($highestLevel < 1) {
        return;
    }

    $statement = $database->prepare(
        'INSERT INTO run_results (user_id, mode, highest_level, score, completed_at)
         VALUES (:user_id, :mode, :highest_level, NULL, :completed_at)'
    );

    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', MODE_LEVEL, PDO::PARAM_STR);
    $statement->bindValue(':highest_level', $highestLevel, PDO::PARAM_INT);
    $statement->bindValue(':completed_at', $completedAt, PDO::PARAM_STR);
    $statement->execute();
}

function recordBlockerRun(PDO $database, string $userId, int $score, string $completedAt): void
{
    if ($score < 1) {
        return;
    }

    $statement = $database->prepare(
        'INSERT INTO run_results (user_id, mode, highest_level, score, completed_at)
         VALUES (:user_id, :mode, NULL, :score, :completed_at)'
    );

    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', MODE_BLOCKER, PDO::PARAM_STR);
    $statement->bindValue(':score', $score, PDO::PARAM_INT);
    $statement->bindValue(':completed_at', $completedAt, PDO::PARAM_STR);
    $statement->execute();
}

function recordTimeRun(PDO $database, string $userId, int $timeSurvived, string $completedAt): void
{
    if ($timeSurvived < 1) {
        return;
    }

    $statement = $database->prepare(
        'INSERT INTO run_results (user_id, mode, highest_level, score, completed_at)
         VALUES (:user_id, :mode, NULL, :score, :completed_at)'
    );

    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', MODE_TIME, PDO::PARAM_STR);
    $statement->bindValue(':score', $timeSurvived, PDO::PARAM_INT);
    $statement->bindValue(':completed_at', $completedAt, PDO::PARAM_STR);
    $statement->execute();
}

function fetchBestLevelFromRuns(PDO $database, string $userId): int
{
    $statement = $database->prepare(
        'SELECT MAX(highest_level) AS best_level FROM run_results WHERE user_id = :user_id AND mode = :mode'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', MODE_LEVEL, PDO::PARAM_STR);
    $statement->execute();

    $row = $statement->fetch();
    return isset($row['best_level']) ? clampLevel($row['best_level']) : 1;
}

function fetchBestScoreFromRuns(PDO $database, string $userId, string $mode): int
{
    $statement = $database->prepare(
        'SELECT MAX(score) AS best_score FROM run_results WHERE user_id = :user_id AND mode = :mode'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', $mode, PDO::PARAM_STR);
    $statement->execute();

    $row = $statement->fetch();
    $bestScore = $row['best_score'] ?? 0;
    return $mode === MODE_TIME ? clampTime($bestScore) : clampScore($bestScore);
}

function handleLeaderboardRequest(PDO $database): void
{
    $mode = requireMode($_GET['mode'] ?? null);
    $limit = clampLimit($_GET['limit'] ?? DEFAULT_LIMIT);
    $offset = clampOffset($_GET['offset'] ?? 0);

    $entries = fetchLeaderboard($database, $mode, $limit, $offset);

    respond(200, ['entries' => $entries]);
}

function handleHistoryRequest(PDO $database): void
{
    $userId = requireUserId($_GET['userId'] ?? null);
    $mode = requireMode($_GET['mode'] ?? null);
    $limit = clampLimit($_GET['limit'] ?? DEFAULT_LIMIT);
    $offset = clampOffset($_GET['offset'] ?? 0);

    $entries = fetchHistory($database, $userId, $mode, $limit, $offset);

    respond(200, ['entries' => $entries]);
}

function requireMode(?string $rawMode): string
{
    if ($rawMode === MODE_LEVEL || $rawMode === MODE_BLOCKER || $rawMode === MODE_TIME) {
        return $rawMode;
    }

    throw new InvalidArgumentException('Unsupported mode requested.');
}

function clampLimit(mixed $limit): int
{
    if (!is_numeric($limit)) {
        return DEFAULT_LIMIT;
    }

    $normalized = (int) floor((float) $limit);
    return max(1, min(MAX_LIMIT, $normalized));
}

function clampOffset(mixed $offset): int
{
    if (!is_numeric($offset)) {
        return 0;
    }

    $normalized = (int) floor((float) $offset);
    return max(0, $normalized);
}

function fetchLeaderboard(PDO $database, string $mode, int $limit, int $offset): array
{
    if ($mode === MODE_LEVEL) {
        return fetchLevelLeaderboard($database, $limit, $offset);
    }
    if ($mode === MODE_TIME) {
        return fetchTimeLeaderboard($database, $limit, $offset);
    }

    return fetchBlockerLeaderboard($database, $limit, $offset);
}

function fetchLevelLeaderboard(PDO $database, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'WITH best AS (
            SELECT user_id, MAX(highest_level) AS best_level
            FROM run_results
            WHERE mode = :mode
            GROUP BY user_id
        ), ranked AS (
            SELECT
                b.user_id,
                b.best_level,
                MIN(r.completed_at) AS completed_at
            FROM best b
            JOIN run_results r ON r.user_id = b.user_id AND r.mode = :mode AND r.highest_level = b.best_level
            GROUP BY b.user_id, b.best_level
        )
        SELECT
            u.google_id AS userId,
            u.display_name AS displayName,
            u.nationality AS nationality,
            ranked.best_level AS bestValue,
            ranked.completed_at AS completedAt
        FROM ranked
        JOIN users u ON u.google_id = ranked.user_id
        ORDER BY ranked.best_level DESC, ranked.completed_at ASC
        LIMIT :limit OFFSET :offset'
    );

    $statement->bindValue(':mode', MODE_LEVEL, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $rows = $statement->fetchAll();
    return array_map(static fn(array $row): array => formatLeaderboardRow($row, MODE_LEVEL), $rows);
}

function fetchBlockerLeaderboard(PDO $database, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'WITH best AS (
            SELECT user_id, MAX(score) AS best_score
            FROM run_results
            WHERE mode = :mode
            GROUP BY user_id
        ), ranked AS (
            SELECT
                b.user_id,
                b.best_score,
                MIN(r.completed_at) AS completed_at
            FROM best b
            JOIN run_results r ON r.user_id = b.user_id AND r.mode = :mode AND r.score = b.best_score
            GROUP BY b.user_id, b.best_score
        )
        SELECT
            u.google_id AS userId,
            u.display_name AS displayName,
            u.nationality AS nationality,
            ranked.best_score AS bestValue,
            ranked.completed_at AS completedAt
        FROM ranked
        JOIN users u ON u.google_id = ranked.user_id
        ORDER BY ranked.best_score DESC, ranked.completed_at ASC
        LIMIT :limit OFFSET :offset'
    );

    $statement->bindValue(':mode', MODE_BLOCKER, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $rows = $statement->fetchAll();
    return array_map(static fn(array $row): array => formatLeaderboardRow($row, MODE_BLOCKER), $rows);
}

function fetchTimeLeaderboard(PDO $database, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'WITH best AS (
            SELECT user_id, MAX(score) AS best_score
            FROM run_results
            WHERE mode = :mode
            GROUP BY user_id
        ), ranked AS (
            SELECT
                b.user_id,
                b.best_score,
                MIN(r.completed_at) AS completed_at
            FROM best b
            JOIN run_results r ON r.user_id = b.user_id AND r.mode = :mode AND r.score = b.best_score
            GROUP BY b.user_id, b.best_score
        )
        SELECT
            u.google_id AS userId,
            u.display_name AS displayName,
            u.nationality AS nationality,
            ranked.best_score AS bestValue,
            ranked.completed_at AS completedAt
        FROM ranked
        JOIN users u ON u.google_id = ranked.user_id
        ORDER BY ranked.best_score DESC, ranked.completed_at ASC
        LIMIT :limit OFFSET :offset'
    );

    $statement->bindValue(':mode', MODE_TIME, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $rows = $statement->fetchAll();
    return array_map(static fn(array $row): array => formatLeaderboardRow($row, MODE_TIME), $rows);
}

function formatLeaderboardRow(array $row, string $mode): array
{
    return [
        'userId' => (string) $row['userId'],
        'displayName' => (string) $row['displayName'],
        'nationality' => sanitizeNationality($row['nationality'] ?? null),
        $mode === MODE_LEVEL ? 'highestLevel' : 'score' => $mode === MODE_LEVEL
            ? clampLevel($row['bestValue'])
            : ($mode === MODE_TIME ? clampTime($row['bestValue']) : clampScore($row['bestValue'])),
        'completedAt' => (string) $row['completedAt']
    ];
}

function fetchHistory(PDO $database, string $userId, string $mode, int $limit, int $offset): array
{
    $orderColumn = $mode === MODE_LEVEL ? 'highest_level' : 'score';
    $statement = $database->prepare(
        'SELECT highest_level, score, completed_at FROM run_results
         WHERE user_id = :user_id AND mode = :mode
         ORDER BY ' . $orderColumn . ' DESC, completed_at ASC
         LIMIT :limit OFFSET :offset'
    );

    $statement->bindValue(':user_id', $userId, PDO::PARAM_STR);
    $statement->bindValue(':mode', $mode, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $rows = $statement->fetchAll();

    return array_map(
        static function (array $row) use ($mode): array {
            return $mode === MODE_LEVEL
                ? [
                    'highestLevel' => clampLevel($row['highest_level'] ?? 1),
                    'completedAt' => (string) $row['completed_at']
                ]
                : [
                    'score' => $mode === MODE_TIME ? clampTime($row['score'] ?? 0) : clampScore($row['score'] ?? 0),
                    'completedAt' => (string) $row['completed_at']
                ];
        },
        $rows
    );
}

function migrateLegacyProgress(PDO $database): void
{
    $legacyRows = $database->query('SELECT user_id, highest_level, data FROM user_progress');
    if ($legacyRows === false) {
        return;
    }

    foreach ($legacyRows->fetchAll() as $row) {
        if (!isset($row['user_id'])) {
            continue;
        }

        $userId = (string) $row['user_id'];
        $displayName = sanitizeDisplayName($userId);
        upsertUser($database, $userId, $displayName, null);

        $existingRuns = $database->prepare(
            'SELECT COUNT(*) AS run_count FROM run_results WHERE user_id = :user_id'
        );
        $existingRuns->bindValue(':user_id', $userId, PDO::PARAM_STR);
        $existingRuns->execute();
        $countRow = $existingRuns->fetch();
        $hasRuns = isset($countRow['run_count']) && (int) $countRow['run_count'] > 0;

        if ($hasRuns) {
            continue;
        }

        $legacyLevel = clampLevel($row['highest_level'] ?? 1);
        recordLevelRun($database, $userId, $legacyLevel, gmdate(DateTimeInterface::ATOM));

        $legacyData = decodeData($row['data'] ?? '{}');
        $legacyScore = clampScore($legacyData['blockerHighScore'] ?? 0);
        recordBlockerRun($database, $userId, $legacyScore, gmdate(DateTimeInterface::ATOM));
    }
}

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
const POWERUP_TYPES = ['shuffle', 'switch', 'bomb'];
const MAX_POWERUP_STOCK = 2;

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
    } elseif ($method === 'DELETE') {
        handleDelete($database);
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
    $database->exec('DROP TABLE IF EXISTS run_results');
    $database->exec('DROP TABLE IF EXISTS user_progress');
    $database->exec('DROP TABLE IF EXISTS users');

    $database->exec(
        'CREATE TABLE IF NOT EXISTS "User" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            googleID TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            nationality TEXT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );

    ensureUserColumnName($database);

    $database->exec(
        'CREATE TABLE IF NOT EXISTS "GameProgress" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userID INTEGER NOT NULL,
            blockerMode_highScore INTEGER NOT NULL DEFAULT 0,
            timeMode_survivalTime INTEGER NOT NULL DEFAULT 0,
            levelMode_level INTEGER NOT NULL DEFAULT 1,
            sugarCoin INTEGER NOT NULL DEFAULT 0,
            shufflePowerup INTEGER NOT NULL DEFAULT 0,
            switchPowerup INTEGER NOT NULL DEFAULT 0,
            bombPowerup INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userID) REFERENCES "User"(id) ON DELETE CASCADE,
            UNIQUE(userID)
        )'
    );
}

function ensureUserColumnName(PDO $database): void
{
    $statement = $database->query('PRAGMA table_info("User")');
    if ($statement === false) {
        return;
    }
    $columns = $statement->fetchAll(PDO::FETCH_COLUMN, 1);
    if (in_array('googleTokenID', $columns, true)) {
        $database->exec('ALTER TABLE "User" RENAME COLUMN googleTokenID TO googleID');
    }
}

function handleGet(PDO $database): void
{
    $googleId = requireUserId($_GET['userId'] ?? null);
    $localLevel = clampLevel($_GET['localLevel'] ?? 1);
    $localCoins = clampCoins($_GET['localCoins'] ?? 0);

    $user = resolveUser($database, $googleId, null, null);

    $candidate = [
        'highestLevel' => $localLevel,
        'blockerHighScore' => 0,
        'timeSurvival' => 0,
        'sugarCoins' => $localCoins,
        'powerups' => []
    ];

    $metrics = persistUserProgress($database, (int) $user['id'], $candidate);

    respond(200, [
        'highestLevel' => $metrics['highestLevel'],
        'data' => [
            'blockerHighScore' => $metrics['blockerHighScore'],
            'timeSurvival' => $metrics['timeSurvival'],
            'sugarCoins' => $metrics['sugarCoins'],
            'powerups' => $metrics['powerups']
        ]
    ]);
}

function handlePost(PDO $database): void
{
    $payload = decodeJsonRequest();
    $googleId = requireUserId($payload['userId'] ?? null);
    $submittedLevel = clampLevel($payload['highestLevel'] ?? 1);
    $mode = isset($payload['mode']) ? requireMode($payload['mode']) : null;
    $data = array_key_exists('data', $payload) && is_array($payload['data']) ? $payload['data'] : [];

    $scores = determineScores($data, $payload, $mode);
    $submittedScore = clampScore($scores['blocker']);
    $submittedTime = clampTime($scores['time']);
    $submittedCoins = clampCoins($data['sugarCoins'] ?? 0);
    $submittedPowerups = clampPowerups($data['powerups'] ?? []);
    $displayName = sanitizeUsername($payload['displayName'] ?? null);
    $nationality = sanitizeNationality($payload['nationality'] ?? null);

    $user = resolveUser($database, $googleId, $displayName, $nationality);

    $candidate = [
        'highestLevel' => $submittedLevel,
        'blockerHighScore' => $submittedScore,
        'timeSurvival' => $submittedTime,
        'sugarCoins' => $submittedCoins,
        'powerups' => $submittedPowerups
    ];

    $metrics = persistUserProgress($database, (int) $user['id'], $candidate);

    respond(200, [
        'highestLevel' => $metrics['highestLevel'],
        'data' => [
            'blockerHighScore' => $metrics['blockerHighScore'],
            'timeSurvival' => $metrics['timeSurvival'],
            'sugarCoins' => $metrics['sugarCoins'],
            'powerups' => $metrics['powerups']
        ]
    ]);
}

function handleDelete(PDO $database): void
{
    $googleId = requireUserId($_GET['userId'] ?? null);
    $scope = $_GET['scope'] ?? 'progress';
    if ($scope === 'account') {
        deleteUser($database, $googleId);
    } else {
        deleteUserProgress($database, $googleId);
    }
    respond(200, ['deleted' => true]);
}

function deleteUserProgress(PDO $database, string $googleId): void
{
    $user = fetchUserByGoogleId($database, $googleId);
    if (!$user) {
        return;
    }

    $statement = $database->prepare('DELETE FROM "GameProgress" WHERE userID = :user_id');
    $statement->bindValue(':user_id', (int) $user['id'], PDO::PARAM_INT);
    $statement->execute();
}

function deleteUser(PDO $database, string $googleId): void
{
    $statement = $database->prepare('DELETE FROM "User" WHERE googleID = :token');
    $statement->bindValue(':token', $googleId, PDO::PARAM_STR);
    $statement->execute();
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
    $googleId = requireUserId($_GET['userId'] ?? null);
    $mode = requireMode($_GET['mode'] ?? null);
    $limit = clampLimit($_GET['limit'] ?? DEFAULT_LIMIT);
    $offset = clampOffset($_GET['offset'] ?? 0);

    $entries = fetchHistory($database, $googleId, $mode, $limit, $offset);
    respond(200, ['entries' => $entries]);
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
        'SELECT
            u.googleID AS userId,
            u.username AS displayName,
            u.nationality AS nationality,
            gp.levelMode_level AS bestValue,
            gp.updated_at AS completedAt
        FROM "GameProgress" gp
        JOIN "User" u ON u.id = gp.userID
        ORDER BY gp.levelMode_level DESC, gp.updated_at ASC
        LIMIT :limit OFFSET :offset'
    );
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    return array_map(
        static fn(array $row): array => formatLeaderboardRow($row, MODE_LEVEL),
        $statement->fetchAll()
    );
}

function fetchBlockerLeaderboard(PDO $database, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'SELECT
            u.googleID AS userId,
            u.username AS displayName,
            u.nationality AS nationality,
            gp.blockerMode_highScore AS bestValue,
            gp.updated_at AS completedAt
        FROM "GameProgress" gp
        JOIN "User" u ON u.id = gp.userID
        ORDER BY gp.blockerMode_highScore DESC, gp.updated_at ASC
        LIMIT :limit OFFSET :offset'
    );
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    return array_map(
        static fn(array $row): array => formatLeaderboardRow($row, MODE_BLOCKER),
        $statement->fetchAll()
    );
}

function fetchTimeLeaderboard(PDO $database, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'SELECT
            u.googleID AS userId,
            u.username AS displayName,
            u.nationality AS nationality,
            gp.timeMode_survivalTime AS bestValue,
            gp.updated_at AS completedAt
        FROM "GameProgress" gp
        JOIN "User" u ON u.id = gp.userID
        ORDER BY gp.timeMode_survivalTime DESC, gp.updated_at ASC
        LIMIT :limit OFFSET :offset'
    );
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    return array_map(
        static fn(array $row): array => formatLeaderboardRow($row, MODE_TIME),
        $statement->fetchAll()
    );
}

function fetchHistory(PDO $database, string $googleId, string $mode, int $limit, int $offset): array
{
    $statement = $database->prepare(
        'SELECT
            gp.levelMode_level,
            gp.blockerMode_highScore,
            gp.timeMode_survivalTime,
            gp.updated_at
        FROM "GameProgress" gp
        JOIN "User" u ON u.id = gp.userID
        WHERE u.googleID = :token
        LIMIT :limit OFFSET :offset'
    );
    $statement->bindValue(':token', $googleId, PDO::PARAM_STR);
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
    $statement->execute();

    $row = $statement->fetch();
    if ($row === false) {
        return [];
    }

    if ($mode === MODE_LEVEL) {
        return [
            [
                'highestLevel' => clampLevel($row['levelMode_level'] ?? 1),
                'completedAt' => (string) $row['updated_at']
            ]
        ];
    }

    $score = $mode === MODE_TIME
        ? clampTime($row['timeMode_survivalTime'] ?? 0)
        : clampScore($row['blockerMode_highScore'] ?? 0);

    return [
        [
            'score' => $score,
            'completedAt' => (string) $row['updated_at']
        ]
    ];
}

function formatLeaderboardRow(array $row, string $mode): array
{
    return [
        'userId' => (string) $row['userId'],
        'displayName' => (string) $row['displayName'],
        'nationality' => sanitizeNationality($row['nationality'] ?? null),
        $mode === MODE_LEVEL ? 'highestLevel' : 'score' => $mode === MODE_LEVEL
            ? clampLevel($row['bestValue'] ?? 1)
            : ($mode === MODE_TIME ? clampTime($row['bestValue'] ?? 0) : clampScore($row['bestValue'] ?? 0)),
        'completedAt' => (string) $row['completedAt']
    ];
}

function resolveUser(PDO $database, string $googleId, ?string $displayName, ?string $nationality): array
{
    $user = fetchUserByGoogleId($database, $googleId);
    if ($user) {
        $username = determineUsername($displayName, (int) $user['id'], (string) $user['username']);
        $needsUpdate = $username !== $user['username'] || $nationality !== $user['nationality'];
        if ($needsUpdate) {
            updateUser($database, (int) $user['id'], $username, $nationality);
            $user['username'] = $username;
            $user['nationality'] = $nationality;
        }
        return $user;
    }

    $usernameForInsert = $displayName ?? 'Player';
    $statement = $database->prepare(
        'INSERT INTO "User" (googleID, username, nationality)
         VALUES (:token, :username, :nationality)'
    );
    $statement->bindValue(':token', $googleId, PDO::PARAM_STR);
    $statement->bindValue(':username', $usernameForInsert, PDO::PARAM_STR);
    $nationValue = $nationality === null ? null : $nationality;
    $nationType = $nationality === null ? PDO::PARAM_NULL : PDO::PARAM_STR;
    $statement->bindValue(':nationality', $nationValue, $nationType);
    $statement->execute();

    $userId = (int) $database->lastInsertId();
    $username = determineUsername($displayName, $userId, '');
    if ($username !== $usernameForInsert) {
        updateUser($database, $userId, $username, $nationality);
    }

    return fetchUserById($database, $userId);
}

function fetchUserByGoogleId(PDO $database, string $googleId): ?array
{
    $statement = $database->prepare('SELECT id, googleID, username, nationality FROM "User" WHERE googleID = :token');
    $statement->bindValue(':token', $googleId, PDO::PARAM_STR);
    $statement->execute();
    $row = $statement->fetch();
    return $row === false ? null : $row;
}

function fetchUserById(PDO $database, int $userId): array
{
    $statement = $database->prepare('SELECT id, googleID, username, nationality FROM "User" WHERE id = :id');
    $statement->bindValue(':id', $userId, PDO::PARAM_INT);
    $statement->execute();
    $row = $statement->fetch();
    if ($row === false) {
        throw new RuntimeException('Failed to load user.');
    }
    return $row;
}

function updateUser(PDO $database, int $userId, string $username, ?string $nationality): void
{
    $statement = $database->prepare(
        'UPDATE "User" SET username = :username, nationality = :nationality, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
    );
    $statement->bindValue(':username', $username, PDO::PARAM_STR);
    $nationValue = $nationality === null ? null : $nationality;
    $nationType = $nationality === null ? PDO::PARAM_NULL : PDO::PARAM_STR;
    $statement->bindValue(':nationality', $nationValue, $nationType);
    $statement->bindValue(':id', $userId, PDO::PARAM_INT);
    $statement->execute();
}

function persistUserProgress(PDO $database, int $userId, array $candidate): array
{
    $currentRow = fetchProgress($database, $userId);
    $currentMetrics = columnsToMetrics($currentRow);
    $merged = mergeMetrics($currentMetrics, $candidate);
    $columns = metricsToColumns($merged);
    saveProgress($database, $userId, $columns);
    return $merged;
}

function fetchProgress(PDO $database, int $userId): array
{
    $statement = $database->prepare('SELECT * FROM "GameProgress" WHERE userID = :user_id');
    $statement->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $statement->execute();
    $row = $statement->fetch();
    return $row === false ? [] : $row;
}

function saveProgress(PDO $database, int $userId, array $columns): void
{
    $statement = $database->prepare(
        'INSERT INTO "GameProgress" (
            userID,
            blockerMode_highScore,
            timeMode_survivalTime,
            levelMode_level,
            sugarCoin,
            shufflePowerup,
            switchPowerup,
            bombPowerup
        ) VALUES (
            :user_id,
            :blocker,
            :time,
            :level,
            :coin,
            :shuffle,
            :switch,
            :bomb
        )
        ON CONFLICT(userID) DO UPDATE SET
            blockerMode_highScore = excluded.blockerMode_highScore,
            timeMode_survivalTime = excluded.timeMode_survivalTime,
            levelMode_level = excluded.levelMode_level,
            sugarCoin = excluded.sugarCoin,
            shufflePowerup = excluded.shufflePowerup,
            switchPowerup = excluded.switchPowerup,
            bombPowerup = excluded.bombPowerup,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->bindValue(':user_id', $userId, PDO::PARAM_INT);
    $statement->bindValue(':blocker', $columns['blockerMode_highScore'], PDO::PARAM_INT);
    $statement->bindValue(':time', $columns['timeMode_survivalTime'], PDO::PARAM_INT);
    $statement->bindValue(':level', $columns['levelMode_level'], PDO::PARAM_INT);
    $statement->bindValue(':coin', $columns['sugarCoin'], PDO::PARAM_INT);
    $statement->bindValue(':shuffle', $columns['shufflePowerup'], PDO::PARAM_INT);
    $statement->bindValue(':switch', $columns['switchPowerup'], PDO::PARAM_INT);
    $statement->bindValue(':bomb', $columns['bombPowerup'], PDO::PARAM_INT);
    $statement->execute();
}

function columnsToMetrics(array $row): array
{
    $powerups = [];
    foreach (POWERUP_TYPES as $type) {
        $powerups[$type] = clampPowerup($row[$type . 'Powerup'] ?? 0);
    }

    return [
        'highestLevel' => clampLevel($row['levelMode_level'] ?? 1),
        'blockerHighScore' => clampScore($row['blockerMode_highScore'] ?? 0),
        'timeSurvival' => clampTime($row['timeMode_survivalTime'] ?? 0),
        'sugarCoins' => clampCoins($row['sugarCoin'] ?? 0),
        'powerups' => $powerups
    ];
}

function metricsToColumns(array $metrics): array
{
    $powerups = clampPowerups($metrics['powerups'] ?? []);

    return [
        'blockerMode_highScore' => clampScore($metrics['blockerHighScore'] ?? 0),
        'timeMode_survivalTime' => clampTime($metrics['timeSurvival'] ?? 0),
        'levelMode_level' => clampLevel($metrics['highestLevel'] ?? 1),
        'sugarCoin' => clampCoins($metrics['sugarCoins'] ?? 0),
        'shufflePowerup' => $powerups['shuffle'],
        'switchPowerup' => $powerups['switch'],
        'bombPowerup' => $powerups['bomb']
    ];
}

function mergeMetrics(array $current, array $candidate): array
{
    $result = $current;
    $result['highestLevel'] = max($current['highestLevel'], $candidate['highestLevel'] ?? 1);
    $result['blockerHighScore'] = max($current['blockerHighScore'], $candidate['blockerHighScore'] ?? 0);
    $result['timeSurvival'] = max($current['timeSurvival'], $candidate['timeSurvival'] ?? 0);
    $result['sugarCoins'] = max($current['sugarCoins'], $candidate['sugarCoins'] ?? 0);

    $result['powerups'] = [];
    foreach (POWERUP_TYPES as $type) {
        $result['powerups'][$type] = max(
            $current['powerups'][$type] ?? 0,
            $candidate['powerups'][$type] ?? 0
        );
    }

    return $result;
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

function clampCoins(mixed $coins): int
{
    if (!is_numeric($coins)) {
        return 0;
    }

    $normalized = (int) floor((float) $coins);
    return max(0, $normalized);
}

function clampPowerups(mixed $powerups): array
{
    $result = [];
    foreach (POWERUP_TYPES as $type) {
        $value = null;
        if (is_array($powerups) && array_key_exists($type, $powerups)) {
            $value = $powerups[$type];
        }
        $result[$type] = clampPowerup($value);
    }
    return $result;
}

function clampPowerup(mixed $value): int
{
    if (!is_numeric($value)) {
        return 0;
    }

    $normalized = (int) floor((float) $value);
    return max(0, min(MAX_POWERUP_STOCK, $normalized));
}

function sanitizeUsername(?string $rawDisplayName): ?string
{
    $normalized = trim((string) ($rawDisplayName ?? ''));
    $normalized = preg_replace('/[\x00-\x1F\x7F]+/', '', $normalized) ?? '';

    if ($normalized === '') {
        return null;
    }

    if (mb_strlen($normalized) > 128) {
        $normalized = mb_substr($normalized, 0, 128);
    }

    return $normalized;
}

function determineUsername(?string $provided, int $userId, string $existing): string
{
    if ($provided !== null && $provided !== '') {
        return $provided;
    }

    if ($existing !== '') {
        return $existing;
    }

    return 'Player#' . $userId;
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

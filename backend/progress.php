<?php
declare(strict_types=1);

const PROGRESS_DB_PATH = __DIR__ . '/progress.sqlite';
const MAX_LEVEL = 50;

header('Content-Type: application/json');
header('Cache-Control: no-store');

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $database = openDatabase();

    if ($method === 'GET') {
        handleGet($database);
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
}

function handleGet(PDO $database): void
{
    $userId = requireUserId($_GET['userId'] ?? null);
    $progress = fetchProgress($database, $userId);
    $highestLevel = isset($progress['highest_level']) ? clampLevel($progress['highest_level']) : 1;

    respond(200, [
        'highestLevel' => $highestLevel,
        'data' => decodeData($progress['data'] ?? '{}')
    ]);
}

function handlePost(PDO $database): void
{
    $payload = decodeJsonRequest();
    $userId = requireUserId($payload['userId'] ?? null);
    $submittedLevel = clampLevel($payload['highestLevel'] ?? 1);
    $data = array_key_exists('data', $payload) && is_array($payload['data']) ? $payload['data'] : [];

    $progress = fetchProgress($database, $userId);
    $currentLevel = isset($progress['highest_level']) ? (int) $progress['highest_level'] : 1;
    $highestLevel = max($currentLevel, $submittedLevel);
    $encodedData = json_encode($data, JSON_THROW_ON_ERROR);

    saveProgress($database, $userId, $highestLevel, $encodedData);

    respond(200, [
        'highestLevel' => $highestLevel,
        'data' => $data
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

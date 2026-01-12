<?php
declare(strict_types=1);

const OPTIONS_DB_PATH = __DIR__ . '/progress.sqlite';
const DEFAULT_LOCALE = 'en';
const DEFAULT_CELL_SHAPE = 'square';
const DEFAULT_AUDIO = 1;
const DEFAULT_PERFORMANCE = 0;
const DEFAULT_RECORDING = 1;

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
    error_log('Options API error: ' . $exception->getMessage());
    respond(500, ['error' => 'Internal server error.']);
}

function openDatabase(): PDO
{
    $database = new PDO(
        'sqlite:' . OPTIONS_DB_PATH,
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
        'CREATE TABLE IF NOT EXISTS "UserOptions" (
            userId TEXT PRIMARY KEY,
            language TEXT NOT NULL,
            cellShape TEXT NOT NULL,
            audioEnabled INTEGER NOT NULL,
            performanceModeEnabled INTEGER NOT NULL,
            recordingEnabled INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );
}

function handleGet(PDO $database): void
{
    $userId = requireUserId($_GET['userId'] ?? null);
    $statement = $database->prepare('SELECT * FROM "UserOptions" WHERE userId = :user_id');
    $statement->execute([':user_id' => $userId]);
    $row = $statement->fetch();

    if (!$row) {
        respond(200, ['options' => null]);
    }

    respond(200, ['options' => normalizeOptionsRow($row)]);
}

function handlePost(PDO $database): void
{
    $payload = decodeJsonRequest();
    $userId = requireUserId($payload['userId'] ?? null);
    $incoming = $payload['options'] ?? [];
    if (!is_array($incoming)) {
        throw new InvalidArgumentException('Options payload must be an object.');
    }

    $options = normalizeOptions($incoming);

    $statement = $database->prepare(
        'INSERT INTO "UserOptions"
            (userId, language, cellShape, audioEnabled, performanceModeEnabled, recordingEnabled, updated_at)
         VALUES
            (:user_id, :language, :cell_shape, :audio_enabled, :performance_enabled, :recording_enabled, CURRENT_TIMESTAMP)
         ON CONFLICT(userId) DO UPDATE SET
            language = excluded.language,
            cellShape = excluded.cellShape,
            audioEnabled = excluded.audioEnabled,
            performanceModeEnabled = excluded.performanceModeEnabled,
            recordingEnabled = excluded.recordingEnabled,
            updated_at = CURRENT_TIMESTAMP'
    );
    $statement->execute([
        ':user_id' => $userId,
        ':language' => $options['language'],
        ':cell_shape' => $options['cellShape'],
        ':audio_enabled' => $options['audioEnabled'],
        ':performance_enabled' => $options['performanceModeEnabled'],
        ':recording_enabled' => $options['recordingEnabled']
    ]);

    respond(200, ['options' => normalizeOptionsRow($options)]);
}

function normalizeOptionsRow(array $row): array
{
    $normalized = normalizeOptions($row);
    return [
        'locale' => $normalized['language'],
        'cellShapeMode' => $normalized['cellShape'],
        'audioEnabled' => (bool) $normalized['audioEnabled'],
        'performanceModeEnabled' => (bool) $normalized['performanceModeEnabled'],
        'recordingEnabled' => (bool) $normalized['recordingEnabled']
    ];
}

function normalizeOptions(array $data): array
{
    $language = normalizeLocale($data['language'] ?? $data['locale'] ?? DEFAULT_LOCALE);
    $cellShape = normalizeCellShape($data['cellShape'] ?? $data['cellShapeMode'] ?? DEFAULT_CELL_SHAPE);
    $audioEnabled = normalizeBoolean($data['audioEnabled'] ?? DEFAULT_AUDIO);
    $performanceEnabled = normalizeBoolean($data['performanceModeEnabled'] ?? DEFAULT_PERFORMANCE);
    $recordingEnabled = normalizeBoolean($data['recordingEnabled'] ?? DEFAULT_RECORDING);

    return [
        'language' => $language,
        'cellShape' => $cellShape,
        'audioEnabled' => $audioEnabled,
        'performanceModeEnabled' => $performanceEnabled,
        'recordingEnabled' => $recordingEnabled
    ];
}

function normalizeLocale($value): string
{
    $candidate = is_string($value) ? strtolower(trim($value)) : '';
    if ($candidate === 'de') {
        return 'de';
    }
    return DEFAULT_LOCALE;
}

function normalizeCellShape($value): string
{
    $candidate = is_string($value) ? strtolower(trim($value)) : '';
    if ($candidate === 'shaped') {
        return 'shaped';
    }
    return DEFAULT_CELL_SHAPE;
}

function normalizeBoolean($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }
    if (is_numeric($value)) {
        return (int) ((int) $value !== 0);
    }
    return 0;
}

function requireUserId($value): string
{
    $userId = is_string($value) ? trim($value) : '';
    if ($userId === '') {
        throw new InvalidArgumentException('User ID is required.');
    }
    if (strlen($userId) > 128) {
        throw new InvalidArgumentException('User ID is too long.');
    }
    return $userId;
}

function decodeJsonRequest(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Invalid JSON payload.');
    }
    return $decoded;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

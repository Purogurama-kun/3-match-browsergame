<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing request body']);
    exit;
}

$decoded = json_decode($raw, true);
if (!$decoded || !isset($decoded['levels']) || !is_array($decoded['levels'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Body must include a levels array']);
    exit;
}

$pretty = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if ($pretty === false) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to encode JSON']);
    exit;
}

$target = __DIR__ . '/../assets/data/levels.json';
$result = file_put_contents($target, $pretty . "\n");
if ($result === false) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to write levels.json']);
    exit;
}

echo json_encode(['status' => 'ok']);

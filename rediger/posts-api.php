<?php
require __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

$currentUser = currentUser();
if ($currentUser === null || !isAdminUser($currentUser)) {
    http_response_code(403);
    echo json_encode(['error' => 'Bare administrator kan administrere innlegg.']);
    exit;
}

$postsDir = dirname(__DIR__) . '/innlegg';
$sourceDir = dirname(__DIR__) . '/data/posts';
$indexPath = $postsDir . '/index.json';

$readIndex = static function () use ($indexPath): array {
    if (!is_file($indexPath)) {
        return [];
    }
    $decoded = json_decode((string) @file_get_contents($indexPath), true);
    return is_array($decoded) ? $decoded : [];
};

$validId = static fn(string $id): bool => (bool) preg_match('/^[a-z0-9-]{4,40}$/', $id);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = (string) ($_GET['id'] ?? '');
    if (!$validId($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ugyldig innlegg.']);
        exit;
    }
    $sourcePath = $sourceDir . '/' . $id . '.json';
    $manuscript = is_file($sourcePath) ? json_decode((string) file_get_contents($sourcePath), true) : null;
    echo json_encode(['ok' => true, 'manuscript' => is_array($manuscript) ? $manuscript : null], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metoden er ikke tillatt.']);
    exit;
}

$input = json_decode((string) file_get_contents('php://input'), true);
$id = is_array($input) ? (string) ($input['id'] ?? '') : '';
if (($input['action'] ?? '') !== 'delete' || !$validId($id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Ugyldig forespørsel.']);
    exit;
}

foreach ([$postsDir . '/' . $id . '.html', $sourceDir . '/' . $id . '.json'] as $path) {
    if (is_file($path)) {
        unlink($path);
    }
}

$remaining = array_values(array_filter($readIndex(), static fn($entry) => ($entry['id'] ?? '') !== $id));
file_put_contents($indexPath, json_encode($remaining, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

echo json_encode(['ok' => true]);

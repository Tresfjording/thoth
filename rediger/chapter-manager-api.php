<?php
require __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

$chaptersPath = __DIR__ . '/../data/chapters.json';
$directory = dirname($chaptersPath);
if (!is_dir($directory)) {
    mkdir($directory, 0775, true);
}

if (currentUser() === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Du må være innlogget.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    $title = trim((string) ($payload['title'] ?? ''));
    $body = trim((string) ($payload['body'] ?? ''));

    if ($title === '' || $body === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Tittel og innhold er påkrevd.']);
        exit;
    }

    $chapters = [];
    if (is_file($chaptersPath)) {
        $existing = json_decode((string) file_get_contents($chaptersPath), true);
        if (is_array($existing)) {
            $chapters = $existing;
        }
    }

    $chapters[] = ['title' => $title, 'body' => $body];
    file_put_contents($chaptersPath, json_encode($chapters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    echo json_encode(['ok' => true, 'chapters' => $chapters]);
    exit;
}

if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $index = (int) $_GET['delete'];
    $chapters = [];
    if (is_file($chaptersPath)) {
        $existing = json_decode((string) file_get_contents($chaptersPath), true);
        if (is_array($existing)) {
            $chapters = $existing;
        }
    }

    if (isset($chapters[$index])) {
        array_splice($chapters, $index, 1);
        file_put_contents($chaptersPath, json_encode($chapters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        echo json_encode(['ok' => true, 'chapters' => $chapters]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Kapittel ble ikke funnet.']);
    exit;
}

$chapters = [];
if (is_file($chaptersPath)) {
    $existing = json_decode((string) file_get_contents($chaptersPath), true);
    if (is_array($existing)) {
        $chapters = $existing;
    }
}

echo json_encode(['chapters' => $chapters]);

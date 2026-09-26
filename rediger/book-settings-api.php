<?php
require __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

$settingsPath = __DIR__ . '/../data/book-settings.json';
$directory = dirname($settingsPath);
if (!is_dir($directory)) {
    mkdir($directory, 0775, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (currentUser() === null) {
        http_response_code(401);
        echo json_encode(['error' => 'Du må være innlogget.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);

    $existingSettings = ['book_title' => 'THOTH', 'chapter_label' => 'Kapittel'];
    if (is_file($settingsPath)) {
        $stored = json_decode((string) file_get_contents($settingsPath), true);
        if (is_array($stored)) {
            $existingSettings = [
                'book_title' => (string) ($stored['book_title'] ?? $existingSettings['book_title']),
                'chapter_label' => (string) ($stored['chapter_label'] ?? $existingSettings['chapter_label']),
            ];
        }
    }

    $bookTitle = trim((string) ($payload['book_title'] ?? $existingSettings['book_title']));
    $chapterLabel = trim((string) ($payload['chapter_label'] ?? $existingSettings['chapter_label']));

    if ($bookTitle === '' && $chapterLabel === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Boktittel eller kapittellabel må fylles ut.']);
        exit;
    }

    $settings = [
        'book_title' => $bookTitle !== '' ? $bookTitle : $existingSettings['book_title'],
        'chapter_label' => $chapterLabel !== '' ? $chapterLabel : $existingSettings['chapter_label'],
        'updated_at' => date('c'),
    ];

    file_put_contents($settingsPath, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    echo json_encode(['ok' => true, 'settings' => $settings]);
    exit;
}

if (currentUser() === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Du må være innlogget.']);
    exit;
}

$defaultSettings = ['book_title' => 'THOTH', 'chapter_label' => 'Kapittel'];
if (is_file($settingsPath)) {
    $stored = json_decode((string) file_get_contents($settingsPath), true);
    if (is_array($stored)) {
        $defaultSettings = [
            'book_title' => (string) ($stored['book_title'] ?? $defaultSettings['book_title']),
            'chapter_label' => (string) ($stored['chapter_label'] ?? $defaultSettings['chapter_label']),
        ];
    }
}

echo json_encode(['settings' => $defaultSettings]);

<?php
require __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

if (currentUser() === null || !isAdminUser(currentUser())) {
    http_response_code(403);
    echo json_encode(['error' => 'Bare administrator kan administrere kategorier.']);
    exit;
}

$categoriesPath = dirname(__DIR__) . '/data/categories.json';
$directory = dirname($categoriesPath);
if (!is_dir($directory)) {
    mkdir($directory, 0775, true);
}

$readCategories = static function () use ($categoriesPath): array {
    if (!is_file($categoriesPath)) {
        return [];
    }
    $decoded = json_decode((string) @file_get_contents($categoriesPath), true);
    return is_array($decoded)
        ? array_values(array_unique(array_filter($decoded, 'is_string')))
        : [];
};

$categories = $readCategories();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['categories' => $categories], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metoden er ikke tillatt.']);
    exit;
}

$input = json_decode((string) file_get_contents('php://input'), true);
$action = is_array($input) ? (string) ($input['action'] ?? '') : '';
$name = trim((string) (is_array($input) ? ($input['name'] ?? '') : ''));
$replacement = trim((string) (is_array($input) ? ($input['replacement'] ?? '') : ''));
if (!in_array($action, ['add', 'rename', 'delete'], true) || $name === '' || mb_strlen($name) > 60) {
    http_response_code(400);
    echo json_encode(['error' => 'Skriv inn et kategorinavn på maks 60 tegn.']);
    exit;
}

if ($action === 'add' && in_array($name, $categories, true)) {
    echo json_encode(['ok' => true, 'category' => $name, 'categories' => $categories], JSON_UNESCAPED_UNICODE);
    exit;
}

$category = $name;
if ($action === 'rename') {
    if ($replacement === '' || mb_strlen($replacement) > 60 || !in_array($name, $categories, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Kategorien finnes ikke, eller det nye navnet er ugyldig.']);
        exit;
    }
    if (in_array($replacement, $categories, true)) {
        http_response_code(409);
        echo json_encode(['error' => 'Det finnes allerede en kategori med dette navnet.']);
        exit;
    }
    $categories[array_search($name, $categories, true)] = $replacement;
    $category = $replacement;
} elseif ($action === 'delete') {
    $categories = array_values(array_filter($categories, static fn(string $categoryName): bool => $categoryName !== $name));
    $category = '';
} else {
    $categories[] = $name;
}

if (file_put_contents($categoriesPath, json_encode($categories, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Kategoriene kunne ikke lagres.']);
    exit;
}

$postsIndexPath = dirname(__DIR__) . '/innlegg/index.json';
$sourceDir = dirname(__DIR__) . '/data/posts';
if (in_array($action, ['rename', 'delete'], true) && is_file($postsIndexPath)) {
    $posts = json_decode((string) file_get_contents($postsIndexPath), true);
    if (is_array($posts)) {
        foreach ($posts as &$post) {
            if (($post['category'] ?? '') === $name) $post['category'] = $action === 'rename' ? $replacement : '';
            $sourcePath = $sourceDir . '/' . ($post['id'] ?? '') . '.json';
            if (is_file($sourcePath)) {
                $source = json_decode((string) file_get_contents($sourcePath), true);
                if (is_array($source) && ($source['category'] ?? '') === $name) {
                    $source['category'] = $action === 'rename' ? $replacement : '';
                    file_put_contents($sourcePath, json_encode($source, JSON_UNESCAPED_UNICODE), LOCK_EX);
                }
            }
        }
        unset($post);
        file_put_contents($postsIndexPath, json_encode($posts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
}

$messages = ['add' => 'Kategorien er registrert.', 'rename' => 'Kategorien er endret.', 'delete' => 'Kategorien er slettet.'];
echo json_encode(['ok' => true, 'category' => $category, 'message' => $messages[$action], 'categories' => $categories], JSON_UNESCAPED_UNICODE);

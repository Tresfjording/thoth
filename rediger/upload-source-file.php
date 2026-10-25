<?php
require __DIR__ . '/auth.php';

const MAX_SOURCE_FILE_BYTES = 5 * 1024 * 1024;
const GITHUB_OWNER = 'Tresfjording';
const GITHUB_REPOSITORY = 'tresfjording';
const GITHUB_BRANCH = 'master';
const GITHUB_UPLOAD_DIRECTORY = 'thoth/uploads';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$currentUser = currentUser();
if ($currentUser === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Du må være innlogget for å laste opp filer.']);
    exit;
}

if (!isAdminUser($currentUser)) {
    http_response_code(403);
    echo json_encode(['error' => 'Bare administrator kan laste opp filer til GitHub.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Bare POST er tillatt.']);
    exit;
}

$file = $_FILES['source_file'] ?? null;
if (!is_array($file) || !isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Fila kunne ikke lastes opp til serveren.']);
    exit;
}

if (!isset($file['size']) || $file['size'] > MAX_SOURCE_FILE_BYTES) {
    http_response_code(400);
    echo json_encode(['error' => 'Fila er for stor (maks 5 MB).']);
    exit;
}

$originalName = basename(str_replace('\\', '/', (string) ($file['name'] ?? '')));
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!in_array($extension, ['txt', 'html', 'htm'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bare TXT-, HTML- og HTM-filer er tillatt.']);
    exit;
}

$contents = file_get_contents((string) $file['tmp_name']);
if ($contents === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Kunne ikke lese den opplastede fila.']);
    exit;
}

$token = getenv('THOTH_GITHUB_TOKEN');
if (!is_string($token) || trim($token) === '') {
    http_response_code(503);
    echo json_encode(['error' => 'GitHub-opplasting er ikke konfigurert på serveren.']);
    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(503);
    echo json_encode(['error' => 'GitHub-opplasting krever cURL-utvidelsen på serveren.']);
    exit;
}

$stem = pathinfo($originalName, PATHINFO_FILENAME);
$stem = preg_replace('/[^A-Za-z0-9_-]+/', '-', $stem);
$stem = trim(substr((string) $stem, 0, 80), '-_.');
if ($stem === '') {
    $stem = 'manuskript';
}

// Keep uploaded HTML as plain text so GitHub Pages cannot execute it on the site origin.
$storedExtension = $extension === 'txt' ? '.txt' : '.' . $extension . '.txt';
$storedName = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '-' . $stem . $storedExtension;
$path = GITHUB_UPLOAD_DIRECTORY . '/' . $storedName;
$url = 'https://api.github.com/repos/' . GITHUB_OWNER . '/' . GITHUB_REPOSITORY
    . '/contents/' . GITHUB_UPLOAD_DIRECTORY . '/' . rawurlencode($storedName);

$payload = json_encode([
    'message' => 'THOTH: upload ' . $storedName,
    'content' => base64_encode($contents),
    'branch' => GITHUB_BRANCH,
]);
if ($payload === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Kunne ikke klargjøre fila for GitHub.']);
    exit;
}

$curl = curl_init($url);
if ($curl === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Kunne ikke starte forbindelsen til GitHub.']);
    exit;
}

curl_setopt_array($curl, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'Accept: application/vnd.github+json',
        'Authorization: Bearer ' . trim($token),
        'Content-Type: application/json',
        'User-Agent: THOTH-file-uploader',
        'X-GitHub-Api-Version: 2022-11-28',
    ],
]);

$githubResponse = curl_exec($curl);
$curlError = curl_error($curl);
$statusCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if (!is_string($githubResponse)) {
    http_response_code(502);
    echo json_encode(['error' => 'Kunne ikke kontakte GitHub: ' . $curlError]);
    exit;
}

$result = json_decode($githubResponse, true);
if (
    !in_array($statusCode, [200, 201], true)
    || !is_array($result)
    || ($result['content']['path'] ?? null) !== $path
) {
    $details = is_array($result) && isset($result['message']) && is_string($result['message'])
        ? ': ' . $result['message']
        : '';
    http_response_code(502);
    echo json_encode(['error' => 'GitHub lagret ikke fila (HTTP ' . $statusCode . ')' . $details . '.']);
    exit;
}

echo json_encode([
    'ok' => true,
    'name' => $storedName,
    'path' => $path,
]);

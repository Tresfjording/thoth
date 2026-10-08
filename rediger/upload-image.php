<?php
require __DIR__ . '/auth.php';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

header('Content-Type: application/json; charset=utf-8');

$currentUser = currentUser();
if ($currentUser === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Du må være innlogget for å laste opp bilder.']);
    exit;
}

if (!isAdminUser($currentUser)) {
    http_response_code(403);
    echo json_encode(['error' => 'Bare administrator kan laste opp bilder.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Opplastingen mislyktes. Bildet kan være for stort for serveren.']);
    exit;
}

$file = $_FILES['image'];
if ($file['size'] > MAX_IMAGE_BYTES) {
    http_response_code(400);
    echo json_encode(['error' => 'Bildet er for stort (maks 5 MB).']);
    exit;
}

$info = @getimagesize($file['tmp_name']);
$extensions = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
if ($info === false || !isset($extensions[$info[2]])) {
    http_response_code(400);
    echo json_encode(['error' => 'Bare JPG, PNG, GIF og WebP er tillatt.']);
    exit;
}

$directory = dirname(__DIR__) . '/innlegg/bilder';
if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
    http_response_code(500);
    echo json_encode(['error' => 'Kunne ikke opprette bildemappen.']);
    exit;
}

$name = date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.' . $extensions[$info[2]];
if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $name)) {
    http_response_code(500);
    echo json_encode(['error' => 'Bildet kunne ikke lagres.']);
    exit;
}

$basePath = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME']))), '/');
echo json_encode(['ok' => true, 'url' => $basePath . '/innlegg/bilder/' . $name]);

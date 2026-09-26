<?php
require __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');

$user = currentUser();
$status = authStatus();
if (!$status['loggedIn'] || $user === null) {
    http_response_code(401);
    echo json_encode(['loggedIn' => false]);
    exit;
}

echo json_encode([
    'loggedIn' => true,
    'username' => $status['username'],
    'displayName' => $status['displayName'],
    'isAdmin' => isAdminUser($user),
]);

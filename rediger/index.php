<?php
require __DIR__ . '/auth.php';
requireAuth();

$path = __DIR__ . '/index.html';
if (!is_file($path)) {
    http_response_code(500);
    echo 'Editorfil mangler.';
    exit;
}

readfile($path);

<?php
declare(strict_types=1);

$indexHtml = __DIR__ . '/index.html';
if (!is_file($indexHtml)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'BUILD_NOT_FOUND';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
readfile($indexHtml);

<?php
declare(strict_types=1);

/**
 * Serve latest built asset when a stale hashed asset URL is requested.
 * This prevents white-screen failures for clients with cached old index.html.
 */
function serveAssetFallbackIfNeeded(string $baseDir): void
{
    $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
    $requestPath = parse_url($requestUri, PHP_URL_PATH);
    if (!is_string($requestPath)) {
        return;
    }

    $requestPath = rawurldecode($requestPath);
    if (!preg_match('#^/assets/index-[A-Za-z0-9_-]+\.(js|css)$#', $requestPath, $matches)) {
        return;
    }

    $extension = strtolower($matches[1]);
    $assetCandidates = glob($baseDir . '/assets/index-*.' . $extension);
    if (!is_array($assetCandidates) || count($assetCandidates) === 0) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'ASSET_NOT_FOUND';
        exit;
    }

    usort($assetCandidates, static function (string $left, string $right): int {
        return filemtime($right) <=> filemtime($left);
    });

    $latestAsset = $assetCandidates[0];
    if (!is_file($latestAsset)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'ASSET_NOT_FOUND';
        exit;
    }

    if ($extension === 'js') {
        header('Content-Type: application/javascript; charset=utf-8');
    } else {
        header('Content-Type: text/css; charset=utf-8');
    }
    header('Cache-Control: public, max-age=300, must-revalidate');
    header('X-Splaro-Asset-Fallback: 1');
    readfile($latestAsset);
    exit;
}

serveAssetFallbackIfNeeded(__DIR__);

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

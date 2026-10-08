<?php
require __DIR__ . '/auth.php';

const PUBLISH_TOKEN = '18105433324';
define('OUTPUT_HTML_FILE', dirname(__DIR__) . '/arbeidskopi.html');
define('POSTS_DIR', dirname(__DIR__) . '/innlegg');
define('LEGACY_JSON_FILE', dirname(__DIR__) . '/arbeidskopi.json');

header('Content-Type: application/json; charset=utf-8');

$currentUser = currentUser();
if ($currentUser === null) {
    http_response_code(401);
    echo json_encode(['error' => 'Du må være innlogget for å publisere.']);
    exit;
}

if (!isAdminUser($currentUser)) {
    http_response_code(403);
    echo json_encode(['error' => 'Bare administrator kan publisere. Lesere har kun lesetilgang.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Bare POST er tillatt.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
$manuscript = is_array($input) ? ($input['manuscript'] ?? null) : null;

if (!is_array($manuscript)) {
    http_response_code(400);
    echo json_encode(['error' => 'Arbeidskopien mangler.']);
    exit;
}

$allowedFields = ['title', 'intro', 'author', 'chapter', 'body'];
$publishedCopy = [];
foreach ($allowedFields as $field) {
    $value = $manuscript[$field] ?? '';
    if (!is_string($value)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ugyldig innhold i arbeidskopien.']);
        exit;
    }
    $publishedCopy[$field] = $value;
}

$postId = strtolower(trim((string) ($input['post_id'] ?? '')));
if (!preg_match('/^[a-z0-9-]{4,40}$/', $postId)) {
    $postId = date('Ymd') . '-' . bin2hex(random_bytes(4));
}

$settingsPath = dirname(__DIR__) . '/data/book-settings.json';
$settings = [];
if (is_file($settingsPath)) {
    $settingsJson = @file_get_contents($settingsPath);
    if (is_string($settingsJson)) {
        $decodedSettings = json_decode($settingsJson, true);
        if (is_array($decodedSettings)) {
            $settings = $decodedSettings;
        }
    }
}

$postTitle = trim($publishedCopy['title']);
if (($postTitle === '' || $postTitle === 'Skriv her') && isset($settings['book_title']) && trim((string) $settings['book_title']) !== '') {
    $publishedCopy['title'] = trim((string) $settings['book_title']);
}

$chapterLabel = trim((string) ($settings['chapter_label'] ?? 'Kapittel'));
if ($chapterLabel === '') {
    $chapterLabel = 'Kapittel';
}
if (trim((string) ($publishedCopy['chapter'] ?? '')) === '' || trim((string) $publishedCopy['chapter']) === 'Arbeidsnotat' || trim((string) $publishedCopy['chapter']) === 'Kapittel 1') {
    $publishedCopy['chapter'] = $chapterLabel;
}

$chaptersPath = dirname(__DIR__) . '/data/chapters.json';
$storedChapters = [];
if (is_file($chaptersPath)) {
    $chaptersJson = @file_get_contents($chaptersPath);
    if (is_string($chaptersJson)) {
        $decodedChapters = json_decode($chaptersJson, true);
        if (is_array($decodedChapters)) {
            $storedChapters = $decodedChapters;
        }
    }
}

$publishedCopy['body'] = strip_tags(
    $publishedCopy['body'],
    '<p><br><strong><b><em><i><u><h2><h3><blockquote><ul><ol><li><img><figure><figcaption>'
);
$publishedCopy['body'] = preg_replace_callback('/<figure\b[^>]*>/i', static function (array $match): string {
    $classes = [];
    if (preg_match('/\bclass="([^"]*)"/i', $match[0], $classMatch)) {
        foreach (preg_split('/\s+/', trim($classMatch[1])) as $name) {
            if (preg_match('/^img-(?:wrap|align-(?:left|center|right)|size-(?:25|50|75|100))$/', $name)) {
                $classes[] = $name;
            }
        }
    }
    return '<figure' . ($classes ? ' class="' . implode(' ', $classes) . '"' : '') . '>';
}, $publishedCopy['body']);
$publishedCopy['body'] = preg_replace('/<figcaption\b[^>]*>/i', '<figcaption>', $publishedCopy['body']);
$publishedCopy['body'] = preg_replace_callback('/<img\b[^>]*>/i', static function (array $match): string {
    if (!preg_match('/\ssrc="([^"]*)"/i', $match[0], $src)
        || !preg_match('#^/?[\w/.-]*innlegg/bilder/[\w-]+\.(?:jpg|png|gif|webp)$#', $src[1])) {
        return '';
    }
    $alt = preg_match('/\salt="([^"]*)"/i', $match[0], $altMatch) ? $altMatch[1] : '';
    return '<img src="' . $src[1] . '" alt="' . htmlspecialchars(html_entity_decode($alt), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">';
}, $publishedCopy['body']);
$publishedCopy['body'] = preg_replace('/<\s*h2\b/i', '<h3', $publishedCopy['body']);
$publishedCopy['body'] = preg_replace('/<\s*\/\s*h2\s*>/i', '</h3>', $publishedCopy['body']);

if (trim($publishedCopy['body']) === '' && isset($storedChapters[0])) {
    $chapterHtml = '';
    foreach ($storedChapters as $chapterEntry) {
        $title = trim((string) ($chapterEntry['title'] ?? ''));
        $bodyContent = trim((string) ($chapterEntry['body'] ?? ''));
        if ($title === '' && $bodyContent === '') {
            continue;
        }
        $chapterHtml .= '<h3>' . htmlspecialchars($title !== '' ? $title : $chapterLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</h3>';
        if ($bodyContent !== '') {
            $chapterHtml .= '<p>' . nl2br(htmlspecialchars($bodyContent, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) . '</p>';
        }
    }
    $publishedCopy['body'] = $chapterHtml;
}

$escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$body = preg_replace(
    '/<(p|br|strong|b|em|i|u|h2|h3|blockquote|ul|ol|li)(?:\s[^>]*)?>/i',
    '<$1>',
    $publishedCopy['body']
);
$chapterLinks = [];
$chapterNumber = 0;
$chapterCount = preg_match_all('/<h3\b/i', $body);
if ($chapterCount < 1) {
    http_response_code(400);
    echo json_encode(['error' => 'Boka trenger minst ett kapittel med kapitteloverskrift før publisering.']);
    exit;
}
$body = preg_replace_callback('/<h3>(.*?)<\/h3>/is', static function (array $match) use (&$chapterLinks, &$chapterNumber, $escape): string {
    $chapterNumber++;
    $chapterTitle = trim(strip_tags($match[1]));
    $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($chapterTitle));
    $slug = trim($slug, '-') ?: 'kapittel';
    $id = $slug . '-' . $chapterNumber;
    $chapterLinks[] = '<div class="chapter-item"><a href="#' . $id . '">' . $escape($chapterTitle) . '</a><a class="chapter-edit"     href="{{EDIT_BASE}}rediger/index.html?chapter=' . rawurlencode($id) . '">rediger</a></div>';
    return '<h3 id="' . $id . '">' . $match[1] . '</h3>';
}, $body);
$chapterNavigation = $chapterLinks
    ? '<nav aria-label="Kapitler"><p class="nav-label">Kapitler</p>' . implode('', $chapterLinks) . '</nav>'
    : '<nav aria-label="Kapitler"><p class="nav-label">Kapitler</p><span class="nav-empty">Minst 1 kapittel kreves</span></nav>';
$html = '<!doctype html><html lang="no"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width, initial-scale=1">'
    . '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">'
    . '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">'
    . '<meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">'
    . '<title>' . $escape($publishedCopy['title']) . '</title>'
    . '<style>'
    . ':root{--ink:#1f1a17;--muted:#6b5e53;--paper:#fffaf2;--wash:#eee2d6;--accent:#8d3f25}'
    . '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font:18px/1.7 Georgia,serif;user-select:none;-webkit-user-select:none;-ms-user-select:none;-webkit-touch-callout:none}'
    . '.layout{display:grid;grid-template-columns:220px minmax(0,760px);gap:56px;max-width:1100px;margin:0 auto;padding:64px 28px}'
    . 'nav{position:sticky;top:40px;align-self:start;padding:18px 0}.nav-label{margin:0 0 18px;color:var(--muted);font:700 11px/1.2 Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase}'
    . '.chapter-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0}.chapter-item a{display:block;color:var(--muted);font:15px/1.35 Arial,sans-serif;text-decoration:none;border-left:2px solid transparent;padding-left:14px}.chapter-item a:hover{color:var(--accent);border-color:var(--accent)}.chapter-edit{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)!important;border-left:none!important;padding-left:0!important}.nav-empty{color:var(--muted);font:14px Arial,sans-serif}'
    . '.book{padding:72px clamp(32px,8vw,88px);background:var(--paper);box-shadow:0 18px 45px rgba(68,43,21,.12)}'
    . 'h1{margin:18px 0 24px;font-size:clamp(2.6rem,6vw,4.5rem);line-height:.98}h3{scroll-margin-top:32px;margin:56px 0 18px;font-size:2rem;line-height:1.1}em{color:var(--muted)}img{display:block;max-width:100%;height:auto;margin:1.4em auto;border-radius:6px;-webkit-user-drag:none}article{display:flow-root}figure{width:100%;margin:1.4em auto}figure img{width:100%;margin:0}figure.img-size-25{width:25%}figure.img-size-50{width:50%}figure.img-size-75{width:75%}figure.img-size-100{width:100%}figure.img-align-left{margin:1.4em auto 1.4em 0}figure.img-align-right{margin:1.4em 0 1.4em auto}figure.img-wrap.img-align-left{float:left;margin:.3em 1.4em 1em 0}figure.img-wrap.img-align-right{float:right;margin:.3em 0 1em 1.4em}figcaption{margin-top:.5em;color:var(--muted);font-size:.9rem;font-style:italic;line-height:1.4;text-align:center}h3{clear:both}@media(max-width:600px){figure.img-wrap{float:none!important;margin:1.4em auto!important}}article{margin-top:34px}small{color:var(--muted)}'
    . '.locked{padding:80px 24px;text-align:center;color:var(--muted);font:600 18px/1.6 Arial,sans-serif}.locked strong{display:block;color:var(--ink);font-size:2rem;margin-bottom:12px}'
    . '@media(max-width:800px){.layout{display:block;padding:24px 14px}.layout nav{position:static;padding:0 10px 24px}.layout nav a{display:inline-block;margin-right:14px}.book{padding:42px 28px}}'
    . '</style>'
    . '</head><body><script>'
    . '(function(){const allowedHosts=new Set(["www.tresfjording.no","tresfjording.no","localhost"]);'
    . 'if(!allowedHosts.has(window.location.hostname)){'
    . 'document.body.innerHTML="<main class=\"locked\"><strong>Kun på eget domene</strong>Denne boken er kun tilgjengelig på tresfjording.no.</main>";'
    . 'return;}'
    . 'const block = function(event){if((event.ctrlKey||event.metaKey)&&["c","C","s","S","p","P","u","U","a","A"].includes(event.key)){event.preventDefault();}if(event.key==="PrintScreen"){event.preventDefault();}};'
    . 'document.addEventListener("contextmenu", function(event){event.preventDefault();}, {passive:false});'
    . 'document.addEventListener("copy", function(event){event.preventDefault();}, {passive:false});'
    . 'document.addEventListener("cut", function(event){event.preventDefault();}, {passive:false});'
    . 'document.addEventListener("dragstart", function(event){event.preventDefault();}, {passive:false});'
    . 'document.addEventListener("selectstart", function(event){event.preventDefault();}, {passive:false});'
    . 'document.addEventListener("keydown", block, {passive:false});'
    . '})();</script><div class="layout">' . $chapterNavigation
    . '<main class="book"><small>' . $escape($publishedCopy['chapter']) . '</small>'
    . '<h1>' . $escape($publishedCopy['title']) . '</h1>'
    . '<p><em>' . $escape($publishedCopy['intro']) . '</em></p>'
    . '<article>' . $body . '</article>'
    . '<p><small>' . $escape($publishedCopy['author']) . '</small></p></main></div>'
    . '</body></html>';

if (!is_dir(POSTS_DIR) && !mkdir(POSTS_DIR, 0775, true) && !is_dir(POSTS_DIR)) {
    http_response_code(500);
    echo json_encode(['error' => 'Kunne ikke opprette mappen for innlegg.']);
    exit;
}

$postFile = POSTS_DIR . '/' . $postId . '.html';
if (file_put_contents($postFile, str_replace('{{EDIT_BASE}}', '../', $html), LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Innlegget kunne ikke publiseres.']);
    exit;
}

$indexPath = POSTS_DIR . '/index.json';
$postIndex = [];
if (is_file($indexPath)) {
    $decodedIndex = json_decode((string) @file_get_contents($indexPath), true);
    if (is_array($decodedIndex)) {
        $postIndex = $decodedIndex;
    }
}
$postIndex = array_values(array_filter($postIndex, static fn($entry) => ($entry['id'] ?? '') !== $postId));
array_unshift($postIndex, [
    'id' => $postId,
    'title' => trim($publishedCopy['title']),
    'chapter' => trim($publishedCopy['chapter']),
    'intro' => trim($publishedCopy['intro']),
    'published_at' => date('c'),
]);
file_put_contents($indexPath, json_encode($postIndex, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

$sourceDir = dirname(__DIR__) . '/data/posts';
if (is_dir($sourceDir) || mkdir($sourceDir, 0775, true) || is_dir($sourceDir)) {
    file_put_contents($sourceDir . '/' . $postId . '.json', json_encode($publishedCopy, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

if (file_put_contents(OUTPUT_HTML_FILE, str_replace('{{EDIT_BASE}}', './', $html), LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Arbeidskopien ble lagret, men HTML-siden kunne ikke opprettes.']);
    exit;
}

if (is_file(LEGACY_JSON_FILE)) {
    unlink(LEGACY_JSON_FILE);
}

$path = 'https://www.tresfjording.no/thoth/innlegg/' . $postId . '.html?v=' . time();
echo json_encode(['ok' => true, 'message' => 'Innlegget er publisert.', 'url' => $path, 'post_id' => $postId]);

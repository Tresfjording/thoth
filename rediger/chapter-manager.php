<?php
require __DIR__ . '/auth.php';
requireAuth();

$errors = [];
$success = '';
$chapters = [];

$bodyPath = __DIR__ . '/../data/chapters.json';
if (is_file($bodyPath)) {
    $raw = json_decode((string) file_get_contents($bodyPath), true);
    if (is_array($raw)) {
        $chapters = $raw;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $chapterTitle = trim((string) ($_POST['chapter_title'] ?? ''));
    $chapterBody = trim((string) ($_POST['chapter_body'] ?? ''));

    if ($chapterTitle === '') {
        $errors[] = 'Kapitteloverskrift er påkrevd.';
    }
    if ($chapterBody === '') {
        $errors[] = 'Kapitteltekst er påkrevd.';
    }

    if ($errors === []) {
        $chapters[] = ['title' => $chapterTitle, 'body' => $chapterBody];
        $dir = dirname($bodyPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        file_put_contents($bodyPath, json_encode($chapters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        $success = 'Kapittelet ble lagt til.';
    }
}

if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $index = (int) $_GET['delete'];
    if (isset($chapters[$index])) {
        array_splice($chapters, $index, 1);
        file_put_contents($bodyPath, json_encode($chapters, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        $success = 'Kapittelet ble slettet.';
    }
}
?>
<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>THOTH | Kapittelbehandler</title>
    <style>
        :root {
            --bg: #f6efe8;
            --panel: #fffaf3;
            --ink: #1f1a17;
            --muted: #6a5c52;
            --accent: #7b3d2b;
            --border: #d7c9bc;
            --error: #8f2a2a;
            --success: #285d3d;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            background: var(--bg);
            color: var(--ink);
            font-family: Arial, sans-serif;
            padding: 30px 18px;
        }
        .shell {
            width: min(92vw, 900px);
            margin: 0 auto;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 26px 24px;
        }
        h1 { margin-top: 0; }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
        }
        .card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 18px;
        }
        label { display: block; margin-bottom: 6px; font-weight: 700; }
        input, textarea {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 12px;
            font-size: 1rem;
        }
        textarea { min-height: 120px; resize: vertical; }
        button {
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 16px;
            cursor: pointer;
            font-weight: 700;
        }
        ul {
            margin: 0;
            padding-left: 18px;
        }
        li {
            margin: 8px 0;
        }
        .delete {
            margin-left: 8px;
            color: var(--accent);
            text-decoration: none;
            font-weight: 700;
        }
        .error-list, .success {
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 12px;
        }
        .error-list {
            background: rgba(143, 42, 42, 0.08);
            color: var(--error);
        }
        .success {
            background: rgba(40, 93, 61, 0.08);
            color: var(--success);
        }
        .nav {
            margin-top: 18px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        .nav a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 700;
        }
        @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Kapittelbehandler</h1>

        <?php if ($errors !== []): ?>
            <div class="error-list"><?php foreach ($errors as $error): ?><div><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div><?php endforeach; ?></div>
        <?php endif; ?>

        <?php if ($success !== ''): ?>
            <div class="success"><?php echo htmlspecialchars($success, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <div class="grid">
            <section class="card">
                <h2>Legg til kapittel</h2>
                <form method="post" action="chapter-manager.php">
                    <label for="chapter_title">Kapitteloverskrift</label>
                    <input id="chapter_title" name="chapter_title" type="text" required>

                    <label for="chapter_body">Kapitteltekst</label>
                    <textarea id="chapter_body" name="chapter_body" required></textarea>

                    <button type="submit">Legg til kapittel</button>
                </form>
            </section>

            <section class="card">
                <h2>Eksisterende kapitler</h2>
                <?php if ($chapters === []): ?>
                    <p>Ingen kapitler er lagret ennå.</p>
                <?php else: ?>
                    <ul>
                        <?php foreach ($chapters as $index => $chapter): ?>
                            <li>
                                <?php echo htmlspecialchars((string) ($chapter['title'] ?? 'Uten tittel'), ENT_QUOTES, 'UTF-8'); ?>
                                <a class="delete" href="chapter-manager.php?delete=<?php echo (int) $index; ?>" onclick="return confirm('Slette dette kapittelet?');">Slett</a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </section>
        </div>

        <div class="nav">
            <a href="index.php">Til editoren</a>
            <a href="profile.php">Min profil</a>
            <a href="book-settings.php">Bokinstillinger</a>
        </div>
    </main>
</body>
</html>

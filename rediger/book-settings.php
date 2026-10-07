<?php
require __DIR__ . '/auth.php';
requireAuth();

$errors = [];
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = trim((string) ($_POST['book_title'] ?? ''));
    $chapterLabel = trim((string) ($_POST['chapter_label'] ?? ''));

    if ($title === '') {
        $errors[] = 'Tittel er påkrevd.';
    }
    if ($chapterLabel === '') {
        $errors[] = 'Kapitteltekst er påkrevd.';
    }

    if ($errors === []) {
        $settings = [
            'book_title' => $title,
            'chapter_label' => $chapterLabel,
            'updated_at' => date('c'),
        ];

        $path = __DIR__ . '/../data/book-settings.json';
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        file_put_contents($path, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        $success = 'Instillingene ble lagret.';
    }
}

$bookTitle = 'THOTH';
$chapterLabel = 'Kapittel';
$settingsPath = __DIR__ . '/../data/book-settings.json';
if (is_file($settingsPath)) {
    $settings = json_decode((string) file_get_contents($settingsPath), true);
    if (is_array($settings)) {
        $bookTitle = (string) ($settings['book_title'] ?? $bookTitle);
        $chapterLabel = (string) ($settings['chapter_label'] ?? $chapterLabel);
    }
}
?>
<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>THOTH | Innstilliger</title>
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
            display: grid;
            place-items: center;
            background: var(--bg);
            color: var(--ink);
            font-family: Arial, sans-serif;
        }
        .shell {
            width: min(92vw, 620px);
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 26px 24px;
            box-shadow: 0 18px 40px rgba(43, 29, 18, 0.08);
        }
        h1 { margin-top: 0; }
        label { display: block; margin-bottom: 6px; font-weight: 700; }
        input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 10px;
            margin-bottom: 12px;
            font-size: 1rem;
        }
        button {
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 16px;
            cursor: pointer;
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
    </style>
</head>
<body>
    <main class="shell">
        <h1>Bokinstillinger</h1>

        <?php if ($errors !== []): ?>
            <div class="error-list">
                <?php foreach ($errors as $error): ?>
                    <div><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($success !== ''): ?>
            <div class="success"><?php echo htmlspecialchars($success, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post" action="book-settings.php">
            <label for="book_title">Innleggstittel</label>
            <input id="book_title" name="book_title" type="text" value="<?php echo htmlspecialchars($bookTitle, ENT_QUOTES, 'UTF-8'); ?>" required>

            <label for="chapter_label">Standard kapittellabel</label>
            <input id="chapter_label" name="chapter_label" type="text" value="<?php echo htmlspecialchars($chapterLabel, ENT_QUOTES, 'UTF-8'); ?>" required>

            <button type="submit">Lagre Innstillinger</button>
        </form>

        <div class="nav">
            <a href="index.php">Til editoren</a>
            <a href="profile.php">Min profil</a>
        </div>
    </main>
</body>
</html>

<?php
require __DIR__ . '/auth.php';
requireAuth();

$user = currentUser();
if ($user === null) {
    header('Location: login.php', true, 302);
    exit;
}

$errors = [];
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'profile';

    if ($action === 'delete_account') {
        $result = deleteCurrentUser();
        if ($result['ok']) {
            header('Location: login.php?message=' . urlencode('Brukeren ble slettet.'), true, 302);
            exit;
        }

        $errors = $result['errors'];
    } elseif ($action === 'password') {
        $result = changePassword((string) ($_POST['current_password'] ?? ''), (string) ($_POST['new_password'] ?? ''));
        if ($result['ok']) {
            $success = 'Passordet ble oppdatert.';
        } else {
            $errors = $result['errors'];
        }
    } else {
        $result = updateUserProfile(
            (string) ($_POST['username'] ?? ''),
            (string) ($_POST['first_name'] ?? ''),
            (string) ($_POST['last_name'] ?? ''),
            (string) ($_POST['email'] ?? ''),
            (string) ($_POST['phone'] ?? '')
        );

        if ($result['ok']) {
            $success = 'Profilen ble oppdatert.';
            $user = currentUser();
        } else {
            $errors = $result['errors'];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>THOTH | Min profil</title>
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
            width: min(92vw, 760px);
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 26px 24px;
            box-shadow: 0 18px 40px rgba(43, 29, 18, 0.08);
        }
        h1 {
            margin-top: 0;
        }
        .meta {
            color: var(--muted);
            margin-bottom: 18px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
        }
        .card {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 18px;
            background: rgba(255,255,255,0.35);
        }
        h2 {
            margin-top: 0;
            font-size: 1.2rem;
        }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: 700;
        }
        input {
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: 1px solid var(--border);
            margin-bottom: 10px;
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
        .nav {
            display: flex;
            gap: 12px;
            margin-top: 18px;
            flex-wrap: wrap;
        }
        .nav a {
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
        @media (max-width: 720px) {
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Min profil</h1>
        <div class="meta">Bruker: <?php echo htmlspecialchars($user['username'] ?? '', ENT_QUOTES, 'UTF-8'); ?></div>

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

        <div class="grid">
            <section class="card">
                <h2>Oppdater profil</h2>
                <form method="post" action="profile.php">
                    <input type="hidden" name="action" value="profile">
                    <label for="username">Brukernavn</label>
                    <input id="username" name="username" type="text" value="<?php echo htmlspecialchars($user['username'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>

                    <label for="first_name">Fornavn</label>
                    <input id="first_name" name="first_name" type="text" value="<?php echo htmlspecialchars($user['first_name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>

                    <label for="last_name">Etternavn</label>
                    <input id="last_name" name="last_name" type="text" value="<?php echo htmlspecialchars($user['last_name'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>

                    <label for="email">E-post</label>
                    <input id="email" name="email" type="email" value="<?php echo htmlspecialchars($user['email'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" required>

                    <label for="phone">Telefon</label>
                    <input id="phone" name="phone" type="text" value="<?php echo htmlspecialchars($user['phone'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">

                    <button type="submit">Lagre profil</button>
                </form>
            </section>

            <section class="card">
                <h2>Endre passord</h2>
                <form method="post" action="profile.php">
                    <input type="hidden" name="action" value="password">
                    <label for="current_password">Nåværende passord</label>
                    <input id="current_password" name="current_password" type="password" required>

                    <label for="new_password">Nytt passord</label>
                    <input id="new_password" name="new_password" type="password" required>

                    <button type="submit">Endre passord</button>
                </form>
            </section>
        </div>

        <div class="nav">
            <a href="index.php">Til editoren</a>
            <a href="logout.php">Logg ut</a>
        </div>

        <div class="card" style="margin-top: 20px; border-color: rgba(143, 42, 42, 0.35);">
            <h2>Slett bruker</h2>
            <form method="post" action="profile.php" onsubmit="return confirm('Er du sikker på at du vil slette brukeren? Dette kan ikke angres.');">
                <input type="hidden" name="action" value="delete_account">
                <button type="submit" style="background: #8f2a2a;">Slett brukeren</button>
            </form>
        </div>
    </main>
</body>
</html>

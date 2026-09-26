<?php
require __DIR__ . '/auth.php';

$errors = [];
$successMessage = '';
$mode = 'login';

if (isset($_GET['message']) && $_GET['message'] !== '') {
    $successMessage = trim((string) $_GET['message']);
}

if (currentUser() !== null) {
    $target = $_GET['next'] ?? 'index.php';
    header('Location: ' . $target, true, 302);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mode = $_POST['mode'] ?? 'login';

    if ($mode === 'register') {
        $currentUser = currentUser();
        if (!isAdminUser($currentUser)) {
            $errors[] = administratorContactMessage();
            $mode = 'register';
        } else {
            $result = registerUser(
                (string) ($_POST['username'] ?? ''),
                (string) ($_POST['password'] ?? ''),
                (string) ($_POST['first_name'] ?? ''),
                (string) ($_POST['last_name'] ?? ''),
                (string) ($_POST['email'] ?? ''),
                (string) ($_POST['phone'] ?? '')
            );

            if ($result['ok']) {
                $successMessage = 'Brukeren ble opprettet. Du kan nå logge inn.';
                $mode = 'login';
            } else {
                $errors = $result['errors'];
            }
        }
    } elseif ($mode === 'reset_password') {
        $result = resetUserPassword((string) ($_POST['reset_username'] ?? ''), (string) ($_POST['reset_email'] ?? ''));
        if ($result['ok']) {
            $successMessage = 'Nytt midlertidig passord: ' . $result['new_password'] . '. Endre det i profilen etter innlogging.';
            $mode = 'login';
        } else {
            $errors = $result['errors'];
            $mode = 'reset_password';
        }
    } else {
        $user = loginUser((string) ($_POST['username'] ?? ''), (string) ($_POST['password'] ?? ''));
        if ($user !== null) {
            $target = $_GET['next'] ?? 'index.php';
            header('Location: ' . $target, true, 302);
            exit;
        }

        $errors[] = 'Feil brukernavn eller passord.';
    }
}
?>
<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>THOTH | Logg inn</title>
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
        .auth-shell {
            width: min(92vw, 480px);
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 28px 24px;
            box-shadow: 0 18px 40px rgba(43, 29, 18, 0.08);
        }
        h1 {
            margin: 0 0 8px;
            font-size: clamp(1.8rem, 5vw, 2.4rem);
        }
        .subtitle {
            margin: 0 0 18px;
            color: var(--muted);
            line-height: 1.6;
        }
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 18px;
        }
        .tab-button {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid var(--border);
            background: #f1e8df;
            color: var(--ink);
            border-radius: 10px;
            cursor: pointer;
            font-weight: 700;
        }
        .tab-button.active {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
        }
        .inline-link {
            display: inline-block;
            margin: 0 0 14px;
            color: var(--accent);
            background: transparent;
            border: none;
            padding: 0;
            cursor: pointer;
            font-weight: 700;
            text-decoration: underline;
        }
        .panel {
            display: none;
        }
        .panel.active {
            display: block;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
        }
        input {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid var(--border);
            margin-bottom: 14px;
            font-size: 1rem;
        }
        button {
            width: 100%;
            border: none;
            border-radius: 10px;
            padding: 12px 16px;
            cursor: pointer;
            background: var(--accent);
            color: white;
            font-weight: 700;
            font-size: 1rem;
        }
        .error-list, .success-message {
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 14px;
            font-size: 0.95rem;
        }
        .error-list {
            background: rgba(143, 42, 42, 0.08);
            color: var(--error);
        }
        .success-message {
            background: rgba(40, 93, 61, 0.08);
            color: var(--success);
        }
    </style>
</head>
<body>
    <main class="auth-shell">
        <h1>THOTH</h1>
        <p class="subtitle">Logg inn for å redigere manuskriptet. Registrer deg om du er ny bruker.</p>

        <div class="tabs" aria-label="Autentisering">
            <button type="button" class="tab-button <?php echo $mode === 'login' ? 'active' : ''; ?>" data-mode="login">Logg inn</button>
            <button type="button" class="tab-button <?php echo $mode === 'register' ? 'active' : ''; ?>" data-mode="register">Registrer</button>
        </div>

        <?php if ($errors !== []): ?>
            <div class="error-list">
                <?php foreach ($errors as $error): ?>
                    <div><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($successMessage !== ''): ?>
            <div class="success-message"><?php echo htmlspecialchars($successMessage, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <section class="panel <?php echo $mode === 'login' ? 'active' : ''; ?>" data-panel="login">
            <form method="post" action="login.php<?php echo isset($_GET['next']) ? '?next=' . urlencode((string) $_GET['next']) : ''; ?>">
                <input type="hidden" name="mode" value="login">
                <label for="login-username">Brukernavn</label>
                <input id="login-username" name="username" type="text" autocomplete="username" required>

                <label for="login-password">Passord</label>
                <input id="login-password" name="password" type="password" autocomplete="current-password" required>

                <button type="submit">Logg inn</button>
            </form>
            <button type="button" class="inline-link" data-mode="reset_password">Glemt passord?</button>
        </section>

        <section class="panel <?php echo $mode === 'register' ? 'active' : ''; ?>" data-panel="register">
            <form method="post" action="login.php<?php echo isset($_GET['next']) ? '?next=' . urlencode((string) $_GET['next']) : ''; ?>">
                <input type="hidden" name="mode" value="register">
                <label for="register-username">Brukernavn</label>
                <input id="register-username" name="username" type="text" autocomplete="username" required>

                <label for="register-password">Passord</label>
                <input id="register-password" name="password" type="password" autocomplete="new-password" required>

                <label for="register-first-name">Fornavn</label>
                <input id="register-first-name" name="first_name" type="text" required>

                <label for="register-last-name">Etternavn</label>
                <input id="register-last-name" name="last_name" type="text" required>

                <label for="register-email">E-post</label>
                <input id="register-email" name="email" type="email" autocomplete="email" required>

                <label for="register-phone">Telefon (valgfritt)</label>
                <input id="register-phone" name="phone" type="text" autocomplete="tel">

                <button type="submit">Registrer bruker</button>
            </form>
        </section>

        <section class="panel <?php echo $mode === 'reset_password' ? 'active' : ''; ?>" data-panel="reset_password">
            <form method="post" action="login.php<?php echo isset($_GET['next']) ? '?next=' . urlencode((string) $_GET['next']) : ''; ?>">
                <input type="hidden" name="mode" value="reset_password">
                <label for="reset-username">Brukernavn</label>
                <input id="reset-username" name="reset_username" type="text" autocomplete="username" required>

                <label for="reset-email">E-post</label>
                <input id="reset-email" name="reset_email" type="email" autocomplete="email" required>

                <button type="submit">Nullstill passord</button>
            </form>
        </section>
    </main>

    <script>
        const buttons = document.querySelectorAll('.tab-button');
        const linkButtons = document.querySelectorAll('.inline-link');
        const panels = document.querySelectorAll('.panel');

        const openMode = (mode) => {
            buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode && mode !== 'reset_password'));
            panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === mode));
        };

        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                openMode(button.dataset.mode);
            });
        });

        linkButtons.forEach((button) => {
            button.addEventListener('click', () => {
                openMode(button.dataset.mode);
            });
        });
    </script>
</body>
</html>

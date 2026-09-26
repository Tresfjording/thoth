<?php
const SESSION_INACTIVITY_SECONDS = 1800;

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => SESSION_INACTIVITY_SECONDS,
        'path' => '/',
        'secure' => false,
        'httponly' => true,
    ]);
    session_start();
}

if (!empty($_SESSION['last_activity']) && (time() - (int) $_SESSION['last_activity']) > SESSION_INACTIVITY_SECONDS) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $cookieOptions = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $cookieOptions['path'],
            $cookieOptions['domain'],
            $cookieOptions['secure'],
            $cookieOptions['httponly']
        );
    }
    session_destroy();
}

if (!empty($_SESSION['user_id'])) {
    $_SESSION['last_activity'] = time();
}

const APP_DATA_DIR = __DIR__ . '/../data';
const APP_DB_PATH = APP_DATA_DIR . '/thoth.sqlite';
const APP_USERS_PATH = APP_DATA_DIR . '/users.json';
const ADMIN_USERNAME = 'Tresfjording';
const ADMIN_CONTACT_EMAIL = 'post@tresfjording.no';

function administratorContactMessage(): string
{
    return 'Registrering av nye brukere er kun for administrator. Kontakt Tresfjording på ' . ADMIN_CONTACT_EMAIL . '.';
}

function isAdminUser(?array $user): bool
{
    if ($user === null) {
        return false;
    }

    $username = strtolower(trim((string) ($user['username'] ?? '')));
    $email = strtolower(trim((string) ($user['email'] ?? '')));

    return $username === strtolower(ADMIN_USERNAME)
        || $email === strtolower(ADMIN_CONTACT_EMAIL)
        || $email === 'kontakt@tresfjording.no'
        || $email === 'tresfjording@tresfjording.no';
}

function ensureDataDirectory(): void
{
    if (!is_dir(APP_DATA_DIR)) {
        mkdir(APP_DATA_DIR, 0775, true);
    }

    $htaccessPath = APP_DATA_DIR . '/.htaccess';
    if (!is_file($htaccessPath)) {
        file_put_contents($htaccessPath, "Require all denied\n", LOCK_EX);
    }
}

function loadUsersFromJson(): array
{
    ensureDataDirectory();

    if (!is_file(APP_USERS_PATH)) {
        return [];
    }

    $json = @file_get_contents(APP_USERS_PATH);
    if ($json === false || trim($json) === '') {
        return [];
    }

    $users = json_decode($json, true);
    return is_array($users) ? $users : [];
}

function saveUsersToJson(array $users): void
{
    ensureDataDirectory();
    file_put_contents(APP_USERS_PATH, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function getDatabase(): ?PDO
{
    ensureDataDirectory();

    if (!class_exists('PDO') || !extension_loaded('pdo_sqlite')) {
        return null;
    }

    try {
        $pdo = new PDO('sqlite:' . APP_DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT DEFAULT "",
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );

        return $pdo;
    } catch (Throwable $exception) {
        return null;
    }
}

function currentUser(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $userId = (int) $_SESSION['user_id'];

    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone FROM users WHERE id = :id LIMIT 1');
            $statement->execute([':id' => $userId]);
            $user = $statement->fetch();
            return $user ?: null;
        } catch (Throwable $exception) {
            return null;
        }
    }

    foreach (loadUsersFromJson() as $user) {
        if ((int) ($user['id'] ?? 0) === $userId) {
            return $user;
        }
    }

    return null;
}

function authStatus(): array
{
    $user = currentUser();
    return [
        'loggedIn' => $user !== null,
        'username' => $user['username'] ?? '',
        'displayName' => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
    ];
}

function requireAuth(string $redirectTo = 'login.php'): void
{
    if (currentUser() === null) {
        $next = urlencode($_SERVER['REQUEST_URI'] ?? 'index.php');
        header('Location: ' . $redirectTo . '?next=' . $next, true, 302);
        exit;
    }
}

function loginUser(string $username, string $password): ?array
{
    $username = trim($username);
    if ($username === '' || $password === '') {
        return null;
    }

    $pdo = getDatabase();
    if ($pdo !== null) {
        $statement = $pdo->prepare('SELECT * FROM users WHERE username = :username LIMIT 1');
        $statement->execute([':username' => $username]);
        $user = $statement->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return null;
        }

        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['display_name'] = trim($user['first_name'] . ' ' . $user['last_name']);

        return $user;
    }

    foreach (loadUsersFromJson() as $user) {
        if (strcasecmp((string) ($user['username'] ?? ''), $username) === 0 && password_verify($password, (string) ($user['password_hash'] ?? ''))) {
            $_SESSION['user_id'] = (int) $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['display_name'] = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            return $user;
        }
    }

    return null;
}

function findUserByUsernameAndEmail(string $username, string $email): ?array
{
    $username = trim($username);
    $email = strtolower(trim($email));

    if ($username === '' || $email === '') {
        return null;
    }

    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(:username) AND LOWER(email) = LOWER(:email) LIMIT 1');
            $statement->execute([':username' => $username, ':email' => $email]);
            $user = $statement->fetch();
            return $user ?: null;
        } catch (Throwable $exception) {
            return null;
        }
    }

    foreach (loadUsersFromJson() as $user) {
        if (strcasecmp((string) ($user['username'] ?? ''), $username) === 0 && strtolower((string) ($user['email'] ?? '')) === $email) {
            return $user;
        }
    }

    return null;
}

function resetUserPassword(string $username, string $email): array
{
    $user = findUserByUsernameAndEmail($username, $email);
    if ($user === null) {
        return ['ok' => false, 'errors' => ['Fant ingen brukerkonto med dette brukernavnet og e-postadressen.']];
    }

    $newPassword = 'Thoth-' . bin2hex(random_bytes(4));
    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
            $statement->execute([
                ':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
                ':id' => (int) $user['id'],
            ]);

            return ['ok' => true, 'errors' => [], 'new_password' => $newPassword];
        } catch (Throwable $exception) {
            return ['ok' => false, 'errors' => ['Kunne ikke nullstille passordet. Prøv igjen.']];
        }
    }

    $users = loadUsersFromJson();
    $updated = false;
    foreach ($users as $index => $storedUser) {
        if ((int) ($storedUser['id'] ?? 0) !== (int) ($user['id'] ?? 0)) {
            continue;
        }

        $users[$index]['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = true;
    }

    if (!$updated) {
        return ['ok' => false, 'errors' => ['Kunne ikke finne brukeren i lagringen.']];
    }

    saveUsersToJson($users);
    return ['ok' => true, 'errors' => [], 'new_password' => $newPassword];
}

function registerUser(string $username, string $password, string $firstName, string $lastName, string $email, string $phone = ''): array
{
    $currentUser = currentUser();
    if (!isAdminUser($currentUser)) {
        return ['ok' => false, 'errors' => [administratorContactMessage()]];
    }

    $username = trim($username);
    $firstName = trim($firstName);
    $lastName = trim($lastName);
    $email = trim($email);
    $phone = trim($phone);

    $errors = [];

    if ($username === '') {
        $errors[] = 'Brukernavn er påkrevd.';
    }
    if (strlen($username) < 3) {
        $errors[] = 'Brukernavnet må være minst 3 tegn.';
    }
    if ($firstName === '' || $lastName === '') {
        $errors[] = 'Fornavn og etternavn er påkrevd.';
    }
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'E-postadressen er ugyldig.';
    }
    if ($password === '' || strlen($password) < 8) {
        $errors[] = 'Passordet må være minst 8 tegn.';
    }

    if ($errors !== []) {
        return ['ok' => false, 'errors' => $errors];
    }

    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
            $statement->execute([':username' => $username]);
            if ($statement->fetch()) {
                return ['ok' => false, 'errors' => ['Brukernavnet er allerede registrert.']];
            }

            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            $insert = $pdo->prepare(
                'INSERT INTO users (username, password_hash, first_name, last_name, email, phone) VALUES (:username, :password_hash, :first_name, :last_name, :email, :phone)'
            );
            $insert->execute([
                ':username' => $username,
                ':password_hash' => $passwordHash,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':email' => $email,
                ':phone' => $phone,
            ]);

            return ['ok' => true, 'errors' => []];
        } catch (Throwable $exception) {
            return ['ok' => false, 'errors' => ['Kunne ikke opprette brukeren. Prøv igjen.']];
        }
    }

    $users = loadUsersFromJson();
    foreach ($users as $user) {
        if (strcasecmp((string) ($user['username'] ?? ''), $username) === 0) {
            return ['ok' => false, 'errors' => ['Brukernavnet er allerede registrert.']];
        }
    }

    $nextId = 1;
    foreach ($users as $user) {
        $nextId = max($nextId, (int) ($user['id'] ?? 0) + 1);
    }

    $users[] = [
        'id' => $nextId,
        'username' => $username,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'first_name' => $firstName,
        'last_name' => $lastName,
        'email' => $email,
        'phone' => $phone,
    ];

    saveUsersToJson($users);
    return ['ok' => true, 'errors' => []];
}

function logoutUser(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $cookieOptions = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $cookieOptions['path'],
            $cookieOptions['domain'],
            $cookieOptions['secure'],
            $cookieOptions['httponly']
        );
    }

    session_destroy();
}

function deleteUserById(int $userId): bool
{
    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('DELETE FROM users WHERE id = :id');
            $statement->execute([':id' => $userId]);
            return true;
        } catch (Throwable $exception) {
            return false;
        }
    }

    $users = loadUsersFromJson();
    $filteredUsers = array_values(array_filter(
        $users,
        static fn (array $user): bool => (int) ($user['id'] ?? 0) !== $userId
    ));

    saveUsersToJson($filteredUsers);
    return true;
}

function deleteCurrentUser(): array
{
    $user = currentUser();
    if ($user === null) {
        return ['ok' => false, 'errors' => ['Du må være innlogget for å slette brukeren.']];
    }

    $deleted = deleteUserById((int) ($user['id'] ?? 0));
    if (!$deleted) {
        return ['ok' => false, 'errors' => ['Kunne ikke slette brukeren. Prøv igjen.']];
    }

    logoutUser();
    return ['ok' => true, 'errors' => []];
}

function updateUserProfile(string $username, string $firstName, string $lastName, string $email, string $phone = ''): array
{
    $user = currentUser();
    if ($user === null) {
        return ['ok' => false, 'errors' => ['Du må være innlogget for å oppdatere profilen.']];
    }

    $username = trim($username);
    $firstName = trim($firstName);
    $lastName = trim($lastName);
    $email = trim($email);
    $phone = trim($phone);

    $errors = [];
    if ($username === '') {
        $errors[] = 'Brukernavn er påkrevd.';
    }
    if (strlen($username) < 3) {
        $errors[] = 'Brukernavnet må være minst 3 tegn.';
    }
    if ($firstName === '' || $lastName === '') {
        $errors[] = 'Fornavn og etternavn er påkrevd.';
    }
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $errors[] = 'E-postadressen er ugyldig.';
    }

    if ($errors !== []) {
        return ['ok' => false, 'errors' => $errors];
    }

    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $duplicate = $pdo->prepare('SELECT id FROM users WHERE username = :username AND id != :id LIMIT 1');
            $duplicate->execute([':username' => $username, ':id' => (int) $user['id']]);
            if ($duplicate->fetch()) {
                return ['ok' => false, 'errors' => ['Brukernavnet er allerede registrert.']];
            }

            $update = $pdo->prepare(
                'UPDATE users SET username = :username, first_name = :first_name, last_name = :last_name, email = :email, phone = :phone WHERE id = :id'
            );
            $update->execute([
                ':username' => $username,
                ':first_name' => $firstName,
                ':last_name' => $lastName,
                ':email' => $email,
                ':phone' => $phone,
                ':id' => (int) $user['id'],
            ]);

            $_SESSION['username'] = $username;
            $_SESSION['display_name'] = trim($firstName . ' ' . $lastName);

            return ['ok' => true, 'errors' => []];
        } catch (Throwable $exception) {
            return ['ok' => false, 'errors' => ['Kunne ikke oppdatere profilen. Prøv igjen.']];
        }
    }

    $users = loadUsersFromJson();
    $updated = false;
    foreach ($users as $index => $storedUser) {
        if ((int) ($storedUser['id'] ?? 0) !== (int) $user['id']) {
            continue;
        }

        foreach (['username', 'first_name', 'last_name', 'email', 'phone'] as $field) {
            if ($field === 'username') {
                $value = $username;
            } elseif ($field === 'first_name') {
                $value = $firstName;
            } elseif ($field === 'last_name') {
                $value = $lastName;
            } elseif ($field === 'email') {
                $value = $email;
            } else {
                $value = $phone;
            }

            $users[$index][$field] = $value;
        }
        $updated = true;
    }

    if (!$updated) {
        return ['ok' => false, 'errors' => ['Brukeren ble ikke funnet i lagringen.']];
    }

    saveUsersToJson($users);
    $_SESSION['username'] = $username;
    $_SESSION['display_name'] = trim($firstName . ' ' . $lastName);
    return ['ok' => true, 'errors' => []];
}

function changePassword(string $currentPassword, string $newPassword): array
{
    $user = currentUser();
    if ($user === null) {
        return ['ok' => false, 'errors' => ['Du må være innlogget for å endre passordet.']];
    }

    if ($currentPassword === '' || $newPassword === '') {
        return ['ok' => false, 'errors' => ['Begge passordfelt må fylles ut.']];
    }

    if (strlen($newPassword) < 8) {
        return ['ok' => false, 'errors' => ['Det nye passordet må være minst 8 tegn.']];
    }

    $pdo = getDatabase();
    if ($pdo !== null) {
        try {
            $statement = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
            $statement->execute([':id' => (int) $user['id']]);
            $stored = $statement->fetch();

            if (!$stored || !password_verify($currentPassword, $stored['password_hash'])) {
                return ['ok' => false, 'errors' => ['Nåværende passord er feil.']];
            }

            $update = $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
            $update->execute([
                ':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
                ':id' => (int) $user['id'],
            ]);

            return ['ok' => true, 'errors' => []];
        } catch (Throwable $exception) {
            return ['ok' => false, 'errors' => ['Kunne ikke endre passordet. Prøv igjen.']];
        }
    }

    $users = loadUsersFromJson();
    $updated = false;
    foreach ($users as $index => $storedUser) {
        if ((int) ($storedUser['id'] ?? 0) !== (int) $user['id']) {
            continue;
        }

        if (!password_verify($currentPassword, (string) ($storedUser['password_hash'] ?? ''))) {
            return ['ok' => false, 'errors' => ['Nåværende passord er feil.']];
        }

        $users[$index]['password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = true;
    }

    if (!$updated) {
        return ['ok' => false, 'errors' => ['Brukeren ble ikke funnet i lagringen.']];
    }

    saveUsersToJson($users);
    return ['ok' => true, 'errors' => []];
}

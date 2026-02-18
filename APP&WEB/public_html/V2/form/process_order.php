<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Získání dat z formuláře a jejich validace
    $name = htmlspecialchars(trim($_POST['name']));
    $email = htmlspecialchars(trim($_POST['email']));
    $phone = htmlspecialchars(trim($_POST['phone']));
    $product = htmlspecialchars(trim($_POST['product']));
    $quantity = htmlspecialchars(trim($_POST['quantity']));
    $message = htmlspecialchars(trim($_POST['message']));

    // Validace vstupů
    if (empty($name) || empty($email) || empty($phone) || empty($product)) {
        echo "Všechna pole jsou povinná.";
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "Neplatná e-mailová adresa.";
        exit;
    }

    /* if (!is_numeric($quantity) || $quantity <= 0) {
        echo "Množství musí být kladné číslo.";
        exit;
    }

    /* Připojení k databázi
    $servername = "localhost";
    $username = "root";
    $password = "";
    $dbname = "orders";

    $conn = new mysqli($servername, $username, $password, $dbname);

    // Kontrola připojení
    if ($conn->connect_error) {
        die("Připojení k databázi selhalo: " . $conn->connect_error);
    }

    // Uložení objednávky do databáze
    $stmt = $conn->prepare("INSERT INTO orders (name, email, phone, product, quantity, message) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssiss", $name, $email, $phone, $product, $quantity, $message);

    if ($stmt->execute()) {
        echo "Objednávka byla úspěšně uložena do databáze!";
    } else {
        echo "Nastala chyba při ukládání objednávky do databáze: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
    */
    
    // Ukázka odeslání e-mailu
    $to = "admin@newearth.cz"; // Změňte na svou e-mailovou adresu
    $subject = "Nová objednávka od " . $name;
    $body = "Jméno: $name\nE-mail: $email\nTelefon: $phone\nProdukt: $product\nMnožství: $quantity\nPoznámka: $message";
    $headers = "From: $email";

    if (mail($to, $subject, $body, $headers)) {
        echo "Objednávka byla úspěšně odeslána!";
    } else {
        echo "Nastala chyba při odesílání objednávky.";
    }
} else {
    echo "Neplatná metoda požadavku.";
}
?>

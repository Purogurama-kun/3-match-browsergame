<?php

// test file write permission:
$file = __DIR__ . '/test_file.txt';
$success = file_put_contents($file, 'Test');
if ($success === false) {
    echo "❌ FEHLER: PHP darf in diesem Ordner keine Dateien anlegen!\n";
} else {
    echo "✅ ERFOLG: Schreibrechte sind vorhanden. Datei wurde erstellt.\n";
    unlink($file);
}

// test sqlite:
// 1. Check: Ist die Extension überhaupt geladen?
echo "1. Extension Check:\n";
$extensions = ['pdo_sqlite', 'sqlite3'];
foreach ($extensions as $ext) {
    if (extension_loaded($ext)) {
        echo "✅ OK: Extension '$ext' ist geladen.\n";
    } else {
        echo "❌ FEHLER: Extension '$ext' fehlt!\n";
    }
}

// 2. Check: PDO Treiber Verfügbarkeit
echo "\n2. PDO Treiber Check:\n";
if (in_array('sqlite', PDO::getAvailableDrivers())) {
    echo "✅ OK: 'sqlite' Treiber ist in PDO verfügbar.\n";
} else {
    echo "❌ FEHLER: 'sqlite' Treiber fehlt in PDO.\n";
}

// 3. Check: Schreibtest & Datenbank-Erstellung
echo "\n3. Datenbank Schreib-Test:\n";
$testDbFile = __DIR__ . '/test_temp.sqlite';

try {
    // Falls Datei existiert, löschen für sauberen Test
    if (file_exists($testDbFile)) { @unlink($testDbFile); }

    $db = new PDO('sqlite:' . $testDbFile);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Tabelle erstellen
    $db->exec("CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)");
    
    // Daten schreiben
    $stmt = $db->prepare("INSERT INTO test (val) VALUES (:v)");
    $stmt->execute([':v' => 'Funktioniert']);
    
    // Daten lesen
    $result = $db->query("SELECT val FROM test LIMIT 1")->fetchColumn();
    
    if ($result === 'Funktioniert') {
        echo "✅ OK: Datenbank wurde erstellt, Tabelle angelegt und Daten gelesen.\n";
    }
    
    // Aufräumen
    $db = null; // Verbindung schließen
    unlink($testDbFile); 
    echo "✅ OK: Test-Datei wurde erfolgreich wieder gelöscht.\n";

} catch (PDOException $e) {
    echo "❌ KRITISCHER FEHLER: " . $e->getMessage() . "\n";
    echo "Hinweis: Prüfe, ob PHP im Ordner '" . __DIR__ . "' Schreibrechte hat.\n";
}

// Show php info:
phpinfo();


<?php
$host = 'localhost';
$dbname = 'drummachine';
$username = 'root';
$password = '';

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['name']) || !isset($data['pattern'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("INSERT INTO beats (name, pattern_json) VALUES (:name, :pattern)");
    $stmt->execute([
        ':name' => $data['name'],
        ':pattern' => json_encode($data['pattern'])
    ]);

    $lastId = $pdo->lastInsertId(); // Get inserted ID

    echo json_encode(['success' => true, 'id' => $lastId, 'name' => $data['name']]);


} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}



?>
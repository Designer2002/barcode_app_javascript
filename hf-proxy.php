<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Путь к логам
$log_file = '/var/log/hugging_face.log';

// Функция логирования
function log_gpt_event($message, $product = '') {
    global $log_file;
    $timestamp = date('Y-m-d H:i:s');
    $log_entry = "[$timestamp] [Продукт: $product] $message\n";
    file_put_contents($log_file, $log_entry, FILE_APPEND);
}

function askHF($product, $apiKey) {
    
    $url = "https://router.huggingface.co/together/v1/chat/completions";
    
    // Формируем промпт с требованием строгого JSON
    $prompt = "Hello! Please tell me about the nutrition facts of (the word is in Russian and it is a meal!) $product. " .
              "Please give the answer in STRICT JSON format: " .
              "{\"proteins\":[the proteins per 100g], \"fats\":[the fats per 100g], \"carbohydrates\":[the carbohydrates per 100g]}. " .
              "Write ONLY JSON. Thank you!";

    $data = [
        "messages" => [
            [
                "role" => "user",
                "content" => $prompt
            ]
        ],
        "max_tokens" => 200,
        "model" => "google/t5-small-ssm-nq",
        "provider" => "together",
        "response_format" => ["type" => "json_object"],
        "stream" => false
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $apiKey",
            "Content-Type: application/json"
        ],
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        return ["error" => "cURL error: $error"];
    }
    
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return ["error" => "API returned HTTP $httpCode", "response" => $response];
    }
    
    $result = json_decode($response, true);
    
    // Извлекаем JSON из ответа (может быть вложен в 'choices')
    if (isset($result['choices'][0]['message']['content'])) {
        $jsonResponse = json_decode($result['choices'][0]['message']['content'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $jsonResponse;
        }
    }
    
    return ["error" => "Invalid JSON response", "raw" => $response];
}

// Основная логика
$product = $_GET['product'] ?? '';
$apiKey = $_GET['token']; // Ваш ключ Hugging Face
if (empty($product)) {
    log_gpt_event('ОШИБКА: Не указан продукт');
    http_response_code(400);
    die(json_encode(['error' => 'Укажите продукт'], JSON_UNESCAPED_UNICODE));
}
if (empty($token)) {
    http_response_code(401);
    die(json_encode(["error" => "Не указан токен"]));
}

log_gpt_event("Начало обработки запроса", $code);

try {
    
    $nutrition = askHF($product, $key);
    // Логируем успех
    log_gpt_event("УСПЕХ: Пищевая ценность - $nutrition");

    // Возвращаем результат с русским текстом
    echo json_encode([
        'product' => $product,
        'nutrition_facts' => $nutrition,
        'status' => 'success'
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    log_gpt_event("ОШИБКА: " . $e->getMessage(), $code);
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'status' => 'error'
    ], JSON_UNESCAPED_UNICODE);
}
?>
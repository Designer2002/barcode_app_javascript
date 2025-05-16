<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

const LOG_FILE = '/var/log/barcode_scanner.log';
const REQUEST_TIMEOUT = 5; // Таймаут запроса в секундах
const MAX_RETRIES = 2; // Максимальное количество попыток запроса

// Функция логирования
function logEvent(string $message, string $barcode = ''): void {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = sprintf("[%s] [Штрих-код: %s] %s\n", $timestamp, $barcode, $message);
    file_put_contents(LOG_FILE, $logEntry, FILE_APPEND);
}

function fetchProductName(string $url, string $barcode): ?string {
    $context = stream_context_create([
        'http' => [
            'timeout' => REQUEST_TIMEOUT
        ]
    ]);
    
    $retryCount = 0;
    $content = false;
    
    // Повторяем запрос при неудаче (но не более MAX_RETRIES раз)
    while ($retryCount < MAX_RETRIES && $content === false) {
        $content = @file_get_contents($url, false, $context);
        if ($content === false) {
            $retryCount++;
            if ($retryCount < MAX_RETRIES) {
                usleep(500000); // Задержка 0.5 сек перед повторной попыткой
            }
        }
    }
    
    if ($content === false) {
        throw new Exception("Сайт не отвечал в течение " . (REQUEST_TIMEOUT * MAX_RETRIES) . " секунд");
    }
    
    if (!preg_match("/<title>(.*)<\/title>/siU", $content, $titleMatches)) {
        return null;
    }
    
    $title = preg_replace('/\s+/', ' ', $titleMatches[1]);
    return trim($title);
}

function processBarcodeRequest(string $code): array {
    logEvent("Начало обработки запроса", $code);
    
    $url = "https://barcode-list.ru/barcode/RU/barcode-$code/Поиск.htm";
    $productNameFull = fetchProductName($url, $code);
    
    if ($productNameFull === null) {
        throw new Exception("Не удалось извлечь название товара");
    }
    
    $productName = preg_replace('/\s*-\s*Штрих-код:.*$/', '', $productNameFull);
    logEvent("УСПЕХ: Название товара - $productName", $code);
    
    return [
        'barcode' => $code,
        'product' => $productName,
        'status' => 'success'
    ];
}

// Основная логика
try {
    $code = $_GET['code'] ?? '';
    if (empty($code)) {
        throw new InvalidArgumentException('Не указан штрих-код');
    }
    
    $response = processBarcodeRequest($code);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (InvalidArgumentException $e) {
    logEvent('ОШИБКА: ' . $e->getMessage(), $code ?? '');
    http_response_code(400);
    echo json_encode([
        'error' => $e->getMessage(),
        'status' => 'error'
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    logEvent("ОШИБКА: " . $e->getMessage(), $code ?? '');
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'status' => 'error'
    ], JSON_UNESCAPED_UNICODE);
}
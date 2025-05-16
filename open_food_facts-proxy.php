<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Конфигурационные параметры
const LOG_FILE = '/var/log/open_food_facts_api.log';
const API_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const TIMEOUT = 5; // Таймаут в секундах
const DEFAULT_FIELDS = 'product_name,nutriments';

/**
 * Логирование событий
 * @param string $message Сообщение для логирования
 * @param string $productName Название продукта (необязательно)
 */
function logEvent(string $message, string $productName = ''): void {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = sprintf("[%s] [Продукт: %s] %s\n", 
        $timestamp, 
        $productName, 
        $message
    );
    file_put_contents(LOG_FILE, $logEntry, FILE_APPEND);
}

/**
 * Создать URL для API запроса
 * @param string $product Название продукта
 * @param string $searchTerm Поисковый термин (по умолчанию совпадает с продуктом)
 * @return string Сформированный URL
 */
function buildApiUrl(string $product, string $searchTerm = null): string {
    $searchTerm = $searchTerm ?? $product;
    $queryParams = [
        'search_terms' => $searchTerm,
        'search_simple' => 1,
        'action' => 'process',
        'json' => 1,
        'fields' => DEFAULT_FIELDS,
        'sort_by' => 'nova_score',
        'page' => 1,
        'page_size' => 1
    ];
    
    return API_URL . '?' . http_build_query($queryParams);
}

/**
 * Получить данные от API
 * @param string $url URL для запроса
 * @return string|false Результат запроса или false при ошибке
 */
function fetchApiData(string $url) {
    $context = stream_context_create([
        'http' => ['timeout' => TIMEOUT]
    ]);
    
    return @file_get_contents($url, false, $context);
}

/**
 * Отправить JSON ответ
 * @param mixed $data Данные для отправки
 * @param int $statusCode HTTP статус код
 */
function sendJsonResponse($data, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Основная логика обработки запроса
try {
    $product = trim($_GET['product'] ?? '');
    
    if (empty($product)) {
        logEvent('ОШИБКА: Не указан продукт');
        sendJsonResponse(['error' => 'Укажите продукт'], 400);
    }
    
    logEvent("Начало обработки запроса", $product);
    
    // Первоначальный запрос
    $url = buildApiUrl($product);
    $content = fetchApiData($url);
    logEvent("uri - $url");
    $decoded = json_decode($content, true);

    // Проверяем:
    // 1. Что ответ — валидный JSON
    // 2. Что существует массив products
    // 3. Что он не пустой (неважно, что говорит count)
    if ($content !== false && isset($decoded['products']) && !empty($decoded['products'])) {
    logEvent("УСПЕХ: найдена информация о товаре $product");
        logEvent("УСПЕХ: найдена информация о товаре $product");
        sendJsonResponse([
            'content' => json_decode($content, true),
            'status' => 'success'
        ]);
    }
    
    // Попытка поиска по первой букве, если первоначальный запрос не удался
    $words = explode(" ", $product);
    $maxWords = min(count($words), 4); // Ограничиваем максимум 4 словами
    $found = false;
    $response = null;

    // Пробуем комбинации от 1 до 4 слов (или меньше, если в названии меньше слов)
    for ($i = 1; $i <= $maxWords; $i++) {
        $searchPhrase = implode(" ", array_slice($words, 0, $i));
        $url = buildApiUrl($product, $searchPhrase);
        $content = fetchApiData($url);
        
        if ($content !== false) {
            $found = true;
            $response = [
                'content' => json_decode($content, true),
                'status' => 'success',
                'matched_phrase' => $searchPhrase // Можно добавить, по какой фразе нашли
            ];
            logEvent("УСПЕХ: найдена информация по фразе '$searchPhrase' продукта '$product'");
            break; // Прерываем цикл при первом успешном результате
        }
    }

    if ($found) {
        sendJsonResponse($response);
    } else {
        logEvent("ОШИБКА: не найдена информация для продукта '$product'");
        sendJsonResponse([
            'status' => 'error',
            'message' => 'Информация не найдена'
        ]);
    }
    
    // Если оба запроса не удались
    logEvent("НЕ НАШЛОСЬ ИНФОРМАЦИИ о $product");
    sendJsonResponse([
        'error' => "Информация о продукте не найдена",
        'status' => 'error'
    ], 404);
    
} catch (Throwable $e) {
    logEvent("ОШИБКА: " . $e->getMessage(), $product ?? '');
    sendJsonResponse([
        'error' => 'Произошла внутренняя ошибка сервера',
        'status' => 'error'
    ], 500);
}
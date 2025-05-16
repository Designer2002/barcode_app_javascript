from pyzbar.pyzbar import decode
import cv2
import numpy as np

def scan(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    barcodes = decode(gray)
    
    if len(barcodes) == 0:
        print("Не удалось распознать ничего.")
    for barcode in barcodes:
        (x, y, w, h) = barcode.rect
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        barcode_data = barcode.data.decode("utf-8")
        cv2.putText(frame, barcode_data, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        print("Распознано:", barcode_data)
        return barcode_data

def enhance_scanned(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Улучшение контраста
    alpha = 1.5
    beta = 30
    contrast = cv2.convertScaleAbs(gray, alpha=alpha, beta=beta)

    # Адаптивная бинаризация
    binary = cv2.adaptiveThreshold(contrast, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)

    # Морфологическое закрытие (улучшает штрихи)
    kernel = np.ones((3, 3), np.uint8)
    morph = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    return morph
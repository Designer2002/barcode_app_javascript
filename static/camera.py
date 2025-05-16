import cv2
from api_request import ask_api
from barcode_scanner import scan



cap = cv2.VideoCapture(0) 

while True:
    ret, frame = cap.read()
    if not ret:
        break

    
    cv2.imshow("Webcam Barcode Scanner", frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):  # Выход по 'q'
        break

    if cv2.waitKey(1) & 0xFF == ord('s'): # Клавиша 's' скаинирует
        data=scan(frame)
        print(data)
        ask_api(data)

cap.release()
cv2.destroyAllWindows()


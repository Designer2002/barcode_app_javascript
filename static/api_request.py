import requests

def ask_api(barcode):
    if barcode is None:
        return
    response = requests.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
    data = response.json()

    if data["status"] == 1:
        product = data["product"]
        print("Название:", product.get("product_name_ru", product.get("product_name", "Нет данных")))
        print("Бренд:", product.get("brands", "Нет данных"))
        print("Вес/объем:", product.get("quantity", "Нет данных"))
        print("Состав:", product.get("ingredients_text_ru", product.get("ingredients_text", "Нет данных")))
    else:
        print("Товар не найден в Open Food Facts.")
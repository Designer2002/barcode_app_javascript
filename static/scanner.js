document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-preview');
    // Элементы интерфейса
    const scanBtn = document.getElementById('scan-btn');
    const addBtn = document.getElementById('add-to-db-btn');
    const deleteFromDbBtn = document.getElementById('delete-from-db-btn');
    const resultDiv = document.getElementById('result');
    const modal = document.getElementById('deleteModal');
    const closeBtn = document.querySelector('.close');
    const productSelect = document.getElementById('product-select');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    let scannerActive = false;
    let lastScannedCode = null;
    let lastScanTime = 0;
    const SCAN_COOLDOWN = 3000; // 3 секунды между запросами
    let found = false;
    let productData = {}
    // try{
    // const db = loadDB();
    // fillJsonByTop5(db);
    // }
    // catch(ex){
    //     console.log(ex);
    // }
    //searchAlternativeProducts("4620749150192");

    // Запуск камеры
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            contrast: 1.2,
            brightness: 0.9
        } 
    })
    .then(stream => {
        video.srcObject = stream;
        video.play();
    })
    .catch(err => {
        resultDiv.textContent = "Ошибка камеры: " + err.message;
    });

    // Проверка валидности штрих-кода
    function isValidBarcode(code) {
        // EAN-13 (13 цифр), EAN-8 (8 цифр), UPC-A (12 цифр), UPC-E (6-8 цифр)
        const barcodeRegex = /^(\d{8}|\d{12,13})$/;
        return barcodeRegex.test(code);
    }

    // Обработка данных продукта
    async function processProductData(code) {
        resultDiv.innerHTML = `<p>Запрос информации для кода: ${code}...</p>`;
        
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
            const data = await response.json();
            
            if (data.status === 1 && data.product && (data.product.product_name || data.product.product_name_ru)) {
                displayProductInfo(data.product);
                productData = makeData(data.product)
                found = true;
            } else {
                await searchAlternativeProducts(code);
            }
            if (found)
            {
                addBtn.style.display="block";
            }
        } catch (err) {
            resultDiv.innerHTML = `<p>Ошибка при запросе к API: ${err.message}</p>`;
        }
    }

    // Поиск альтернативных продуктов
    async function searchAlternativeProducts(code) {
        resultDiv.innerHTML = "<p>Товар не найден в базе. Ищем аналоги...</p>";
        
        try {
            const productName = await parse_russian_db(code);
            if (productName === "Товар не найден") {
                resultDiv.innerHTML = "Товар не найден в базах данных. Введите информацию вручную.";
                return;
            }
            const searchData = await parse_similar(productName)
            console.log(searchData);
            if (searchData.content && searchData.content.products && searchData.content.products.length > 0) {
                displaySimilarProduct(searchData.content.products[0], productName);
                found = true;
                productData = makeData(searchData.content.products[0],productName)
            } else {
                const localData = await searchFood(productName);
                if (localData) {
                    displayLocalProductInfo(localData, productName);
                    found = true;
                    productData = makeData(localData, productName)
                } else {
                    resultDiv.innerHTML = "Информация о продукте не найдена ни в одной базе данных.";
                }
            }
        } catch (err) {
            resultDiv.innerHTML = `<p>Ошибка при поиске альтернатив: ${err.message}</p>`;
        }
    }

    // Инициализация сканера QuaggaJS
    scanBtn.addEventListener('click', () => {
        found=false;
        if (scannerActive) return;
        
        scannerActive = true;
        resultDiv.textContent = "Сканирование...";

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: video,
                constraints: { facingMode: "environment" }
            },
            decoder: {
                readers: ["ean_reader", "ean_8_reader", "code_128_reader"]
            }
        }, err => {
            if (err) {
                resultDiv.textContent = "Ошибка сканера: " + err;
                scannerActive = false;
                return;
            }
            Quagga.start();
        });

        Quagga.onDetected(data => {
            const code = data.codeResult.code;
            const currentTime = Date.now();
            
            // Проверка валидности кода и временного интервала
            if (!isValidBarcode(code)) {
                resultDiv.textContent = `Неверный формат штрих-кода: ${code}`;
                Quagga.stop();
                scannerActive = false;
                return;
            }
            
            if (code === lastScannedCode && (currentTime - lastScanTime) < SCAN_COOLDOWN) {
                Quagga.stop();
                scannerActive = false;
                return;
            }
            
            lastScannedCode = code;
            lastScanTime = currentTime;
            
            resultDiv.textContent = `Найден код: ${code}`;
            Quagga.stop();
            scannerActive = false;
            
            processProductData(code);
            
        });
    });

    // Отображение информации о найденном продукте
function displayProductInfo(product) {
    let infoHtml = `
        <h3>${product.product_name_ru || product.product_name || "Название не указано"}</h3>
        <p><strong>Бренд:</strong> ${product.brands || "—"}</p>
    `;

    // Состав
    if (product.ingredients_text_ru) {
        infoHtml += `<p><strong>Состав:</strong> ${product.ingredients_text_ru}</p>`;
    }

    // Пищевая ценность
    if (product.nutriments) {
        const nut = product.nutriments;
        const calories = ((parseFloat(nut.proteins_100g || 0) * 4) + 
                        (parseFloat(nut.fat_100g || 0) * 9) + 
                        (parseFloat(nut.carbohydrates_100g || 0) * 4)).toFixed(1);
        
        infoHtml += `
            <div class="nutrition-facts">
                <h4>Пищевая ценность (на 100г):</h4>
                <p><strong>Калории:</strong> ${calories} ккал</p>
                <p><strong>Белки:</strong> ${nut.proteins_100g || "—"} г</p>
                <p><strong>Жиры:</strong> ${nut.fat_100g || "—"} г</p>
                <p><strong>Углеводы:</strong> ${nut.carbohydrates_100g || "—"} г</p>
            </div>
        `;
    } else {
        infoHtml += `<p>Нет данных о пищевой ценности</p>`;
    }

    resultDiv.innerHTML = infoHtml;
}

// Отображение похожего продукта
async function displaySimilarProduct(similarProduct, originalName) {
    let similarHtml = `
        <h3>Оригинальный запрос: ${originalName}</h3>
        <h4>Похожий продукт в базе:</h4>
        <p><strong>${similarProduct.product_name_ru || similarProduct.product_name || "Без названия"}</strong></p>
        <p><strong>Бренд:</strong> ${similarProduct.brands || "—"}</p>
    `;

    if (similarProduct.nutriments) {
        let nut = similarProduct.nutriments;
        
        // Если нет полных данных о питательной ценности
        if (!nut.proteins_100g && !nut.fat_100g && !nut.carbohydrates_100g) {
            similarHtml += `<p class="warning">Информация о питательной ценности неполная. Ищем в локальной базе...</p>`;
            
            // Пробуем найти в локальной базе
            const localData = await displayLocalProductInfo(originalName);
            
            if (localData !== "НЕТ ДАННЫХ") {
                nut = localData;
                similarHtml += `
                    <div class="nutrition-facts">
                        <h4>Пищевая ценность из локальной базы:</h4>
                        <p><strong>Калории:</strong> ${((nut.proteins_100g * 4) + (nut.fat_100g * 9) + (nut.carbohydrates_100g * 4)).toFixed(1)} ккал</p>
                        <p><strong>Белки:</strong> ${nut.proteins_100g} г</p>
                        <p><strong>Жиры:</strong> ${nut.fat_100g} г</p>
                        <p><strong>Углеводы:</strong> ${nut.carbohydrates_100g} г</p>
                    </div>
                `;
            } else {
                similarHtml += `<p class="error">Данные о питательной ценности не найдены</p>`;
            }
        } else {
            // Если данные о питательной ценности полные
            similarHtml += `
                <div class="nutrition-facts">
                    <h4>Пищевая ценность (на 100г):</h4>
                    <p><strong>Калории:</strong> ${((nut.proteins_100g * 4) + (nut.fat_100g * 9) + (nut.carbohydrates_100g * 4)).toFixed(1)} ккал</p>
                    <p><strong>Белки:</strong> ${nut.proteins_100g} г</p>
                    <p><strong>Жиры:</strong> ${nut.fat_100g} г</p>
                    <p><strong>Углеводы:</strong> ${nut.carbohydrates_100g} г</p>
                </div>
            `;
        }
    }

    resultDiv.innerHTML = similarHtml;
}

// Получение данных из локальной базы
async function displayLocalProductInfo(productName) {
    try {
        const json_res = await searchFood(productName);
        if (!json_res) {
            return "НЕТ ДАННЫХ";
        }
        return {
            proteins_100g: parseFloat(json_res.proteins) || 0,
            fat_100g: parseFloat(json_res.fats) || 0,
            carbohydrates_100g: parseFloat(json_res.carbs) || 0
        };
    } catch (error) {
        console.error("Ошибка при поиске в локальной базе:", error);
        return "НЕТ ДАННЫХ";
    }
}


async function searchFood(query) {
    if (!query.trim()) return null;
    
    try {
        const response = await fetch("./food.json");
        const foods = await response.json();
        const foodsArray = foods || [];
        
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const results = foodsArray.filter(item => regex.test(item.name));
        
        return results[0] || null;
    } catch (err) {
        console.error("Ошибка при поиске в локальной базе:", err);
        return null;
    }
}

// Добавление в базу
addBtn.addEventListener('click', async function() {
    if (!found) {
        alert('Нечего добавлять!');
        return;
    }
    const result = await addProductToDb(productData);
    if (result && result.id) {
        // Добавляем штрихкод к продукту
        await fetch('/api/barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                barcode: currentBarcode,
                product_id: result.id
            })
        });
        alert('Товар успешно добавлен!');
        currentProduct = { ...productData, id: result.id };
    } else {
        alert('Ошибка при добавлении товара', result);
    }
});

// Открытие модального окна для удаления
deleteFromDbBtn.addEventListener('click', async function() {
    const products = await getAllProducts();
    
    // Очищаем и заполняем select
    productSelect.innerHTML = '<option value="">-- Выберите товар --</option>';
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        productSelect.appendChild(option);
    });
    
    modal.style.display = 'block';
});

// Закрытие модального окна
closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
});

window.addEventListener('click', function(event) {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Подтверждение удаления
confirmDeleteBtn.addEventListener('click', async function() {
    const productId = productSelect.value;
    if (!productId) {
        alert('Выберите товар для удаления!');
        return;
    }
    
    if (confirm('Вы уверены, что хотите удалить этот товар?')) {
        const result = await deleteProductFromDb(productId);
        if (result && result.success) {
            alert('Товар успешно удален!');
            modal.style.display = 'none';
            
            // Если удалили текущий продукт, сбрасываем его
            if (currentProduct && currentProduct.id === parseInt(productId)) {
                currentProduct = null;
                resultDiv.textContent = 'Наведите камеру на штрихкод';
            }
        } else {
            alert('Ошибка при удалении товара');
        }
    }
});

function makeData(data, diff_name=null){
    const nut = data.nutriments
    return  {
        name: diff_name || data.product_name || data.product_name_ru,
        calories: ((nut.proteins_100g * 4) + (nut.fat_100g * 9) + (nut.carbohydrates_100g * 4)).toFixed(1) || 0,
        proteins: nut.proteins_100g || 0,
        fats: nut.fat_100g || 0,
        carbs: nut.carbohydrates_100g || 0
    };
}
});
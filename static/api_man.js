// ==================== API ФУНКЦИИ ====================
    
    // Поиск продукта по штрихкоду
    async function findProductByBarcode(barcode) {
        try {
            const response = await fetch(`/api/products/by-barcode/${barcode}`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка поиска продукта:', error);
            return null;
        }
    }
    
    // Добавление нового продукта
    async function addProductToDb(productData) {
        try {
            console.log(productData)
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка добавления продукта:', error);
            return null;
        }
    }
    
    // Удаление продукта
    async function deleteProductFromDb(productId) {
        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка удаления продукта:', error);
            return null;
        }
    }
    
    // Получение списка всех продуктов
    async function getAllProducts() {
        try {
            const response = await fetch('/api/products');
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения продуктов:', error);
            return [];
        }
    }
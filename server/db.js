const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const db = new sqlite3.Database('./db.sqlite'); // Файл БД на сервере

const cors = require('cors');
app.use(cors({
  origin: `https://${get_ip_by_place_code()}`,
  methods: ['GET', 'POST', 'PUT', 'DELETE'] // Явно разрешаем POST
}));

app.use(bodyParser.json());

// Создаём таблицы (если их нет)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      proteins REAL NOT NULL,
      fats REAL NOT NULL,
      carbs REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barcodes (
      barcode TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
});

// Добавление продукта
app.post('/api/products', (req, res) => {
  const { name, calories, proteins, fats, carbs } = req.body;
  db.run(
    `INSERT INTO products (name, calories, proteins, fats, carbs) 
     VALUES (?, ?, ?, ?, ?)`,
    [name, calories, proteins, fats, carbs],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Добавление штрих-кода
app.post('/api/barcodes', (req, res) => {
  const { barcode, product_id } = req.body;
  db.run(
    "INSERT OR IGNORE INTO barcodes (barcode, product_id) VALUES (?, ?)",
    [barcode, product_id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Поиск продукта по штрих-коду
app.get('/api/products/by-barcode/:barcode', (req, res) => {
  const { barcode } = req.params;
  db.get(
    `SELECT p.* FROM products p
     JOIN barcodes b ON p.id = b.product_id
     WHERE b.barcode = ?`,
    [barcode],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    }
  );
});

// Поиск продуктов по названию
app.get('/api/products/search', (req, res) => {
  const { query } = req.query;
  db.all(
    "SELECT * FROM products WHERE name LIKE ?",
    [`%${query}%`],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
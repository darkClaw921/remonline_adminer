-- Миграция для создания таблиц вкладок
-- Создано: 2025-09-12
-- Описание: Добавляет поддержку вкладок, подвкладок и товаров в подвкладках

-- Создание таблицы вкладок
CREATE TABLE IF NOT EXISTS tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для сортировки вкладок
CREATE INDEX IF NOT EXISTS idx_tabs_order ON tabs(order_index, is_active);

-- Создание таблицы подвкладок
CREATE TABLE IF NOT EXISTS subtabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tab_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
);

-- Создание индексов для подвкладок
CREATE INDEX IF NOT EXISTS idx_subtabs_tab ON subtabs(tab_id);
CREATE INDEX IF NOT EXISTS idx_subtabs_order ON subtabs(tab_id, order_index, is_active);

-- Создание таблицы товаров в подвкладках
CREATE TABLE IF NOT EXISTS subtab_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtab_id INTEGER NOT NULL,
    product_remonline_id INTEGER NOT NULL,
    custom_name VARCHAR,
    custom_category VARCHAR,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subtab_id) REFERENCES subtabs(id) ON DELETE CASCADE
);

-- Создание индексов для товаров в подвкладках
CREATE INDEX IF NOT EXISTS idx_subtab_products_subtab ON subtab_products(subtab_id);
CREATE INDEX IF NOT EXISTS idx_subtab_products_remonline ON subtab_products(product_remonline_id);
CREATE INDEX IF NOT EXISTS idx_subtab_products_order ON subtab_products(subtab_id, order_index, is_active);

-- Создание уникального индекса для предотвращения дублирования товаров в одной подвкладке
CREATE UNIQUE INDEX IF NOT EXISTS idx_subtab_products_unique ON subtab_products(subtab_id, product_remonline_id);

-- Добавление триггеров для автоматического обновления updated_at
CREATE TRIGGER IF NOT EXISTS tabs_updated_at
    AFTER UPDATE ON tabs
    FOR EACH ROW
BEGIN
    UPDATE tabs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS subtabs_updated_at
    AFTER UPDATE ON subtabs
    FOR EACH ROW
BEGIN
    UPDATE subtabs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS subtab_products_updated_at
    AFTER UPDATE ON subtab_products
    FOR EACH ROW
BEGIN
    UPDATE subtab_products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Вставка базовой вкладки "Все товары"
INSERT OR IGNORE INTO tabs (id, name, order_index, is_active) 
VALUES (1, 'Все товары', 0, 1);

-- Вставка подвкладки "Основной список" для вкладки "Все товары"
INSERT OR IGNORE INTO subtabs (id, tab_id, name, order_index, is_active)
VALUES (1, 1, 'Основной список', 0, 1);

# Remonline Adminer

Приложение на FastAPI для работы с API Remonline, предоставляющее возможность управлять и просматривать данные о товарах, остатках и складах.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
uv sync
```

### 2. Настройка переменных окружения
Создайте файл `.env` и укажите ваш API ключ Remonline:
```bash
REMONLINE_API_KEY=your_remonline_api_key_here
```

### 3. Запуск приложения
```bash
# Через uv
uv run main.py

# Или через скрипт
python run.py
```

Приложение будет доступно на `http://localhost:8000`

## 📚 Документация API

После запуска откройте в браузере:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🧪 Запуск тестов

```bash
# Все тесты
uv run pytest

# Только API тесты
uv run pytest app/tests/test_api.py

# Интеграционные тесты (требуют API ключ)
uv run pytest app/tests/test_integration.py -v
```

## 🏗️ Архитектура

Подробное описание архитектуры проекта находится в файле [architecture.md](./architecture.md).

## 📋 API Endpoints

### Склады
- `GET /api/v1/warehouses/` - получить все склады
- `GET /api/v1/warehouses/{id}` - получить склад по ID

### Товары
- `GET /api/v1/products/` - получить все товары с фильтрами
- `GET /api/v1/products/{id}` - получить товар по ID

### Остатки
- `GET /api/v1/stocks/` - получить все остатки с фильтрами
- `GET /api/v1/stocks/warehouse/{warehouse_id}` - остатки на складе
- `GET /api/v1/stocks/product/{product_id}` - остатки товара

## ⚙️ Конфигурация

### Переменные окружения
- `REMONLINE_API_KEY` - API ключ Remonline (обязательно)
- `DATABASE_URL` - URL базы данных (по умолчанию SQLite)
- `DEBUG` - режим отладки
- `UPDATE_INTERVAL_MINUTES` - интервал обновления данных

## 🔧 Разработка

### Структура проекта
```
remonline_adminer/
├── main.py              # Точка входа
├── app/                 # Основное приложение
│   ├── api/            # API endpoints
│   ├── core/           # Конфигурация
│   ├── models/         # Модели БД
│   ├── services/       # Бизнес-логика
│   └── tests/          # Тесты
├── architecture.md      # Документация архитектуры
└── pyproject.toml       # Зависимости
```

## 📊 Мониторинг

- `GET /` - информация о приложении
- `GET /health` - проверка здоровья

## 🐛 Логирование

Приложение использует структурированное логирование с `loguru`:
- INFO: основная информация
- ERROR: ошибки
- DEBUG: детальная отладка

## 🔒 Безопасность

- API ключ хранится в переменных окружения
- Асинхронная обработка запросов
- Валидация данных через Pydantic

## 📈 Производительность

- Асинхронные запросы к API
- Фоновое обновление данных
- Оптимизированные SQL запросы
- Пагинация результатов

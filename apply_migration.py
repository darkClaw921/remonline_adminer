#!/usr/bin/env python3
"""
Скрипт для применения миграций
"""
import sys
from pathlib import Path
from loguru import logger
from sqlalchemy import text
from app.models.database import engine

def apply_migration(migration_path=None):
    """Применить SQL миграцию"""
    # Если путь не указан, используем последнюю миграцию
    if migration_path is None:
        migration_file = Path("migrations/003_performance_indexes.sql")
    else:
        migration_file = Path(migration_path)
    
    if not migration_file.exists():
        logger.error(f"Файл миграции не найден: {migration_file}")
        sys.exit(1)
    
    logger.info(f"Чтение миграции из {migration_file}")
    sql_content = migration_file.read_text()
    
    # Разделяем SQL на отдельные команды (игнорируем комментарии и пустые строки)
    statements = []
    for line in sql_content.split('\n'):
        line = line.strip()
        if line and not line.startswith('--'):
            statements.append(line)
    
    # Объединяем в полные SQL команды по разделителю ;
    full_statements = ' '.join(statements).split(';')
    full_statements = [s.strip() for s in full_statements if s.strip()]
    
    try:
        with engine.connect() as conn:
            logger.info(f"Применение {len(full_statements)} SQL команд...")
            for i, statement in enumerate(full_statements, 1):
                if statement:
                    logger.debug(f"Выполнение команды {i}: {statement[:100]}...")
                    conn.execute(text(statement))
                    conn.commit()
            
            logger.success("✅ Миграция успешно применена!")
            logger.info("Индексы созданы для оптимизации производительности БД")
            
    except Exception as e:
        logger.error(f"❌ Ошибка при применении миграции: {e}")
        logger.exception(e)
        sys.exit(1)

if __name__ == "__main__":
    migration_path = sys.argv[1] if len(sys.argv) > 1 else None
    logger.info(f"Запуск миграции{' ' + migration_path if migration_path else ' (последняя)'}...")
    apply_migration(migration_path)


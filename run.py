#!/usr/bin/env python3
"""
Скрипт для запуска Remonline Adminer
"""
import subprocess
import sys
import os

def main():
    """Запуск приложения через uv"""
    try:
        # Проверяем, установлен ли uv
        subprocess.run(["uv", "--version"], check=True, capture_output=True)

        # Запускаем приложение
        print("🚀 Запуск Remonline Adminer...")
        subprocess.run(["uv", "run", "main.py"], check=True)

    except subprocess.CalledProcessError as e:
        print(f"❌ Ошибка выполнения: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ uv не установлен. Установите uv или используйте pip.")
        print("Инструкция: https://github.com/astral-sh/uv")
        sys.exit(1)

if __name__ == "__main__":
    main()

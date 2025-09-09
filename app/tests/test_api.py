import pytest
from fastapi.testclient import TestClient
from loguru import logger

def test_root_endpoint(client: TestClient):
    """Тест корневого endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Remonline Adminer API" in data["message"]

def test_health_endpoint(client: TestClient):
    """Тест endpoint проверки здоровья"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_get_warehouses_empty_db(client: TestClient):
    """Тест получения складов из пустой базы данных"""
    response = client.get("/api/v1/warehouses/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert isinstance(data["data"], list)

def test_get_products_empty_db(client: TestClient):
    """Тест получения товаров из пустой базы данных"""
    response = client.get("/api/v1/products/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert isinstance(data["data"], list)

def test_get_stocks_empty_db(client: TestClient):
    """Тест получения остатков из пустой базы данных"""
    response = client.get("/api/v1/stocks/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert isinstance(data["data"], list)

def test_warehouse_not_found(client: TestClient):
    """Тест получения несуществующего склада"""
    response = client.get("/api/v1/warehouses/99999")
    assert response.status_code == 404

def test_product_not_found(client: TestClient):
    """Тест получения несуществующего товара"""
    response = client.get("/api/v1/products/99999")
    assert response.status_code == 404

def test_stock_not_found(client: TestClient):
    """Тест получения несуществующего остатка"""
    response = client.get("/api/v1/stocks/99999")
    assert response.status_code == 404

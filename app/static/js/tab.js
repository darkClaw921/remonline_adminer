/**
 * Класс для управления подвкладкой
 */
class Subtab {
    constructor(data, parentTab) {
        this.id = data.id;
        this.tabId = data.tab_id;
        this.name = data.name;
        this.orderIndex = data.order_index;
        this.isActive = data.is_active;
        this.products = data.products || [];
        this.parentTab = parentTab;
        this.element = null;
        this.isSelected = false;
    }

    /**
     * Создаёт DOM элемент подвкладки
     */
    createElement() {
        const subtabElement = document.createElement('div');
        subtabElement.className = 'subtab-item';
        subtabElement.dataset.subtabId = this.id;
        subtabElement.draggable = true;
        
        subtabElement.innerHTML = `
            <div class="subtab-header">
                <span class="subtab-name" title="${this.name}">${this.name}</span>
                <div class="subtab-actions">
                    <button class="btn-subtab-products" title="Управление товарами">📦</button>
                    <button class="btn-subtab-edit" title="Переименовать">✏️</button>
                    <button class="btn-subtab-close" title="Удалить">✕</button>
                </div>
            </div>
        `;

        this.element = subtabElement;
        this.bindEvents();
        
        return subtabElement;
    }

    /**
     * Привязывает события к элементу подвкладки
     */
    bindEvents() {
        if (!this.element) return;

        const subtabHeader = this.element.querySelector('.subtab-header');
        const productsBtn = this.element.querySelector('.btn-subtab-products');
        const editBtn = this.element.querySelector('.btn-subtab-edit');
        const closeBtn = this.element.querySelector('.btn-subtab-close');

        // Клик по заголовку подвкладки - выбор
        subtabHeader.addEventListener('click', (e) => {
            if (e.target === productsBtn || e.target === editBtn || e.target === closeBtn) return;
            this.parentTab.selectSubtab(this);
        });

        // Управление товарами
        productsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openProductsManager();
        });

        // Переименование подвкладки
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startRename();
        });

        // Удаление подвкладки
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });

        // Drag & Drop для перемещения подвкладок
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', `subtab:${this.id}`);
            e.dataTransfer.effectAllowed = 'move';
            this.element.classList.add('dragging');
        });

        this.element.addEventListener('dragend', () => {
            this.element.classList.remove('dragging');
        });

        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedData = e.dataTransfer.getData('text/plain');
            
            // Проверяем, что перетаскиваем подвкладку
            if (draggedData.startsWith('subtab:')) {
                const draggedSubtabId = parseInt(draggedData.split(':')[1]);
                if (draggedSubtabId !== this.id) {
                    this.parentTab.moveSubtab(draggedSubtabId, this.id);
                }
            }
        });
    }

    /**
     * Выбирает подвкладку
     */
    select() {
        this.isSelected = true;
        this.element.classList.add('selected');
    }

    /**
     * Снимает выделение с подвкладки
     */
    deselect() {
        this.isSelected = false;
        this.element.classList.remove('selected');
    }

    /**
     * Открывает менеджер товаров подвкладки
     */
    openProductsManager() {
        console.log('Открытие менеджера товаров для подвкладки:', this.name);
        
        // Создаем модальное окно для управления товарами
        const modal = this.createProductsModal();
        document.body.appendChild(modal);
        
        // Показываем модальное окно
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Обработчик для изменения размера модального окна
        const toggleSizeBtn = modal.querySelector('#toggleModalSize');
        const modalDialog = modal.querySelector('.modal-dialog');
        let isFullscreen = false;
        
        toggleSizeBtn.addEventListener('click', () => {
            const availableProducts = modal.querySelector('#availableProducts');
            const subtabProducts = modal.querySelector('#subtabProducts');
            
            if (isFullscreen) {
                modalDialog.className = 'modal-dialog modal-xl modal-dialog-resizable';
                toggleSizeBtn.innerHTML = '⛶';
                toggleSizeBtn.title = 'Развернуть на весь экран';
                // Возвращаем обычную высоту
                if (availableProducts) availableProducts.style.height = '400px';
                if (subtabProducts) subtabProducts.style.height = '400px';
                isFullscreen = false;
            } else {
                modalDialog.className = 'modal-dialog modal-fullscreen modal-dialog-resizable';
                toggleSizeBtn.innerHTML = '🗗';
                toggleSizeBtn.title = 'Свернуть до обычного размера';
                // Увеличиваем высоту для полноэкранного режима
                if (availableProducts) availableProducts.style.height = 'calc(100vh - 300px)';
                if (subtabProducts) subtabProducts.style.height = 'calc(100vh - 300px)';
                isFullscreen = true;
            }
        });
        
        // Удаляем модальное окно после закрытия
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
        
        // Загружаем товары
        this.loadProductsForModal(modal);
    }

    /**
     * Создает модальное окно для управления товарами
     */
    createProductsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-resizable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Товары на листе "${this.name}"</h5>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary" id="toggleModalSize" title="Изменить размер окна">⛶</button>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <input type="text" class="form-control" id="productSearch" placeholder="Поиск по названию или RemID...">
                            </div>
                            <div class="col-md-6">
                                <button type="button" class="btn btn-primary" id="addSelectedProducts">
                                    Добавить выбранные товары
                                </button>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Доступные товары</h6>
                                <div id="availableProducts" class="border p-2" style="height: 400px; overflow-y: auto;">
                                    <div class="text-center">
                                        <div class="spinner-border" role="status">
                                            <span class="visually-hidden">Загрузка...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h6>Товары на листе</h6>
                                <div id="subtabProducts" class="border p-2" style="height: 400px; overflow-y: auto;">
                                    <div class="text-center">
                                        <div class="spinner-border" role="status">
                                            <span class="visually-hidden">Загрузка...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Загружает товары для модального окна
     */
    async loadProductsForModal(modal) {
        const availableContainer = modal.querySelector('#availableProducts');
        const subtabContainer = modal.querySelector('#subtabProducts');
        const searchInput = modal.querySelector('#productSearch');
        const addButton = modal.querySelector('#addSelectedProducts');
        
        try {
            // Загружаем все товары
            const response = await fetch('/api/v1/products/?limit=1000');
            const data = await response.json();
            const allProducts = data.data || [];
            
            // Сохраняем ссылку на исходные данные для отображения оригиналов
            this.originalProductsData = allProducts;
            
            // Загружаем товары подвкладки с полными данными (включая custom поля)
            const subtabProductsResponse = await fetch(`/api/v1/tabs/subtabs/${this.id}/products`);
            const subtabProductsData = await subtabProductsResponse.json();
            
            // Получаем ID товаров уже добавленных в подвкладку
            const subtabProductIds = subtabProductsData.map(sp => sp.product_remonline_id);
            
            // Обогащаем данные товаров в подвкладке информацией из общего списка
            const currentProducts = subtabProductsData.map(subtabProduct => {
                const fullProduct = allProducts.find(p => p.remonline_id === subtabProduct.product_remonline_id);
                return {
                    ...fullProduct,
                    id: subtabProduct.id, // ID записи SubTabProduct для редактирования
                    custom_name: subtabProduct.custom_name,
                    custom_category: subtabProduct.custom_category,
                    product_remonline_id: subtabProduct.product_remonline_id,
                    order_index: subtabProduct.order_index // Сохраняем порядок
                };
            });
            
            // Обновляем данные подвкладки с правильным порядком
            this.products = subtabProductsData;
            
            // Разделяем на доступные товары
            const availableProducts = allProducts.filter(p => !subtabProductIds.includes(p.remonline_id));
            
            // Отрисовываем списки товаров
            this.renderProductsList(availableContainer, availableProducts, 'available');
            this.renderProductsList(subtabContainer, currentProducts, 'current');
            
            // Настраиваем поиск
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const query = e.target.value.toLowerCase();
                    const filtered = allProducts.filter(p => 
                        !subtabProductIds.includes(p.remonline_id) &&
                        (p.name.toLowerCase().includes(query) || 
                         (p.custom_name && p.custom_name.toLowerCase().includes(query)) ||
                         (p.remonline_id && p.remonline_id.toString().includes(query)))
                    );
                    this.renderProductsList(availableContainer, filtered, 'available');
                }, 300);
            });
            
            // Настраиваем кнопку добавления
            addButton.addEventListener('click', () => {
                this.addSelectedProductsToSubtab(modal);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки товаров:', error);
            availableContainer.innerHTML = '<div class="alert alert-danger">Ошибка загрузки товаров</div>';
            subtabContainer.innerHTML = '<div class="alert alert-danger">Ошибка загрузки товаров</div>';
        }
    }

    /**
     * Отрисовывает список товаров
     */
    renderProductsList(container, products, type) {
        if (products.length === 0) {
            container.innerHTML = '<div class="text-muted">Товары не найдены</div>';
            return;
        }
        
        const html = products.map(product => {
            if (type === 'current') {
                // Для товаров в подвкладке показываем редактируемые поля
                const displayName = product.custom_name || product.name;
                const displayCategory = product.custom_category || product.category || 'Без категории';
                
                return `
                    <div class="card mb-2 draggable-product" data-product-id="${product.id}" data-remonline-id="${product.product_remonline_id || product.remonline_id}" draggable="true">
                        <div class="card-body p-2">
                            <div class="row align-items-center">
                                <div class="col-auto pe-2">
                                    <span class="drag-handle text-muted" title="Перетащите для изменения порядка" style="cursor: move;">⋮⋮</span>
                                </div>
                                <div class="col">
                                    <div class="mb-1">
                                        <strong class="editable-name" data-field="custom_name" title="Клик для редактирования">${displayName}</strong>
                                        ${product.custom_name ? '<small class="text-success ms-1">✓</small>' : ''}
                                    </div>
                                    ${product.custom_name ? `<div class="mb-1"><small class="text-muted">Оригинал: ${product.name}</small></div>` : ''}
                                    <div class="mb-1">
                                        <span class="text-muted">Категория: </span>
                                        <span class="editable-category" data-field="custom_category" title="Клик для редактирования">${displayCategory}</span>
                                        ${product.custom_category ? '<small class="text-success ms-1">✓</small>' : ''}
                                    </div>
                                    ${product.custom_category ? `<div class="mb-1"><small class="text-muted">Оригинал категории: ${product.category || 'Без категории'}</small></div>` : ''}
                                    <small class="text-muted">ID: ${product.product_remonline_id || product.remonline_id} | SKU: ${product.sku || '-'} | Порядок: ${product.order_index}</small>
                                </div>
                                <div class="col-auto">
                                    <button type="button" class="btn btn-sm btn-outline-danger" 
                                            onclick="removeProductFromSubtab(${this.id}, ${product.product_remonline_id || product.remonline_id})">
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Для доступных товаров обычный вид с чекбоксом
                return `
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="checkbox" value="${product.remonline_id}" 
                               id="${type}_${product.id}" data-product-id="${product.id}">
                        <label class="form-check-label" for="${type}_${product.id}">
                            <strong>${product.name}</strong><br>
                            <small class="text-muted">Категория: ${product.category || 'Без категории'}</small><br>
                            <small class="text-muted">ID: ${product.remonline_id} | SKU: ${product.sku || '-'}</small>
                        </label>
                    </div>
                `;
            }
        }).join('');
        
        container.innerHTML = html;
        
        // Привязываем события для редактирования, если это товары в подвкладке
        if (type === 'current') {
            this.bindEditableEvents(container);
            this.bindDragDropEvents(container);
        }
    }

    /**
     * Привязывает события для редактирования полей товаров
     */
    bindEditableEvents(container) {
        // Редактирование названий
        container.querySelectorAll('.editable-name').forEach(element => {
            element.addEventListener('click', (e) => {
                this.startEditField(e.target, 'custom_name');
            });
            element.style.cursor = 'pointer';
            element.style.borderBottom = '1px dashed #007bff';
        });

        // Редактирование категорий
        container.querySelectorAll('.editable-category').forEach(element => {
            element.addEventListener('click', (e) => {
                this.startEditField(e.target, 'custom_category');
            });
            element.style.cursor = 'pointer';
            element.style.borderBottom = '1px dashed #007bff';
        });
    }

    /**
     * Привязывает события для drag&drop товаров
     */
    bindDragDropEvents(container) {
        const draggableItems = container.querySelectorAll('.draggable-product');
        
        draggableItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', `product:${item.dataset.productId}:${item.dataset.remonlineId}`);
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                // Удаляем все drag-over классы
                container.querySelectorAll('.draggable-product').forEach(el => {
                    el.classList.remove('drag-over', 'drag-over-bottom');
                });
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (item.classList.contains('dragging')) return;
                
                const rect = item.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const isBottomHalf = y > rect.height / 2;
                
                // Очищаем все drag-over классы
                container.querySelectorAll('.draggable-product').forEach(el => {
                    el.classList.remove('drag-over', 'drag-over-bottom');
                });
                
                // Добавляем соответствующий класс
                if (isBottomHalf) {
                    item.classList.add('drag-over-bottom');
                } else {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const draggedData = e.dataTransfer.getData('text/plain');
                if (!draggedData.startsWith('product:')) return;
                
                const [, draggedProductId, draggedRemonlineId] = draggedData.split(':');
                const draggedElement = container.querySelector(`[data-product-id="${draggedProductId}"]`);
                
                if (!draggedElement || draggedElement === item) return;
                
                const rect = item.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const isBottomHalf = y > rect.height / 2;
                
                // Перемещаем элемент в DOM
                if (isBottomHalf) {
                    item.parentNode.insertBefore(draggedElement, item.nextSibling);
                } else {
                    item.parentNode.insertBefore(draggedElement, item);
                }
                
                // Обновляем порядок товаров на сервере
                this.updateProductsOrder(container);
                
                // Очищаем drag-over классы
                item.classList.remove('drag-over', 'drag-over-bottom');
            });
        });
    }

    /**
     * Обновляет порядок товаров на сервере
     */
    async updateProductsOrder(container) {
        const productElements = container.querySelectorAll('.draggable-product');
        const orderData = Array.from(productElements).map((element, index) => ({
            product_id: parseInt(element.dataset.productId),
            order_index: index
        }));

        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}/products/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ products: orderData })
            });

            if (!response.ok) {
                throw new Error('Ошибка при обновлении порядка товаров');
            }

            console.log('Порядок товаров обновлен');
            
            // Обновляем данные подвкладки для синхронизации с основной таблицей
            await this.refreshSubtabData();
            
            // Если эта подвкладка активна, перезагружаем основную таблицу
            if (window.activeSubtab && window.activeSubtab.id === this.id) {
                if (typeof loadPage === 'function') {
                    loadPage();
                }
            }
        } catch (error) {
            console.error('Ошибка при обновлении порядка товаров:', error);
            // Можно показать уведомление пользователю
        }
    }

    /**
     * Начинает редактирование поля
     */
    startEditField(element, fieldName) {
        const currentValue = element.textContent;
        const card = element.closest('.card');
        const productId = card.dataset.productId;
        
        // Создаем инпут для редактирования
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.className = 'form-control form-control-sm';
        input.style.minWidth = '200px';
        
        // Заменяем элемент на инпут
        element.parentNode.replaceChild(input, element);
        input.focus();
        input.select();

        const finishEdit = async () => {
            const newValue = input.value.trim();
            
            try {
                // Отправляем запрос на обновление
                await this.updateSubtabProductField(productId, fieldName, newValue);
                
                // Восстанавливаем элемент с новым значением
                const newElement = document.createElement('span');
                newElement.className = element.className;
                newElement.dataset.field = fieldName;
                newElement.title = 'Клик для редактирования';
                newElement.textContent = newValue || (fieldName === 'custom_category' ? 'Без категории' : currentValue);
                newElement.style.cursor = 'pointer';
                newElement.style.borderBottom = '1px dashed #007bff';
                
                // Заменяем input на новый элемент
                const parentElement = input.parentNode;
                parentElement.replaceChild(newElement, input);
                
                // Удаляем старую галочку если есть
                const existingCheckmark = parentElement.querySelector('.text-success');
                if (existingCheckmark) {
                    existingCheckmark.remove();
                }
                
                // Добавляем галочку если значение кастомное
                if (newValue && newValue.trim() !== '') {
                    const checkmark = document.createElement('small');
                    checkmark.className = 'text-success ms-1';
                    checkmark.textContent = '✓';
                    checkmark.title = fieldName === 'custom_name' ? 'Кастомное название' : 'Кастомная категория';
                    parentElement.insertBefore(checkmark, newElement.nextSibling);
                }
                
                // Привязываем событие заново
                newElement.addEventListener('click', (e) => {
                    this.startEditField(e.target, fieldName);
                });
                
                // Обновляем отображение оригинальных данных
                this.updateOriginalDataDisplay(card, fieldName, newValue);
                
            } catch (error) {
                console.error('Ошибка обновления поля:', error);
                alert('Не удалось обновить поле');
                
                // Восстанавливаем оригинальный элемент
                input.parentNode.replaceChild(element, input);
            }
        };

        // Обработчики событий
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                input.parentNode.replaceChild(element, input);
            }
        });
    }

    /**
     * Обновляет отображение оригинальных данных
     */
    updateOriginalDataDisplay(card, fieldName, newValue) {
        const originalSelector = fieldName === 'custom_name' ? '.original-name' : '.original-category';
        let originalElement = card.querySelector(originalSelector);
        
        if (newValue && newValue.trim() !== '') {
            // Показываем оригинал если есть кастомное значение
            if (!originalElement) {
                originalElement = document.createElement('div');
                originalElement.className = 'mb-1';
                originalElement.innerHTML = `<small class="text-muted ${fieldName === 'custom_name' ? 'original-name' : 'original-category'}"></small>`;
                
                if (fieldName === 'custom_name') {
                    // Вставляем после названия
                    const nameDiv = card.querySelector('.editable-name').closest('.mb-1');
                    nameDiv.parentNode.insertBefore(originalElement, nameDiv.nextSibling);
                } else {
                    // Вставляем после категории
                    const categoryDiv = card.querySelector('.editable-category').closest('.mb-1');
                    categoryDiv.parentNode.insertBefore(originalElement, categoryDiv.nextSibling);
                }
            }
            
            // Получаем оригинальные данные из data-атрибутов или других источников
            const originalData = this.getOriginalProductData(card);
            const originalText = fieldName === 'custom_name' 
                ? `Оригинал: ${originalData.name}` 
                : `Оригинал категории: ${originalData.category || 'Без категории'}`;
            
            originalElement.querySelector('small').textContent = originalText;
        } else {
            // Скрываем оригинал если нет кастомного значения
            if (originalElement) {
                originalElement.remove();
            }
        }
    }

    /**
     * Получает оригинальные данные товара
     */
    getOriginalProductData(card) {
        const productId = card.dataset.remonlineId;
        // Ищем товар в исходных данных
        const originalProduct = this.originalProductsData?.find(p => 
            p.remonline_id === parseInt(productId)
        );
        
        return originalProduct || { name: 'Неизвестно', category: 'Без категории' };
    }

    /**
     * Обновляет поле товара в подвкладке
     */
    async updateSubtabProductField(productId, fieldName, value) {
        const updateData = {};
        updateData[fieldName] = value || null;
        
        const response = await fetch(`/api/v1/tabs/subtabs/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error('Ошибка сервера');
        }
        
        return response.json();
    }

    /**
     * Добавляет выбранные товары в подвкладку
     */
    async addSelectedProductsToSubtab(modal) {
        const checkboxes = modal.querySelectorAll('#availableProducts input[type="checkbox"]:checked');
        const productIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (productIds.length === 0) {
            alert('Выберите товары для добавления');
            return;
        }
        
        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_remonline_ids: productIds
                })
            });
            
            if (response.ok) {
                // Обновляем данные подвкладки
                await this.refreshProductsData();
                
                // Перезагружаем модальное окно
                await this.loadProductsForModal(modal);
                
                // Если эта подвкладка активна, обновляем таблицу товаров
                if (this.parentTab.activeSubtab === this) {
                    window.loadPage && window.loadPage();
                }
            } else {
                throw new Error('Ошибка сервера');
            }
        } catch (error) {
            console.error('Ошибка добавления товаров:', error);
            alert('Не удалось добавить товары в подвкладку');
        }
    }

    /**
     * Обновляет данные товаров подвкладки
     */
    async refreshProductsData() {
        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}`);
            if (response.ok) {
                const data = await response.json();
                this.products = data.products || [];
            }
        } catch (error) {
            console.error('Ошибка обновления данных подвкладки:', error);
        }
    }

    /**
     * Начинает переименование подвкладки
     */
    startRename() {
        const nameSpan = this.element.querySelector('.subtab-name');
        const currentName = nameSpan.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'subtab-rename-input';
        
        nameSpan.parentNode.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        const finishRename = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                await this.rename(newName);
            }
            
            const newNameSpan = document.createElement('span');
            newNameSpan.className = 'subtab-name';
            newNameSpan.title = this.name;
            newNameSpan.textContent = this.name;
            input.parentNode.replaceChild(newNameSpan, input);
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            } else if (e.key === 'Escape') {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'subtab-name';
                nameSpan.title = currentName;
                nameSpan.textContent = currentName;
                input.parentNode.replaceChild(nameSpan, input);
            }
        });
    }

    /**
     * Переименовывает подвкладку
     */
    async rename(newName) {
        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName
                })
            });

            if (response.ok) {
                this.name = newName;
            }
        } catch (error) {
            console.error('Ошибка переименования подвкладки:', error);
        }
    }

    /**
     * Удаляет подвкладку
     */
    async delete() {
        if (!confirm(`Удалить подвкладку "${this.name}"?`)) return;

        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Удаляем из родительской вкладки
                const index = this.parentTab.subtabs.indexOf(this);
                if (index > -1) {
                    this.parentTab.subtabs.splice(index, 1);
                    this.parentTab.renderSubtabs();
                    
                    // Если это была активная подвкладка, выбираем другую
                    if (this.parentTab.activeSubtab === this) {
                        const newActive = this.parentTab.subtabs.find(s => s.isActive);
                        if (newActive) {
                            this.parentTab.selectSubtab(newActive);
                        } else {
                            this.parentTab.activeSubtab = null;
                            this.parentTab.tabsManager.onSubtabSelected(null);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка удаления подвкладки:', error);
        }
    }

    /**
     * Получает список ID товаров в подвкладке
     */
    getProductIds() {
        return this.products
            .filter(p => p.is_active)
            .map(p => p.product_remonline_id);
    }

    /**
     * Обновляет данные подвкладки с сервера
     */
    async refreshSubtabData() {
        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}/products`);
            if (!response.ok) {
                throw new Error('Ошибка загрузки данных подвкладки');
            }
            
            const data = await response.json();
            this.products = data || [];
            
            console.log('Данные подвкладки обновлены');
        } catch (error) {
            console.error('Ошибка обновления данных подвкладки:', error);
        }
    }

    /**
     * Обновляет порядок подвкладки
     */
    async updateOrder(newOrder) {
        try {
            const response = await fetch(`/api/v1/tabs/subtabs/${this.id}/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_order: newOrder })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Ошибка API при изменении порядка подвкладки:', errorData);
                return false;
            }
            
            this.orderIndex = newOrder;
            return true;
        } catch (error) {
            console.error('Ошибка изменения порядка подвкладки:', error);
            return false;
        }
    }
}

/**
 * Класс для управления одной вкладкой
 */
class Tab {
    constructor(data, tabsManager) {
        this.id = data.id;
        this.name = data.name;
        this.orderIndex = data.order_index;
        this.isActive = data.is_active;
        this.subtabs = data.subtabs || [];
        this.tabsManager = tabsManager;
        this.element = null;
        this.isSelected = false;
        this.activeSubtab = null;
    }

    /**
     * Создаёт DOM элемент вкладки
     */
    createElement() {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';
        tabElement.dataset.tabId = this.id;
        tabElement.draggable = true;
        
        tabElement.innerHTML = `
            <div class="tab-header">
                <span class="tab-name" title="${this.name}">${this.name}</span>
                <div class="tab-actions">
                    <button class="btn-tab-edit" title="Переименовать">✏️</button>
                    <button class="btn-tab-close" title="Удалить">✕</button>
                </div>
            </div>
        `;

        this.element = tabElement;
        this.bindEvents();
        
        return tabElement;
    }

    /**
     * Привязывает события к элементу вкладки
     */
    bindEvents() {
        if (!this.element) return;

        const tabHeader = this.element.querySelector('.tab-header');
        const editBtn = this.element.querySelector('.btn-tab-edit');
        const closeBtn = this.element.querySelector('.btn-tab-close');

        // Клик по заголовку вкладки - выбор/разворачивание
        tabHeader.addEventListener('click', (e) => {
            if (e.target === editBtn || e.target === closeBtn) return;
            this.toggle();
        });

        // Переименование вкладки
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startRename();
        });

        // Удаление вкладки
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete();
        });

        // Drag & Drop для перемещения вкладок
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', this.id);
            e.dataTransfer.effectAllowed = 'move';
            this.element.classList.add('dragging');
        });

        this.element.addEventListener('dragend', () => {
            this.element.classList.remove('dragging');
        });

        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedTabId = parseInt(e.dataTransfer.getData('text/plain'));
            if (draggedTabId !== this.id) {
                this.tabsManager.moveTab(draggedTabId, this.id);
            }
        });
    }

    /**
     * Переключает состояние вкладки (выбранная/свёрнутая)
     */
    toggle() {
        if (this.isSelected) {
            this.collapse();
        } else {
            this.tabsManager.selectTab(this);
        }
    }

    /**
     * Выбирает вкладку
     */
    select() {
        this.isSelected = true;
        this.element.classList.add('selected');
        
        // Создаём базовую подвкладку если её нет
        if (this.subtabs.length === 0) {
            this.createDefaultSubtab();
        }
    }

    /**
     * Сворачивает вкладку
     */
    collapse() {
        this.isSelected = false;
        this.element.classList.remove('selected');
        this.activeSubtab = null;
    }

    /**
     * Создаёт базовую подвкладку "Основной список"
     */
    async createDefaultSubtab() {
        try {
            const response = await fetch(`/api/v1/tabs/${this.id}/subtabs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tab_id: this.id,
                    name: 'Основной список',
                    order_index: 0,
                    is_active: true
                })
            });

            if (response.ok) {
                const subtabData = await response.json();
                const subtab = new Subtab(subtabData, this);
                this.subtabs.push(subtab);
            }
        } catch (error) {
            console.error('Ошибка создания базовой подвкладки:', error);
        }
    }


    /**
     * Начинает переименование вкладки
     */
    startRename() {
        const nameSpan = this.element.querySelector('.tab-name');
        const currentName = nameSpan.textContent;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'tab-rename-input';
        
        nameSpan.parentNode.replaceChild(input, nameSpan);
        input.focus();
        input.select();

        const finishRename = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                await this.rename(newName);
            }
            
            const newNameSpan = document.createElement('span');
            newNameSpan.className = 'tab-name';
            newNameSpan.title = this.name;
            newNameSpan.textContent = this.name;
            input.parentNode.replaceChild(newNameSpan, input);
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            } else if (e.key === 'Escape') {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'tab-name';
                nameSpan.title = currentName;
                nameSpan.textContent = currentName;
                input.parentNode.replaceChild(nameSpan, input);
            }
        });
    }

    /**
     * Переименовывает вкладку
     */
    async rename(newName) {
        try {
            const response = await fetch(`/api/v1/tabs/${this.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName
                })
            });

            if (response.ok) {
                this.name = newName;
            }
        } catch (error) {
            console.error('Ошибка переименования вкладки:', error);
        }
    }

    /**
     * Удаляет вкладку
     */
    async delete() {
        if (!confirm(`Удалить вкладку "${this.name}"?`)) return;

        try {
            const response = await fetch(`/api/v1/tabs/${this.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.tabsManager.removeTab(this);
            }
        } catch (error) {
            console.error('Ошибка удаления вкладки:', error);
        }
    }

    /**
     * Выбирает подвкладку
     */
    selectSubtab(subtab) {
        // Снимаем выделение с предыдущей активной подвкладки
        if (this.activeSubtab && this.activeSubtab !== subtab) {
            this.activeSubtab.deselect();
        }
        
        this.activeSubtab = subtab;
        subtab.select();
        
        // Уведомляем менеджер вкладок о смене подвкладки
        this.tabsManager.onSubtabSelected(subtab);
    }

    /**
     * Отрисовывает подвкладки
     */
    renderSubtabs() {
        // Обновляем отображение подвкладок через менеджер
        this.tabsManager.showSubtabs(this);
    }

    /**
     * Перемещает подвкладку
     */
    async moveSubtab(draggedSubtabId, targetSubtabId) {
        const draggedSubtab = this.subtabs.find(s => s.id === draggedSubtabId);
        const targetSubtab = this.subtabs.find(s => s.id === targetSubtabId);
        
        if (!draggedSubtab || !targetSubtab) return;

        try {
            // Обновляем порядок на сервере
            await draggedSubtab.updateOrder(targetSubtab.orderIndex);
            
            // Перезагружаем подвкладки для корректного отображения
            await this.reloadSubtabs();
            
        } catch (error) {
            console.error('Ошибка перемещения подвкладки:', error);
        }
    }

    /**
     * Перезагружает подвкладки из API
     */
    async reloadSubtabs() {
        try {
            const response = await fetch(`/api/v1/tabs/${this.id}/subtabs`);
            if (response.ok) {
                const subtabsData = await response.json();
                
                // Обновляем данные подвкладок
                this.subtabs = subtabsData
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(subtabData => new Subtab(subtabData, this));
                
                // Перерисовываем подвкладки
                this.tabsManager.showSubtabs(this);
                
                // Восстанавливаем активную подвкладку если она есть
                if (this.activeSubtab) {
                    const activeSubtab = this.subtabs.find(s => s.id === this.activeSubtab.id);
                    if (activeSubtab) {
                        this.selectSubtab(activeSubtab);
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка перезагрузки подвкладок:', error);
        }
    }

    /**
     * Обновляет порядок вкладки
     */
    async updateOrder(newOrder) {
        try {
            const response = await fetch(`/api/v1/tabs/${this.id}/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ new_order: newOrder })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Ошибка API при изменении порядка:', errorData);
                return false;
            }
            
            this.orderIndex = newOrder;
            return true;
        } catch (error) {
            console.error('Ошибка изменения порядка вкладки:', error);
            return false;
        }
    }
}

/**
 * Глобальная функция для удаления товара из подвкладки
 */
window.removeProductFromSubtab = async function(subtabId, productRemonlineId) {
    if (!confirm('Удалить товар из подвкладки?')) return;
    
    try {
        const response = await fetch(`/api/v1/tabs/subtabs/${subtabId}/products/${productRemonlineId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Находим подвкладку и обновляем её данные
            if (window.tabsManager) {
                const tab = window.tabsManager.tabs.find(t => 
                    t.subtabs.some(s => s.id === subtabId)
                );
                if (tab) {
                    const subtab = tab.subtabs.find(s => s.id === subtabId);
                    if (subtab) {
                        await subtab.refreshProductsData();
                        
                        // Если эта подвкладка активна, обновляем таблицу товаров
                        if (tab.activeSubtab === subtab) {
                            window.loadPage && window.loadPage();
                        }
                    }
                }
            }
        } else {
            throw new Error('Ошибка сервера');
        }
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        alert('Не удалось удалить товар из подвкладки');
    }
};

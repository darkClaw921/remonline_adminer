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
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Товары в подвкладке "${this.name}"</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <input type="text" class="form-control" id="productSearch" placeholder="Поиск товаров...">
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
                                <h6>Товары в подвкладке</h6>
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
            
            // Получаем ID товаров уже добавленных в подвкладку
            const subtabProductIds = this.getProductIds();
            
            // Разделяем на доступные и уже добавленные товары
            const availableProducts = allProducts.filter(p => !subtabProductIds.includes(p.remonline_id));
            const currentProducts = allProducts.filter(p => subtabProductIds.includes(p.remonline_id));
            
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
                        p.name.toLowerCase().includes(query)
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
        
        const html = products.map(product => `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" value="${product.remonline_id}" 
                       id="${type}_${product.id}" data-product-id="${product.id}">
                <label class="form-check-label" for="${type}_${product.id}">
                    <strong>${product.name}</strong><br>
                    <small class="text-muted">ID: ${product.remonline_id} | SKU: ${product.sku || '-'}</small>
                </label>
                ${type === 'current' ? `
                    <button type="button" class="btn btn-sm btn-outline-danger float-end" 
                            onclick="removeProductFromSubtab(${this.id}, ${product.remonline_id})">
                        Удалить
                    </button>
                ` : ''}
            </div>
        `).join('');
        
        container.innerHTML = html;
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
                this.loadProductsForModal(modal);
                
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

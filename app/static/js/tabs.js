/**
 * Менеджер для управления системой вкладок
 */
class TabsManager {
    constructor(container) {
        this.container = container;
        this.tabs = [];
        this.activeTab = null;
        this.activeSubtab = null;
        this.onSubtabChangeCallback = null;
        
        this.init();
    }

    /**
     * Инициализация системы вкладок
     */
    async init() {
        this.createTabsInterface();
        await this.loadTabs();
        
        // Выбираем первую вкладку по умолчанию
        if (this.tabs.length > 0) {
            this.selectTab(this.tabs[0]);
        }
    }

    /**
     * Создаёт интерфейс вкладок
     */
    createTabsInterface() {
        const tabsHTML = `
            <div class="tabs-system">
                <div class="tabs-header">
                    <button class="btn-add-tab" title="Добавить вкладку">+</button>
                    <div class="tabs-scroll-container">
                        <button class="tabs-scroll-btn tabs-scroll-left" style="display: none;">‹</button>
                        <div class="tabs-list-wrapper">
                            <div class="tabs-list"></div>
                        </div>
                        <button class="tabs-scroll-btn tabs-scroll-right" style="display: none;">›</button>
                    </div>
                </div>
                <div class="subtabs-container" style="display: none;">
                    <div class="subtabs-header">
                        <button class="btn-add-subtab" title="Добавить лист">+ Листы</button>
                        <div class="subtabs-list"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = tabsHTML;
        
        // Привязываем события
        this.bindEvents();
        
        // Настраиваем скроллинг вкладок
        this.setupTabsScrolling();
    }

    /**
     * Привязывает события к интерфейсу
     */
    bindEvents() {
        const addTabBtn = this.container.querySelector('.btn-add-tab');
        addTabBtn.addEventListener('click', () => {
            this.addTab();
        });

        const addSubtabBtn = this.container.querySelector('.btn-add-subtab');
        addSubtabBtn.addEventListener('click', () => {
            this.addSubtab();
        });

        // Скроллинг вкладок
        const scrollLeft = this.container.querySelector('.tabs-scroll-left');
        const scrollRight = this.container.querySelector('.tabs-scroll-right');
        const tabsList = this.container.querySelector('.tabs-list');

        scrollLeft.addEventListener('click', () => {
            tabsList.scrollBy({ left: -200, behavior: 'smooth' });
        });

        scrollRight.addEventListener('click', () => {
            tabsList.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }

    /**
     * Настраивает скроллинг вкладок
     */
    setupTabsScrolling() {
        const tabsList = this.container.querySelector('.tabs-list');
        const scrollLeft = this.container.querySelector('.tabs-scroll-left');
        const scrollRight = this.container.querySelector('.tabs-scroll-right');

        const updateScrollButtons = () => {
            const canScrollLeft = tabsList.scrollLeft > 0;
            const canScrollRight = tabsList.scrollLeft < tabsList.scrollWidth - tabsList.clientWidth;
            
            scrollLeft.style.display = canScrollLeft ? 'block' : 'none';
            scrollRight.style.display = canScrollRight ? 'block' : 'none';
        };

        // Обновляем кнопки при скролле
        tabsList.addEventListener('scroll', updateScrollButtons);
        
        // Обновляем кнопки при изменении размера
        const resizeObserver = new ResizeObserver(updateScrollButtons);
        resizeObserver.observe(tabsList);
        
        // Первоначальное обновление
        setTimeout(updateScrollButtons, 100);
    }

    /**
     * Загружает вкладки с сервера
     */
    async loadTabs() {
        try {
            // Формируем URL с учётом активной главной вкладки
            let url = '/api/v1/tabs/?active_only=true&limit=1000';
            
            // Добавляем фильтр по главной вкладке если активна не "все"
            if (window.activeMainTabType && window.activeMainTabType !== 'all') {
                url += `&main_tab_type=${window.activeMainTabType}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const tabsData = await response.json();
                
                this.tabs = tabsData
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(tabData => {
                        const tab = new Tab(tabData, this);
                        // Преобразуем данные подвкладок в объекты Subtab
                        if (tabData.subtabs) {
                            tab.subtabs = tabData.subtabs.map(subtabData => new Subtab(subtabData, tab));
                        }
                        return tab;
                    });
                
                this.renderTabs();
            }
        } catch (error) {
            console.error('Ошибка загрузки вкладок:', error);
        }
    }

    /**
     * Отрисовывает все вкладки
     */
    renderTabs() {
        const tabsList = this.container.querySelector('.tabs-list');
        tabsList.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabElement = tab.createElement();
            tabsList.appendChild(tabElement);
        });

        // Обновляем видимость кнопок скроллинга
        setTimeout(() => {
            const event = new Event('scroll');
            tabsList.dispatchEvent(event);
        }, 100);
    }

    /**
     * Выбирает вкладку
     */
    selectTab(tab) {
        // Сворачиваем предыдущую активную вкладку
        if (this.activeTab && this.activeTab !== tab) {
            this.activeTab.collapse();
        }

        this.activeTab = tab;
        tab.select();
        
        // Показываем подвкладки для выбранной вкладки
        this.showSubtabs(tab);
    }

    /**
     * Добавляет новую вкладку
     */
    async addTab() {
        const name = prompt('Название вкладки:');
        if (!name || !name.trim()) return;

        try {
            const response = await fetch('/api/v1/tabs/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    is_active: true
                })
            });

            if (response.ok) {
                const tabData = await response.json();
                const tab = new Tab(tabData, this);
                this.tabs.push(tab);
                this.renderTabs();
                this.selectTab(tab);
            }
        } catch (error) {
            console.error('Ошибка создания вкладки:', error);
        }
    }

    /**
     * Удаляет вкладку
     */
    removeTab(tab) {
        const index = this.tabs.indexOf(tab);
        if (index > -1) {
            this.tabs.splice(index, 1);
            
            // Если удалённая вкладка была активной, выбираем другую
            if (this.activeTab === tab) {
                this.activeTab = null;
                this.activeSubtab = null;
                
                if (this.tabs.length > 0) {
                    const newActiveIndex = Math.min(index, this.tabs.length - 1);
                    this.selectTab(this.tabs[newActiveIndex]);
                } else {
                    // Если вкладок не осталось, уведомляем о смене
                    this.onSubtabSelected(null);
                }
            }
            
            this.renderTabs();
        }
    }

    /**
     * Перемещает вкладку
     */
    async moveTab(draggedTabId, targetTabId) {
        const draggedTab = this.tabs.find(t => t.id === draggedTabId);
        const targetTab = this.tabs.find(t => t.id === targetTabId);
        
        if (!draggedTab || !targetTab) return;

        try {
            // Обновляем порядок на сервере
            await draggedTab.updateOrder(targetTab.orderIndex);
            
            // Перезагружаем вкладки для корректного отображения
            await this.loadTabs();
            
            // Восстанавливаем активную вкладку
            if (this.activeTab) {
                const activeTab = this.tabs.find(t => t.id === this.activeTab.id);
                if (activeTab) {
                    this.selectTab(activeTab);
                }
            }
        } catch (error) {
            console.error('Ошибка перемещения вкладки:', error);
        }
    }

    /**
     * Вызывается при выборе подвкладки
     */
    onSubtabSelected(subtab) {
        this.activeSubtab = subtab;
        
        // Уведомляем внешний код о смене активной подвкладки
        if (this.onSubtabChangeCallback) {
            this.onSubtabChangeCallback(subtab);
        }
    }

    /**
     * Устанавливает callback для смены подвкладки
     */
    setOnSubtabChangeCallback(callback) {
        this.onSubtabChangeCallback = callback;
    }

    /**
     * Получает текущую активную подвкладку
     */
    getActiveSubtab() {
        return this.activeSubtab;
    }

    /**
     * Получает ID товаров для текущей активной подвкладки
     */
    getActiveSubtabProductIds() {
        if (!this.activeSubtab) {
            return null; // Показываем все товары
        }
        
        return this.activeSubtab.getProductIds();
    }

    /**
     * Показывает подвкладки для выбранной вкладки
     */
    showSubtabs(tab) {
        const subtabsContainer = this.container.querySelector('.subtabs-container');
        const subtabsList = this.container.querySelector('.subtabs-list');
        
        if (tab && tab.subtabs && tab.subtabs.length > 0) {
            // Очищаем список подвкладок
            subtabsList.innerHTML = '';
            
            // Отрисовываем подвкладки
            tab.subtabs
                .filter(subtab => subtab.isActive)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .forEach(subtab => {
                    const subtabElement = subtab.createElement();
                    subtabsList.appendChild(subtabElement);
                });
            
            subtabsContainer.style.display = 'block';
            
            // Выбираем первую подвкладку, если нет активной
            if (!this.activeSubtab || this.activeSubtab.parentTab !== tab) {
                const firstSubtab = tab.subtabs.find(s => s.isActive) || tab.subtabs[0];
                if (firstSubtab) {
                    this.activeSubtab = firstSubtab;
                    firstSubtab.select();
                    this.onSubtabSelected(firstSubtab);
                }
            }
        } else {
            subtabsContainer.style.display = 'none';
            this.onSubtabSelected(null);
        }
    }

    /**
     * Добавляет новую подвкладку к активной вкладке
     */
    async addSubtab() {
        if (!this.activeTab) {
            alert('Сначала выберите вкладку');
            return;
        }

        const name = prompt('Название подвкладки:');
        if (!name || !name.trim()) return;

        try {
            const response = await fetch(`/api/v1/tabs/${this.activeTab.id}/subtabs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tab_id: this.activeTab.id,
                    name: name.trim(),
                    is_active: true
                })
            });

            if (response.ok) {
                const subtabData = await response.json();
                const subtab = new Subtab(subtabData, this.activeTab);
                this.activeTab.subtabs.push(subtab);
                this.showSubtabs(this.activeTab);
                
                // Выбираем новую подвкладку
                this.onSubtabSelected(subtab);
                subtab.select();
            }
        } catch (error) {
            console.error('Ошибка создания подвкладки:', error);
        }
    }
}


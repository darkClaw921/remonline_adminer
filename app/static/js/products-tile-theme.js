// Плиточная тема - навигация по категориям и вкладкам

// Состояние навигации в плиточной теме
const tileState = {
  currentView: 'categories', // 'categories', 'tabs', 'table'
  selectedCategory: null, // 'apple', 'android'
  selectedTab: null,
  selectedSubtab: null
};

// Инициализация плиточной темы
function initTileTheme() {
  console.log('Инициализация плиточной темы');
  
  // Сброс состояния
  tileState.currentView = 'categories';
  tileState.selectedCategory = null;
  tileState.selectedTab = null;
  tileState.selectedSubtab = null;
  
  // ПОЛНАЯ ОЧИСТКА: принудительно скрыть все элементы классической темы
  // даже если у них был удален класс theme-classic-only
  const tableCard = document.querySelector('.card');
  const tableContainer = document.getElementById('tableContainer');
  const tabsContainer = document.getElementById('tabsContainer');
  const pagination = document.querySelector('#pagination')?.parentElement;
  const pageInfo = document.querySelector('#pageInfo')?.parentElement;
  const columnsSettingsBtn = document.getElementById('columnsSettingsBtn')?.parentElement;
  const mainTabsDiv = document.querySelector('.main-tabs');
  
  // Скрыть все элементы таблицы и вернуть им классы
  if (tableCard) {
    tableCard.style.display = 'none';
    if (!tableCard.classList.contains('theme-classic-only')) {
      tableCard.classList.add('theme-classic-only');
    }
  }
  if (tableContainer) {
    tableContainer.style.display = 'none';
    if (!tableContainer.classList.contains('theme-classic-only')) {
      tableContainer.classList.add('theme-classic-only');
    }
  }
  if (tabsContainer) {
    tabsContainer.style.display = 'none';
    if (!tabsContainer.classList.contains('theme-classic-only')) {
      tabsContainer.classList.add('theme-classic-only');
    }
  }
  if (pagination) {
    pagination.style.display = 'none';
    if (!pagination.classList.contains('theme-classic-only')) {
      pagination.classList.add('theme-classic-only');
    }
  }
  if (pageInfo) {
    pageInfo.style.display = 'none';
    if (!pageInfo.classList.contains('theme-classic-only')) {
      pageInfo.classList.add('theme-classic-only');
    }
  }
  if (columnsSettingsBtn) {
    columnsSettingsBtn.style.display = 'none';
    if (!columnsSettingsBtn.classList.contains('theme-classic-only')) {
      columnsSettingsBtn.classList.add('theme-classic-only');
    }
  }
  if (mainTabsDiv) {
    mainTabsDiv.style.display = 'none';
    if (!mainTabsDiv.classList.contains('theme-classic-only')) {
      mainTabsDiv.classList.add('theme-classic-only');
    }
  }
  
  // Удалить все кнопки навигации плиточной темы
  document.getElementById('backToTabsBtn')?.remove();
  document.getElementById('backToSubtabsBtn')?.remove();
  document.getElementById('backToCategoriesBtn')?.remove();
  document.getElementById('manageProductsBtn')?.remove();
  document.getElementById('manageSubtabProductsBtn')?.remove();
  
  // Показать контейнер плиток
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer) {
    tilesContainer.style.display = '';
  }
  
  // Инициализируем настройку цен для работы в плиточной теме
  if (typeof initPriceAdjustment === 'function') {
    initPriceAdjustment();
  }
  
  // Показать категории
  showCategoryTiles();
}

// Экспортируем функцию для использования в theme-manager
window.initTileTheme = initTileTheme;

// Показать плитки категорий (Apple/Android)
function showCategoryTiles() {
  tileState.currentView = 'categories';
  
  const tilesContainer = document.getElementById('tilesContainer');
  if (!tilesContainer) return;
  
  tilesContainer.innerHTML = `
    <div class="tiles-section-header">
      <h2 class="tiles-section-title">Выберите категорию</h2>
      <p class="tiles-section-subtitle">Товары разделены по платформам</p>
    </div>
    <div class="category-tiles-wrapper">
      <div class="category-tile apple-tile" data-category="apple">
        <span class="category-tile-icon">🍎</span>
        <h3 class="category-tile-title">Apple</h3>
        <p class="category-tile-subtitle">iPhone, iPad, Mac и аксессуары</p>
      </div>
      <div class="category-tile android-tile" data-category="android">
        <span class="category-tile-icon">🤖</span>
        <h3 class="category-tile-title">Android</h3>
        <p class="category-tile-subtitle">Смартфоны и планшеты Android</p>
      </div>
    </div>
  `;
  
  // Добавить обработчики
  tilesContainer.querySelectorAll('.category-tile').forEach(tile => {
    tile.addEventListener('click', (e) => {
      const category = e.currentTarget.dataset.category;
      selectCategory(category);
    });
  });
}

// Выбор категории
async function selectCategory(category) {
  tileState.selectedCategory = category;
  tileState.currentView = 'tabs';
  
  // Загрузить вкладки для категории
  await showTabTiles(category);
}

// Показать плитки вкладок
async function showTabTiles(category) {
  const tilesContainer = document.getElementById('tilesContainer');
  if (!tilesContainer) return;
  
  // Показать загрузку
  tilesContainer.innerHTML = `
    <div class="tile-navigation">
      <button class="btn btn-outline-secondary tile-back-btn" id="backToCategoriesBtn">
        ← Назад к категориям
      </button>
    </div>
    <div class="tiles-section-header">
      <h2 class="tiles-section-title">Загрузка...</h2>
    </div>
  `;
  
  // Добавить обработчик кнопки "Назад"
  document.getElementById('backToCategoriesBtn')?.addEventListener('click', () => {
    showCategoryTiles();
  });
  
  try {
    // Загрузить вкладки из API
    const mainTabType = category === 'apple' ? 'apple' : category === 'android' ? 'android' : null;
    const url = `${API_BASE}/tabs/?active_only=true&limit=1000${mainTabType ? `&main_tab_type=${mainTabType}` : ''}`;
    
    console.log('Загрузка вкладок для категории:', category);
    console.log('URL запроса:', url);
    
    const response = await fetch(url);
    console.log('Статус ответа:', response.status, response.statusText);
    
    if (!response.ok) throw new Error('Ошибка загрузки вкладок');
    
    let tabs = await response.json(); // API возвращает массив напрямую
    
    // Проверяем, что получили массив
    if (!Array.isArray(tabs)) {
      console.error('Ответ API не является массивом:', tabs);
      tabs = [];
    }
    
    console.log('Получено вкладок:', tabs.length);
    if (tabs.length > 0) {
      console.log('Первая вкладка:', tabs[0]);
    }
    
    // Отрисовать плитки вкладок
    const categoryTitle = category === 'apple' ? '🍎 Apple' : category === 'android' ? '🤖 Android' : 'Все';
    
    tilesContainer.innerHTML = `
      <div class="tile-navigation">
        <button class="btn btn-outline-secondary tile-back-btn" id="backToCategoriesBtn">
          ← Назад к категориям
        </button>
      </div>
      <div class="tiles-section-header">
        <h2 class="tiles-section-title">${categoryTitle}</h2>
        <p class="tiles-section-subtitle">Выберите вкладку для просмотра товаров (найдено: ${tabs.length})</p>
      </div>
      <div class="tabs-tiles-wrapper" id="tabsTilesGrid"></div>
    `;
    
    // Обработчик кнопки "Назад"
    document.getElementById('backToCategoriesBtn')?.addEventListener('click', () => {
      showCategoryTiles();
    });
    
    const tabsGrid = document.getElementById('tabsTilesGrid');
    
    if (!tabs || tabs.length === 0) {
      tabsGrid.innerHTML = `
        <div class="tiles-empty-state">
          <div class="tiles-empty-state-icon">📂</div>
          <div class="tiles-empty-state-text">Нет вкладок в этой категории</div>
          <div class="text-muted mt-2" style="font-size: 0.9rem;">
            Попробуйте добавить вкладки через настройки (⚙️) и назначьте им категорию ${categoryTitle}
          </div>
        </div>
      `;
      return;
    }
    
    // Создать плитку для каждой вкладки
    tabs.forEach(tab => {
      const subtabsCount = tab.subtabs ? tab.subtabs.length : 0;
      
      const tile = document.createElement('div');
      tile.className = 'tab-tile';
      tile.dataset.tabId = tab.id;
      tile.innerHTML = `
        <div class="tab-tile-header">
          <h4 class="tab-tile-title">${escapeHtml(tab.name)}</h4>
          ${subtabsCount > 0 ? `<span class="tab-tile-badge">${subtabsCount} ${declension(subtabsCount, 'лист', 'листа', 'листов')}</span>` : ''}
        </div>
        ${subtabsCount > 0 ? `
          <div class="tab-tile-subtabs">
            <span class="tab-tile-subtabs-icon">📋</span>
            ${subtabsCount} ${declension(subtabsCount, 'подвкладка', 'подвкладки', 'подвкладок')}
          </div>
        ` : ''}
      `;
      
      tile.addEventListener('click', () => {
        selectTab(tab);
      });
      
      tabsGrid.appendChild(tile);
    });
    
  } catch (error) {
    console.error('Ошибка загрузки вкладок:', error);
    tilesContainer.innerHTML = `
      <div class="tile-navigation">
        <button class="btn btn-outline-secondary tile-back-btn" id="backToCategoriesBtn">
          ← Назад к категориям
        </button>
      </div>
      <div class="alert alert-danger">
        Ошибка загрузки вкладок. Попробуйте обновить страницу.
      </div>
    `;
    
    document.getElementById('backToCategoriesBtn')?.addEventListener('click', () => {
      showCategoryTiles();
    });
  }
}

// Выбор вкладки - показать подвкладки как плитки
async function selectTab(tab) {
  tileState.selectedTab = tab;
  tileState.currentView = 'subtabs';
  
  console.log('Показ подвкладок для вкладки:', tab.name);
  
  // Загружаем и показываем подвкладки
  await showSubtabTiles(tab);
}

// Показать плитки подвкладок
async function showSubtabTiles(tab) {
  const tilesContainer = document.getElementById('tilesContainer');
  if (!tilesContainer) return;
  
  console.log('Загрузка подвкладок для вкладки:', tab.id);
  
  try {
    const response = await fetch(`/api/v1/tabs/${tab.id}/subtabs`);
    const subtabs = await response.json();
    
    console.log('Получено подвкладок:', subtabs.length);
    
    if (subtabs.length === 0) {
      tilesContainer.innerHTML = `
        <div class="tiles-section-header">
          <button class="btn btn-outline-secondary btn-sm mb-3" onclick="backToTabs()">← Назад к вкладкам</button>
          <h2 class="tiles-section-title">${tab.name}</h2>
          <p class="tiles-section-subtitle">Нет подвкладок в этой вкладке</p>
        </div>
        <div class="alert alert-info">
          <p class="mb-0">В этой вкладке пока нет подвкладок (листов).</p>
        </div>
      `;
      return;
    }
    
    // Формируем HTML для подвкладок (будем загружать количество товаров асинхронно)
    tilesContainer.innerHTML = `
      <div class="tile-navigation">
        <button class="btn btn-outline-secondary tile-back-btn" id="backToTabsBtn">
          ← Назад к вкладкам
        </button>
      </div>
      <div class="tile-header">
        <h2 class="tiles-section-title">${tab.name}</h2>
        <p class="tiles-section-subtitle">Выберите подвкладку (лист) для просмотра товаров (найдено: ${subtabs.length})</p>
      </div>
      <div class="tabs-tiles-wrapper" id="subtabsTilesGrid"></div>
    `;
    
    // Добавляем обработчик кнопки "Назад"
    document.getElementById('backToTabsBtn')?.addEventListener('click', () => {
      backToTabs();
    });
    
    const subtabsGrid = document.getElementById('subtabsTilesGrid');
    
    // Создаем плитки для подвкладок с информацией о количестве товаров
    for (const subtab of subtabs) {
      // Создаем плитку
      const tile = document.createElement('div');
      tile.className = 'tab-tile';
      tile.dataset.subtabId = subtab.id;
      
      // Временное содержимое пока загружаем данные
      tile.innerHTML = `
        <div class="tab-tile-header">
          <h4 class="tab-tile-title">${escapeHtml(subtab.name)}</h4>
          <span class="tab-tile-badge">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Загрузка...</span>
            </div>
          </span>
        </div>
        <div class="tab-tile-subtabs">
          <span class="tab-tile-subtabs-icon">📦</span>
          Загрузка...
        </div>
      `;
      
      tile.addEventListener('click', () => {
        selectSubtab(tab, subtab);
      });
      
      subtabsGrid.appendChild(tile);
      
      // Загружаем количество товаров асинхронно
      fetch(`/api/v1/tabs/subtabs/${subtab.id}/products`)
        .then(response => response.json())
        .then(products => {
          const productsCount = products.length;
          tile.innerHTML = `
            <div class="tab-tile-header">
              <h4 class="tab-tile-title">${escapeHtml(subtab.name)}</h4>
              ${productsCount > 0 ? `<span class="tab-tile-badge">${productsCount} ${declension(productsCount, 'товар', 'товара', 'товаров')}</span>` : ''}
            </div>
            ${productsCount > 0 ? `
              <div class="tab-tile-subtabs">
                <span class="tab-tile-subtabs-icon">📦</span>
                ${productsCount} ${declension(productsCount, 'товар', 'товара', 'товаров')}
              </div>
            ` : `
              <div class="tab-tile-subtabs text-muted">
                <span class="tab-tile-subtabs-icon">📭</span>
                Нет товаров
              </div>
            `}
          `;
        })
        .catch(error => {
          console.error('Ошибка загрузки товаров подвкладки:', error);
          tile.innerHTML = `
            <div class="tab-tile-header">
              <h4 class="tab-tile-title">${escapeHtml(subtab.name)}</h4>
            </div>
            <div class="tab-tile-subtabs text-muted">
              <span class="tab-tile-subtabs-icon">📦</span>
              Нет данных
            </div>
          `;
        });
    }
    
  } catch (error) {
    console.error('Ошибка загрузки подвкладок:', error);
    tilesContainer.innerHTML = `
      <div class="tiles-section-header">
        <button class="btn btn-outline-secondary btn-sm mb-3" onclick="backToTabs()">← Назад к вкладкам</button>
        <h2 class="tiles-section-title">${tab.name}</h2>
      </div>
      <div class="alert alert-danger">
        Ошибка загрузки подвкладок: ${error.message}
      </div>
    `;
  }
}

// Выбор подвкладки - показать таблицу
function selectSubtab(tab, subtab) {
  tileState.selectedTab = tab;
  tileState.selectedSubtab = subtab;
  tileState.currentView = 'table';
  
  console.log('Переход к таблице для подвкладки:', subtab.name);
  
  // Скрыть плитки
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer) {
    tilesContainer.style.display = 'none';
  }
  
  // Показать таблицу и фильтры - нужно убрать класс theme-classic-only
  const tableCard = document.querySelector('.card');
  const tableContainer = document.getElementById('tableContainer');
  const tabsContainer = document.getElementById('tabsContainer');
  const pagination = document.querySelector('#pagination')?.parentElement;
  const pageInfo = document.querySelector('#pageInfo')?.parentElement;
  const columnsSettingsBtn = document.getElementById('columnsSettingsBtn')?.parentElement;
  const mainTabsDiv = document.querySelector('.main-tabs');
  
  // Убираем класс theme-classic-only, чтобы элементы стали видимыми
  if (tableCard) {
    tableCard.classList.remove('theme-classic-only');
    tableCard.style.display = '';
  }
  if (tableContainer) {
    tableContainer.classList.remove('theme-classic-only');
    tableContainer.style.display = '';
  }
  // В плиточной теме НЕ показываем систему вкладок - она заменена на кнопку "Работа с товарами"
  if (tabsContainer) {
    tabsContainer.style.display = 'none';
  }
  if (pagination) {
    pagination.classList.remove('theme-classic-only');
    pagination.style.display = '';
  }
  if (pageInfo) {
    pageInfo.classList.remove('theme-classic-only');
    pageInfo.style.display = '';
  }
  if (columnsSettingsBtn) {
    columnsSettingsBtn.classList.remove('theme-classic-only');
    columnsSettingsBtn.style.display = '';
  }
  // Скрываем главные категории (Apple, Android, Все) в плиточной теме
  if (mainTabsDiv) {
    mainTabsDiv.style.setProperty('display', 'none', 'important');
  }
  
  // Добавить кнопку "Назад к подвкладкам" в карточку фильтров
  addBackToSubtabsButton();
  
  // Добавить кнопку "Работа с товарами" для конкретной подвкладки
  addManageSubtabProductsButton(subtab);
  
  // Загрузить товары для выбранной подвкладки
  loadProductsForSubtab(subtab);
  
  console.log('Таблица готова к использованию в плиточной теме');
}

// Добавить кнопку "Назад к подвкладкам"
function addBackToSubtabsButton() {
  const cardBody = document.querySelector('.card .card-body');
  if (!cardBody) return;
  
  // Проверить, нет ли уже кнопки
  if (document.getElementById('backToSubtabsBtn')) return;
  
  const backBtn = document.createElement('button');
  backBtn.id = 'backToSubtabsBtn';
  backBtn.className = 'btn btn-sm btn-outline-secondary mb-2';
  backBtn.innerHTML = '← Назад к подвкладкам';
  backBtn.addEventListener('click', () => {
    backToSubtabs();
  });
  
  cardBody.insertBefore(backBtn, cardBody.firstChild);
}

// Вернуться к подвкладкам
function backToSubtabs() {
  console.log('Возврат к плиткам подвкладок');
  
  // Скрыть таблицу и вернуть классы
  const tableCard = document.querySelector('.card');
  const tableContainer = document.getElementById('tableContainer');
  const tabsContainer = document.getElementById('tabsContainer');
  const pagination = document.querySelector('#pagination')?.parentElement;
  const pageInfo = document.querySelector('#pageInfo')?.parentElement;
  const columnsSettingsBtn = document.getElementById('columnsSettingsBtn')?.parentElement;
  const mainTabsDiv = document.querySelector('.main-tabs');
  
  if (tableCard) {
    tableCard.style.display = 'none';
    tableCard.classList.add('theme-classic-only');
  }
  if (tableContainer) {
    tableContainer.style.display = 'none';
    tableContainer.classList.add('theme-classic-only');
  }
  if (tabsContainer) {
    tabsContainer.style.display = 'none';
    tabsContainer.classList.add('theme-classic-only');
  }
  if (pagination) {
    pagination.style.display = 'none';
    pagination.classList.add('theme-classic-only');
  }
  if (pageInfo) {
    pageInfo.style.display = 'none';
    pageInfo.classList.add('theme-classic-only');
  }
  if (columnsSettingsBtn) {
    columnsSettingsBtn.style.display = 'none';
    columnsSettingsBtn.classList.add('theme-classic-only');
  }
  // Вернуть видимость главных категорий
  if (mainTabsDiv) {
    mainTabsDiv.style.removeProperty('display');
  }
  
  // Удалить кнопку "Назад" и кнопку "Работа с товарами"
  document.getElementById('backToSubtabsBtn')?.remove();
  document.getElementById('manageSubtabProductsBtn')?.remove();
  
  // Показать плитки подвкладок
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer) {
    tilesContainer.style.display = '';
  }
  
  // Перезагрузить подвкладки
  if (tileState.selectedTab) {
    showSubtabTiles(tileState.selectedTab);
  }
}

// Добавить кнопку "Работа с товарами" для подвкладки
function addManageSubtabProductsButton(subtab) {
  const cardBody = document.querySelector('.card .card-body');
  if (!cardBody) return;
  
  // Проверить, существует ли уже кнопка
  if (document.getElementById('manageSubtabProductsBtn')) return;
  
  // Найти кнопку "Назад к подвкладкам"
  const backBtn = document.getElementById('backToSubtabsBtn');
  if (!backBtn) return;
  
  // Создать кнопку "Работа с товарами"
  const manageBtn = document.createElement('button');
  manageBtn.id = 'manageSubtabProductsBtn';
  manageBtn.className = 'btn btn-primary btn-sm ms-2 mb-2';
  manageBtn.innerHTML = '📦 Работа с товарами';
  manageBtn.addEventListener('click', () => openSubtabProductsManagement(subtab));
  
  // Вставить кнопку рядом с кнопкой "Назад"
  backBtn.parentElement.insertBefore(manageBtn, backBtn.nextSibling);
}

// Открыть управление товарами конкретной подвкладки
function openSubtabProductsManagement(subtab) {
  console.log('Открытие управления товарами подвкладки:', subtab);
  
  // Создаем временный объект Subtab для использования его методов
  const dummySubtab = new Subtab({
    id: subtab.id,
    name: subtab.name,
    order_index: subtab.order_index,
    is_active: true
  }, null);
  
  dummySubtab.openProductsManager();
}

// Открыть модальное окно управления товарами
async function openProductManagement(tab) {
  console.log('Открытие управления товарами для вкладки:', tab);
  
  // Создаем модальное окно
  const modal = createSubtabsModal(tab);
  document.body.appendChild(modal);
  
  // Показываем модальное окно
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
  
  // Удаляем модальное окно после закрытия
  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });
  
  // Загружаем подвкладки
  await loadSubtabsForModal(modal, tab);
}

// Создать модальное окно для управления подвкладками
function createSubtabsModal(tab) {
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.tabIndex = -1;
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Управление товарами: ${tab.name}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <button type="button" class="btn btn-primary" id="addNewSubtab">
              + Добавить подвкладку (лист)
            </button>
          </div>
          <div id="subtabsList">
            <div class="text-center">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Загрузка...</span>
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

// Загрузить подвкладки для модального окна
async function loadSubtabsForModal(modal, tab) {
  const container = modal.querySelector('#subtabsList');
  const addButton = modal.querySelector('#addNewSubtab');
  
  try {
    // Загружаем подвкладки вкладки
    const response = await fetch(`/api/v1/tabs/${tab.id}/subtabs`);
    const subtabs = await response.json();
    
    if (subtabs.length === 0) {
      container.innerHTML = '<div class="alert alert-info">Нет подвкладок. Создайте первую подвкладку.</div>';
    } else {
      renderSubtabsList(container, subtabs, tab);
    }
    
    // Обработчик добавления новой подвкладки
    addButton.addEventListener('click', async () => {
      const name = prompt('Название подвкладки (листа):');
      if (!name || !name.trim()) return;
      
      try {
        const createResponse = await fetch(`/api/v1/tabs/${tab.id}/subtabs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tab_id: tab.id,
            name: name.trim(),
            is_active: true
          })
        });
        
        if (createResponse.ok) {
          // Перезагружаем список подвкладок
          await loadSubtabsForModal(modal, tab);
        } else {
          alert('Ошибка создания подвкладки');
        }
      } catch (error) {
        console.error('Ошибка создания подвкладки:', error);
        alert('Ошибка создания подвкладки');
      }
    });
    
  } catch (error) {
    console.error('Ошибка загрузки подвкладок:', error);
    container.innerHTML = '<div class="alert alert-danger">Ошибка загрузки подвкладок</div>';
  }
}

// Отрисовать список подвкладок
function renderSubtabsList(container, subtabs, tab) {
  const html = subtabs.map(subtab => `
    <div class="card mb-2" data-subtab-id="${subtab.id}">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col">
            <h6 class="mb-1">${subtab.name}</h6>
            <small class="text-muted">ID: ${subtab.id} | Порядок: ${subtab.order_index}</small>
          </div>
          <div class="col-auto">
            <button type="button" class="btn btn-sm btn-primary" 
                    onclick="openSubtabProducts(${tab.id}, ${subtab.id}, '${subtab.name.replace(/'/g, "\\'")}')">
              📦 Управление товарами
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" 
                    onclick="renameSubtab(${tab.id}, ${subtab.id})">
              ✏️
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" 
                    onclick="deleteSubtab(${tab.id}, ${subtab.id})">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Открыть управление товарами подвкладки
window.openSubtabProducts = function(tabId, subtabId, subtabName) {
  console.log('Открытие управления товарами подвкладки:', subtabId);
  
  // Создаем временный объект Subtab для использования его методов
  const subtab = {
    id: subtabId,
    name: subtabName,
    openProductsManager: function() {
      // Импортируем метод из tab.js через создание элемента
      const dummySubtab = new Subtab({
        id: subtabId,
        name: subtabName,
        order_index: 0,
        is_active: true
      }, null);
      
      dummySubtab.openProductsManager();
    }
  };
  
  subtab.openProductsManager();
};

// Переименовать подвкладку
window.renameSubtab = async function(tabId, subtabId) {
  const newName = prompt('Новое название подвкладки:');
  if (!newName || !newName.trim()) return;
  
  try {
    const response = await fetch(`/api/v1/tabs/subtabs/${subtabId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newName.trim()
      })
    });
    
    if (response.ok) {
      // Обновляем отображение
      const card = document.querySelector(`[data-subtab-id="${subtabId}"]`);
      if (card) {
        const h6 = card.querySelector('h6');
        if (h6) h6.textContent = newName.trim();
      }
    } else {
      alert('Ошибка переименования подвкладки');
    }
  } catch (error) {
    console.error('Ошибка переименования:', error);
    alert('Ошибка переименования подвкладки');
  }
};

// Удалить подвкладку
window.deleteSubtab = async function(tabId, subtabId) {
  if (!confirm('Удалить подвкладку? Все товары будут удалены из неё.')) return;
  
  try {
    const response = await fetch(`/api/v1/tabs/subtabs/${subtabId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Удаляем карточку из DOM
      const card = document.querySelector(`[data-subtab-id="${subtabId}"]`);
      if (card) card.remove();
      
      // Проверяем, остались ли подвкладки
      const container = document.getElementById('subtabsList');
      if (container && container.children.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Нет подвкладок. Создайте первую подвкладку.</div>';
      }
    } else {
      alert('Ошибка удаления подвкладки');
    }
  } catch (error) {
    console.error('Ошибка удаления:', error);
    alert('Ошибка удаления подвкладки');
  }
};

// Загрузить товары для выбранной подвкладки
async function loadProductsForSubtab(subtab) {
  console.log('Загрузка товаров для подвкладки:', subtab);
  
  try {
    // Сначала загружаем товары подвкладки из API
    console.log(`Загружаем товары подвкладки ${subtab.id} из API...`);
    const response = await fetch(`/api/v1/tabs/subtabs/${subtab.id}/products`);
    
    if (!response.ok) {
      throw new Error('Ошибка загрузки товаров подвкладки');
    }
    
    const products = await response.json();
    console.log(`Загружено товаров подвкладки:`, products.length);
    
    // Создаем объект подвкладки с загруженными товарами
    const tempSubtab = new Subtab({
      id: subtab.id,
      name: subtab.name,
      order_index: subtab.order_index,
      is_active: true,
      products: products // Передаем загруженные товары
    }, null);
    
    // Устанавливаем как активную подвкладку
    window.activeSubtab = tempSubtab;
    
    console.log('Активная подвкладка установлена, товары:', tempSubtab.getProductIds());
    
    // Вызываем функцию loadPage из products.js для загрузки товаров подвкладки
    if (typeof loadPage === 'function') {
      await loadPage(false);
    } else {
      console.warn('Функция loadPage не найдена');
    }
  } catch (error) {
    console.error('Ошибка загрузки товаров подвкладки:', error);
    alert('Не удалось загрузить товары подвкладки');
  }
}

// Вернуться к плиткам вкладок
function backToTabs() {
  console.log('Возврат к плиткам вкладок');
  
  // Скрыть таблицу и вернуть классы
  const tableCard = document.querySelector('.card');
  const tableContainer = document.getElementById('tableContainer');
  const tabsContainer = document.getElementById('tabsContainer');
  const pagination = document.querySelector('#pagination')?.parentElement;
  const pageInfo = document.querySelector('#pageInfo')?.parentElement;
  const columnsSettingsBtn = document.getElementById('columnsSettingsBtn')?.parentElement;
  const mainTabsDiv = document.querySelector('.main-tabs');
  
  if (tableCard) {
    tableCard.style.display = 'none';
    tableCard.classList.add('theme-classic-only');
  }
  if (tableContainer) {
    tableContainer.style.display = 'none';
    tableContainer.classList.add('theme-classic-only');
  }
  if (tabsContainer) {
    tabsContainer.style.display = 'none';
    tabsContainer.classList.add('theme-classic-only');
  }
  if (pagination) {
    pagination.style.display = 'none';
    pagination.classList.add('theme-classic-only');
  }
  if (pageInfo) {
    pageInfo.style.display = 'none';
    pageInfo.classList.add('theme-classic-only');
  }
  if (columnsSettingsBtn) {
    columnsSettingsBtn.style.display = 'none';
    columnsSettingsBtn.classList.add('theme-classic-only');
  }
  // Вернуть видимость главных категорий
  if (mainTabsDiv) {
    mainTabsDiv.style.removeProperty('display');
  }
  
  // Удалить все кнопки "Назад" и "Работа с товарами"
  document.getElementById('backToTabsBtn')?.remove();
  document.getElementById('backToSubtabsBtn')?.remove();
  document.getElementById('manageProductsBtn')?.remove();
  document.getElementById('manageSubtabProductsBtn')?.remove();
  
  // Показать плитки вкладок
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer) {
    tilesContainer.style.display = '';
  }
  
  showTabTiles(tileState.selectedCategory);
}

// Вспомогательные функции
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function declension(number, one, two, five) {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) {
    return five;
  }
  n %= 10;
  if (n === 1) {
    return one;
  }
  if (n >= 2 && n <= 4) {
    return two;
  }
  return five;
}


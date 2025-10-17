const API_BASE = '/api/v1';
// Склады из API (будут загружены при инициализации)
let TARGET_WAREHOUSES = [];

// Настройки отображения колонок (localStorage)
const STORAGE_KEY_COLUMNS = 'columnsVisibility.v1';
const DEFAULT_COLUMN_VISIBILITY = {
  photos: true,
  name: true,
  category: true,
  price_base: true,
  price_48388: true,
  price_97150: true,
  price_377836: true,
  price_555169: true,
  total: true,
  warehouses: {}
};

function loadColumnVisibility() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLUMNS);
    if (!raw) return structuredClone(DEFAULT_COLUMN_VISIBILITY);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_COLUMN_VISIBILITY), ...parsed, warehouses: { ...DEFAULT_COLUMN_VISIBILITY.warehouses, ...(parsed.warehouses || {}) } };
  } catch {
    return structuredClone(DEFAULT_COLUMN_VISIBILITY);
  }
}

function saveColumnVisibility(v) {
  try { localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(v)); } catch {}
}

let columnVisibility = loadColumnVisibility();

// Настройки порядка столбцов (localStorage)
const STORAGE_KEY_COLUMN_ORDER = 'columnOrder.v1';
const DEFAULT_COLUMN_ORDER = [
  'photos', 'name', 'category', 'price-base', 
  'price-48388', 'price-97150', 'price-377836', 'price-555169', 
  'total', 'wh-2272079', 'wh-52226', 'wh-37746'
];

function loadColumnOrder() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLUMN_ORDER);
    if (!raw) return [...DEFAULT_COLUMN_ORDER];
    return JSON.parse(raw);
  } catch {
    return [...DEFAULT_COLUMN_ORDER];
  }
}

function saveColumnOrder(order) {
  try { localStorage.setItem(STORAGE_KEY_COLUMN_ORDER, JSON.stringify(order)); } catch {}
}

let columnOrder = loadColumnOrder();

function ensureWarehouseVisibilityKeys() {
  for (const w of TARGET_WAREHOUSES) {
    if (!(w.remonline_id in columnVisibility.warehouses)) {
      columnVisibility.warehouses[w.remonline_id] = true;
    }
  }
}

function applyColumnVisibility() {
  // Статические колонки: шапка
  toggleColumnDisplay(document.querySelectorAll('thead th.photos-col'), columnVisibility.photos);
  toggleColumnDisplay(document.querySelectorAll('thead th.name-col'), columnVisibility.name);
  toggleColumnDisplay(document.querySelectorAll('thead th.category-col'), columnVisibility.category);
  toggleColumnDisplay(document.querySelectorAll('thead th.price-base-col'), columnVisibility.price_base);
  toggleColumnDisplay(document.querySelectorAll('thead th.price-col[data-price="48388"]'), columnVisibility.price_48388);
  toggleColumnDisplay(document.querySelectorAll('thead th.price-col[data-price="97150"]'), columnVisibility.price_97150);
  toggleColumnDisplay(document.querySelectorAll('thead th.price-col[data-price="377836"]'), columnVisibility.price_377836);
  toggleColumnDisplay(document.querySelectorAll('thead th.price-col[data-price="555169"]'), columnVisibility.price_555169);
  toggleColumnDisplay(document.querySelectorAll('thead th.total-col'), columnVisibility.total);

  // Статические колонки: строки
  toggleColumnDisplay(document.querySelectorAll('tbody td.photos-col'), columnVisibility.photos);
  toggleColumnDisplay(document.querySelectorAll('tbody td.name-col'), columnVisibility.name);
  toggleColumnDisplay(document.querySelectorAll('tbody td.category-col'), columnVisibility.category);
  toggleColumnDisplay(document.querySelectorAll('tbody td.price-base-col'), columnVisibility.price_base);
  toggleColumnDisplay(document.querySelectorAll('tbody td.price-col[data-price="48388"]'), columnVisibility.price_48388);
  toggleColumnDisplay(document.querySelectorAll('tbody td.price-col[data-price="97150"]'), columnVisibility.price_97150);
  toggleColumnDisplay(document.querySelectorAll('tbody td.price-col[data-price="377836"]'), columnVisibility.price_377836);
  toggleColumnDisplay(document.querySelectorAll('tbody td.price-col[data-price="555169"]'), columnVisibility.price_555169);
  toggleColumnDisplay(document.querySelectorAll('tbody td.total-col'), columnVisibility.total);

  // Склады: шапка и строки
  for (const w of TARGET_WAREHOUSES) {
    const visible = !!columnVisibility.warehouses[w.remonline_id];
    toggleColumnDisplay(document.querySelectorAll(`thead th.warehouse-col[data-wh="${w.remonline_id}"]`), visible);
    toggleColumnDisplay(document.querySelectorAll(`tbody td.warehouse-col[data-wh="${w.remonline_id}"]`), visible);
  }
}

function toggleColumnDisplay(nodeList, isVisible) {
  nodeList.forEach(el => {
    if (isVisible) el.classList.remove('d-none');
    else el.classList.add('d-none');
  });
}

// Функции для управления порядком столбцов
function applyColumnOrder() {
  const headerRow = document.querySelector('thead tr');
  const headers = Array.from(headerRow.querySelectorAll('th'));
  
  // Создаем карту заголовков по data-col
  const headerMap = new Map();
  headers.forEach(header => {
    const colId = header.getAttribute('data-col');
    if (colId) headerMap.set(colId, header);
  });
  
  // Переставляем заголовки согласно сохраненному порядку
  columnOrder.forEach(colId => {
    const header = headerMap.get(colId);
    if (header) {
      headerRow.appendChild(header);
    }
  });
  
  // Переставляем ячейки в каждой строке тела таблицы
  const bodyRows = document.querySelectorAll('tbody tr');
  bodyRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    const cellMap = new Map();
    
    cells.forEach(cell => {
      const colId = cell.getAttribute('data-col');
      if (colId) cellMap.set(colId, cell);
    });
    
    columnOrder.forEach(colId => {
      const cell = cellMap.get(colId);
      if (cell) {
        row.appendChild(cell);
      }
    });
  });
}

// Drag and Drop функции
let draggedElement = null;
let draggedIndex = -1;

function initDragAndDrop() {
  const headers = document.querySelectorAll('thead th[draggable="true"]');
  
  headers.forEach((header, index) => {
    header.addEventListener('dragstart', handleDragStart);
    header.addEventListener('dragend', handleDragEnd);
    header.addEventListener('dragover', handleDragOver);
    header.addEventListener('dragenter', handleDragEnter);
    header.addEventListener('dragleave', handleDragLeave);
    header.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  draggedElement = this;
  draggedIndex = Array.from(this.parentNode.children).indexOf(this);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  
  // Очищаем все drag-over классы
  document.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('drag-over', 'drag-over-right');
  });
  
  draggedElement = null;
  draggedIndex = -1;
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  if (this === draggedElement) return;
  
  const rect = this.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const isRightHalf = x > rect.width / 2;
  
  // Очищаем все drag-over классы
  document.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('drag-over', 'drag-over-right');
  });
  
  // Добавляем соответствующий класс
  if (isRightHalf) {
    this.classList.add('drag-over-right');
  } else {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  // Проверяем, что мы действительно покинули элемент
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-over', 'drag-over-right');
  }
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRightHalf = x > rect.width / 2;
    const targetIndex = Array.from(this.parentNode.children).indexOf(this);
    
    // Перемещаем элемент в DOM
    if (isRightHalf) {
      this.parentNode.insertBefore(draggedElement, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedElement, this);
    }
    
    // Обновляем порядок столбцов
    updateColumnOrder();
    
    // Применяем новый порядок к строкам данных
    reorderTableCells();
  }
  
  this.classList.remove('drag-over', 'drag-over-right');
  return false;
}

function updateColumnOrder() {
  const headers = document.querySelectorAll('thead th[data-col]');
  columnOrder = Array.from(headers).map(header => header.getAttribute('data-col'));
  saveColumnOrder(columnOrder);
}

function reorderTableCells() {
  const bodyRows = document.querySelectorAll('tbody tr');
  bodyRows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    const cellMap = new Map();
    
    cells.forEach(cell => {
      const colId = cell.getAttribute('data-col');
      if (colId) cellMap.set(colId, cell);
    });
    
    columnOrder.forEach(colId => {
      const cell = cellMap.get(colId);
      if (cell) {
        row.appendChild(cell);
      }
    });
  });
}

function buildColumnsSettingsModal() {
  const staticList = document.getElementById('columnsStaticList');
  const whList = document.getElementById('columnsWarehousesList');
  if (!staticList || !whList) return;
  staticList.innerHTML = '';
  whList.innerHTML = '';

  const staticItems = [
    { key: 'photos', title: 'Фото' },
    { key: 'name', title: 'Товар' },
    { key: 'category', title: 'Категория' },
    { key: 'price_base', title: 'Цена' },
    { key: 'price_48388', title: 'Розничная (48388)' },
    { key: 'price_97150', title: 'Партнёр (97150)' },
    { key: 'price_377836', title: 'Продажа зч (377836)' },
    { key: 'price_555169', title: 'Продажа зч VIP (555169)' },
    { key: 'total', title: 'Общий остаток' },
  ];

  for (const it of staticItems) {
    const id = `col-static-${it.key}`;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `<input class="form-check-input" type="checkbox" id="${id}">`+
      `<label class="form-check-label" for="${id}">${it.title}</label>`;
    const input = div.querySelector('input');
    input.checked = !!columnVisibility[it.key];
    input.addEventListener('change', () => {
      columnVisibility[it.key] = !!input.checked;
      saveColumnVisibility(columnVisibility);
      applyColumnVisibility();
    });
    staticList.appendChild(div);
  }

  // Склады (динамически)
  ensureWarehouseVisibilityKeys();
  for (const w of TARGET_WAREHOUSES) {
    const id = `col-wh-${w.remonline_id}`;
    const div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = `<input class="form-check-input" type="checkbox" id="${id}">`+
      `<label class="form-check-label" for="${id}">${w.title} (${w.remonline_id})</label>`;
    const input = div.querySelector('input');
    input.checked = !!columnVisibility.warehouses[w.remonline_id];
    input.addEventListener('change', () => {
      columnVisibility.warehouses[w.remonline_id] = !!input.checked;
      saveColumnVisibility(columnVisibility);
      applyColumnVisibility();
    });
    whList.appendChild(div);
  }
}

async function loadWarehouses() {
  try {
    const resp = await fetch(`${API_BASE}/warehouses/?active_only=true&limit=1000`);
    if (!resp.ok) throw new Error('warehouses fetch failed');
    const data = await resp.json();
    const warehouses = (data?.data || []).filter(w => w?.remonline_id && w?.name);
    TARGET_WAREHOUSES = warehouses.map(w => ({
      remonline_id: w.remonline_id,
      title: w.name,
    }));
    
    // Обновляем UI элементы (индикатор списка складов мог быть удалён из макета)
    const whListEl = document.getElementById('wh-list');
    if (whListEl) whListEl.textContent = TARGET_WAREHOUSES.map(w => `${w.title} (${w.remonline_id})`).join(', ');
    updateWarehouseFilterOptions();
    // после загрузки складов отметим сортируемые заголовки
    markSortableHeaders();
  } catch (e) {
    console.error('Failed to load warehouses:', e);
    // Fallback к хардкоду при ошибке
    TARGET_WAREHOUSES = [
      { remonline_id: 2272079, title: '29. Склад Китай' },
      { remonline_id: 52226,  title: '05. Виртуальный склад' },
      { remonline_id: 37746,  title: '01. Запчасти Ростов' },
    ];
    const whListEl = document.getElementById('wh-list');
    if (whListEl) whListEl.textContent = TARGET_WAREHOUSES.map(w => `${w.title} (${w.remonline_id})`).join(', ');
    ensureWarehouseVisibilityKeys();
    buildColumnsSettingsModal();
    markSortableHeaders();
  }
}

function updateWarehouseFilterOptions() {
  if (!warehouseFilterEl) return;
  const selected = new Set(Array.from(warehouseFilterEl.selectedOptions).map(o => Number(o.value)));
  warehouseFilterEl.innerHTML = '';
  
  // Добавляем placeholder опцию
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = 'Выберите склады';
  placeholderOpt.disabled = true;
  placeholderOpt.hidden = true;
  warehouseFilterEl.appendChild(placeholderOpt);
  
  for (const w of TARGET_WAREHOUSES) {
    const opt = document.createElement('option');
    opt.value = String(w.remonline_id);
    opt.textContent = w.title;
    if (selected.has(w.remonline_id)) opt.selected = true;
    warehouseFilterEl.appendChild(opt);
  }
}

function updateSortOptions() {
  if (!sortByEl) return;
  const currentValue = sortByEl.value;
  
  // Удаляем старые опции складов
  const warehouseOptions = Array.from(sortByEl.options).filter(opt => opt.value.startsWith('wh_'));
  warehouseOptions.forEach(opt => opt.remove());
  
  // Добавляем новые опции складов
  for (const w of TARGET_WAREHOUSES) {
    const opt = document.createElement('option');
    opt.value = `wh_${w.remonline_id}`;
    opt.textContent = w.title;
    sortByEl.appendChild(opt);
  }
  
  // Восстанавливаем выбранное значение если оно еще существует
  if (Array.from(sortByEl.options).some(opt => opt.value === currentValue)) {
    sortByEl.value = currentValue;
  }
}

let state = {
  page: 1,
  size: 50,
  totalLoaded: 0,
  totalPages: 1,
  currentProducts: [],
  filters: {
    categories: [],
    warehouses: [],
    priceMin: null,
    priceMax: null,
    stockMin: null,
    stockMax: null,
    sortBy: 'name',
    sortOrder: 'desc',
  },
  userSortActive: false, // Флаг активности пользовательской сортировки
  allProducts: [],
  isLoading: false,
  hasMore: true,
};

const loader = document.getElementById('loader');
const bodyEl = document.getElementById('productsBody');
const pageInfo = document.getElementById('pageInfo');
const autoSyncBtn = document.getElementById('autoSyncBtn');
const autoSyncProgress = document.getElementById('autoSyncProgress');
const statusEl = document.createElement('small');
statusEl.className = 'text-muted ms-2';
autoSyncBtn?.parentElement?.appendChild(statusEl);
const categoryFilterEl = document.getElementById('categoryFilter');
const warehouseFilterEl = document.getElementById('warehouseFilter');
const priceMinEl = document.getElementById('priceMin');
const priceMaxEl = document.getElementById('priceMax');
const stockMinEl = document.getElementById('stockMin');
const stockMaxEl = document.getElementById('stockMax');
const sortByEl = document.getElementById('sortBy');
const sortOrderEl = document.getElementById('sortOrder');
const applyBtn = document.getElementById('applyFilters');
const resetBtn = document.getElementById('resetFilters');
const tableContainer = document.getElementById('tableContainer');

document.getElementById('pageSize').addEventListener('change', (e) => {
  state.size = parseInt(e.target.value, 10);
  state.page = 1;
  loadPage();
});

document.getElementById('reloadBtn').addEventListener('click', () => {
  loadPage();
});

// Автосинхронизация всех складов
let autoSyncPollTimer = null;
let autoSyncStatusTimer = null;
autoSyncBtn?.addEventListener('click', async () => {
  try {
    autoSyncBtn.disabled = true;
    await fetch(`${API_BASE}/stocks/sync_all`, { method: 'POST' });
    startAutoSyncPolling();
  } catch (e) {
    console.error(e);
    alert('Не удалось запустить синхронизацию');
    autoSyncBtn.disabled = false;
  }
});

function formatStatusText(st) {
  const status = st?.status || 'idle';
  const total = Number(st?.total || 0);
  const processed = Number(st?.processed || 0);
  if (status === 'running') return `Синхронизация: ${processed}/${total}`;
  if (status === 'finished') return 'Синхронизация завершена';
  if (status === 'failed') return 'Синхронизация упала';
  return 'Синхронизация: не запущена';
}

async function pollSyncProgressOnce() {
  try {
    const resp = await fetch(`${API_BASE}/stocks/sync_progress`);
    if (!resp.ok) throw new Error('progress http');
    const json = await resp.json();
    const st = json?.data || {};
    const processed = Number(st.processed || 0);
    const total = Number(st.total || 0) || 1;
    const pct = Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
    if (autoSyncProgress) {
      autoSyncProgress.style.width = pct + '%';
      autoSyncProgress.setAttribute('aria-valuenow', String(pct));
    }
    if (statusEl) statusEl.textContent = formatStatusText(st);
    const running = st.status === 'running';
    if (autoSyncBtn) autoSyncBtn.disabled = !!running;
    // если синхронизация уже шла до перезагрузки, включим частый поллинг
    if (running && !autoSyncPollTimer) {
      startAutoSyncPolling();
    }
    return st;
  } catch (e) {
    // quiet
    return null;
  }
}

function startAutoSyncPolling() {
  clearInterval(autoSyncPollTimer);
  autoSyncPollTimer = setInterval(async () => {
    const st = await pollSyncProgressOnce();
    if (!st) return;
    if (st.status === 'finished' || st.status === 'failed') {
      clearInterval(autoSyncPollTimer);
      autoSyncBtn && (autoSyncBtn.disabled = false);
      state.page = 1; await loadPage();
    }
  }, 1000);
}

function startPermanentStatusPolling() {
  clearInterval(autoSyncStatusTimer);
  autoSyncStatusTimer = setInterval(pollSyncProgressOnce, 5000);
}

startPermanentStatusPolling();
// Первичная инициализация статуса сразу после загрузки страницы
pollSyncProgressOnce();

// Инициализация модального окна при открытии
const columnsModalEl = document.getElementById('columnsModal');
if (columnsModalEl) {
  columnsModalEl.addEventListener('show.bs.modal', () => {
    // Перестраиваем, чтобы учесть динамические склады
    buildColumnsSettingsModal();
  });
}

// Обработчики prevBtn/nextBtn удалены - используется числовая пагинация

document.getElementById('searchInput').addEventListener('input', debounce(() => {
  state.page = 1;
  loadPage();
}, 400));

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Применение/сброс фильтров
applyBtn?.addEventListener('click', () => {
  readFiltersFromUI();
  state.page = 1;
  
  // Если активна подвкладка, используем клиентскую фильтрацию
  if (window.activeSubtab) {
    applyAndRender();
  } else {
    loadPage(true); // Используем серверные фильтры только если нет активной подвкладки
  }
});

resetBtn?.addEventListener('click', () => {
  // Сброс UI
  if (categoryFilterEl) Array.from(categoryFilterEl.options).forEach(o => o.selected = false);
  if (warehouseFilterEl) Array.from(warehouseFilterEl.options).forEach(o => o.selected = false);
  if (priceMinEl) priceMinEl.value = '';
  if (priceMaxEl) priceMaxEl.value = '';
  if (stockMinEl) stockMinEl.value = '';
  if (stockMaxEl) stockMaxEl.value = '';
  // Сброс состояния
  state.filters = { categories: [], warehouses: [], priceMin: null, priceMax: null, stockMin: null, stockMax: null, sortBy: 'name', sortOrder: 'desc' };
  state.userSortActive = false; // Сбрасываем пользовательскую сортировку
  state.page = 1;
  
  // Если активна подвкладка, используем клиентскую фильтрацию
  if (window.activeSubtab) {
    applyAndRender();
  } else {
    loadPage(false); // Загружаем без фильтров только если нет активной подвкладки
  }
});

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function updateTableHeaders(warehousesToShow) {
  const tableHeader = document.querySelector('thead tr');
  if (!tableHeader) return;
  
  // Удаляем старые заголовки складов
  const warehouseHeaders = tableHeader.querySelectorAll('.warehouse-col');
  warehouseHeaders.forEach(header => header.remove());
  
  // Добавляем новые заголовки складов
  for (const w of warehousesToShow) {
    const th = document.createElement('th');
    th.className = 'warehouse-col';
    th.setAttribute('data-wh', w.remonline_id);
    th.setAttribute('data-col', `wh-${w.remonline_id}`);
    th.setAttribute('draggable', 'true');
    th.textContent = w.title;
    tableHeader.appendChild(th);
  }
  // Применяем настройки видимости после перестройки шапки
  applyColumnVisibility();
  // Применяем порядок столбцов
  applyColumnOrder();
  // помечаем сортируемые заголовки
  markSortableHeaders();
  // Переинициализируем drag and drop
  initDragAndDrop();
}

// renderSummary удалён - элемент summary больше не используется

function renderTable(productsWithStocks) {
  bodyEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  
  // Определяем какие склады показывать: выбранные в фильтре или все
  const warehousesToShow = state.filters.warehouses.length > 0 
    ? TARGET_WAREHOUSES.filter(w => state.filters.warehouses.includes(w.remonline_id))
    : TARGET_WAREHOUSES;
  
  // Обновляем заголовки таблицы
  updateTableHeaders(warehousesToShow);
  
  for (const p of productsWithStocks) {
    const tr = document.createElement('tr');
    // Добавляем класс для отсутствующих товаров
    if (p.is_missing) {
      tr.classList.add('table-warning');
    }
    tr.innerHTML = `
      <td class="photos-col" data-col="photos">
        <div class="thumbs">${p.is_missing ? '<div class="text-muted small">Нет изображений</div>' : (p.images || []).slice(0,3).map(u => `<img src="${escapeAttr(u.thumbnail || u)}" data-full="${escapeAttr(u.full || u)}" class="thumb" loading="lazy" alt="">`).join('')}</div>
      </td>
      <td class="name-col" data-col="name">
        <div class="product-menu-wrapper">
          <div class="name-wrap" title="${escapeHtml(p.original_name || p.name)}">
            ${escapeHtml(p.display_name || p.name)}
            ${p.is_custom_name ? '<small class="text-success ms-1" title="Кастомное название">✓</small>' : ''}
            ${p.is_missing ? '<span class="badge bg-warning text-dark ms-1">Не в БД</span>' : ''}
          </div>
          <div class="sku">RemID: ${p.remonline_id ?? '-'} · SKU: ${escapeHtml(p.sku || '-')}</div>
          <div class="sku">Обновлено: ${formatDate(p.updated_at)}</div>
          ${p.is_missing ? '<div class="text-warning small">⚠️ Товар отсутствует в локальной базе данных</div>' : ''}
          <div class="product-menu" data-product-id="${p.id}" data-product-remonline-id="${p.remonline_id}" data-is-missing="${p.is_missing || false}">
            <div class="list-group list-group-flush">
              <div class="list-group-item" data-action="refresh">${p.is_missing ? 'Загрузить товар из Remonline' : 'Обновить данные товара'}</div>
              ${!p.is_missing ? `<div class="list-group-item" data-action="open-api" data-url="/api/v1/products/${p.id}">Открыть в API</div>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td class="category-col" data-col="category">
        ${escapeHtml(p.display_category || p.category || '-')}
        ${p.is_custom_category ? '<small class="text-success ms-1" title="Кастомная категория">✓</small>' : ''}
      </td>
      <td class="price-base-col" data-col="price-base">${p.is_missing ? '-' : (p.price != null ? p.price : '-')}</td>
      <td class="price-col" data-price="48388" data-col="price-48388">${p.is_missing ? '-' : formatPrice(p.prices['48388'])}</td>
      <td class="price-col" data-price="97150" data-col="price-97150">${p.is_missing ? '-' : formatPrice(p.prices['97150'])}</td>
      <td class="price-col" data-price="377836" data-col="price-377836">${p.is_missing ? '-' : formatPrice(p.prices['377836'])}</td>
      <td class="price-col" data-price="555169" data-col="price-555169">${p.is_missing ? '-' : formatPrice(p.prices['555169'])}</td>
      <td class="total-col" data-col="total">${p.is_missing ? '-' : formatPrice(p.totalStock)}</td>
      ${warehousesToShow.map(w => `<td class="warehouse-col" data-wh="${w.remonline_id}" data-col="wh-${w.remonline_id}">${p.is_missing ? '-' : (p.stocks[w.remonline_id] ?? 0)}</td>`).join('')}
    `;
    fragment.appendChild(tr);
  }
  bodyEl.appendChild(fragment);
  attachImageHoverPreview();
  attachProductMenus();
  applyColumnVisibility();
  applyColumnOrder();
  initDragAndDrop();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
}
function escapeAttr(str) {
  return String(str).replace(/["'`<>\\]/g, s => ({'"':'&quot;', "'":'&#39;', '`':'&#96;', '<':'&lt;', '>':'&gt;', '\\':'\\\\'}[s]));
}

function normalizeImageUrls(imagesJson) {
  if (!imagesJson) return [];
  const urls = [];
  const pickBoth = (obj) => {
    if (typeof obj === 'string') return { thumbnail: obj, full: obj };
    if (!obj || typeof obj !== 'object') return null;
    const thumbKeys = ['thumbnail','thumb','small','preview'];
    const fullKeys = ['original','full','large','url','src'];
    let thumb = null, full = null;
    for (const k of thumbKeys) {
      const v = obj[k];
      if (typeof v === 'string' && v.startsWith('http')) { thumb = v; break; }
    }
    for (const k of fullKeys) {
      const v = obj[k];
      if (typeof v === 'string' && v.startsWith('http')) { full = v; break; }
    }
    const anyUrl = Object.values(obj).find(v => typeof v === 'string' && v.startsWith('http'));
    if (!thumb && anyUrl) thumb = anyUrl;
    if (!full && anyUrl) full = anyUrl;
    if (!thumb && !full) return null;
    return { thumbnail: thumb || full, full: full || thumb };
  };
  try {
    if (Array.isArray(imagesJson)) {
      for (const it of imagesJson) {
        const u = pickBoth(it);
        if (u) urls.push(u);
      }
    } else if (typeof imagesJson === 'object') {
      if (Array.isArray(imagesJson.images)) {
        for (const it of imagesJson.images) {
          const u = pickBoth(it);
          if (u) urls.push(u);
        }
      } else {
        const u = pickBoth(imagesJson);
        if (u) urls.push(u);
      }
    }
  } catch {}
  // уникальные по full
  const seen = new Set();
  const unique = [];
  for (const x of urls) {
    if (!seen.has(x.full)) { seen.add(x.full); unique.push(x); }
  }
  return unique;
}

function normalizePrices(pricesJson) {
  if (!pricesJson || typeof pricesJson !== 'object') return {};
  try {
    // Если уже словарь id->число
    const result = {};
    for (const [k, v] of Object.entries(pricesJson)) {
      if (typeof v === 'number') result[k] = v;
      else if (typeof v === 'string') {
        const num = Number(v.replace(/\s+/g, '').replace(',', '.'));
        if (!Number.isNaN(num)) result[k] = num;
      } else if (v && typeof v === 'object') {
        // частые поля: amount, price, value
        const num = Number((v.amount ?? v.price ?? v.value ?? '').toString().replace(/\s+/g,'').replace(',', '.'));
        if (!Number.isNaN(num)) result[k] = num;
      }
    }
    return result;
  } catch { return {}; }
}

function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return '-';
  try {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(value);
  }
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '-'; }
}

async function loadPage(useFilters = false) {
  // Обычная пагинация - skip рассчитывается по номеру страницы
  const skip = (state.page - 1) * state.size;
  const name = encodeURIComponent(document.getElementById('searchInput').value.trim());
  
  // Если активна подвкладка, загружаем больше товаров чтобы найти все нужные
  const isSubtabActive = window.activeSubtab && window.activeSubtab.getProductIds().length > 0;
  const loadLimit = isSubtabActive ? 5000 : state.size; // Увеличиваем лимит для подвкладок
  
  let url;
  if (useFilters || isSubtabActive) {
    // Используем новый endpoint с фильтрами (или принудительно для подвкладок)
    const params = new URLSearchParams();
    params.append('skip', isSubtabActive ? 0 : skip);
    params.append('limit', isSubtabActive ? 10000 : loadLimit); // Увеличиваем лимит для подвкладок
    
    if (name) params.append('name', name);
    
    // Для подвкладок добавляем конкретные remonline_ids товаров
    if (isSubtabActive) {
      const subtabProductIds = window.activeSubtab.getProductIds();
      if (subtabProductIds.length > 0) {
        // Если есть поиск, фильтруем ID товаров подвкладки по поисковому запросу
        let filteredIds = subtabProductIds;
        if (name) {
          // Проверяем является ли поиск числом (remonline_id)
          const searchAsNumber = parseInt(name);
          if (!isNaN(searchAsNumber) && name && searchAsNumber.toString() === name.trim()) {
            // Поиск по конкретному remonline_id - оставляем только его если он есть в подвкладке
            filteredIds = subtabProductIds.includes(searchAsNumber) ? [searchAsNumber] : [];
            console.log(`Поиск по remonline_id ${searchAsNumber} в подвкладке:`, filteredIds.length > 0 ? 'найден' : 'не найден');
            // Убираем name параметр так как фильтруем по remonline_ids
            params.delete('name');
          } else {
            // Текстовый поиск - оставляем все ID подвкладки, фильтрация будет на сервере по name + remonline_ids
            console.log('Текстовый поиск в подвкладке по запросу:', name);
          }
        }
        
        if (filteredIds.length > 0) {
          params.append('remonline_ids', filteredIds.join(','));
          console.log('Загружаем товары по ID из подвкладки:', filteredIds);
        } else if (name && !isNaN(parseInt(name))) {
          // Если искали по ID но он не найден в подвкладке - не загружаем товары
          console.log('Товар с ID', name, 'не найден в текущей подвкладке');
          params.append('remonline_ids', '0'); // Передаем несуществующий ID чтобы получить пустой результат
        }
      }
    }
    
    const f = state.filters;
    if (f.categories.length > 0) {
      params.append('category', f.categories[0]); // Пока поддерживаем только одну категорию
    }
    if (f.warehouses.length > 0) {
      params.append('warehouse_ids', f.warehouses.join(','));
    }
    if (f.priceMin != null) params.append('price_min', f.priceMin);
    if (f.priceMax != null) params.append('price_max', f.priceMax);
    if (f.stockMin != null) params.append('stock_min', f.stockMin);
    if (f.stockMax != null) params.append('stock_max', f.stockMax);
    // Преобразуем значения сортировки для API (только поддерживаемые ключи)
    let sortBy = f.sortBy || 'name';
    const sortOrder = f.sortOrder || 'desc';
    const serverSortable = (['name','category','price','total'].includes(sortBy) || sortBy.startsWith('wh_'));
    if (sortBy === 'total') sortBy = 'total_stock';
    if (serverSortable) {
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
    }
    
    // Для подвкладок включаем все товары (активные и неактивные)
    if (!isSubtabActive) {
      params.append('is_active', 'true');
    }
    
    url = `${API_BASE}/products/filtered?${params.toString()}`;
  } else {
    // Используем старый endpoint без фильтров
    const nameQuery = name ? `&name=${name}` : '';
    const currentSkip = skip;
    const activeFilter = '&is_active=true';
    url = `${API_BASE}/products/?skip=${currentSkip}&limit=${loadLimit}${nameQuery}${activeFilter}`;
  }
  
  console.log('Загружаем товары с URL:', url);
  console.log('Активна подвкладка:', !!window.activeSubtab, 'Загружаем все товары:', isSubtabActive);
  
  if (state.isLoading) return;
  state.isLoading = true;
  loader.style.display = 'inline-block';
  try {
    const productsResp = await fetchJson(url);
    let products = (productsResp?.data) || [];
    
    console.log('Получено товаров с сервера:', products.length);
    console.log('ID товаров с сервера:', products.map(p => p.remonline_id));
    
    // Проверяем есть ли конкретный товар который недавно обновляли
    if (window.lastUpdatedProductId) {
      const isInResponse = products.some(p => p.remonline_id === window.lastUpdatedProductId);
      console.log(`🔍 Товар ${window.lastUpdatedProductId} в ответе сервера:`, isInResponse);
      if (isInResponse) {
        console.log(`✅ Товар ${window.lastUpdatedProductId} найден в ответе!`);
        // Сбрасываем флаг
        window.lastUpdatedProductId = null;
      }
    }
    
    // Специальная проверка для товара 38089182
    const hasProduct38089182 = products.some(p => p.remonline_id === 38089182);
    console.log(`🔍 Товар 38089182 в ответе сервера:`, hasProduct38089182);
    if (hasProduct38089182) {
      const product = products.find(p => p.remonline_id === 38089182);
      console.log(`📋 Данные товара 38089182 в ответе:`, {
        id: product.id,
        name: product.name,
        is_active: product.is_active,
        remonline_id: product.remonline_id
      });
    }
    
    // Фильтрация и обогащение товаров из активной подвкладки
    if (window.activeSubtab) {
      const subtabProductIds = window.activeSubtab.getProductIds();
      if (subtabProductIds && subtabProductIds.length > 0) {
        console.log('Товары в подвкладке:', subtabProductIds);
        
        // Проверяем какие товары из подвкладки есть в ответе сервера
        const availableProductIds = products.map(p => p.remonline_id);
        const missingProductIds = subtabProductIds.filter(id => !availableProductIds.includes(id));
        
        // Если есть поиск по remonline_id и товар не найден, это нормально
        const searchAsNumber = name ? parseInt(name) : NaN;
        const isSearchById = !isNaN(searchAsNumber) && name && searchAsNumber.toString() === name.trim();
        
        if (missingProductIds.length > 0 && !isSearchById) {
          console.warn('Товары из подвкладки отсутствуют в ответе сервера:', missingProductIds);
        } else if (isSearchById && products.length === 0) {
          console.log(`Товар с ID ${searchAsNumber} не найден в подвкладке или отсутствует в БД`);
        }
        
        // Получаем данные товаров из подвкладки с кастомными названиями
        const subtabProducts = window.activeSubtab.products || [];
        const subtabProductsMap = new Map();
        
        subtabProducts.forEach(sp => {
          subtabProductsMap.set(sp.product_remonline_id, {
            custom_name: sp.custom_name,
            custom_category: sp.custom_category,
            order_index: sp.order_index !== undefined ? sp.order_index : 0
          });
        });
        
        // При использовании remonline_ids фильтра товары уже отфильтрованы сервером
        const filteredProducts = products;
        
        console.log('Товары после серверной фильтрации по подвкладке:', filteredProducts.length);
        console.log('ID товаров после серверной фильтрации:', filteredProducts.map(p => p.remonline_id));
        
        // Специальная проверка для товара 38089182
        const hasProduct38089182InFiltered = filteredProducts.some(p => p.remonline_id === 38089182);
        console.log(`🎯 Товар 38089182 в серверном ответе:`, hasProduct38089182InFiltered);
        
        // Создаем список товаров из подвкладки с кастомными данными
        const enrichedProducts = filteredProducts.map(product => {
          // Обогащаем товар кастомными данными из подвкладки
          const subtabData = subtabProductsMap.get(product.remonline_id);
          if (subtabData) {
            return {
              ...product,
              display_name: subtabData.custom_name || product.name,
              display_category: subtabData.custom_category || product.category,
              is_custom_name: !!subtabData.custom_name,
              is_custom_category: !!subtabData.custom_category,
              subtab_order_index: subtabData.order_index
            };
          }
          return {
            ...product,
            display_name: product.name,
            display_category: product.category,
            is_custom_name: false,
            is_custom_category: false,
            subtab_order_index: 999999 // Большое число для товаров без порядка
          };
        });
        
        // Добавляем отсутствующие товары из подвкладки как заглушки
        const foundProductIds = filteredProducts.map(p => p.remonline_id);
        
        // Создаем заглушки только если не было поиска по ID
        let missingProducts = [];
        if (!isSearchById) {
          missingProducts = subtabProducts
            .filter(sp => !foundProductIds.includes(sp.product_remonline_id))
            .map(sp => {
              // При использовании remonline_ids API заглушки должны создаваться только если товар действительно не существует в БД
              console.log('Создаем заглушку для отсутствующего в БД товара:', sp.product_remonline_id);
              return {
                id: `missing_${sp.product_remonline_id}`, // Уникальный ID для заглушки
                remonline_id: sp.product_remonline_id,
                name: sp.custom_name || `Товар ID ${sp.product_remonline_id}`,
                display_name: sp.custom_name || `Товар ID ${sp.product_remonline_id}`,
                category: sp.custom_category || 'Не найден в базе',
                display_category: sp.custom_category || 'Не найден в базе',
                sku: '-',
                price: null,
                images: [],
                prices: {},
                stocks: {},
                totalStock: 0,
                updated_at: sp.updated_at,
                is_missing: true, // Помечаем как отсутствующий товар
                is_custom_name: !!sp.custom_name,
                is_custom_category: !!sp.custom_category,
                subtab_order_index: sp.order_index !== undefined ? sp.order_index : 0
              };
            });
        }
        
        if (missingProducts.length > 0) {
          console.log('Статистика товаров:', {
            foundInDB: foundProductIds.length,
            totalInSubtab: subtabProductIds.length,
            missingFromDB: missingProducts.length,
            missingProductIds: missingProducts.map(p => p.remonline_id)
          });
        }
        
        // Объединяем найденные и отсутствующие товары
        products = [...enrichedProducts, ...missingProducts];
        
        // Сортируем товары по порядку из подвкладки
        products.sort((a, b) => {
          const orderA = a.subtab_order_index !== undefined ? a.subtab_order_index : 999999;
          const orderB = b.subtab_order_index !== undefined ? b.subtab_order_index : 999999;
          return orderA - orderB;
        });
      }
    }

    // Ограничение конкурентности при загрузке остатков
    const concurrency = 6;
    const queue = products.map(p => async () => {
      // Для отсутствующих товаров не загружаем остатки
      if (p.is_missing) {
        return { product: p, stocks: {} };
      }
      return { product: p, stocks: await loadStocksForProduct(p.id) };
    });
    const results = await runLimited(queue, concurrency);

    const productsWithStocks = results.map(({ product, stocks }) => {
      // Определяем какие склады учитывать для общего остатка
      const warehousesToCount = state.filters.warehouses.length > 0 
        ? state.filters.warehouses
        : TARGET_WAREHOUSES.map(w => w.remonline_id);
      
      const totalStock = warehousesToCount.reduce((sum, whId) => sum + (Number(stocks[whId]) || 0), 0);
      
      const finalProduct = {
        id: product.id,
        remonline_id: product.remonline_id,
        name: product.display_name || product.name,
        original_name: product.name,
        sku: product.sku,
        category: product.display_category || product.category,
        original_category: product.category,
        is_custom_name: product.is_custom_name || false,
        is_custom_category: product.is_custom_category || false,
        is_missing: product.is_missing || false, // Передаем флаг отсутствующего товара
        price: product.price,
        updated_at: product.updated_at,
        stocks: stocks,
        images: normalizeImageUrls(product.images_json),
        prices: normalizePrices(product.prices_json),
        totalStock: totalStock,
        subtab_order_index: product.subtab_order_index !== undefined ? product.subtab_order_index : 999999,
      };
      
      return finalProduct;
    });

    // Обычная пагинация - заменяем данные на каждой странице
    state.allProducts = productsWithStocks;
    state.currentProducts = state.allProducts;
    state.totalLoaded = productsWithStocks.length;
    updateCategoryOptions(state.currentProducts);
    
    if (useFilters) {
      // При использовании фильтров, hasMore определяется по total из ответа
      const total = productsResp?.total || 0;
      state.hasMore = (skip + products.length) < total;
      state.totalPages = Math.ceil(total / state.size);
    } else {
      // Есть ещё данные, если получили полную пачку (равную размеру страницы)
      state.hasMore = products.length === state.size;
      state.totalPages = state.hasMore ? state.page + 1 : state.page; // Примерная оценка
    }
    
    // Всегда применяем клиентскую сортировку/фильтрацию для консистентности отображения
    const toRender = sortProducts(productsWithStocks);
    renderTable(toRender);
    renderPagination();
    // Обновляем стрелочки после рендеринга таблицы
    markSortableHeaders();
    updateAllSortArrows();
    if (useFilters) {
      const total = productsResp?.total || 0;
      pageInfo.textContent = formatPageInfo();
    } else {
      pageInfo.textContent = formatPageInfo();
    }
  } catch (e) {
    console.error(e);
    alert('Ошибка загрузки данных');
  } finally {
    loader.style.display = 'none';
    state.isLoading = false;
  }
}

function updateCategoryOptions(products) {
  if (!categoryFilterEl) return;
  const selected = new Set(Array.from(categoryFilterEl.selectedOptions).map(o => o.value));
  
  // Собираем все категории (включая кастомные)
  const allCategories = new Set();
  products.forEach(p => {
    if (p.category) allCategories.add(p.category);
    if (p.original_category && p.original_category !== p.category) {
      allCategories.add(p.original_category);
    }
  });
  
  const categories = Array.from(allCategories).sort((a,b) => a.localeCompare(b));
  categoryFilterEl.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Выберите категории';
  ph.disabled = true; ph.hidden = true;
  categoryFilterEl.appendChild(ph);
  for (const c of categories) {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (selected.has(c)) opt.selected = true;
    categoryFilterEl.appendChild(opt);
  }
}

function readFiltersFromUI() {
  state.filters.categories = getMultiValues(categoryFilterEl);
  state.filters.warehouses = getMultiValues(warehouseFilterEl).map(v => Number(v)).filter(v => !Number.isNaN(v));
  state.filters.priceMin = numOrNull(priceMinEl?.value);
  state.filters.priceMax = numOrNull(priceMaxEl?.value);
  state.filters.stockMin = numOrNull(stockMinEl?.value);
  state.filters.stockMax = numOrNull(stockMaxEl?.value);
  // sortBy/sortOrder управляются кликами по заголовкам таблицы
}

function getMultiValues(selectEl) {
  if (!selectEl) return [];
  const values = Array.from(selectEl.selectedOptions).map(o => o.value).filter(v => v !== '');
  // Если в мультиселекте ничего не выбрано, возвращаем пустой массив
  return values;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function applyAndRender() {
  const products = state.currentProducts || [];
  const filtered = filterProducts(products);
  const sorted = sortProducts(filtered);
  
  // Обновляем состояние для правильной пагинации
  state.allProducts = sorted;
  state.totalLoaded = sorted.length;
  state.totalPages = Math.ceil(sorted.length / state.size) || 1;
  state.hasMore = false; // Клиентская фильтрация - все данные уже загружены
  
  // Применяем пагинацию - показываем только товары для текущей страницы
  const startIndex = (state.page - 1) * state.size;
  const endIndex = startIndex + state.size;
  const paginatedProducts = sorted.slice(startIndex, endIndex);
  
  renderTable(paginatedProducts);
  renderPagination();
  // Обновляем стрелочки после рендеринга
  markSortableHeaders();
  updateAllSortArrows();
  pageInfo.textContent = formatPageInfo();
}

function formatPageInfo() {
  const totalPages = Math.max(1, state.totalPages || 1);
  return `< ${state.page} ... > ${totalPages}`;
}

function renderPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';

  const totalPages = Math.max(1, state.totalPages || 1);
  const current = Math.min(state.page, totalPages);

  function createBtn(label, disabled, onClick) {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${disabled ? 'btn-outline-secondary' : 'btn-secondary'}`;
    btn.textContent = label;
    if (disabled) btn.disabled = true;
    if (onClick && !disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  // Prev
  container.appendChild(createBtn('<', current <= 1, () => {
    if (state.page > 1) { 
      state.page -= 1; 
      // Если активна подвкладка, используем клиентскую фильтрацию
      if (window.activeSubtab) {
        applyAndRender();
      } else {
        loadPage(state.filters.warehouses.length > 0 || state.filters.categories.length > 0);
      }
    }
  }));

  // Всегда показываем 1, текущую ±2, и последнюю страницу
  const pagesToShow = new Set();
  
  // Всегда добавляем первую страницу
  pagesToShow.add(1);
  
  // Добавляем текущую ±2 страницы
  for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
    pagesToShow.add(i);
  }
  
  // Всегда добавляем последнюю страницу
  if (totalPages > 1) {
    pagesToShow.add(totalPages);
  }
  
  const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);
  
  for (let i = 0; i < sortedPages.length; i++) {
    const pageNum = sortedPages[i];
    const prevPageNum = i > 0 ? sortedPages[i - 1] : 0;
    
    // Добавляем многоточие если есть пропуск страниц
    if (pageNum - prevPageNum > 1) {
      const ell = document.createElement('span');
      ell.className = 'text-muted px-1';
      ell.textContent = '...';
      container.appendChild(ell);
    }
    
    // Добавляем кнопку страницы
    const isActive = pageNum === current;
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-secondary'}`;
    btn.textContent = String(pageNum);
    if (!isActive) btn.addEventListener('click', () => { 
      state.page = pageNum; 
      // Если активна подвкладка, используем клиентскую фильтрацию
      if (window.activeSubtab) {
        applyAndRender();
      } else {
        loadPage(state.filters.warehouses.length > 0 || state.filters.categories.length > 0);
      }
    });
    container.appendChild(btn);
  }

  // Next
  container.appendChild(createBtn('>', current >= totalPages, () => {
    if (state.page < totalPages) { 
      state.page += 1; 
      // Если активна подвкладка, используем клиентскую фильтрацию
      if (window.activeSubtab) {
        applyAndRender();
      } else {
        loadPage(state.filters.warehouses.length > 0 || state.filters.categories.length > 0);
      }
    }
  }));
}

function filterProducts(products) {
  const f = state.filters;
  return products.filter(p => {
    // Фильтр по категориям (любой из выбранных) - проверяем как текущую, так и оригинальную категорию
    if (f.categories.length > 0) {
      const currentCategory = p.category || '';
      const originalCategory = p.original_category || '';
      const hasMatchingCategory = f.categories.includes(currentCategory) || 
                                 f.categories.includes(originalCategory);
      if (!hasMatchingCategory) return false;
    }
    // Фильтр по цене
    if (f.priceMin != null && (p.price == null || p.price < f.priceMin)) return false;
    if (f.priceMax != null && (p.price == null || p.price > f.priceMax)) return false;
    // Фильтр по складам и остатку
    let stockForCheck = p.totalStock;
    if (f.warehouses.length > 0) {
      stockForCheck = f.warehouses.reduce((sum, wid) => sum + (Number(p.stocks[wid]) || 0), 0);
      // Если фильтруем по складам, скрываем товары, где сумма по выбранным складам = 0
      if (stockForCheck <= 0) return false;
    }
    if (f.stockMin != null && stockForCheck < f.stockMin) return false;
    if (f.stockMax != null && stockForCheck > f.stockMax) return false;
    return true;
  });
}

function sortProducts(products) {
  const f = state.filters;
  const dir = f.sortOrder === 'asc' ? 1 : -1;
  const by = f.sortBy || 'name';
  const copy = products.slice();
  
  // Если активна подвкладка и НЕТ пользовательской сортировки, используем порядок из подвкладки
  if (window.activeSubtab && !state.userSortActive) {
    
    copy.sort((a, b) => {
      const orderA = a.subtab_order_index !== undefined ? Number(a.subtab_order_index) : 999999;
      const orderB = b.subtab_order_index !== undefined ? Number(b.subtab_order_index) : 999999;
      return orderA - orderB;
    });
    
    
    return copy;
  }
  
  // Применяем пользовательскую сортировку
  copy.sort((a, b) => {
    let va, vb;
    if (by === 'name') { va = a.name || ''; vb = b.name || ''; return va.localeCompare(vb) * dir; }
    if (by === 'category') { va = a.category || ''; vb = b.category || ''; return va.localeCompare(vb) * dir; }
    if (by === 'price') { va = Number(a.price) || 0; vb = Number(b.price) || 0; return (va - vb) * dir; }
    if (by.startsWith('price_')) {
      const pid = by.split('_')[1];
      va = Number(a.prices?.[pid]) || 0; vb = Number(b.prices?.[pid]) || 0; return (va - vb) * dir;
    }
    if (by === 'total') { va = Number(a.totalStock) || 0; vb = Number(b.totalStock) || 0; return (va - vb) * dir; }
    if (by.startsWith('wh_')) {
      const wid = Number(by.split('_')[1]);
      va = Number(a.stocks[wid]) || 0; vb = Number(b.stocks[wid]) || 0; return (va - vb) * dir;
    }
    return 0;
  });
  return copy;
}

// Удалена бесконечная прокрутка - используется обычная пагинация

// Контекстное меню на колонке «Товар»
function attachProductMenus() {
  // Скрывать меню при клике вне
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.product-menu-wrapper')) {
      document.querySelectorAll('.product-menu.show').forEach(el => el.classList.remove('show'));
    }
  });

  bodyEl.querySelectorAll('.product-menu-wrapper').forEach(wrapper => {
    const menu = wrapper.querySelector('.product-menu');
    if (!menu) return;
    const nameWrap = wrapper.querySelector('.name-wrap');
    if (!nameWrap) return;

    // Показывать меню при наведении
    let hideTimer = null;
    function show() {
      clearTimeout(hideTimer); menu.classList.add('show');
    }
    function scheduleHide() {
      hideTimer = setTimeout(() => menu.classList.remove('show'), 150);
    }
    nameWrap.addEventListener('mouseenter', show);
    nameWrap.addEventListener('mouseleave', scheduleHide);

    menu.addEventListener('mouseenter', show);
    menu.addEventListener('mouseleave', scheduleHide);

    // Клики по пунктам
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.list-group-item');
      if (!item) return;
      const action = item.getAttribute('data-action');
      const productId = menu.getAttribute('data-product-id');
      const productRemonlineId = menu.getAttribute('data-product-remonline-id');
      const isMissing = menu.getAttribute('data-is-missing') === 'true';
      
      if (action === 'refresh') {
        try {
          item.classList.add('disabled');
          item.classList.add('btn-progress');
          
          if (isMissing) {
            // Для отсутствующих товаров пытаемся найти их по Remonline ID
            await refreshMissingProduct(productRemonlineId, item);
            
            // Сначала обновляем данные активной подвкладки
            if (window.activeSubtab) {
              console.log(`🔄 Обновляем данные подвкладки ${window.activeSubtab.id}...`);
              await window.activeSubtab.refreshSubtabData();
              console.log(`📊 Новые ID товаров в подвкладке:`, window.activeSubtab.getProductIds());
            }
          } else {
            // Обычное обновление товара
            await refreshProductWithProgress(Number(productId), item);
            
            // Также обновляем данные подвкладки, если она активна
            if (window.activeSubtab) {
              console.log(`🔄 Обновляем данные подвкладки ${window.activeSubtab.id}...`);
              await window.activeSubtab.refreshSubtabData();
              console.log(`📊 Новые ID товаров в подвкладке:`, window.activeSubtab.getProductIds());
            }
          }
          
          // Принудительная загрузка страницы с очисткой кеша
          console.log(`🔄 Принудительно перезагружаем таблицу...`);
          await loadPage(false);
        } catch (err) {
          console.error('Ошибка обновления товара:', err);
          alert(isMissing ? 'Не удалось загрузить товар из Remonline' : 'Не удалось обновить товар');
        } finally {
          item.classList.remove('disabled');
          item.classList.remove('btn-progress');
          item.style.removeProperty('--progress');
        }
      } else if (action === 'open-api') {
        const url = item.getAttribute('data-url');
        window.open(url, '_blank');
      }
    });
  });
}

async function refreshProductWithProgress(productId, buttonEl) {
  // Получаем активные склады
  const resp = await fetch(`${API_BASE}/warehouses/?active_only=true&limit=1000`);
  if (!resp.ok) throw new Error('warehouses fetch failed');
  const data = await resp.json();
  const warehouses = (data?.data || []).filter(w => w?.remonline_id);
  const total = warehouses.length || 1;
  let done = 0;
  const start = Date.now();
  let lastEtaTimeout = null;

  // Обработка пачками по 3 запроса в секунду
  const batchSize = 3;
  for (let i = 0; i < warehouses.length; i += batchSize) {
    const batch = warehouses.slice(i, i + batchSize);
    const requests = batch.map(async (wh) => {
      try {
        await fetch(`${API_BASE}/products/${productId}/refresh?warehouse_id=${encodeURIComponent(wh.remonline_id)}`, { method: 'POST' });
      } catch {}
      // По факту завершения запроса — увеличиваем прогресс и ETA
      done += 1;
      const pct = Math.min(100, Math.round((done / total) * 100));
      buttonEl.style.setProperty('--progress', pct + '%');

      const elapsedMs = Date.now() - start;
      const avgPerItem = elapsedMs / Math.max(1, done);
      const remaining = Math.max(0, Math.round(avgPerItem * (total - done)));
      const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
      const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
      buttonEl.setAttribute('data-eta', `${mm}:${ss}`);
    });

    await Promise.all(requests);
    // Пауза 1 секунда между пачками, если ещё остались склады
    if (i + batchSize < warehouses.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  // По завершении ETA убираем
  buttonEl.removeAttribute('data-eta');
}

async function refreshMissingProduct(remonlineId, buttonEl) {
  try {
    console.log(`🔍 Начинаем поиск товара с Remonline ID: ${remonlineId}`);
    console.log(`🔗 URL поиска: ${API_BASE}/products/remonline/${remonlineId}`);
    buttonEl.textContent = 'Поиск товара в БД...';
    
    // Пытаемся найти товар в локальной БД по Remonline ID
    let response = await fetch(`${API_BASE}/products/remonline/${remonlineId}`);
    console.log(`📦 Ответ поиска в БД: status=${response.status}`);
    
    if (response.ok) {
      // Товар найден в БД - обновляем его
      const data = await response.json();
      const product = data.data;
      
      console.log(`✅ Товар найден в БД с ID: ${product.id}, обновляем...`);
      buttonEl.textContent = 'Обновление товара...';
      await refreshProductWithProgress(product.id, buttonEl);
      
      console.log('✅ Товар успешно обновлен');
      buttonEl.textContent = 'Товар загружен!';
      
      // Помечаем товар для отслеживания в следующей загрузке
      window.lastUpdatedProductId = parseInt(remonlineId);
      
      // Дополнительно загружаем товар напрямую для проверки
      console.log(`🔍 Проверяем товар после обновления...`);
      const checkResponse = await fetch(`${API_BASE}/products/${product.id}`);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        console.log(`📋 Данные товара после обновления:`, checkData.data);
        console.log(`🏃 Активен ли товар: ${checkData.data.is_active}`);
        
        // Если товар неактивен, активируем его
        if (!checkData.data.is_active) {
          console.log(`🔄 Товар неактивен, активируем...`);
          buttonEl.textContent = 'Активация товара...';
          
          const activateResponse = await fetch(`${API_BASE}/products/${product.id}/activate`, {
            method: 'PUT'
          });
          
          if (activateResponse.ok) {
            console.log(`✅ Товар успешно активирован`);
            buttonEl.textContent = 'Товар активирован!';
          } else {
            console.log(`❌ Ошибка активации товара`);
            buttonEl.textContent = 'Ошибка активации';
          }
        }
      }
      
    } else if (response.status === 404) {
      // Товар не найден в БД - загружаем из Remonline
      console.log(`❌ Товар с Remonline ID ${remonlineId} не найден в БД, загружаем из Remonline...`);
      console.log(`🔗 URL создания: ${API_BASE}/products/create-from-remonline/${remonlineId}`);
      buttonEl.textContent = 'Загрузка из Remonline...';
      
      const createResponse = await fetch(`${API_BASE}/products/create-from-remonline/${remonlineId}`, {
        method: 'POST'
      });
      
      console.log(`📦 Ответ создания товара: status=${createResponse.status}`);
      
      if (createResponse.ok) {
        const createData = await createResponse.json();
        const newProduct = createData.data;
        
        console.log(`✅ Товар создан в БД:`, newProduct);
        console.log(`🔄 Товар создан в БД с ID: ${newProduct.id}, обновляем остатки...`);
        buttonEl.textContent = 'Обновление остатков...';
        
        // Обновляем товар для получения остатков
        await refreshProductWithProgress(newProduct.id, buttonEl);
        
        console.log('✅ Товар успешно загружен и обновлен');
        buttonEl.textContent = 'Товар загружен!';
        
        // Помечаем товар для отслеживания в следующей загрузке
        window.lastUpdatedProductId = parseInt(remonlineId);
        
        // Дополнительно проверяем созданный товар
        console.log(`🔍 Проверяем созданный товар...`);
        const checkResponse = await fetch(`${API_BASE}/products/${newProduct.id}`);
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          console.log(`📋 Данные созданного товара:`, checkData.data);
          console.log(`🏃 Активен ли созданный товар: ${checkData.data.is_active}`);
        }
      } else {
        const errorData = await createResponse.json().catch(() => ({}));
        console.error('❌ Ошибка создания товара:', errorData);
        const errorMessage = errorData.detail || 'Неизвестная ошибка при загрузке из Remonline';
        throw new Error(errorMessage);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Ошибка поиска товара:', errorData);
      throw new Error('Ошибка при поиске товара в базе данных');
    }
  } catch (error) {
    console.error('❌ Ошибка обновления отсутствующего товара:', error);
    buttonEl.textContent = 'Ошибка загрузки';
    throw error;
  }
}

async function loadStocksForProduct(productId) {
  const url = `${API_BASE}/stocks/product/${productId}?include_details=true`;
  const resp = await fetchJson(url);
  const items = resp?.data || [];
  const map = {};
  for (const it of items) {
    const whRemId = it?.warehouse?.remonline_id;
    if (!whRemId) continue;
    // Загружаем все остатки, не фильтруя по TARGET_WAREHOUSES
    map[whRemId] = (map[whRemId] || 0) + (it.available_quantity ?? 0);
  }
  // Убеждаемся что у всех целевых складов есть значения (даже если 0)
  for (const w of TARGET_WAREHOUSES) {
    if (map[w.remonline_id] == null) map[w.remonline_id] = 0;
  }
  return map;
}

async function runLimited(tasks, limit = 5) {
  const results = new Array(tasks.length);
  let i = 0;
  const workers = Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (i < tasks.length) {
      const cur = i++;
      results[cur] = await tasks[cur]();
    }
  });
  await Promise.all(workers);
  return results;
}

// Hover-превью полноразмерных изображений рядом с курсором
function attachImageHoverPreview() {
  let previewEl = null;
  function ensurePreview(src) {
    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.className = 'img-hover-preview';
      previewEl.innerHTML = '<img alt="">';
      document.body.appendChild(previewEl);
    }
    const img = previewEl.querySelector('img');
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    previewEl.style.display = 'block';
  }
  function movePreview(e) {
    if (!previewEl) return;
    const padding = 12;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    let left = e.clientX + padding;
    let top = e.clientY + padding;
    const rect = previewEl.getBoundingClientRect();
    if (left + rect.width > maxW) left = e.clientX - rect.width - padding;
    if (top + rect.height > maxH) top = e.clientY - rect.height - padding;
    previewEl.style.left = left + 'px';
    previewEl.style.top = top + 'px';
  }
  function hidePreview() {
    if (previewEl) previewEl.style.display = 'none';
  }

  bodyEl.querySelectorAll('img.thumb').forEach(img => {
    const full = img.getAttribute('data-full') || img.getAttribute('src');
    img.addEventListener('mouseenter', () => ensurePreview(full));
    img.addEventListener('mousemove', movePreview);
    img.addEventListener('mouseleave', hidePreview);
  });
}

// Инициализация: загружаем склады, затем данные
loadWarehouses().then(() => {
  loadPage();
});

// Сортировка по клику на заголовки
const theadEl = document.querySelector('thead');
if (theadEl) {
  theadEl.addEventListener('click', (e) => {
    const th = e.target.closest('th');
    if (!th || !theadEl.contains(th)) return;
    const key = getSortKeyForHeader(th);
    if (!key) return;
    
    // Активируем пользовательскую сортировку
    state.userSortActive = true;
    
    if (state.filters.sortBy === key) {
      state.filters.sortOrder = (state.filters.sortOrder === 'asc') ? 'desc' : 'asc';
    } else {
      state.filters.sortBy = key;
      state.filters.sortOrder = 'desc'; // По умолчанию начинаем с убывания
    }
    applyAndRender();
    updateAllSortArrows();
  });
}

function getSortKeyForHeader(th) {
  if (th.classList.contains('photos-col')) return null;
  if (th.classList.contains('name-col')) return 'name';
  if (th.classList.contains('category-col')) return 'category';
  if (th.classList.contains('price-base-col')) return 'price';
  if (th.classList.contains('price-col')) {
    const pid = th.getAttribute('data-price');
    if (pid) return `price_${pid}`;
  }
  if (th.classList.contains('total-col')) return 'total';
  if (th.classList.contains('warehouse-col')) {
    const wid = th.getAttribute('data-wh');
    if (wid) return `wh_${wid}`;
  }
  return null;
}

function markSortableHeaders() {
  const ths = document.querySelectorAll('thead th');
  ths.forEach(th => {
    const key = getSortKeyForHeader(th);
    if (key) {
      // console.log('Adding arrows to header:', th.textContent, 'key:', key);
      th.classList.add('sortable');
      addSortArrows(th, key);
    } else {
      th.classList.remove('sortable');
    }
  });
}

function addSortArrows(th, sortKey) {
  // Удаляем старую стрелочку если есть
  const existingArrow = th.querySelector('.sort-arrow');
  if (existingArrow) {
    existingArrow.remove();
  }
  
  // Создаём одну стрелочку
  const arrow = document.createElement('span');
  arrow.className = 'sort-arrow';
  arrow.innerHTML = '↓'; // По умолчанию вниз
  
  th.appendChild(arrow);
  
  // Обновляем состояние стрелочки
  updateSortArrows(th, sortKey);
}

function updateSortArrows(th, sortKey) {
  const arrow = th.querySelector('.sort-arrow');
  
  if (!arrow) return;
  
  // Если активна подвкладка и нет пользовательской сортировки, скрываем все стрелочки
  if (window.activeSubtab && !state.userSortActive) {
    arrow.classList.remove('active');
    arrow.innerHTML = '↓';
    return;
  }
  
  // Проверяем, активна ли эта колонка для сортировки
  if (state.userSortActive && state.filters.sortBy === sortKey) {
    arrow.classList.add('active');
    // Устанавливаем направление стрелочки
    if (state.filters.sortOrder === 'asc') {
      arrow.innerHTML = '↑';
    } else {
      arrow.innerHTML = '↓';
    }
  } else {
    arrow.classList.remove('active');
    arrow.innerHTML = '↓'; // По умолчанию вниз для неактивных колонок
  }
}

function updateAllSortArrows() {
  const ths = document.querySelectorAll('thead th.sortable');
  ths.forEach(th => {
    const key = getSortKeyForHeader(th);
    if (key) {
      updateSortArrows(th, key);
    }
  });
}

// Глобальная переменная для менеджера вкладок
let tabsManager = null;

// Состояние активной главной вкладки
let activeMainTabType = 'all'; // 'apple', 'android', 'all'
window.activeMainTabType = activeMainTabType;

/**
 * Инициализация классической темы
 */
function initClassicTheme() {
  console.log('Инициализация классической темы');
  
  // ПОЛНАЯ ОЧИСТКА: скрыть контейнер плиток и показать элементы классической темы
  const tilesContainer = document.getElementById('tilesContainer');
  if (tilesContainer) {
    tilesContainer.style.display = 'none';
  }
  
  // Удалить все кнопки навигации плиточной темы, если они остались
  document.getElementById('backToTabsBtn')?.remove();
  document.getElementById('backToSubtabsBtn')?.remove();
  document.getElementById('backToCategoriesBtn')?.remove();
  document.getElementById('manageSubtabProductsBtn')?.remove();
  
  // Показать элементы классической темы
  const tableCard = document.querySelector('.card');
  const tableContainer = document.getElementById('tableContainer');
  const tabsContainer = document.getElementById('tabsContainer');
  const pagination = document.querySelector('#pagination')?.parentElement;
  const pageInfo = document.querySelector('#pageInfo')?.parentElement;
  const columnsSettingsBtn = document.getElementById('columnsSettingsBtn')?.parentElement;
  const mainTabsDiv = document.querySelector('.main-tabs');
  
  // Показать все элементы таблицы
  if (tableCard) {
    tableCard.style.display = '';
  }
  if (tableContainer) {
    tableContainer.style.display = '';
  }
  if (tabsContainer) {
    tabsContainer.style.display = '';
  }
  if (pagination) {
    pagination.style.display = '';
  }
  if (pageInfo) {
    pageInfo.style.display = '';
  }
  if (columnsSettingsBtn) {
    columnsSettingsBtn.style.display = '';
  }
  if (mainTabsDiv) {
    mainTabsDiv.style.display = '';
  }
  
  // Сбросить активную подвкладку
  window.activeSubtab = null;
  
  // Применяем сохраненный порядок столбцов
  applyColumnOrder();
  
  // Инициализируем drag and drop
  initDragAndDrop();
  
  // Инициализируем систему главных вкладок
  initMainTabsSystem();
  
  // Инициализируем систему вкладок
  initTabsSystem();
  
  // Инициализируем настройки вкладок
  initTabsSettings();
  
  // Дополнительно инициализируем при открытии модального окна
  initColumnsModal();
}

// Экспортируем функцию для использования в theme-manager
window.initClassicTheme = initClassicTheme;

/**
 * Инициализирует систему вкладок
 */
function initTabsSystem() {
  const tabsContainer = document.getElementById('tabsContainer');
  if (!tabsContainer) {
    console.error('Контейнер для вкладок не найден');
    return;
  }
  
  // Создаём менеджер вкладок
  tabsManager = new TabsManager(tabsContainer);
  
  // Делаем менеджер доступным глобально для других модулей
  window.tabsManager = tabsManager;
  
  // Устанавливаем callback для смены активной подвкладки
  tabsManager.setOnSubtabChangeCallback((subtab) => {
    onActiveSubtabChanged(subtab);
  });
}

/**
 * Вызывается при смене активной подвкладки
 */
function onActiveSubtabChanged(subtab) {
  console.log('Активная подвкладка изменена:', subtab);
  
  // Сохраняем активную подвкладку для фильтрации
  window.activeSubtab = subtab;
  
  // Сбрасываем пользовательскую сортировку при смене подвкладки
  state.userSortActive = false;
  
  if (subtab) {
    // Фильтруем товары по подвкладке
    const productIds = subtab.getProductIds();
    console.log('Показываем товары с ID:', productIds);
  } else {
    // Показываем все товары
    console.log('Показываем все товары (нет активной подвкладки)');
  }
  
  // Обновляем таблицу товаров
  loadPage();
}

/**
 * Инициализирует систему главных вкладок Apple/Android
 */
function initMainTabsSystem() {
  const appleBtn = document.getElementById('appleTabBtn');
  const androidBtn = document.getElementById('androidTabBtn');
  const allBtn = document.getElementById('allTabBtn');

  if (!appleBtn || !androidBtn || !allBtn) {
    console.error('Кнопки главных вкладок не найдены');
    return;
  }

  // Обработчики кликов
  appleBtn.addEventListener('click', () => setActiveMainTab('apple'));
  androidBtn.addEventListener('click', () => setActiveMainTab('android'));
  allBtn.addEventListener('click', () => setActiveMainTab('all'));
}

/**
 * Устанавливает активную главную вкладку
 */
function setActiveMainTab(type) {
  activeMainTabType = type;
  window.activeMainTabType = type; // Обновляем глобальную переменную
  
  // Обновляем UI кнопок
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-main-type="${type}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  console.log('Активная главная вкладка:', type);
  
  // Перезагружаем систему обычных вкладок с учётом фильтра
  if (tabsManager) {
    tabsManager.loadTabs();
  }
}

/**
 * Инициализирует настройки вкладок в модальном окне
 */
async function initTabsSettings() {
  console.log('Инициализация настроек вкладок...');
  
  // Загружаем вкладки для настроек при открытии вкладки "Вкладки"
  const tabsTabButton = document.getElementById('tabs-tab');
  if (tabsTabButton) {
    console.log('Найдена кнопка вкладки настроек');
    
    // Используем правильное событие Bootstrap
    tabsTabButton.addEventListener('click', async function() {
      console.log('Клик по вкладке настроек вкладок');
      setTimeout(async () => {
        await loadTabsSettings();
      }, 150); // Небольшая задержка для полного переключения вкладки
    });

    // Дополнительно слушаем правильное событие Bootstrap для переключения вкладок
    tabsTabButton.addEventListener('shown.bs.tab', async function() {
      console.log('Bootstrap событие shown.bs.tab - загружаем настройки вкладок');
      await loadTabsSettings();
    });
  } else {
    console.error('Кнопка вкладки настроек не найдена');
  }

  // Обработчик добавления новой вкладки
  const addNewTabBtn = document.getElementById('addNewTabBtn');
  if (addNewTabBtn) {
    console.log('Найдена кнопка добавления вкладки');
    addNewTabBtn.addEventListener('click', async function() {
      console.log('Клик по кнопке добавления вкладки');
      await addNewTab();
    });
  } else {
    console.error('Кнопка добавления вкладки не найдена');
  }
}

/**
 * Загружает список вкладок в настройки
 */
async function loadTabsSettings() {
  console.log('Загрузка настроек вкладок...');
  
  try {
    const response = await fetch('/api/v1/tabs/?active_only=false&limit=1000');
    console.log('Ответ от API:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки вкладок: ${response.status} ${response.statusText}`);
    }
    
    const tabs = await response.json();
    console.log('Загружено вкладок:', tabs.length);
    
    const container = document.getElementById('tabsSettingsList');
    if (!container) {
      console.error('Контейнер tabsSettingsList не найден');
      return;
    }
    
    if (tabs.length === 0) {
      container.innerHTML = '<div class="text-muted text-center">Нет вкладок для отображения</div>';
      return;
    }
    
    container.innerHTML = tabs.map(tab => `
      <div class="tab-setting-item" data-tab-id="${tab.id}">
        <div class="tab-name-display">${tab.name}</div>
        <div class="d-flex gap-2 align-items-center">
          <select class="form-select form-select-sm main-tab-select" data-tab-id="${tab.id}">
            <option value="" ${!tab.main_tab_type ? 'selected' : ''}>Не назначено</option>
            <option value="apple" ${tab.main_tab_type === 'apple' ? 'selected' : ''}>🍎 Apple</option>
            <option value="android" ${tab.main_tab_type === 'android' ? 'selected' : ''}>🤖 Android</option>
          </select>
          <button class="btn btn-sm btn-outline-danger delete-tab-btn" data-tab-id="${tab.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    // Добавляем обработчики изменений
    const selects = container.querySelectorAll('.main-tab-select');
    console.log('Найдено селектов главных вкладок:', selects.length);
    
    selects.forEach(select => {
      select.addEventListener('change', async function() {
        const tabId = this.dataset.tabId;
        const mainTabType = this.value || null;
        console.log(`Изменение главной вкладки для ID ${tabId} на ${mainTabType}`);
        await updateTabMainType(tabId, mainTabType);
      });
    });

    // Добавляем обработчики удаления
    container.querySelectorAll('.delete-tab-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const tabId = this.dataset.tabId;
        if (confirm('Удалить эту вкладку?')) {
          await deleteTab(tabId);
          await loadTabsSettings();
        }
      });
    });

  } catch (error) {
    console.error('Ошибка загрузки настроек вкладок:', error);
  }
}

/**
 * Обновляет тип главной вкладки
 */
async function updateTabMainType(tabId, mainTabType) {
  console.log(`Отправка запроса на обновление вкладки ${tabId} с типом ${mainTabType}`);
  
  try {
    const response = await fetch(`/api/v1/tabs/${tabId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        main_tab_type: mainTabType
      })
    });

    console.log(`Ответ сервера: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const result = await response.json();
      console.log('Результат обновления:', result);
      console.log(`✅ Успешно обновлен тип главной вкладки для вкладки ${tabId}: ${mainTabType}`);
      
      // Перезагружаем систему вкладок если изменения касаются текущей главной вкладки
      if (tabsManager) {
        console.log('Перезагрузка системы вкладок...');
        tabsManager.loadTabs();
      }
    } else {
      const errorText = await response.text();
      console.error(`Ошибка ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.error('Ошибка обновления типа главной вкладки:', error);
  }
}

/**
 * Добавляет новую вкладку
 */
async function addNewTab() {
  const name = prompt('Название новой вкладки:');
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
      await loadTabsSettings();
      
      // Перезагружаем систему вкладок
      if (tabsManager) {
        tabsManager.loadTabs();
      }
    }
  } catch (error) {
    console.error('Ошибка создания вкладки:', error);
  }
}

/**
 * Удаляет вкладку
 */
async function deleteTab(tabId) {
  try {
    const response = await fetch(`/api/v1/tabs/${tabId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      // Перезагружаем систему вкладок
      if (tabsManager) {
        tabsManager.loadTabs();
      }
    }
  } catch (error) {
    console.error('Ошибка удаления вкладки:', error);
  }
}

/**
 * Инициализирует модальное окно настроек
 */
function initColumnsModal() {
  const modal = document.getElementById('columnsModal');
  if (!modal) {
    console.error('Модальное окно настроек не найдено');
    return;
  }

  modal.addEventListener('shown.bs.modal', function() {
    console.log('Модальное окно настроек открыто');
    
    // Загружаем вкладки сразу при открытии модального окна
    const tabsTab = document.getElementById('tabs');
    if (tabsTab && tabsTab.classList.contains('active')) {
      console.log('Вкладка "Вкладки" уже активна - загружаем настройки');
      loadTabsSettings();
    }
  });

  // Дополнительно слушаем переключение на вкладку "Вкладки"
  const tabsTabButton = document.getElementById('tabs-tab');
  if (tabsTabButton) {
    tabsTabButton.addEventListener('shown.bs.tab', function() {
      console.log('Переключение на вкладку "Вкладки" - загружаем настройки');
      loadTabsSettings();
    });
  }
}


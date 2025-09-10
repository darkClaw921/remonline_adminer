const API_BASE = '/api/v1';
// Склады из API (будут загружены при инициализации)
let TARGET_WAREHOUSES = [];

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
    
    // Обновляем UI элементы
    document.getElementById('wh-list').textContent = TARGET_WAREHOUSES.map(w => `${w.title} (${w.remonline_id})`).join(', ');
    updateWarehouseFilterOptions();
    updateSortOptions();
  } catch (e) {
    console.error('Failed to load warehouses:', e);
    // Fallback к хардкоду при ошибке
    TARGET_WAREHOUSES = [
      { remonline_id: 2272079, title: '29. Склад Китай' },
      { remonline_id: 52226,  title: '05. Виртуальный склад' },
      { remonline_id: 37746,  title: '01. Запчасти Ростов' },
    ];
    document.getElementById('wh-list').textContent = TARGET_WAREHOUSES.map(w => `${w.title} (${w.remonline_id})`).join(', ');
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

document.getElementById('prevBtn').addEventListener('click', () => {
  if (state.page > 1 && !state.isLoading) {
    state.page -= 1;
    loadPage(state.filters.warehouses.length > 0 || 
             state.filters.categories.length > 0 || 
             state.filters.priceMin !== null || 
             state.filters.priceMax !== null || 
             state.filters.stockMin !== null || 
             state.filters.stockMax !== null);
  }
});
document.getElementById('nextBtn').addEventListener('click', () => {
  if (state.hasMore && !state.isLoading) {
    state.page += 1;
    loadPage(state.filters.warehouses.length > 0 || 
             state.filters.categories.length > 0 || 
             state.filters.priceMin !== null || 
             state.filters.priceMax !== null || 
             state.filters.stockMin !== null || 
             state.filters.stockMax !== null);
  }
});

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
  loadPage(true); // Используем серверные фильтры
});

resetBtn?.addEventListener('click', () => {
  // Сброс UI
  if (categoryFilterEl) Array.from(categoryFilterEl.options).forEach(o => o.selected = false);
  if (warehouseFilterEl) Array.from(warehouseFilterEl.options).forEach(o => o.selected = false);
  if (priceMinEl) priceMinEl.value = '';
  if (priceMaxEl) priceMaxEl.value = '';
  if (stockMinEl) stockMinEl.value = '';
  if (stockMaxEl) stockMaxEl.value = '';
  if (sortByEl) sortByEl.value = 'name';
  if (sortOrderEl) sortOrderEl.value = 'desc';
  // Сброс состояния
  state.filters = { categories: [], warehouses: [], priceMin: null, priceMax: null, stockMin: null, stockMax: null, sortBy: 'name', sortOrder: 'desc' };
  state.page = 1;
  loadPage(false); // Загружаем без фильтров
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
    th.textContent = w.title;
    tableHeader.appendChild(th);
  }
}

function renderSummary(productsWithStocks) {
  const container = document.getElementById('summary');
  container.innerHTML = '';
  
  // Определяем какие склады показывать: выбранные в фильтре или все
  const warehousesToShow = state.filters.warehouses.length > 0 
    ? TARGET_WAREHOUSES.filter(w => state.filters.warehouses.includes(w.remonline_id))
    : TARGET_WAREHOUSES;
  
  const totals = Object.fromEntries(warehousesToShow.map(w => [w.remonline_id, 0]));
  for (const p of productsWithStocks) {
    for (const w of warehousesToShow) {
      const qty = p.stocks[w.remonline_id] || 0;
      totals[w.remonline_id] += qty;
    }
  }
  for (const w of warehousesToShow) {
    const badge = document.createElement('span');
    badge.className = 'badge text-bg-light';
    badge.textContent = `${w.title}: ${totals[w.remonline_id]}`;
    container.appendChild(badge);
  }
}

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
    tr.innerHTML = `
      <td class="photos-col">
        <div class="thumbs">${(p.images || []).slice(0,3).map(u => `<img src="${escapeAttr(u.thumbnail || u)}" data-full="${escapeAttr(u.full || u)}" class="thumb" loading="lazy" alt="">`).join('')}</div>
      </td>
      <td class="name-col">
        <div class="product-menu-wrapper">
          <div class="name-wrap" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="sku">RemID: ${p.remonline_id ?? '-'} · SKU: ${escapeHtml(p.sku || '-')}</div>
          <div class="sku">Обновлено: ${formatDate(p.updated_at)}</div>
          <div class="product-menu" data-product-id="${p.id}">
            <div class="list-group list-group-flush">
              <div class="list-group-item" data-action="refresh">Обновить данные товара</div>
              <div class="list-group-item" data-action="open-api" data-url="/api/v1/products/${p.id}">Открыть в API</div>
            </div>
          </div>
        </div>
      </td>
      <td class="category-col">${escapeHtml(p.category || '-')}</td>
      <td class="text-end">${p.price != null ? p.price : '-'}</td>
      <td class="price-col text-end">${formatPrice(p.prices['48388'])}</td>
      <td class="price-col text-end">${formatPrice(p.prices['97150'])}</td>
      <td class="price-col text-end">${formatPrice(p.prices['377836'])}</td>
      <td class="price-col text-end">${formatPrice(p.prices['555169'])}</td>
      <td class="total-col text-end">${formatPrice(p.totalStock)}</td>
      ${warehousesToShow.map(w => `<td class="warehouse-col">${p.stocks[w.remonline_id] ?? 0}</td>`).join('')}
    `;
    fragment.appendChild(tr);
  }
  bodyEl.appendChild(fragment);
  attachImageHoverPreview();
  attachProductMenus();
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
  
  let url;
  if (useFilters) {
    // Используем новый endpoint с фильтрами
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', state.size);
    
    if (name) params.append('name', name);
    
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
    // Преобразуем значения сортировки для API
    let sortBy = f.sortBy || 'name';
    if (sortBy === 'total') sortBy = 'total_stock';
    if (sortBy.startsWith('wh_')) {
      // Уже в правильном формате для API
    }
    params.append('sort_by', sortBy);
    params.append('sort_order', f.sortOrder || 'desc');
    
    url = `${API_BASE}/products/filtered?${params.toString()}`;
  } else {
    // Используем старый endpoint без фильтров
    const nameQuery = name ? `&name=${name}` : '';
    url = `${API_BASE}/products/?skip=${skip}&limit=${state.size}${nameQuery}`;
  }
  
  if (state.isLoading) return;
  state.isLoading = true;
  loader.style.display = 'inline-block';
  try {
    const productsResp = await fetchJson(url);
    const products = (productsResp?.data) || [];

    // Ограничение конкурентности при загрузке остатков
    const concurrency = 6;
    const queue = products.map(p => async () => ({ product: p, stocks: await loadStocksForProduct(p.id) }));
    const results = await runLimited(queue, concurrency);

    const productsWithStocks = results.map(({ product, stocks }) => {
      // Определяем какие склады учитывать для общего остатка
      const warehousesToCount = state.filters.warehouses.length > 0 
        ? state.filters.warehouses
        : TARGET_WAREHOUSES.map(w => w.remonline_id);
      
      const totalStock = warehousesToCount.reduce((sum, whId) => sum + (Number(stocks[whId]) || 0), 0);
      
      return {
        id: product.id,
        remonline_id: product.remonline_id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        updated_at: product.updated_at,
        stocks: stocks,
        images: normalizeImageUrls(product.images_json),
        prices: normalizePrices(product.prices_json),
        totalStock: totalStock,
      };
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
    
    // Применяем фильтры и рендерим (только если не используем серверные фильтры)
    if (useFilters) {
      renderSummary(productsWithStocks);
      renderTable(productsWithStocks);
      const total = productsResp?.total || 0;
      pageInfo.textContent = `Найдено ${total} поз., страница ${state.page} из ${state.totalPages}`;
    } else {
      applyAndRender();
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
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort((a,b) => a.localeCompare(b));
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
  state.filters.sortBy = sortByEl?.value || 'name';
  state.filters.sortOrder = sortOrderEl?.value || 'desc';
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
  renderSummary(sorted);
  renderTable(sorted);
  const pageText = state.totalPages > 1 ? `, страница ${state.page}` : '';
  pageInfo.textContent = `Загружено ${state.totalLoaded} поз., в выборке: ${sorted.length}${pageText}`;
}

function filterProducts(products) {
  const f = state.filters;
  return products.filter(p => {
    // Фильтр по категориям (любой из выбранных)
    if (f.categories.length > 0 && !f.categories.includes(p.category || '')) return false;
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
  copy.sort((a, b) => {
    let va, vb;
    if (by === 'name') { va = a.name || ''; vb = b.name || ''; return va.localeCompare(vb) * dir; }
    if (by === 'category') { va = a.category || ''; vb = b.category || ''; return va.localeCompare(vb) * dir; }
    if (by === 'price') { va = Number(a.price) || 0; vb = Number(b.price) || 0; return (va - vb) * dir; }
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
    menu.addEventListener('mouseenter', () => { clearTimeout(hideTimer); });
    menu.addEventListener('mouseleave', scheduleHide);

    // Клики по пунктам
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.list-group-item');
      if (!item) return;
      const action = item.getAttribute('data-action');
      const productId = Number(menu.getAttribute('data-product-id'));
      if (action === 'refresh') {
        try {
          item.classList.add('disabled');
          item.classList.add('btn-progress');
          await refreshProductWithProgress(productId, item);
          await loadPage();
        } catch (err) {
          alert('Не удалось обновить товар');
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


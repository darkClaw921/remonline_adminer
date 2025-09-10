const API_BASE = '/api/v1';
// Целевые склады по remonline_id
const TARGET_WAREHOUSES = [
  { remonline_id: 2272079, title: '29. Склад Китай' },
  { remonline_id: 52226,  title: '05. Виртуальный склад' },
  { remonline_id: 37746,  title: '01. Запчасти Ростов' },
];

document.getElementById('wh-list').textContent = TARGET_WAREHOUSES.map(w => `${w.title} (${w.remonline_id})`).join(', ');

let state = {
  page: 1,
  size: 50,
  totalLoaded: 0,
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
  state.page = 1;
  loadPage();
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (state.page > 1) { state.page -= 1; loadPage(); }
});
document.getElementById('nextBtn').addEventListener('click', () => {
  state.page += 1; loadPage();
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
  applyAndRender();
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
  applyAndRender();
});

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function renderSummary(productsWithStocks) {
  const container = document.getElementById('summary');
  container.innerHTML = '';
  const totals = Object.fromEntries(TARGET_WAREHOUSES.map(w => [w.remonline_id, 0]));
  for (const p of productsWithStocks) {
    for (const w of TARGET_WAREHOUSES) {
      const qty = p.stocks[w.remonline_id] || 0;
      totals[w.remonline_id] += qty;
    }
  }
  for (const w of TARGET_WAREHOUSES) {
    const badge = document.createElement('span');
    badge.className = 'badge text-bg-light';
    badge.textContent = `${w.title}: ${totals[w.remonline_id]}`;
    container.appendChild(badge);
  }
}

function renderTable(productsWithStocks) {
  bodyEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
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
      ${TARGET_WAREHOUSES.map(w => `<td class="warehouse-col">${p.stocks[w.remonline_id] ?? 0}</td>`).join('')}
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

async function loadPage() {
  const skip = (state.page - 1) * state.size;
  const name = encodeURIComponent(document.getElementById('searchInput').value.trim());
  const nameQuery = name ? `&name=${name}` : '';
  const url = `${API_BASE}/products/?skip=${skip}&limit=${state.size}${nameQuery}`;
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

    const productsWithStocks = results.map(({ product, stocks }) => ({
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
      totalStock: Object.values(stocks || {}).reduce((a, b) => a + (Number(b) || 0), 0),
    }));

    // При первой загрузке сбрасываем коллекцию
    if (state.page === 1) state.allProducts = [];
    state.allProducts = state.allProducts.concat(productsWithStocks);
    state.currentProducts = state.allProducts;
    state.totalLoaded = state.allProducts.length;
    updateCategoryOptions(state.currentProducts);
    state.hasMore = products.length === state.size;
    // Применяем фильтры и рендерим
    applyAndRender();
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
  return Array.from(selectEl.selectedOptions).map(o => o.value).filter(v => v !== '');
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
  pageInfo.textContent = `Загружено ${state.totalLoaded} поз., в выборке: ${sorted.length}${state.hasMore ? ' (есть ещё)' : ''}`;
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

// Бесконечная прокрутка
function onScrollContainer() {
  if (!tableContainer || state.isLoading || !state.hasMore) return;
  const threshold = 120; // px до низа
  const scrollBottom = tableContainer.scrollHeight - tableContainer.scrollTop - tableContainer.clientHeight;
  if (scrollBottom <= threshold) {
    state.page += 1;
    loadPage();
  }
}

tableContainer?.addEventListener('scroll', debounce(onScrollContainer, 150));

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
          state.page = 1; state.hasMore = true; state.allProducts = []; await loadPage();
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

  for (const wh of warehouses) {
    try {
      await fetch(`${API_BASE}/products/${productId}/refresh?warehouse_id=${encodeURIComponent(wh.remonline_id)}`, { method: 'POST' });
    } catch {}
    done += 1;
    const pct = Math.min(100, Math.round((done / total) * 100));
    buttonEl.style.setProperty('--progress', pct + '%');
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
    if (!TARGET_WAREHOUSES.some(w => w.remonline_id === whRemId)) continue;
    map[whRemId] = (map[whRemId] || 0) + (it.available_quantity ?? 0);
  }
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

loadPage();


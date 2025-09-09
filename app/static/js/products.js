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
};

const loader = document.getElementById('loader');
const bodyEl = document.getElementById('productsBody');
const pageInfo = document.getElementById('pageInfo');

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
        <div class="name-wrap" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="sku">RemID: ${p.remonline_id ?? '-'} · SKU: ${escapeHtml(p.sku || '-')}</div>
        <div class="sku">Обновлено: ${formatDate(p.updated_at)}</div>
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

    renderSummary(productsWithStocks);
    renderTable(productsWithStocks);
    state.totalLoaded = products.length;
    pageInfo.textContent = `Страница ${state.page}, загружено ${products.length} поз.`;
  } catch (e) {
    console.error(e);
    alert('Ошибка загрузки данных');
  } finally {
    loader.style.display = 'none';
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


const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readStore(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast('Browser storage is unavailable. Changes last for this visit.');
  }
}

let saved = readStore('dormmart-saved', []).filter(Number.isInteger);
let requests = readStore('dormmart-requests', []).filter(x => x && Number.isInteger(x.itemId) && typeof x.id === 'string');
let customListings = readStore('dormmart-custom-listings', []).filter(x => x && Number.isInteger(x.id));
let toastTimer;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

function getAllListings() {
  return [...customListings, ...LISTINGS];
}

function getCategories() {
  return [...new Set(getAllListings().map(x => x.category))];
}

function updateCategoryDropdown() {
  const currentVal = $('#category').value || 'all';
  const cats = getCategories();
  $('#category').innerHTML = '<option value="all">All categories</option>' + cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if (cats.includes(currentVal) || currentVal === 'all') {
    $('#category').value = currentVal;
  }
}

function renderCategoryChips() {
  const cats = ['Everything', ...getCategories()];
  const currentCat = $('#category') ? $('#category').value : 'all';

  const makeChip = (cat, isActive) => `
    <button type="button" class="chip ${isActive ? 'active' : ''}" data-category="${cat === 'Everything' ? 'all' : escapeHTML(cat)}">
      ${cat === 'Everything' ? '✳ ' : ''}${escapeHTML(cat)}
    </button>
  `;

  $('#home-categories').innerHTML = cats.map(c => {
    const val = c === 'Everything' ? 'all' : c;
    return makeChip(c, val === currentCat);
  }).join('');

  const exploreChips = $('#explore-categories');
  if (exploreChips) {
    exploreChips.innerHTML = cats.map(c => {
      const val = c === 'Everything' ? 'all' : c;
      return makeChip(c, val === currentCat);
    }).join('');
  }
}

function card(x) {
  const isSaved = saved.includes(x.id);
  const badgeText = x.isCustom ? 'YOUR LISTING' : x.mode === 'share' ? 'FREE TO SHARE' : x.mode === 'rent' ? 'FOR RENT' : 'FOR SALE';
  const badgeClass = x.isCustom ? 'mode-badge user-badge' : 'mode-badge';
  const modeSub = x.mode === 'rent' ? '/ day' : x.mode === 'share' ? 'to borrow' : 'to keep';

  return `
    <article class="card">
      <div class="item-art" style="--item-color:${escapeHTML(x.color || '#e0e5d9')}" aria-hidden="true">
        <span>${escapeHTML(x.emoji || '📦')}</span>
      </div>
      <span class="${badgeClass}">${badgeText}</span>
      <button type="button" class="save" data-save="${x.id}" aria-label="Save ${escapeHTML(x.title)}" aria-pressed="${isSaved}">
        ${isSaved ? '♥' : '♡'}
      </button>
      <div class="card-body">
        <div class="card-meta">
          <span>${escapeHTML(x.category)}</span>
          <span>◎ ${x.distance} km away</span>
        </div>
        <h3><a class="card-link" href="#item-${x.id}">${escapeHTML(x.title)}</a></h3>
        <div class="card-price">
          ${x.price ? money(x.price) : 'Free'} <small>${modeSub}</small>
        </div>
        <div class="seller">
          <span>${escapeHTML(x.owner)} ${x.verified ? '<span class="verified">✓ Email verified</span>' : ''}</span>
          <span>${x.reviews ? '★ ' + x.rating + ' (' + x.reviews + ')' : '★ New (0)'}</span>
        </div>
      </div>
    </article>
  `;
}

function filters() {
  return {
    query: $('#query').value,
    mode: $('#mode').value,
    category: $('#category').value,
    radius: Number($('#radius').value),
    price: $('#price').value,
    verified: $('#verified').checked,
    saved: $('#saved').checked,
    sort: $('#sort').value
  };
}

function renderActiveFiltersBar(f) {
  const bar = $('#active-filters-bar');
  if (!bar) return;

  const tags = [];
  if (f.query.trim()) {
    tags.push(`<span class="filter-tag">Search: "${escapeHTML(f.query.trim())}" <button type="button" data-clear-filter="query" aria-label="Remove search filter">×</button></span>`);
  }
  if (f.mode !== 'all') {
    const label = f.mode === 'rent' ? 'Rent only' : f.mode === 'buy' ? 'Buy only' : 'Free share only';
    tags.push(`<span class="filter-tag">${label} <button type="button" data-clear-filter="mode" aria-label="Remove mode filter">×</button></span>`);
  }
  if (f.category !== 'all') {
    tags.push(`<span class="filter-tag">Category: ${escapeHTML(f.category)} <button type="button" data-clear-filter="category" aria-label="Remove category filter">×</button></span>`);
  }
  if (f.radius < 5) {
    tags.push(`<span class="filter-tag">Within ${f.radius} km <button type="button" data-clear-filter="radius" aria-label="Reset radius">×</button></span>`);
  }
  if (f.price !== '') {
    tags.push(`<span class="filter-tag">Under ${money(f.price)} <button type="button" data-clear-filter="price" aria-label="Remove price filter">×</button></span>`);
  }
  if (f.verified) {
    tags.push(`<span class="filter-tag">Email verified only <button type="button" data-clear-filter="verified" aria-label="Remove verified filter">×</button></span>`);
  }
  if (f.saved) {
    tags.push(`<span class="filter-tag">Saved items only <button type="button" data-clear-filter="saved" aria-label="Remove saved filter">×</button></span>`);
  }

  if (tags.length > 0) {
    bar.innerHTML = tags.join('') + `<button type="button" class="clear-all-btn" id="clear-all-filters-btn">Clear all</button>`;
    bar.hidden = false;
  } else {
    bar.innerHTML = '';
    bar.hidden = true;
  }
}

function render() {
  const f = filters();
  const all = getAllListings();
  const items = filterListings(all, f, saved);

  $('#results').innerHTML = items.map(card).join('');
  $('#result-count').textContent = `${items.length} ${items.length === 1 ? 'find' : 'finds'} nearby`;
  $('#empty').hidden = items.length > 0;
  $('#radius-value').value = $('#radius').value;
  $('#saved-count').textContent = saved.length;

  const clearSearchBtn = $('#clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.hidden = !$('#query').value.trim();
  }

  renderCategoryChips();
  renderActiveFiltersBar(f);

  // Home featured items
  $('#featured').innerHTML = all.slice(0, 4).map(card).join('');
}

// Filter listeners
$('#filters').addEventListener('input', render);
$('#filters').addEventListener('submit', e => e.preventDefault());
$('#filters').addEventListener('reset', () => setTimeout(() => {
  $('#radius').value = 5;
  render();
}, 0));

// Clear single filter delegate
$('#active-filters-bar')?.addEventListener('click', e => {
  const clearBtn = e.target.closest('[data-clear-filter]');
  if (clearBtn) {
    const key = clearBtn.dataset.clearFilter;
    if (key === 'query') $('#query').value = '';
    else if (key === 'mode') $('#mode').value = 'all';
    else if (key === 'category') $('#category').value = 'all';
    else if (key === 'radius') $('#radius').value = 5;
    else if (key === 'price') $('#price').value = '';
    else if (key === 'verified') $('#verified').checked = false;
    else if (key === 'saved') $('#saved').checked = false;
    render();
    return;
  }
  if (e.target.id === 'clear-all-filters-btn') {
    $('#filters').reset();
    $('#radius').value = 5;
    render();
  }
});

// Clear search button in input
$('#clear-search-btn')?.addEventListener('click', () => {
  $('#query').value = '';
  $('#query').focus();
  render();
});

// Hero search form
$('#hero-search').addEventListener('submit', e => {
  e.preventDefault();
  const val = new FormData(e.target).get('query') || '';
  $('#query').value = val;
  location.hash = 'explore';
  render();
});

// Category chip clicks (Home & Explore)
function handleCategoryClick(e) {
  const b = e.target.closest('[data-category]');
  if (!b) return;
  $('#category').value = b.dataset.category;
  location.hash = 'explore';
  render();
}

$('#home-categories').addEventListener('click', handleCategoryClick);
$('#explore-categories')?.addEventListener('click', handleCategoryClick);

// Save / Favorite item toggle
document.addEventListener('click', e => {
  const b = e.target.closest('[data-save]');
  if (!b) return;
  const id = Number(b.dataset.save);
  saved = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
  persist('dormmart-saved', saved);
  render();

  const targetSelector = lastPage === 'explore' ? '#results' : '#featured';
  document.querySelector(`${targetSelector} [data-save="${id}"]`)?.focus();
  toast(saved.includes(id) ? 'Saved for later.' : 'Removed from saved items.');
});

// Header saved button
$('#saved-button').onclick = () => {
  $('#saved').checked = true;
  location.hash = 'explore';
  render();
};

let returnFocus = null;
let lastPage = 'home';

function showModal(html) {
  if (!$('#modal').open) returnFocus = document.activeElement;
  $('#modal-body').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
}

function closeModal() {
  $('#modal').close();
  if (location.hash.startsWith('#item-')) {
    history.replaceState(null, '', '#' + lastPage);
  }
  returnFocus?.focus();
}

$('.close').onclick = closeModal;
$('#modal').addEventListener('cancel', e => {
  e.preventDefault();
  closeModal();
});

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}

// Item detail modal
function openItem(id) {
  const x = getAllListings().find(item => item.id === id);
  if (!x) return;

  const rental = x.mode === 'rent';
  const borrow = x.mode !== 'buy';
  const isCustom = Boolean(x.isCustom);

  showModal(`
    <p class="eyebrow">${escapeHTML(x.category)} · ${escapeHTML(x.condition || 'Good')}</p>
    <h2 id="modal-title">${escapeHTML(x.title)}</h2>

    <div class="item-art detail-art" style="--item-color:${escapeHTML(x.color || '#e0e5d9')}" aria-hidden="true">
      <span>${escapeHTML(x.emoji || '📦')}</span>
    </div>

    <div class="trust-badges-row">
      ${x.verified ? '<span class="badge-chip badge-email">✓ Email verified</span>' : '<span class="badge-chip">Email not verified</span>'}
      ${x.student ? '<span class="badge-chip badge-student">🎓 Student affiliation reviewed</span>' : ''}
      <span class="badge-chip badge-condition">Condition: ${escapeHTML(x.condition || 'Good')}</span>
      <span class="badge-chip badge-pickup">◎ ${x.pickupSpot ? escapeHTML(x.pickupSpot) : 'Campus Gate pickup'}</span>
    </div>

    <p>${escapeHTML(x.description)}</p>

    <div class="trust-passport">
      <h4>🛡 Campus Trust & Safety Notes</h4>
      <p>
        <strong>${escapeHTML(x.owner)}</strong> is located ~${x.distance} km away · ${x.reviews ? '★ ' + x.rating + ' from ' + x.reviews + ' demo reviews' : '★ First time listing'}.
        <br>All meetups take place at designated public campus spots during daylight. Never transfer an original identity card or passport as collateral.
      </p>
    </div>

    <form class="detail-form" id="booking-form">
      ${borrow ? `
        <div class="detail-grid">
          <label>Pickup date
            <input required type="date" name="start" min="${localDate()}" value="${localDate()}">
          </label>
          <label>Return date
            <input required type="date" name="end" min="${nextDate()}" value="${nextDate()}">
          </label>
        </div>
      ` : ''}

      ${rental ? `
        <label>Security option
          <select name="security">
            <option value="deposit">Refundable deposit — ${money(x.deposit)}</option>
            ${x.alternative ? '<option value="guarantor">Request a guarantor instead — owner approval needed</option>' : ''}
          </select>
        </label>
      ` : ''}

      <div class="quote" id="quote" aria-live="polite"></div>

      <p class="notice">
        ${rental ? 'Deposit return follows confirmed return and condition review. A guarantor is only a proposed alternative, subject to owner approval. ' : ''}
        Pickup arranged at the campus main gate after agreement. No private address is shared.
        ${borrow ? 'Requests do not reserve dates until owner accepts.' : 'Purchase interest does not reserve the item.'}
      </p>

      <label class="check">
        <input type="checkbox" required> I understand this is a demo request; no payment is collected.
      </label>

      <button class="button" type="submit">
        ${x.mode === 'buy' ? 'Send purchase interest' : 'Request ' + (rental ? 'rental' : 'to borrow')} ↗
      </button>

      <p class="micro">
        ${borrow ? '1–' + (rental ? '30' : '7') + ' days · minimum one full day · zero platform fees in this demo' : 'Owner confirmation is required before arranging pickup.'}
      </p>

      ${isCustom ? `
        <div style="margin-top:16px; border-top:1px solid var(--line); padding-top:12px; text-align:right;">
          <button type="button" class="text-btn" id="delete-custom-listing" style="color:#b3261e;">🗑 Delete my listing</button>
        </div>
      ` : ''}
    </form>
  `);

  if (isCustom) {
    $('#delete-custom-listing')?.addEventListener('click', () => {
      if (confirm(`Remove "${x.title}" from your published listings?`)) {
        customListings = customListings.filter(item => item.id !== x.id);
        persist('dormmart-custom-listings', customListings);
        closeModal();
        updateCategoryDropdown();
        render();
        toast('Listing removed.');
      }
    });
  }

  const form = $('#booking-form');
  function quote() {
    const data = new FormData(form);
    let days = borrow ? (Date.parse(data.get('end')) - Date.parse(data.get('start'))) / 86400000 : 1;
    const valid = !borrow || (data.get('start') >= localDate() && Number.isInteger(days) && days >= 1 && days <= (rental ? 30 : 7));

    if (borrow) {
      form.elements.end.setCustomValidity(valid ? '' : 'Choose a future pickup and a return 1–' + (rental ? 30 : 7) + ' days later.');
    }

    const security = data.get('security');
    const q = calculateQuote(x, days, security);

    $('#quote').innerHTML = valid ? `
      ${rental ? `${days} day${days === 1 ? '' : 's'} × ${money(x.price)}` : x.mode === 'buy' ? 'Item price' : 'Sharing fee'}
      <strong>${money(q.fee)}</strong><br>
      Refundable security<strong>${money(q.deposit)}</strong>
      <hr>
      Estimated total<strong>${money(q.total)}</strong>
      ${security === 'guarantor' ? '<p class="micro">Conditional estimate: deposit waived only if the owner accepts the guarantor.</p>' : ''}
    ` : 'Select valid dates to see your estimate.';

    return { valid, days, security, q, data };
  }

  form.addEventListener('input', quote);
  quote();

  form.onsubmit = e => {
    e.preventDefault();
    const z = quote();
    if (!z.valid || !form.reportValidity()) return;

    const request = {
      id: 'DM-' + Date.now().toString(36).toUpperCase(),
      itemId: x.id,
      itemTitle: x.title,
      start: z.data.get('start') || null,
      end: z.data.get('end') || null,
      security: z.security || 'none',
      total: z.q.total,
      status: 'Pending owner acceptance',
      createdAt: new Date().toLocaleDateString('en-IN')
    };

    requests.unshift(request);
    persist('dormmart-requests', requests);

    showModal(`
      <p class="eyebrow">DEMO REQUEST SENT</p>
      <h2 id="modal-title">Good things start here.</h2>
      <p>Your request for <strong>${escapeHTML(x.title)}</strong> is pending owner acceptance.</p>
      <div class="quote">
        Reference <strong>${request.id}</strong><br>
        Estimated total <strong>${money(z.q.total)}</strong>
      </div>
      <p class="notice">
        Nothing has been charged or reserved. This request is saved in this browser. In a live system, ${escapeHTML(x.owner)} would receive a notification now.
      </p>
      <button class="button" id="done">Keep exploring ↗</button>
    `);
    $('#done').onclick = closeModal;
  };
}

// "List an item" flow
$('#list-button').onclick = () => {
  let selectedEmoji = '📷';
  let selectedColor = '#dce2d3';

  showModal(`
    <p class="eyebrow">LEND · SELL · SHARE</p>
    <h2 id="modal-title">List an item for your campus neighbours</h2>
    <p class="micro">Give something useful a next chapter. No listing fees, verified campus pickup.</p>

    <form class="create-form" id="create-item-form">
      <div class="form-row">
        <label>Listing type
          <select name="mode" id="new-item-mode" required>
            <option value="rent">For Rent (daily fee + deposit)</option>
            <option value="buy">For Sale (one-time buy)</option>
            <option value="share">Free Share (community lending)</option>
          </select>
        </label>
        <label>Category
          <select name="category" id="new-item-category" required>
            <option value="Electronics">Electronics</option>
            <option value="Furniture">Furniture</option>
            <option value="Outdoors">Outdoors</option>
            <option value="Books">Books</option>
            <option value="Music">Music</option>
            <option value="Study">Study Supplies</option>
            <option value="Kitchen">Kitchen & Dorm</option>
          </select>
        </label>
      </div>

      <label>Item Title
        <input name="title" required placeholder="e.g. TI-84 Plus CE Calculator or Standing Fan" maxlength="60">
      </label>

      <div class="form-row" id="price-fields">
        <label id="price-label">Price (₹ / day)
          <input type="number" name="price" id="new-item-price" min="0" placeholder="e.g. 150" required value="120">
        </label>
        <label id="deposit-label">Refundable deposit (₹)
          <input type="number" name="deposit" id="new-item-deposit" min="0" placeholder="e.g. 500" value="500">
        </label>
      </div>

      <div id="guarantor-group">
        <label class="check">
          <input type="checkbox" name="alternative" id="new-item-alternative" checked>
          Allow guarantor alternative instead of cash deposit
        </label>
      </div>

      <div class="form-row">
        <label>Condition
          <select name="condition" required>
            <option value="Like new">Like new</option>
            <option value="Excellent" selected>Excellent</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
          </select>
        </label>
        <label>Pickup proximity
          <select name="distance">
            <option value="0.3">0.3 km (North Hostel Block)</option>
            <option value="0.6" selected>0.6 km (Campus Main Gate)</option>
            <option value="1.2">1.2 km (Central Library)</option>
            <option value="2.5">2.5 km (Presidency Neighbourhood)</option>
          </select>
        </label>
      </div>

      <label>Card artwork & color
        <div class="art-picker">
          <div class="emoji-picker" id="emoji-picker">
            <button type="button" class="emoji-opt selected" data-emoji="📷">📷</button>
            <button type="button" class="emoji-opt" data-emoji="🪑">🪑</button>
            <button type="button" class="emoji-opt" data-emoji="🚲">🚲</button>
            <button type="button" class="emoji-opt" data-emoji="📚">📚</button>
            <button type="button" class="emoji-opt" data-emoji="🎸">🎸</button>
            <button type="button" class="emoji-opt" data-emoji="🧮">🧮</button>
            <button type="button" class="emoji-opt" data-emoji="🏸">🏸</button>
            <button type="button" class="emoji-opt" data-emoji="💡">💡</button>
            <button type="button" class="emoji-opt" data-emoji="⛺">⛺</button>
            <button type="button" class="emoji-opt" data-emoji="🎒">🎒</button>
            <button type="button" class="emoji-opt" data-emoji="🎧">🎧</button>
            <button type="button" class="emoji-opt" data-emoji="🛹">🛹</button>
          </div>
          <div class="color-picker" id="color-picker">
            <button type="button" class="color-opt selected" data-color="#dce2d3" style="background:#dce2d3" title="Sage Green"></button>
            <button type="button" class="color-opt" data-color="#f0d5ba" style="background:#f0d5ba" title="Peach"></button>
            <button type="button" class="color-opt" data-color="#dce4eb" style="background:#dce4eb" title="Sky Blue"></button>
            <button type="button" class="color-opt" data-color="#e9dfcc" style="background:#e9dfcc" title="Warm Sand"></button>
            <button type="button" class="color-opt" data-color="#ead4c7" style="background:#ead4c7" title="Terracotta"></button>
            <button type="button" class="color-opt" data-color="#efdfbd" style="background:#efdfbd" title="Butter"></button>
          </div>
        </div>
      </label>

      <label>Description & notes
        <textarea name="description" rows="3" required placeholder="Describe what is included, any cables or accessories, and preferred pickup hours." maxlength="250">Well-maintained and ready for use. Available for handover at the campus gate.</textarea>
      </label>

      <div class="form-row">
        <label>Your display name
          <input name="owner" required placeholder="e.g. Priya S." value="Priya (Student)">
        </label>
        <label>Pickup meetup spot
          <input name="pickupSpot" placeholder="e.g. Main Gate 1" value="Campus Main Gate">
        </label>
      </div>

      <div class="trust-checks">
        <label class="check">
          <input type="checkbox" name="verified" checked>
          Display "✓ Email verified" badge
        </label>
        <label class="check">
          <input type="checkbox" name="student" checked>
          Display "🎓 Student affiliation reviewed" badge
        </label>
      </div>

      <div class="notice">
        <strong>Demo notice:</strong> Your listing will be published locally into this browser demo. It will immediately appear on Home and Explore.
      </div>

      <div class="form-actions">
        <button type="button" class="text-btn" id="cancel-create-btn">Cancel</button>
        <button type="submit" class="button">Publish listing ↗</button>
      </div>
    </form>
  `);

  $('#cancel-create-btn')?.addEventListener('click', closeModal);

  // Dynamic price labels based on mode
  const modeSelect = $('#new-item-mode');
  const priceLabel = $('#price-label');
  const depositLabel = $('#deposit-label');
  const guarantorGroup = $('#guarantor-group');
  const priceInput = $('#new-item-price');
  const depositInput = $('#new-item-deposit');

  modeSelect.addEventListener('change', () => {
    const m = modeSelect.value;
    if (m === 'rent') {
      priceLabel.innerHTML = 'Price (₹ / day) <input type="number" name="price" id="new-item-price" min="0" placeholder="e.g. 150" required value="120">';
      depositLabel.style.display = 'block';
      guarantorGroup.style.display = 'block';
      depositInput.value = '500';
    } else if (m === 'buy') {
      priceLabel.innerHTML = 'Total price (₹) <input type="number" name="price" id="new-item-price" min="0" placeholder="e.g. 800" required value="500">';
      depositLabel.style.display = 'none';
      guarantorGroup.style.display = 'none';
      depositInput.value = '0';
    } else {
      priceLabel.innerHTML = 'Community Sharing <input type="number" name="price" id="new-item-price" value="0" readonly>';
      depositLabel.style.display = 'none';
      guarantorGroup.style.display = 'none';
      depositInput.value = '0';
    }
  });

  // Emoji picker
  $('#emoji-picker').addEventListener('click', e => {
    const btn = e.target.closest('.emoji-opt');
    if (!btn) return;
    $$('#emoji-picker .emoji-opt').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    selectedEmoji = btn.dataset.emoji;
  });

  // Color picker
  $('#color-picker').addEventListener('click', e => {
    const btn = e.target.closest('.color-opt');
    if (!btn) return;
    $$('#color-picker .color-opt').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    selectedColor = btn.dataset.color;
  });

  // Form submission
  $('#create-item-form').onsubmit = e => {
    e.preventDefault();
    const data = new FormData(e.target);
    const m = data.get('mode');

    const newListing = {
      id: Date.now(),
      title: data.get('title').trim(),
      category: data.get('category'),
      mode: m,
      price: m === 'share' ? 0 : Number(data.get('price')) || 0,
      deposit: m === 'rent' ? Number(data.get('deposit')) || 0 : 0,
      distance: Number(data.get('distance')) || 0.5,
      owner: data.get('owner').trim() || 'Student',
      verified: data.get('verified') === 'on',
      student: data.get('student') === 'on',
      reviews: 0,
      rating: null,
      emoji: selectedEmoji,
      color: selectedColor,
      condition: data.get('condition'),
      description: data.get('description').trim(),
      alternative: m === 'rent' && data.get('alternative') === 'on',
      pickupSpot: data.get('pickupSpot').trim() || 'Campus Main Gate',
      isCustom: true
    };

    customListings.unshift(newListing);
    persist('dormmart-custom-listings', customListings);

    updateCategoryDropdown();
    render();
    closeModal();
    toast(`Published "${newListing.title}" to DormMart!`);

    // Jump to the item
    setTimeout(() => {
      openItem(newListing.id);
    }, 200);
  };
};

// "My demo requests" modal
$('#requests-button').onclick = () => {
  const all = getAllListings();
  showModal(`
    <p class="eyebrow">SAVED IN THIS BROWSER</p>
    <h2 id="modal-title">Your demo requests</h2>
    ${requests.length ? `
      ${requests.map(r => {
        const x = all.find(item => item.id === r.itemId);
        const isPending = r.status === 'Pending owner acceptance';
        const isAccepted = r.status === 'Accepted by owner';
        const statusClass = isAccepted ? 'status-accepted' : isPending ? 'status-pending' : 'status-cancelled';

        return `
          <article class="request">
            <div class="request-header">
              <h3>${x ? escapeHTML(x.emoji + ' ' + x.title) : 'Item #' + r.itemId}</h3>
              <span class="status-pill ${statusClass}">${escapeHTML(r.status)}</span>
            </div>
            <p class="micro">
              Reference: <strong>${escapeHTML(r.id)}</strong><br>
              ${r.start ? `Dates: ${escapeHTML(r.start)} → ${escapeHTML(r.end)}<br>` : ''}
              Security: ${escapeHTML(r.security === 'guarantor' ? 'Guarantor waiver' : r.security === 'deposit' ? 'Refundable deposit' : 'None')}<br>
              Estimated total: <strong>${money(Number(r.total) || 0)}</strong>
            </p>

            ${isAccepted ? `
              <div class="accepted-box">
                <strong>✓ Meetup Confirmed:</strong> Meet ${escapeHTML(x?.owner || 'owner')} tomorrow at ${escapeHTML(x?.pickupSpot || 'Campus Main Gate')}. Inspect the item before exchanging security.
              </div>
            ` : ''}

            <div class="request-actions">
              ${isPending ? `
                <button type="button" class="button small" data-simulate-accept="${escapeHTML(r.id)}">⚡ Simulate owner acceptance</button>
                <button type="button" class="text-btn" data-cancel="${escapeHTML(r.id)}">Cancel request</button>
              ` : ''}
            </div>
          </article>
        `;
      }).join('')}
      <div style="text-align:right; margin-top:16px;">
        <button type="button" class="text-btn" id="clear-requests-btn">Clear demo request history</button>
      </div>
    ` : '<p>No requests yet. Explore the campus catalogue and try sending a demo booking request.</p>'}
  `);

  $('#clear-requests-btn')?.addEventListener('click', () => {
    if (confirm('Clear all demo requests from this browser?')) {
      requests = [];
      persist('dormmart-requests', requests);
      $('#requests-button').click();
      toast('Demo request history cleared.');
    }
  });
};

// Request actions listener (Cancel / Simulate Accept)
$('#modal-body').addEventListener('click', e => {
  const cancelBtn = e.target.closest('[data-cancel]');
  if (cancelBtn) {
    const r = requests.find(x => x.id === cancelBtn.dataset.cancel);
    if (r) {
      r.status = 'Cancelled';
      persist('dormmart-requests', requests);
      $('#requests-button').click();
      toast('Request cancelled.');
    }
    return;
  }

  const acceptBtn = e.target.closest('[data-simulate-accept]');
  if (acceptBtn) {
    const r = requests.find(x => x.id === acceptBtn.dataset.simulateAccept);
    if (r) {
      r.status = 'Accepted by owner';
      persist('dormmart-requests', requests);
      $('#requests-button').click();
      toast('Owner simulated acceptance! View pickup instructions.');
    }
  }
});

// Routing
function route() {
  const hash = location.hash || '#home';
  if (hash.startsWith('#item-')) {
    openItem(Number(hash.slice(6)));
    return;
  }

  if ($('#modal').open) closeModal();

  const explore = hash === '#explore';
  lastPage = explore ? 'explore' : 'home';

  $('#home-view').hidden = explore;
  $('#explore-view').hidden = !explore;
  document.title = explore ? 'Explore nearby — DormMart' : 'DormMart — Good things, closer.';

  document.querySelectorAll('.header nav a').forEach(a => {
    a.removeAttribute('aria-current');
    if (a.hash === hash) a.setAttribute('aria-current', 'page');
  });

  if (hash === '#how') {
    $('#how').scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

window.addEventListener('hashchange', route);

// Initialize
updateCategoryDropdown();
render();
route();

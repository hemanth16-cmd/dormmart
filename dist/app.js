function listingStatusText(x){if(dateRangeValid(x.blockedFrom,x.blockedUntil))return localDate()>=x.blockedFrom&&localDate()<x.blockedUntil?'Rented out':'Available (see dates)';return x.status==='sold'?'Sold':x.status==='rented'?(x.mode==='share'?'On loan':'Rented out'):'Available'}
/* DormMart core application logic */
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
let toastTimer;

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// Global category tracking
function getCategories() {
  return [...new Set(LISTINGS.map(x => x.category))];
}
var categories = getCategories();

function updateCategoryDropdown() {
  categories = getCategories();
  const select = $('#category');
  if (!select) return;
  const currentVal = select.value || 'all';
  select.innerHTML = '<option value="all">All categories</option>' + categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if (categories.includes(currentVal) || currentVal === 'all') {
    select.value = currentVal;
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

  const homeChips = $('#home-categories');
  if (homeChips) {
    homeChips.innerHTML = cats.map(c => {
      const val = c === 'Everything' ? 'all' : c;
      return makeChip(c, val === currentCat);
    }).join('');
  }

  const exploreChips = $('#explore-categories');
  if (exploreChips) {
    exploreChips.innerHTML = cats.map(c => {
      const val = c === 'Everything' ? 'all' : c;
      return makeChip(c, val === currentCat);
    }).join('');
  }
}

function itemPhoto(x, detail = false) {
  const photos = x.photos && x.photos.length ? x.photos : (x.image ? [x.image] : []);
  if (photos.length > 0 && photos[0]) {
    return `<div class="item-art ${detail ? 'detail-art' : ''}"><img src="${escapeHTML(photos[0])}" alt="${escapeHTML(x.title)} — ${x.custom ? 'owner-uploaded photo' : 'representative sample photo'}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="photo-fallback" hidden>${escapeHTML(x.emoji || 'Photo unavailable')}</span></div>`;
  }
  return `<div class="item-art ${detail ? 'detail-art' : ''}" style="--item-color:${escapeHTML(x.color || '#e0e5d9')}" aria-hidden="true"><span>${escapeHTML(x.emoji || '📦')}</span></div>`;
}

function card(x) {
  const isSaved = saved.includes(x.id);
  const badgeText = x.custom ? 'YOUR LISTING' : x.mode === 'share' ? 'FREE TO SHARE' : x.mode === 'rent' ? 'FOR RENT' : 'FOR SALE';
  const badgeClass = x.custom ? 'mode-badge user-badge' : 'mode-badge';
  const modeSub = x.mode === 'rent' ? '/ day' : x.mode === 'share' ? 'to borrow' : 'to keep';

  return `
    <article class="card" data-preview-item="${x.id}">
      ${itemPhoto(x)}
      <span class="${badgeClass}">${badgeText}</span>
      <button type="button" class="save" data-save="${x.id}" aria-label="Save ${escapeHTML(x.title)}" aria-pressed="${isSaved}">
        ${isSaved ? '♥' : '♡'}
      </button>
      <div class="card-body">
        <div class="card-meta">
          <span>${escapeHTML(x.category)}</span>
          <span>◎ ${x.custom ? 'Your listing' : x.distance + ' km away'}</span>
        </div>
        <h3><a class="card-link" href="#item-${x.id}">${escapeHTML(x.title)}</a></h3>
        <span class="condition-badge">${listingStatusText(x)}</span> <span class="condition-badge">${escapeHTML(x.condition || 'Good')}</span>
        <div class="card-price">
          ${x.price ? money(x.price) : 'Free'} <small>${modeSub}</small>
        </div>
        <div class="seller">
          <span>${escapeHTML(x.owner)} ${x.verified ? '<span class="verified">✓ Email verified</span>' : ''}</span>
          <span>${x.reviews ? '★ ' + x.rating + ' (' + x.reviews + ')' : 'No reviews'}</span>
        </div>
      <button type="button" class="compare-toggle" data-compare="${x.id}" aria-pressed="false" aria-label="Compare ${escapeHTML(x.title)}"><span aria-hidden="true">＋</span> Compare item</button></div>
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
  const items = filterListings(LISTINGS, f, saved);

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
  $('#featured').innerHTML = LISTINGS.slice(0, 4).map(card).join('');
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

// Full item detail page
function openItem(id) {
  const x = LISTINGS.find(item => item.id === id);
  if (!x) {showItemContent('<h1 id="item-title">This item is no longer available.</h1><p>It may have been removed from this browser.</p>');return;}

  const rental = x.mode === 'rent';
  const borrow = x.mode !== 'buy';

  showItemContent(`
    <p class="eyebrow">${escapeHTML(x.category)} · ${escapeHTML(x.condition || 'Good')}</p>
    <h1 id="item-title">${escapeHTML(x.title)}</h1>

    <div class="item-detail-layout"><div class="item-visual">${itemPhoto(x, true)}
    ${x.photos?.length > 1 ? `<div class="detail-gallery">${x.photos.slice(1).map((p, i) => `<img src="${escapeHTML(p)}" alt="${escapeHTML(x.title)} photo ${i + 2}">`).join('')}</div>` : ''}
    <p class="micro">${x.custom ? 'Owner-uploaded photos. Condition is self-reported.' : 'Representative sample photo, not evidence of this specific item’s condition.'}</p>

    </div><div class="item-info"><div class="item-page-price">${x.price?money(x.price):'Free'} <small>${rental?'/ day':borrow?'to borrow':'one-time price'}</small></div><div class="trust-badges-row">
      ${x.verified ? '<span class="badge-chip badge-email">✓ Email verified</span>' : '<span class="badge-chip">Email not verified</span>'}
      ${x.student ? '<span class="badge-chip badge-student">🎓 Student affiliation reviewed</span>' : ''}
      <span class="badge-chip badge-condition">Condition: ${escapeHTML(x.condition || 'Good')}</span>
      <span class="badge-chip badge-pickup">◎ ${x.area ? escapeHTML(x.area) : x.pickupSpot ? escapeHTML(x.pickupSpot) : 'Campus main gate'}</span>
    </div>

    <p>${escapeHTML(x.description)}</p>
    ${!x.custom ? `<button type="button" class="button outline" data-message-item="${x.id}">Message ${escapeHTML(x.owner)}</button>` : '<a class="arrow-link" href="#profile">Manage this item in My profile ↗</a>'}

    <div class="trust-passport">
      <h4>🛡 Campus Trust & Safety Notes</h4>
      <p>
        <strong>${escapeHTML(x.owner)}</strong> · ${x.custom ? 'Your listing' : x.distance + ' km away'} · ${x.reviews ? '★ ' + x.rating + ' (' + x.reviews + ' reviews)' : 'No reviews yet'}.
        <br>All meetups take place at designated public campus spots during daylight. Never transfer an original identity card or passport as collateral.
      </p>
    </div>

    <p class="notice">Availability: ${listingStatusText(x)}${listingUnavailable(x)?'. This item is currently unavailable.':''}</p>${availabilityDatesHTML(x)}<form class="detail-form" id="booking-form">
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
        Pickup arranged at ${escapeHTML(x.area || x.pickupSpot || 'the campus main gate')} after agreement. No exact home address is shared.
        ${borrow ? 'Requests do not reserve dates until owner accepts.' : 'Purchase interest does not reserve the item.'}
      </p>

      <label class="check">
        <input type="checkbox" required> I understand this is a demo request; no payment is collected.
      </label>

      <button class="button" type="submit" ${listingUnavailable(x)?'disabled':''}>
        ${x.mode === 'buy' ? 'Send purchase interest' : 'Request ' + (rental ? 'rental' : 'to borrow')} ↗
      </button>

      <p class="micro">
        ${borrow ? '1–' + (rental ? '30' : '7') + ' days · minimum one full day · zero platform fees in this demo' : 'Owner confirmation is required before arranging pickup.'}
      </p>
    </form></div></div>
  `);

  const form = $('#booking-form');
  function quote() {
    const data = new FormData(form);
    let days = borrow ? (Date.parse(data.get('end')) - Date.parse(data.get('start'))) / 86400000 : 1;
    const dateError = rentalDateError(x,data.get('start'),data.get('end'),requests);
    const valid = !dateError && (!borrow || (data.get('start') >= localDate() && Number.isInteger(days) && days >= 1 && days <= (rental ? 30 : 7)));

    if (borrow) {
      form.elements.end.setCustomValidity(valid ? '' : dateError || 'Choose a future pickup and a return 1–' + (rental ? 30 : 7) + ' days later.');
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
    ` : escapeHTML(dateError || 'Select valid future dates to see your estimate.');

    return { valid, days, security, q, data };
  }

  form.addEventListener('input', quote);
  quote();

  form.onsubmit = e => {
    e.preventDefault();
    if(listingUnavailable(x)){toast('This item is currently unavailable.');return}const z = quote();
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
    $('#done').onclick = ()=>{closeModal();location.hash='explore'};
  };
}

// "My demo requests" modal
$('#requests-button').onclick = () => {
  showModal(`
    <p class="eyebrow">SAVED IN THIS BROWSER</p>
    <h2 id="modal-title">Your demo requests</h2>
    ${requests.length ? `
      ${requests.map(r => {
        const x = LISTINGS.find(item => item.id === r.itemId);
        const isPending = r.status === 'Pending owner acceptance';
        const isAccepted = r.status === 'Accepted by owner';
        const statusClass = isAccepted ? 'status-accepted' : isPending ? 'status-pending' : 'status-cancelled';

        return `
          <article class="request">
            <div class="request-header">
              <h3>${escapeHTML(x?.title || r.itemTitle || 'Item #' + r.itemId)}</h3>
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
                <strong>✓ Meetup Confirmed:</strong> Meet ${escapeHTML(x?.owner || 'owner')} ${r.start ? 'on '+escapeHTML(r.start) : 'at an agreed time'} at ${escapeHTML(x?.area || x?.pickupSpot || 'Campus Main Gate')}. Inspect the item before exchanging security.
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
    ` : '<p>No requests yet. Find something you love in Explore.</p>'}
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
      const item=LISTINGS.find(x=>x.id===r.itemId);
      if(!item){toast('This listing has been deleted.');return}
      const dateError=rentalDateError(item,r.start,r.end,requests,r.id);
      if(dateError||(r.start&&r.start<localDate())){toast(dateError||'These pickup dates have passed. Send a new request.');return}
      r.status = 'Accepted by owner';
      persist('dormmart-requests', requests);
      $('#requests-button').click();
      toast('Owner simulated acceptance! View pickup instructions.');
    }
  }
});

// Routing
function route() {
  if (document.body.classList.contains('signed-out')) {
    if ($('#modal').open) closeModal();
    return;
  }

  const hash = location.hash || '#home';
  if(!hash.startsWith('#item-')){$('#item-view').hidden=true;$('#item-view').replaceChildren()}
  if(window.renderCommunityRoute && renderCommunityRoute(hash))return;
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

function availabilityDatesHTML(item){
 if(item.mode==='buy')return '';
 const ranges=[];
 if(dateRangeValid(item.availableFrom,item.availableUntil))ranges.push('Pickup from '+item.availableFrom+' · return by '+item.availableUntil);
 if(dateRangeValid(item.blockedFrom,item.blockedUntil))ranges.push('Unavailable from '+item.blockedFrom+' · available again '+item.blockedUntil);
 for(const r of requests.filter(r=>r.itemId===item.id&&r.status==='Accepted by owner'&&dateRangeValid(r.start,r.end)))ranges.push('Booked from '+r.start+' · available again '+r.end);
 return ranges.map(text=>'<p class="notice">'+escapeHTML(text)+'</p>').join('');
}

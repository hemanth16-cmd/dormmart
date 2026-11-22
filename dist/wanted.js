/* Campus request board. One renderer, three stores:
 * - demo: browser-only localStorage, clearly labelled; nothing leaves the browser.
 * - live guest: read-only public requests from Supabase.
 * - live signed-in: create/edit/close/reopen/archive own requests, offer own listings. */
(()=>{
 const view=$('#wanted-view');
 const today=()=>localDate();
 const future=n=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d)};
 const modes={rent:'Rent',buy:'Buy',share:'Borrow free'};
 let posts=[],filter='all',query='',state='idle',busy=false;

 // ---------------- Stores ----------------
 const demoStore={
  KEY:'dormmart-wanted-v1',
  seeds:()=>[
   {id:'demo-projector',title:'Projector for movie night',category:'Electronics',mode:'rent',budget:300,date:future(5),area:'Student centre',note:'A projector with an HDMI connection for an evening screening. Happy to collect and return the next morning.',owner:'Tara',status:'open',mine:false,offers:[]},
   {id:'demo-tools',title:'A toolkit for moving day',category:'Home & living',mode:'share',budget:0,date:future(8),area:'North campus gate',note:'Looking for a screwdriver set and a small hammer to assemble a shelf. Just for an afternoon.',owner:'Rohan',status:'open',mine:false,offers:[]},
   {id:'demo-calculator',title:'Scientific calculator',category:'Electronics',mode:'buy',budget:650,date:future(12),area:'Library entrance',note:'A working non-programmable calculator for class. Please mention the model and condition.',owner:'Meera',status:'open',mine:false,offers:[]}
  ],
  read(){
   try{const raw=JSON.parse(localStorage.getItem(this.KEY));if(!Array.isArray(raw))return this.seeds();
    return raw.filter(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&typeof p.note==='string'&&['rent','buy','share'].includes(p.mode)&&['open','fulfilled','closed'].includes(p.status)&&Array.isArray(p.offers))
     .map(p=>({...p,status:p.status==='fulfilled'?'closed':p.status,mine:p.mine===true,offers:p.offers.filter(o=>o&&typeof o.title==='string'&&typeof o.note==='string').map(o=>({...o,mine:true,from:'You',status:'active',available:LISTINGS.some(x=>x.id===o.itemId)}))}))}
   catch{return this.seeds()}
  },
  write(next){try{localStorage.setItem(this.KEY,JSON.stringify(next));posts=next;return true}catch{throw Error('Could not save in this browser. Free some browser storage and try again.')}},
  async load(){return this.read()},
  canWrite:()=>demoSignedIn,
  async save(value,existing){const post={...value,id:existing?.id||crypto.randomUUID(),owner:profile.name||'You',mine:true,status:existing?.status||'open',offers:existing?.offers||[]};this.write(existing?posts.map(x=>x.id===existing.id?post:x):[post,...posts])},
  async setStatus(p,status){this.write(posts.map(x=>x.id===p.id?{...x,status}:x))},
  async archive(p){this.write(posts.filter(x=>x.id!==p.id))},
  async offer(p,item,note){this.write(posts.map(x=>x.id===p.id?{...x,offers:[{itemId:item.id,title:item.title,note,mine:true,from:'You',status:'active',available:true}]}:x))},
  async withdraw(p){this.write(posts.map(x=>x.id===p.id?{...x,offers:[]}:x))},
  labels:{notice:['Demo noticeboard','Requests and offers are saved only in this browser. Nothing is published or sent to another person.'],
   count:'open requests on this browser',saved:'Request saved on this browser.',offered:'Demo offer saved locally. No message was sent.',archiveVerb:'Delete',
   formNote:'A local demo request. Use a public pickup area, not a private address.',submit:'Post demo request ↗',offerNote:'This saves a demo offer locally; it does not send a message.'}
 };
 const liveBackend=()=>window.liveBackend||window.publicBackend||null;
 const liveStore={
  async load(){
   const backend=liveBackend();if(!backend)throw Error('not ready');
   if(!(await backend.workflowsAvailable()))return null;
   return backend.requests();
  },
  canWrite:()=>!GUEST_MODE&&demoSignedIn&&!!window.liveBackend?.user,
  async save(value,existing){await liveBackend().saveRequest(value,existing?.id)},
  async setStatus(p,status){await liveBackend().setRequestStatus(p.id,status)},
  async archive(p){await liveBackend().archiveRequest(p.id)},
  async offer(p,item,note){await liveBackend().offerListing(p.id,item.id,note)},
  async withdraw(p,offer){await liveBackend().withdrawOffer(offer.id)},
  labels:{notice:GUEST_MODE?['Browsing as a guest','Requests are public. Posting a request or offering an item needs an account, and accounts are paused for now.']:['Public request board','Requests are visible to everyone on DormMart. Offers are visible only to you and the requester.'],
   count:'open requests on DormMart',saved:'Request published.',offered:'Offer sent. The requester can now see your listing and message you.',archiveVerb:'Archive',
   formNote:'Your request is public. Use a public pickup area, never a private address.',submit:'Publish request ↗',offerNote:'Your listing and note become visible to the requester only. They can message you about it.'}
 };
 const store=LIVE_MODE?liveStore:demoStore;
 const L=store.labels;
 const errorText=e=>LIVE_MODE?DormMartBackend.friendlyError(e):(e?.message||'Could not save. Please try again.');

 async function reload(){
  if(state==='loading')return;
  state='loading';render();
  try{
   const next=await store.load();
   if(next===null){state='unavailable';posts=[]}else{posts=next;state='ready'}
  }catch{state='error'}
  if(location.hash==='#wanted')render();
 }
 function guard(){
  if(store.canWrite())return true;
  if(GUEST_MODE)guestAccountNotice();else if(!demoSignedIn)syncAuth();
  return false;
 }
 async function act(fn,success){
  if(busy)return false;busy=true;
  try{await fn();if(success)toast(success);if(LIVE_MODE)await reload();else render();return true}
  catch(e){toast(errorText(e));return false}
  finally{busy=false}
 }

 // ---------------- Rendering ----------------
 const expired=p=>p.date&&p.date<today();
 function offersHTML(p){
  const visible=p.offers.filter(o=>o.status!=='withdrawn');
  if(!visible.length)return '';
  const label=p.mine?`${visible.length} offer${visible.length===1?'':'s'} for you`:LIVE_MODE?'Your offer':'Your saved demo offer';
  return `<details class="request-offers" ${p.mine?'open':''}><summary>${label}</summary>${visible.map(o=>`<p><strong>${escapeHTML(o.title)}</strong>${p.mine?` · from ${escapeHTML(o.from)}`:''}<br>${escapeHTML(o.note)}${o.available&&LISTINGS.some(x=>x.id===o.itemId)?`<br><a href="#item-${escapeHTML(o.itemId)}">View offered listing ↗</a>${p.mine&&LIVE_MODE?` · <button type="button" class="text-btn" data-wanted-message="${escapeHTML(o.itemId)}">Message owner</button>`:''}`:'<br><span class="micro">This listing is no longer available.</span>'}${o.mine?` · <button type="button" class="text-btn" data-wanted-withdraw="${escapeHTML(p.id)}" data-offer="${escapeHTML(o.id||'')}">Withdraw offer</button>`:''}</p>`).join('')}</details>`;
 }
 function card(p){
  const closed=p.status!=='open';
  const myOffer=p.offers.some(o=>o.mine&&o.status!=='withdrawn');
  return `<article class="wanted-card ${p.mine?'is-mine':''}"><div class="wanted-card-top"><span class="badge-chip">${escapeHTML(modes[p.mode])}</span><span class="request-state">${closed?'✓ Closed':expired(p)?'Date passed':'Looking for'}</span></div><p class="eyebrow">${escapeHTML(p.category||'Other')}</p><h2>${escapeHTML(p.title)}</h2><p class="wanted-note">${escapeHTML(p.note)}</p><dl><div><dt>Budget${p.mode==='rent'?' / day':''}</dt><dd>${p.mode==='share'?'Free borrowing':Number(p.budget)>0?money(p.budget):'Flexible'}</dd></div><div><dt>Needed by</dt><dd>${escapeHTML(p.date||'Flexible')}</dd></div></dl><p class="micro">◎ ${escapeHTML(p.area||'Campus pickup')} · ${p.mine?'You':escapeHTML(p.owner)}${!LIVE_MODE&&!p.mine?' · Demo request':''}</p>${offersHTML(p)}<div class="wanted-actions">${p.mine?`<button class="button small" data-wanted-status="${escapeHTML(p.id)}">${closed?'Reopen request':'Close request'}</button><button class="text-btn" data-wanted-edit="${escapeHTML(p.id)}">Edit</button><button class="text-btn" data-wanted-delete="${escapeHTML(p.id)}">${L.archiveVerb}</button>`:`<button class="button small" data-wanted-offer="${escapeHTML(p.id)}" ${closed||expired(p)?'disabled':''}>${myOffer?'Update my offer':'I have something ↗'}</button>`}</div></article>`;
 }
 function bodyHTML(shown){
  if(state==='loading'&&!posts.length)return '<div class="community-empty" role="status"><h2>Loading requests…</h2></div>';
  if(state==='error')return '<div class="community-empty"><h2>Requests could not load.</h2><p>Check your connection. Nothing you typed has been lost.</p><button class="button" id="wanted-retry">Try again</button></div>';
  if(state==='unavailable')return '<div class="community-empty"><h2>The request board is being set up.</h2><p>Explore listings and message their owners in the meantime.</p><a class="button" href="#explore">Explore items</a></div>';
  return shown.length?shown.map(card).join(''):`<div class="community-empty"><h2>${posts.length?'No requests match.':'A little quiet here.'}</h2><p>${posts.length?'Try another search or filter.':'Be the first to ask for what you need.'}</p><button class="button" id="empty-wanted">Post a request ↗</button></div>`;
 }
 function render(){
  if(view.hidden)return;
  const open=posts.filter(p=>p.status==='open'&&!expired(p));
  const shown=posts.filter(p=>(filter!=='mine'||p.mine)&&(filter!=='open'||p.status==='open'&&!expired(p))&&(p.title+' '+p.note+' '+p.category).toLowerCase().includes(query.toLowerCase()));
  const focused=document.activeElement?.id==='wanted-search',pos=focused?document.activeElement.selectionStart:null;
  view.innerHTML=`<div class="wanted-masthead"><div><p class="eyebrow">ASK LOCAL. FIND MORE.</p><h1>The campus<br><em>wishlist.</em><span aria-hidden="true">✳</span></h1><p>Can’t find the right thing? Put the word out.</p></div><div class="wanted-masthead-aside"><span class="wanted-number">${String(open.length).padStart(2,'0')}</span><p>${L.count}</p><button class="button" id="new-wanted">+ Request an item</button></div></div><div class="board-notice"><strong>${L.notice[0]}</strong><span>${L.notice[1]}</span></div><div class="wanted-toolbar"><div role="group" aria-label="Request filters">${[['all','All requests'],['open','Open requests'],...(store.canWrite()||!LIVE_MODE?[['mine','My requests']]:[])].map(([v,l])=>`<button class="chip ${filter===v?'active':''}" data-wanted-filter="${v}" aria-pressed="${filter===v}">${l}</button>`).join('')}</div><label class="wanted-search"><span class="sr-only">Search requests</span><input id="wanted-search" type="search" placeholder="Search the wishlist…" value="${escapeHTML(query)}"></label></div><div class="wanted-grid" aria-live="polite" aria-busy="${state==='loading'}">${bodyHTML(shown)}</div>`;
  $('#new-wanted').onclick=()=>openForm();$('#empty-wanted')?.addEventListener('click',()=>openForm());$('#wanted-retry')?.addEventListener('click',reload);
  $('#wanted-search').oninput=e=>{query=e.target.value;render()};
  if(focused){$('#wanted-search').focus();try{$('#wanted-search').setSelectionRange(pos,pos)}catch{}}
 }

 // ---------------- Forms ----------------
 function openForm(existing=null){
  if(!guard())return;
  if(!existing?.mine)existing=null;
  showModal(`<p class="eyebrow">PUT THE WORD OUT</p><h2 id="modal-title">${existing?'Edit your request':'What are you looking for?'}</h2><p class="micro">${L.formNote}</p><form id="wanted-form" class="detail-form"><label>Item name<input name="title" maxlength="80" required placeholder="e.g. A projector for movie night"></label><div class="detail-grid"><label>I’d like to<select name="mode" id="wanted-mode"><option value="rent">Rent it</option><option value="buy">Buy it</option><option value="share">Borrow for free</option></select></label><label>Category<select name="category">${[...new Set([...getCategories(),'Other'])].map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select></label></div><div class="detail-grid"><label id="wanted-budget-label">Maximum budget per day (₹)<input name="budget" type="number" min="0" max="1000000" step="1" placeholder="Leave blank for flexible"></label><label>Needed by<input name="date" type="date" min="${today()}"></label></div><label>Campus pickup area<input name="area" maxlength="100" required placeholder="e.g. Library entrance"></label><label>What should the owner know?<textarea name="note" maxlength="600" required rows="3" placeholder="Preferred condition, how long you need it, and any essentials"></textarea></label><p id="wanted-error" class="form-error" role="alert"></p><button class="button" type="submit">${existing?'Save request changes':L.submit}</button></form>`);
  const form=$('#wanted-form');
  $('#wanted-mode').onchange=e=>{const label=$('#wanted-budget-label'),input=label.querySelector('input');label.firstChild.textContent=e.target.value==='rent'?'Maximum budget per day (₹)':'Maximum total budget (₹)';label.hidden=e.target.value==='share';input.disabled=e.target.value==='share'};
  if(existing){for(const key of ['title','mode','category','budget','date','area','note'])form.elements[key].value=existing[key]||'';if(!existing.budget)form.elements.budget.value='';$('#wanted-mode').dispatchEvent(new Event('change'))}
  form.elements.title.focus();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   const f=new FormData(form),value={title:String(f.get('title')||'').trim(),note:String(f.get('note')||'').trim(),area:String(f.get('area')||'').trim(),date:String(f.get('date')||''),mode:String(f.get('mode')),category:String(f.get('category')||'Other'),budget:Number(f.get('budget')||0)};
   const pastDate=value.date&&(!validDate(value.date)||value.date<today())&&value.date!==existing?.date;
   if(!value.title||!value.note||!value.area||pastDate){$('#wanted-error').textContent='Add the item, pickup area and details, and choose today or a future date.';return}
   const button=form.querySelector('[type=submit]');button.disabled=true;$('#wanted-error').textContent='';busy=true;
   try{await store.save(value,existing);busy=false;filter='mine';query='';closeModal();location.hash='wanted';toast(existing?'Request updated.':L.saved);if(LIVE_MODE)await reload();else render()}
   catch(err){busy=false;if(form.isConnected){$('#wanted-error').textContent=errorText(err);button.disabled=false}}
  };
 }
 function offer(p){
  if(!guard())return;
  const own=userListings.filter(x=>!listingUnavailable(x)&&(!LIVE_MODE||x.live));
  const current=p.offers.find(o=>o.mine&&o.status!=='withdrawn');
  showModal(`<p class="eyebrow">HELP A NEIGHBOUR OUT</p><h2 id="modal-title">Offer an item</h2><p>For: <strong>${escapeHTML(p.title)}</strong></p><p class="micro">${L.offerNote} Confirm availability and dates before any exchange.</p>${own.length?`<form id="wanted-offer-form" class="detail-form"><label>Choose one of your listings<select name="item">${own.map(x=>`<option value="${escapeHTML(x.id)}" ${current?.itemId===x.id?'selected':''}>${escapeHTML(x.title)} · ${modes[x.mode]}</option>`).join('')}</select></label><label>Details for the requester<textarea name="note" required maxlength="400" rows="3" placeholder="Condition, dates and your proposed price">${escapeHTML(current?.note||'')}</textarea></label><p id="offer-error" class="form-error" role="alert"></p><button class="button" type="submit">${LIVE_MODE?'Send offer':'Save demo offer'}</button></form>`:'<p>Add an available listing first so the requester can see its photos, price and condition.</p><button class="button" id="offer-add-listing">+ List an item</button>'}`);
  $('#offer-add-listing')?.addEventListener('click',()=>openListingForm());
  const form=$('#wanted-offer-form');if(!form)return;
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   const f=new FormData(form),item=own.find(x=>String(x.id)===String(f.get('item'))),note=String(f.get('note')||'').trim();
   if(!item||!note){$('#offer-error').textContent='Choose a listing and add a note.';return}
   const button=form.querySelector('[type=submit]');button.disabled=true;busy=true;
   try{await store.offer(p,item,note);busy=false;closeModal();toast(L.offered);if(LIVE_MODE)await reload();else render()}
   catch(err){busy=false;if(form.isConnected){$('#offer-error').textContent=errorText(err);button.disabled=false}}
  };
 }
 view.addEventListener('click',e=>{
  const find=(attr,mine)=>{const b=e.target.closest(`[data-${attr}]`);if(!b)return null;const p=posts.find(x=>x.id===b.dataset[attr.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]);return p&&(mine===undefined||p.mine===mine)?{p,b}:false};
  let hit;
  if((hit=find('wanted-filter'))!==null){const b=e.target.closest('[data-wanted-filter]');filter=b.dataset.wantedFilter;render();view.querySelector(`[data-wanted-filter="${filter}"]`)?.focus();return}
  if((hit=find('wanted-edit',true))){openForm(hit.p);return}
  if((hit=find('wanted-status',true))){act(()=>store.setStatus(hit.p,hit.p.status==='open'?'closed':'open'),hit.p.status==='open'?'Request closed.':'Request reopened.');return}
  if((hit=find('wanted-offer',false))){if(hit.p.status==='open'&&!expired(hit.p))offer(hit.p);return}
  if((hit=find('wanted-withdraw'))){const o=hit.p.offers.find(o=>o.mine&&(!LIVE_MODE||o.id===hit.b.dataset.offer));if(o)act(()=>store.withdraw(hit.p,o),'Offer withdrawn.');return}
  const message=e.target.closest('[data-wanted-message]');if(message){startConversation(listingId(message.dataset.wantedMessage));return}
  if((hit=find('wanted-delete',true))){const p=hit.p;showModal(`<h2 id="modal-title">${L.archiveVerb} this request?</h2><p>${escapeHTML(p.title)} ${LIVE_MODE?'will be removed from the board. Offers you received stay visible to you and the offerer cannot add new ones.':'will be removed from this browser.'}</p><button class="button" id="cancel-wanted-delete">Keep request</button> <button class="text-btn" id="confirm-wanted-delete">${L.archiveVerb} request</button>`);$('#cancel-wanted-delete').onclick=closeModal;$('#cancel-wanted-delete').focus();$('#confirm-wanted-delete').onclick=async()=>{$('#confirm-wanted-delete').disabled=true;if(await act(()=>store.archive(p),LIVE_MODE?'Request archived.':'Request deleted.'))closeModal();else if($('#confirm-wanted-delete'))$('#confirm-wanted-delete').disabled=false}}
 });
 window.renderWantedRoute=hash=>{view.hidden=hash!=='#wanted';if(hash!=='#wanted')return false;lastPage='wanted';['home','explore','profile','messages','item'].forEach(x=>$('#'+x+'-view').hidden=true);if($('#modal').open)closeModal();document.querySelectorAll('.header nav a,.mobile-dock a').forEach(a=>a.hash==='#wanted'?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));$('#account-button').removeAttribute('aria-current');document.title='Campus wishlist — DormMart';if(LIVE_MODE){render();reload()}else{posts=demoStore.read();state='ready';render()}window.scrollTo(0,0);return true};
 window.addEventListener('dormmart-account-change',()=>{posts=[];state='idle';filter='all'});
 window.refreshWantedBoard=()=>{if(location.hash==='#wanted')reload()};
 const results=$('#results');function emptyLink(){if(!results.querySelector('.card')&&!results.querySelector('.empty-wanted-link')){const a=document.createElement('a');a.href='#wanted';a.className='button empty-wanted-link';a.textContent='Can’t find it? Request an item ↗';results.append(a)}}
 new MutationObserver(emptyLink).observe(results,{childList:true});emptyLink();route();
})();

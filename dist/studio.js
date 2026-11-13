/* Curated browsing, quick search and a browser-local comparison shortlist. */
(()=>{
 let compare=readStore('dormmart-compare',[]).filter(Number.isSafeInteger).filter(id=>LISTINGS.some(x=>x.id===id)).slice(0,3);
 const dock=document.getElementById('compare-dock');
 function browse(value,query=''){
  $('#filters').reset();$('#query').value=query;
  if(['rent','buy','share'].includes(value))$('#mode').value=value;
  else if(value)$('#category').value=value;
  closeModal();location.hash='explore';render();route();
 }
 document.addEventListener('click',e=>{const collection=e.target.closest('[data-studio-collection]');if(collection)browse(collection.dataset.studioCollection)});
 $('#studio-list-item').onclick=()=>$('#list-button').click();
 function syncCompare(){
  compare=compare.filter(id=>LISTINGS.some(x=>x.id===id));
  document.querySelectorAll('[data-compare]').forEach(b=>{const selected=compare.includes(Number(b.dataset.compare));b.setAttribute('aria-pressed',String(selected));b.innerHTML=`<span aria-hidden="true">${selected?'✓':'＋'}</span> ${selected?'Added to compare':'Compare item'}`});
  dock.hidden=!compare.length||document.body.classList.contains('signed-out');
  dock.innerHTML=`<div class="compare-dock-copy"><strong>${compare.length} / 3 selected</strong><span>Find the one that fits.</span></div><div class="compare-miniatures">${compare.map(id=>{const x=LISTINGS.find(x=>x.id===id);return `<button type="button" data-uncompare="${id}" aria-label="Remove ${escapeHTML(x.title)} from comparison"><img src="${escapeHTML(x.photos?.[0]||x.image||'')}" alt=""><span>×</span></button>`}).join('')}</div><button class="button small" id="open-compare" ${compare.length<2?'disabled':''}>Compare ${compare.length} items ↗</button><button class="text-btn" id="clear-compare">Clear</button>`;
  if(entering){const mini=dock.querySelector(`[data-uncompare="${entering.id}"]`);if(mini)flyIntoTray(entering.from,mini);entering=null}
  $('#open-compare').onclick=openComparison;$('#clear-compare').onclick=()=>{compare=[];persist('dormmart-compare',compare);syncCompare()};
 }
 // Show where a compared item went: its photo travels into the tray, then the miniature settles.
 let entering=null;
 function flyIntoTray(from,mini){
  const root=document.documentElement;
  if(root.classList.contains('motion-off')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  mini.classList.add('is-entering');mini.addEventListener('animationend',()=>mini.classList.remove('is-entering'),{once:true});
  if(!from||!from.isConnected||!from.animate)return;
  const a=from.getBoundingClientRect(),b=mini.getBoundingClientRect();
  if(!a.width||!b.width||a.bottom<0||a.top>innerHeight)return;
  const flight=from.cloneNode(false);flight.removeAttribute('onerror');flight.alt='';flight.className='compare-flight';flight.setAttribute('aria-hidden','true');
  Object.assign(flight.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});document.body.append(flight);
  const s=b.width/a.width,dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2);
  flight.animate([{transform:'none',opacity:.95},{transform:`translate(${dx}px,${dy}px) scale(${s})`,opacity:.35}],{duration:480,easing:'cubic-bezier(.3,.7,.2,1)'}).onfinish=()=>flight.remove();
  setTimeout(()=>flight.remove(),900);
 }
 function openComparison(){
  const items=compare.map(id=>LISTINGS.find(x=>x.id===id)).filter(Boolean);
  if(items.length<2)return;
  showModal(`<p class="eyebrow">SIDE BY SIDE. EASY TO DECIDE.</p><h2 id="modal-title">Find your best fit.</h2><p class="micro">Rental prices are per day; sale prices are one-time. Deposits are separate. All listings are demos.</p><div class="comparison-scroll"><table class="comparison-table"><caption class="sr-only">Selected item comparison</caption><thead><tr><th scope="col">Item</th>${items.map(x=>`<th scope="col"><img src="${escapeHTML(x.photos?.[0]||x.image||'')}" alt=""><a href="#item-${x.id}" class="compare-item-link">${escapeHTML(x.title)} ↗</a></th>`).join('')}</tr></thead><tbody>${[
   ['Offer',x=>x.mode==='rent'?'Rent':x.mode==='buy'?'Buy':'Free sharing'],
   ['Price',x=>(x.price?money(x.price):'Free')+(x.mode==='rent'?' / day':'')],
   ['Deposit',x=>x.mode==='rent'?money(x.deposit):'Not applicable'],
   ['Condition',x=>x.condition||'Not stated'],
   ['Distance',x=>x.distance+' km (demo)'],
   ['Status',x=>listingStatusText(x)],
   ['Owner',x=>x.owner],
   ['Dates',x=>x.availableFrom&&x.availableUntil?x.availableFrom+' → '+x.availableUntil:'Check item details'],
   ['Blocked dates',x=>x.blockedFrom&&x.blockedUntil?x.blockedFrom+' → '+x.blockedUntil:'Check item details']
  ].map(([label,get])=>`<tr><th scope="row">${label}</th>${items.map(x=>`<td>${escapeHTML(get(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="micro">Open an item for its current booking calendar and full condition notes.</p>`);
  document.querySelectorAll('.compare-item-link').forEach(link=>link.onclick=()=>closeModal());
 }
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-compare],[data-uncompare]');if(!button)return;
  const id=Number(button.dataset.compare||button.dataset.uncompare);
  if(compare.includes(id))compare=compare.filter(x=>x!==id);
  else if(compare.length<3){compare.push(id);if(button.dataset.compare)entering={id,from:button.closest('.card')?.querySelector('.item-art img')}}
  else{toast('You can compare three items. Remove one to add another.');return}
  persist('dormmart-compare',compare);syncCompare();
 });
 function quickSearch(){
  showModal(`<p class="eyebrow">YOUR NEXT GOOD FIND</p><h2 id="modal-title">What are you looking for?</h2><form id="quick-search-form" class="search"><input id="quick-search-input" aria-label="Search marketplace" placeholder="Try camera, guitar, cycle…" maxlength="100"><button class="button" type="submit">Search ↗</button></form><div class="quick-links"><button type="button" data-studio-collection="rent">↔ Rent for the weekend</button><button type="button" data-studio-collection="share">✳ Borrow something free</button><button type="button" data-studio-collection="Furniture">⌂ Upgrade your room</button></div><p class="micro">Tip: press / from any page to open quick search.</p>`);
  $('#quick-search-form').onsubmit=e=>{e.preventDefault();browse('', $('#quick-search-input').value.trim())};$('#quick-search-input').focus();
 }
 $('#studio-search').onclick=quickSearch;
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable="true"]')&&!$('#modal').open&&!document.body.classList.contains('signed-out')){e.preventDefault();quickSearch()}});
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncCompare()})}).observe($('#results'),{childList:true});
 new MutationObserver(syncCompare).observe(document.body,{attributes:true,attributeFilter:['class']});
 function navigation(){const hash=location.hash||'#home';document.querySelectorAll('.mobile-dock a').forEach(a=>{const active=a.hash===hash||(a.hash==='#messages'&&hash.startsWith('#messages-'));if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}
 window.addEventListener('hashchange',navigation);syncCompare();navigation();
})();

/* Full detail pages share the existing booking and messaging behavior. */
function showItemContent(html){
 if(document.querySelector('#modal').open)document.querySelector('#modal').close();
 for(const id of ['home-view','explore-view','profile-view','messages-view'])document.getElementById(id).hidden=true;
 const view=document.getElementById('item-view');view.hidden=false;
 const back=['home','explore','profile','wanted'].includes(lastPage)||lastPage.startsWith('messages')?lastPage:'explore';
 view.innerHTML=`<a class="item-back" href="#${escapeHTML(back)}">← Back to ${back==='wanted'?'requests':back==='profile'?'my listings':back.startsWith('messages')?'messages':back==='home'?'home':'Explore'}</a>${html}`;
 document.title=(document.getElementById('item-title')?.textContent||'Item')+' — DormMart';
 document.querySelectorAll('.header nav a').forEach(a=>a.removeAttribute('aria-current'));
 document.getElementById('account-button').removeAttribute('aria-current');
 window.scrollTo(0,0);const heading=document.getElementById('item-title');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}
}

(()=>{
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const preview=document.createElement('aside');preview.id='item-hover-preview';preview.hidden=true;preview.setAttribute('aria-label','Item quick preview');document.body.appendChild(preview);
 let showTimer,hideTimer,active=null,dismissed=null;
 function hide(){clearTimeout(showTimer);clearTimeout(hideTimer);showTimer=null;hideTimer=null;preview.hidden=true;active=null}
 function position(card){const r=card.getBoundingClientRect(),width=Math.min(300,innerWidth-24);preview.style.width=width+'px';const left=r.right+12+width<=innerWidth-12?r.right+12:r.left-width-12>=12?r.left-width-12:Math.max(12,Math.min(innerWidth-width-12,r.left));preview.style.left=left+'px';preview.style.top=Math.max(12,Math.min(r.top,innerHeight-preview.offsetHeight-12))+'px'}
 function show(card){if(!fine.matches||!card.isConnected||document.querySelector('#modal').open)return;const item=LISTINGS.find(x=>x.id===Number(card.dataset.previewItem));if(!item)return;active=card;
 preview.innerHTML=`${itemPhoto(item)}<div class="preview-body"><p class="eyebrow">QUICK LOOK · ${item.mode==='rent'?'FOR RENT':item.mode==='buy'?'FOR SALE':'FREE SHARING'}</p><h3>${escapeHTML(item.title)}</h3><p class="preview-price">${item.price?money(item.price):'Free'} <small>${item.mode==='rent'?'/ day':''}</small></p><p>${escapeHTML(item.condition||'Good')} · ${escapeHTML(listingStatusText(item))}</p><p class="preview-description">${escapeHTML(item.description)}</p><p class="micro">◎ ${escapeHTML(item.area||item.distance+' km away')} · ${escapeHTML(item.owner)}</p><a class="button small" href="#item-${item.id}">View full details ↗</a></div>`;
 preview.hidden=false;position(card);
 }
 document.addEventListener('pointerover',e=>{if(!fine.matches||e.pointerType==='touch')return;const card=e.target.closest('[data-preview-item]');if(!card){if(!preview.contains(e.target))dismissed=null;return}if(card===dismissed)return;clearTimeout(hideTimer);if(card===active||card.contains(e.relatedTarget))return;clearTimeout(showTimer);showTimer=setTimeout(()=>{showTimer=null;show(card)},350)});
 document.addEventListener('pointerout',e=>{const card=e.target.closest('[data-preview-item]');if(!card||card.contains(e.relatedTarget))return;if(dismissed===card)dismissed=null;clearTimeout(showTimer);if(preview.contains(e.relatedTarget))return;hideTimer=setTimeout(hide,180)});
 preview.addEventListener('pointerenter',()=>clearTimeout(hideTimer));preview.addEventListener('pointerleave',()=>{hideTimer=setTimeout(hide,180)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!preview.hidden){dismissed=active;hide()}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-preview-item] a,#item-hover-preview a,[data-save]'))hide()});
 window.addEventListener('scroll',hide,{passive:true});window.addEventListener('resize',hide);window.addEventListener('hashchange',hide);fine.addEventListener('change',hide);
 new MutationObserver(()=>{if(active&&!active.isConnected)hide()}).observe(document.getElementById('main'),{childList:true,subtree:true});
})();


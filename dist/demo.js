/* Demo-only identity and listing tools. Never stores passwords or contact details. */
let demoSignedIn = false;
try { demoSignedIn = sessionStorage.getItem('dormmart-demo-session') === 'active'; } catch {}
const userListings = readStore('dormmart-listings-v2', []).filter(x => x && Number.isSafeInteger(x.id) && x.id > 100 && typeof x.title === 'string' && ['buy','rent','share'].includes(x.mode) && Array.isArray(x.photos) && x.photos.every(p=>/^data:image\/jpeg;base64,/.test(p)));
LISTINGS.push(...userListings);
function syncAuth() {
  document.body.classList.toggle('signed-out', !demoSignedIn);
  $('#auth-screen').hidden = demoSignedIn;
  for (const selector of ['.header', '#main', 'footer']) $(selector).hidden = !demoSignedIn;
  $('#account-button').textContent = 'Demo account';
}
$('#auth-form').onsubmit = e => {
  e.preventDefault();
  if (!$('#auth-form').reportValidity()) return;
  demoSignedIn = true;
  try { sessionStorage.setItem('dormmart-demo-session','active'); } catch {}
  $('#auth-form').reset();
  syncAuth(); location.hash='home'; route(); $('#main').focus();
  toast('Welcome in! You’re using a demo account.');
};
$('#toggle-password').onclick=()=>{const input=$('#demo-password');input.type=input.type==='password'?'text':'password';$('#toggle-password').textContent=input.type==='password'?'Show':'Hide'};
$('#account-button').onclick=()=>{
  showModal(`<p class="eyebrow">YOUR LITTLE CORNER</p><h2 id="modal-title">Hello, neighbour.</h2><p>This is a demo session. Your email, phone and password are not saved or verified.</p><button class="button" id="my-listings">My listings (${userListings.length})</button> <button class="text-btn" id="sign-out">Sign out</button>`);
  $('#my-listings').onclick=showMyListings;
  $('#sign-out').onclick=()=>{demoSignedIn=false;try{sessionStorage.removeItem('dormmart-demo-session')}catch{}closeModal();syncAuth();$('#demo-contact').focus()};
};
function showMyListings(){
  showModal(`<p class="eyebrow">SAVED ON THIS DEVICE</p><h2 id="modal-title">Your things, their next chapter.</h2>${userListings.length?userListings.map(x=>`<article class="request"><h3>${escapeHTML(x.title)}</h3><p>${x.mode==='rent'?'For rent':x.mode==='buy'?'For sale':'Free to share'} · ${money(x.price)}${x.mode==='rent'?'/day':''} · ${escapeHTML(x.condition)}</p>${x.pickupAddress?`<p class="micro">Pickup address (this device only): ${escapeHTML(x.pickupAddress.address)}, ${escapeHTML(x.pickupAddress.city)} ${escapeHTML(x.pickupAddress.postcode)}</p>`:''}<label>Availability<select data-listing-status="${x.id}" aria-label="Availability for ${escapeHTML(x.title)}">${['available',x.mode==='buy'?'sold':'rented'].map(status=>`<option value="${status}" ${(x.status||'available')===status?'selected':''}>${status==='available'?'Available':status==='sold'?'Sold':x.mode==='share'?'On loan':'Rented out'}</option>`).join('')}</select></label><button class="text-btn" data-edit-listing="${x.id}">Edit listing</button> · <button class="text-btn" data-remove-listing="${x.id}">Remove listing</button></article>`).join(''):'<p>You haven’t listed anything yet.</p>'}<button class="button" id="add-another">+ Add an item</button>`);
  $('#add-another').onclick=openListingForm;
}
$('#modal-body').addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit-listing]');if(edit){openListingForm(Number(edit.dataset.editListing));return}const b=e.target.closest('[data-remove-listing]');if(!b)return;
  const id=Number(b.dataset.removeListing), index=userListings.findIndex(x=>x.id===id);
  if(index<0)return;
  userListings.splice(index,1);const itemIndex=LISTINGS.findIndex(x=>x.id===id);if(itemIndex>=0)LISTINGS.splice(itemIndex,1);
  saved=saved.filter(x=>x!==id);persist('dormmart-listings-v2',userListings);persist('dormmart-saved',saved);render();showMyListings();toast('Listing removed from this browser.');
});
async function compressPhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose JPG, PNG or WebP photos, up to 8 MB each.');
  const bitmap=await createImageBitmap(file);
  try{const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fafaf5';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.72)}finally{bitmap.close()}
}
function openListingForm(editId){
 const existing=typeof editId==='number'?userListings.find(x=>x.id===editId):null;
 if(!demoSignedIn){syncAuth();return}
 showModal(`<p class="eyebrow" id="listing-step">STEP 1 OF 2 · YOUR LISTING</p><h2 id="modal-title">What would you like to do?</h2><section id="listing-choice"><p>Give your item a new home, or let someone borrow it for a while.</p><div class="listing-mode-options"><button type="button" class="listing-mode-card" data-listing-mode="buy"><span aria-hidden="true">↗</span><strong>Sell an item</strong><small>Set a one-time price. The buyer keeps it.</small></button><button type="button" class="listing-mode-card" data-listing-mode="rent"><span aria-hidden="true">↔</span><strong>Rent out an item</strong><small>Set a daily rate and a refundable deposit.</small></button></div><button type="button" class="text-btn" data-listing-mode="share">Or share it for free →</button></section><form id="listing-form" class="detail-form" hidden><button type="button" class="text-btn" id="change-listing-mode">← Change Sell / Rent</button><p class="notice" id="listing-mode-help"></p><fieldset id="listing-fields" disabled><label>Item name<input name="title" type="text" maxlength="70" required placeholder="e.g. Wooden study desk"></label><div class="detail-grid"><label>I want to<select name="mode"><option value="buy">Sell this item</option><option value="rent">Rent this item out</option><option value="share">Share for free</option></select></label><label>Category<select name="category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></div><div class="detail-grid"><label><span id="listing-price-label">Sale price (₹)</span><input name="price" type="number" min="1" max="1000000" step="1" required></label><label id="deposit-label" hidden>Refundable deposit (₹)<input name="deposit" type="number" min="0" max="1000000" step="1" value="0"></label></div><div id="guarantor-group" hidden><label class="check"><input type="checkbox" name="alternative" checked> Allow guarantor alternative instead of cash deposit</label></div><label>Condition<select name="condition"><option>Like new</option><option>Excellent</option><option>Good</option><option>Fair</option></select></label><label>Condition notes & description<textarea name="description" rows="3" maxlength="1000" required placeholder="What’s included? Mention scratches, wear or anything that doesn’t work."></textarea></label><h3>Where can it be picked up?</h3><label>Public locality / campus<input name="area" type="text" maxlength="80" required placeholder="e.g. Presidency University, Bengaluru"></label><label>Pickup address<textarea name="address" rows="2" maxlength="250" required placeholder="Building, street and nearby landmark"></textarea></label><div class="detail-grid"><label>City<input name="city" type="text" maxlength="60" required placeholder="e.g. Bengaluru"></label><label>PIN code<input name="postcode" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6-digit PIN"></label></div><p class="micro">Only your public locality appears on the listing. The pickup address stays in this browser and can be viewed in My listings. Use a public meetup point for the demo.</p><label>Item photos — 1 to 3<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><p class="micro">Add the full item, another angle and any wear. JPG, PNG or WebP, up to 8 MB each. Photos stay in this browser.</p><div id="photo-preview" class="photo-preview"></div><div class="trust-checks"><label class="check"><input type="checkbox" name="verified" checked> Display "✓ Email verified" badge</label><label class="check"><input type="checkbox" name="student" checked> Display "🎓 Student affiliation reviewed" badge</label></div><p id="listing-error" role="alert" class="form-error"></p><button class="button" id="publish-listing" type="submit">Add to demo marketplace ↗</button></fieldset></form>`);
 const form=$('#listing-form');let photos=existing?[...existing.photos]:[],version=0;
 const choice=$('#listing-choice');
 function chooseMode(mode){form.elements.mode.value=mode;form.hidden=false;$('#listing-fields').disabled=false;choice.hidden=true;$('#listing-step').textContent='STEP 2 OF 2 · ITEM DETAILS';form.elements.mode.onchange();$('#modal').scrollTop=0;form.elements.title.focus()}
 choice.querySelectorAll('[data-listing-mode]').forEach(button=>button.onclick=()=>chooseMode(button.dataset.listingMode));
 $('#change-listing-mode').onclick=()=>{form.hidden=true;$('#listing-fields').disabled=true;choice.hidden=false;$('#listing-step').textContent='STEP 1 OF 2 · YOUR LISTING';$('#modal-title').textContent='What would you like to do?';$('#modal').scrollTop=0;choice.querySelector(`[data-listing-mode="${form.elements.mode.value}"]`).focus()};
 form.elements.mode.onchange=()=>{const mode=form.elements.mode.value;$('#modal-title').textContent=mode==='rent'?'List your item for rent':mode==='buy'?'List your item for sale':'Share your item for free';$('#listing-mode-help').textContent=mode==='rent'?'Charge per day. Set a refundable deposit, or enter 0 for no deposit.':mode==='buy'?'Set the full purchase price. No rental deposit applies.':'No price or deposit. Someone nearby can borrow your item for free.';$('#publish-listing').textContent=existing?'Save changes ↗':mode==='rent'?'Add rental listing ↗':mode==='buy'?'Add sale listing ↗':'Add free sharing listing ↗';form.elements.deposit.disabled=mode!=='rent';form.elements.alternative.disabled=mode!=='rent';$('#deposit-label').hidden=mode!=='rent';$('#guarantor-group').hidden=mode!=='rent';$('#listing-price-label').textContent=mode==='rent'?'Price per day (₹)':'Sale price (₹)';form.elements.price.disabled=mode==='share';form.elements.price.required=mode!=='share';if(mode==='share')form.elements.price.value='0';else if(Number(form.elements.price.value)<1)form.elements.price.value='';};
 form.elements.photos.onchange=async()=>{const current=++version;photos=[];$('#photo-preview').replaceChildren();$('#listing-error').textContent='';const files=[...form.elements.photos.files];if(!files.length||files.length>3){$('#listing-error').textContent='Choose between one and three photos.';return}$('#publish-listing').disabled=true;try{const processed=await Promise.all(files.map(compressPhoto));if(current!==version||!form.isConnected)return;photos=processed;$('#photo-preview').innerHTML=photos.map((p,i)=>`<img src="${p}" alt="Your item photo ${i+1}">`).join('')}catch(error){if(form.isConnected)$('#listing-error').textContent=error.message||'That image could not be opened. Try another photo.'}finally{if(current===version&&form.isConnected)$('#publish-listing').disabled=false}};
 form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;if(!photos.length){$('#listing-error').textContent='Please add at least one valid item photo.';return}const f=new FormData(form);if(!String(f.get('title')).trim()||!String(f.get('description')).trim()||!String(f.get('area')).trim()){$('#listing-error').textContent='Please enter an item name, condition notes and pickup area.';return}if(!String(f.get('address')||'').trim()||!String(f.get('city')||'').trim()){$('#listing-error').textContent='Enter a pickup address and city.';return}const mode=f.get('mode');const item={...existing,status:existing?.mode===mode?(existing.status||'available'):'available',id:existing?existing.id:Date.now(),title:String(f.get('title')).trim(),category:f.get('category'),mode,price:mode==='share'?0:Number(f.get('price')),deposit:mode==='rent'?Number(f.get('deposit')):0,alternative:mode==='rent'&&f.get('alternative')==='on',condition:f.get('condition'),description:String(f.get('description')).trim(),area:String(f.get('area')).trim(),pickupAddress:{address:String(f.get('address')).trim(),city:String(f.get('city')).trim(),postcode:String(f.get('postcode')).trim()},photos,owner:'You (demo)',verified:f.get('verified')==='on',student:f.get('student')==='on',reviews:0,rating:null,distance:0.1,color:'#e0e5d9',emoji:'',custom:true};
  try{localStorage.setItem('dormmart-listings-v2',JSON.stringify(existing?userListings.map(x=>x.id===existing.id?item:x):[...userListings,item]))}catch{$('#listing-error').textContent='Could not save: browser storage is full or unavailable. Remove an old listing or use fewer/smaller photos.';return}
  if(existing){userListings[userListings.findIndex(x=>x.id===existing.id)]=item;LISTINGS[LISTINGS.findIndex(x=>x.id===existing.id)]=item}else{userListings.push(item);LISTINGS.push(item)}updateCategoryDropdown();$('#filters').reset();$('#sort').value='newest';closeModal();location.hash='explore';render();toast(existing?'Listing updated.':'Your item is live in this browser’s demo marketplace!');
 };
 if(existing){
  chooseMode(existing.mode);
  for(const key of ['title','category','price','deposit','condition','description','area'])form.elements[key].value=existing[key]??'';
  for(const key of ['address','city','postcode'])form.elements[key].value=existing.pickupAddress?.[key]??'';
  for(const key of ['alternative','verified','student'])form.elements[key].checked=Boolean(existing[key]);
  form.elements.photos.required=false;
  $('#photo-preview').innerHTML=photos.map((p,i)=>`<img src="${p}" alt="Current item photo ${i+1}">`).join('');
  $('#listing-step').textContent='EDIT YOUR LISTING';
  $('#listing-mode-help').textContent+=' Your current photos are kept unless you select replacement photos. Closing without saving keeps your original listing.';
 }
}
$('#list-button').onclick=openListingForm;
syncAuth();render();route();

// Owner-controlled demo status. Persist before updating the visible catalogue.
$('#modal-body').addEventListener('change',e=>{
 const control=e.target.closest('[data-listing-status]');if(!control)return;
 const item=userListings.find(x=>x.id===Number(control.dataset.listingStatus));if(!item)return;
 const old=item.status||'available',status=control.value;
 if(!['available',item.mode==='buy'?'sold':'rented'].includes(status)){control.value=old;return}
 const updated={...item,status};
 try{localStorage.setItem('dormmart-listings-v2',JSON.stringify(userListings.map(x=>x.id===item.id?updated:x)))}catch{control.value=old;toast('Could not save status. Your previous status is unchanged.');return}
 Object.assign(item,updated);render();toast('Listing status updated.');
});

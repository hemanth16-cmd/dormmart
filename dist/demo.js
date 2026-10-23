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
  showModal(`<p class="eyebrow">SAVED ON THIS DEVICE</p><h2 id="modal-title">Your things, their next chapter.</h2>${userListings.length?userListings.map(x=>`<article class="request"><h3>${escapeHTML(x.title)}</h3><p>${x.mode==='rent'?'For rent':x.mode==='buy'?'For sale':'Free to share'} · ${money(x.price)}${x.mode==='rent'?'/day':''} · ${escapeHTML(x.condition)}</p><button class="text-btn" data-remove-listing="${x.id}">Remove listing</button></article>`).join(''):'<p>You haven’t listed anything yet.</p>'}<button class="button" id="add-another">+ Add an item</button>`);
  $('#add-another').onclick=openListingForm;
}
$('#modal-body').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove-listing]');if(!b)return;
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
function openListingForm(){
 if(!demoSignedIn){syncAuth();return}
 showModal(`<p class="eyebrow">SELL IT. LEND IT. PASS IT ON.</p><h2 id="modal-title">Someone nearby needs this.</h2><p class="micro">Your listing will appear immediately in this browser’s demo catalogue.</p><form id="listing-form" class="detail-form"><label>Item name<input name="title" type="text" maxlength="70" required placeholder="e.g. Wooden study desk"></label><div class="detail-grid"><label>I want to<select name="mode"><option value="buy">Sell this item</option><option value="rent">Rent this item out</option><option value="share">Share for free</option></select></label><label>Category<select name="category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label></div><div class="detail-grid"><label><span id="listing-price-label">Sale price (₹)</span><input name="price" type="number" min="1" max="1000000" step="1" required></label><label id="deposit-label" hidden>Refundable deposit (₹)<input name="deposit" type="number" min="0" max="1000000" step="1" value="0"></label></div><label>Condition<select name="condition"><option>Like new</option><option>Excellent</option><option>Good</option><option>Fair</option></select></label><label>Condition notes & description<textarea name="description" rows="3" maxlength="1000" required placeholder="What’s included? Mention scratches, wear or anything that doesn’t work."></textarea></label><label>Approximate pickup area<input name="area" type="text" maxlength="80" required placeholder="e.g. Campus main gate"></label><label>Item photos — 1 to 3<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><p class="micro">Add the full item, another angle and any wear. JPG, PNG or WebP, up to 8 MB each. Photos stay in this browser.</p><div id="photo-preview" class="photo-preview"></div><p id="listing-error" role="alert" class="form-error"></p><button class="button" id="publish-listing" type="submit">Add to demo marketplace ↗</button></form>`);
 const form=$('#listing-form');let photos=[],version=0;
 form.elements.mode.onchange=()=>{const mode=form.elements.mode.value;$('#deposit-label').hidden=mode!=='rent';$('#listing-price-label').textContent=mode==='rent'?'Price per day (₹)':'Sale price (₹)';form.elements.price.disabled=mode==='share';form.elements.price.required=mode!=='share';if(mode==='share')form.elements.price.value='0';else if(Number(form.elements.price.value)<1)form.elements.price.value='';};
 form.elements.photos.onchange=async()=>{const current=++version;photos=[];$('#photo-preview').replaceChildren();$('#listing-error').textContent='';const files=[...form.elements.photos.files];if(!files.length||files.length>3){$('#listing-error').textContent='Choose between one and three photos.';return}$('#publish-listing').disabled=true;try{const processed=await Promise.all(files.map(compressPhoto));if(current!==version||!form.isConnected)return;photos=processed;$('#photo-preview').innerHTML=photos.map((p,i)=>`<img src="${p}" alt="Your item photo ${i+1}">`).join('')}catch(error){if(form.isConnected)$('#listing-error').textContent=error.message||'That image could not be opened. Try another photo.'}finally{if(current===version&&form.isConnected)$('#publish-listing').disabled=false}};
 form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;if(!photos.length){$('#listing-error').textContent='Please add at least one valid item photo.';return}const f=new FormData(form);if(!String(f.get('title')).trim()||!String(f.get('description')).trim()||!String(f.get('area')).trim()){$('#listing-error').textContent='Please enter an item name, condition notes and pickup area.';return}const mode=f.get('mode');const item={id:Date.now(),title:String(f.get('title')).trim(),category:f.get('category'),mode,price:mode==='share'?0:Number(f.get('price')),deposit:mode==='rent'?Number(f.get('deposit')):0,condition:f.get('condition'),description:String(f.get('description')).trim(),area:String(f.get('area')).trim(),photos,owner:'You (demo)',verified:false,student:false,reviews:0,rating:null,distance:0,color:'#e0e5d9',emoji:'',custom:true};
  try{localStorage.setItem('dormmart-listings-v2',JSON.stringify([...userListings,item]))}catch{$('#listing-error').textContent='Could not save: browser storage is full or unavailable. Remove an old listing or use fewer/smaller photos.';return}
  userListings.push(item);LISTINGS.push(item);$('#filters').reset();$('#sort').value='newest';closeModal();location.hash='explore';render();toast('Your item is live in this browser’s demo marketplace!');
 };
}
$('#list-button').onclick=openListingForm;
syncAuth();render();route();

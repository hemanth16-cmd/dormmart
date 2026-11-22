/* Live rental / free-borrow booking requests (migration 003). No payments: estimates only.
   Demo mode keeps its browser-only flow in app.js. */
if (LIVE_MODE) {
 const STATUS={pending:['Waiting for owner','status-pending'],accepted:['Accepted','status-accepted'],rejected:['Declined','status-cancelled'],cancelled:['Cancelled','status-cancelled'],completed:['Completed','status-accepted']};
 const signedIn=()=>demoSignedIn&&!!window.liveBackend?.user;
 const reader=()=>signedIn()?window.liveBackend:(window.publicBackend||window.liveBackend||null);
 const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
 const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
 let busy=false,list=[],listState='idle';
 $('#requests-button').textContent='My bookings';

 window.renderLiveBooking=async(x,form)=>{
  const generation=liveGeneration;
  const bookable=(x.mode==='rent'||x.mode==='share')&&x.listingType!=='both';
  if(x.custom){form.innerHTML='<p class="notice">This is your listing. Booking requests for it appear in <button type="button" class="text-btn" data-open-bookings>My bookings</button>.</p>';return}
  if(!bookable){form.innerHTML=`<p class="notice">${x.mode==='buy'?'Message the owner to agree the price and a public pickup point. DormMart does not take payments.':'Message the owner to discuss availability and a public pickup point.'}</p>`;return}
  form.innerHTML='<p class="micro" role="status">Checking booking availability…</p>';
  let available=false;try{available=!!reader()&&await reader().workflowsAvailable()}catch{}
  if(generation!==liveGeneration||!form.isConnected)return;
  if(!available){form.innerHTML='<p class="notice">Online booking requests are not available yet. Message the owner to discuss availability and a public pickup point.</p>';return}
  const rental=x.mode==='rent',max=rental?30:7,canBook=signedIn();
  form.innerHTML=`<div class="detail-grid"><label>Pickup date<input required type="date" name="start" min="${localDate()}" value="${localDate()}"></label><label>Return date<input required type="date" name="end" min="${nextDate()}" value="${nextDate()}"></label></div>
   <div id="booked-ranges"><p class="micro" role="status">Checking booked dates…</p></div>
   ${canBook?'<label>Note for the owner (optional)<textarea name="note" maxlength="500" rows="2" placeholder="When you would like to collect it and what you need it for"></textarea></label>':''}
   <div class="quote" id="quote" aria-live="polite"></div>
   <p class="notice">${rental?`This is an estimate, not a payment. DormMart never charges you. The owner asks for a refundable deposit of ${money(x.deposit)}, agreed and handled in person. `:'Free to borrow. '}Dates are reserved only if the owner accepts. Pickup is at ${escapeHTML(x.area||'a public campus spot')}; never share a home address.</p>
   ${canBook?'<label class="check"><input type="checkbox" name="understand" required> I understand nothing is charged and the owner must accept.</label>':''}
   <button class="button" type="submit" ${listingUnavailable(x)||!canBook?'disabled':''}>Request ${rental?'rental':'to borrow'} ↗</button>
   <p class="micro">${canBook?`1–${max} days · the return date is free for the next pickup`:GUEST_MODE?'Sending a request needs an account. Accounts are paused, so you can check dates and the estimate only.':'<button type="button" class="text-btn" data-open-signin="request dates">Sign in to send a booking request</button>'}</p>
   <p id="booking-error" class="form-error" role="alert"></p>`;
  let ranges=[];
  const accepted=()=>ranges.map((r,i)=>({id:'booked-'+i,itemId:x.id,status:'Accepted by owner',start:r.start,end:r.end}));
  function quote(){
   const data=new FormData(form),start=String(data.get('start')||''),end=String(data.get('end')||'');
   const days=dateRangeValid(start,end)?daysBetween(start,end):0;
   let error=rentalDateError(x,start,end,accepted());
   if(!error&&start<localDate())error='Pickup date has passed.';
   if(!error&&days>max)error=`Bookings can last at most ${max} days.`;
   form.elements.end.setCustomValidity(error);
   const fee=rental?x.price*days:0;
   $('#quote').innerHTML=error?escapeHTML(error):rental
    ?`${plural(days,'day')} × ${money(x.price)}<strong>${money(fee)}</strong><br>Refundable deposit, agreed in person<strong>${money(x.deposit)}</strong><hr>Estimated rental charge<strong>${money(fee)}</strong>`
    :`${plural(days,'day')} · free to borrow<strong>${money(0)}</strong>`;
   return {valid:!error,start,end,note:String(data.get('note')||'')};
  }
  form.addEventListener('input',quote);quote();
  try{ranges=await reader().bookedRanges(x.id)}catch{if(form.isConnected)$('#booked-ranges').innerHTML='<p class="micro">Booked dates could not load. The owner confirms availability when accepting.</p>';ranges=[]}
  if(generation!==liveGeneration||!form.isConnected)return;
  if($('#booked-ranges').querySelector('[role=status]'))$('#booked-ranges').innerHTML=ranges.length?ranges.map(r=>`<p class="notice">Booked from ${escapeHTML(r.start)} · available again ${escapeHTML(r.end)}</p>`).join(''):'<p class="micro">No accepted bookings yet.</p>';
  quote();
  let pending=null;
  form.onsubmit=async e=>{
   e.preventDefault();if(busy||!signedIn())return;
   const z=quote();if(!z.valid||!form.reportValidity())return;
   // One id per date choice: retrying after a lost response cannot create a duplicate request.
   const key=z.start+'|'+z.end;if(!pending||pending.key!==key)pending={key,id:crypto.randomUUID()};
   const button=form.querySelector('[type=submit]');busy=true;button.disabled=true;$('#booking-error').textContent='';
   try{
    await window.liveBackend.requestBooking(pending.id,x.id,z.start,z.end,z.note);
    if(generation!==liveGeneration)return;
    pending=null;listState='stale';
    showModal(`<p class="eyebrow">REQUEST SENT</p><h2 id="modal-title">Good things start here.</h2><p>Your request for <strong>${escapeHTML(x.title)}</strong> (${escapeHTML(z.start)} → ${escapeHTML(z.end)}) is waiting for ${escapeHTML(x.owner)} to accept or decline.</p><p class="notice">Nothing has been charged. The dates are not reserved until the owner accepts.</p><button class="button" type="button" data-open-bookings>View my bookings</button> <button class="text-btn" type="button" id="booking-done">Keep exploring</button>`);
    $('#booking-done').onclick=closeModal;
   }catch(err){if(form.isConnected)$('#booking-error').textContent=DormMartBackend.friendlyError(err,'The request could not be confirmed. Your dates are kept; retrying is safe.')}
   finally{busy=false;if(button.isConnected)button.disabled=listingUnavailable(x)}
  };
 };

 function bookingHTML(b){
  const [label,cls]=STATUS[b.status]||[b.status,'status-pending'];
  const item=LISTINGS.find(x=>x.id===b.itemId),days=daysBetween(b.start,b.end),today=localDate();
  const actions=[];
  if(b.role==='owner'&&b.status==='pending')actions.push(['accept','Accept request','button small'],['reject','Decline','text-btn']);
  if(b.role==='owner'&&b.status==='accepted'&&today>=b.start)actions.push(['complete','Mark returned / completed','button small']);
  if(b.role==='requester'&&(b.status==='pending'||(b.status==='accepted'&&b.start>today)))actions.push(['cancel','Cancel request','text-btn']);
  return `<article class="request"><div class="request-header"><h3>${escapeHTML(b.itemTitle)}</h3><span class="status-pill ${cls}">${label}</span></div>
   <p class="micro">${b.role==='owner'?'Requested by':'Owner'}: <strong>${escapeHTML(b.counterpart)}</strong><br>Dates: ${escapeHTML(b.start)} → ${escapeHTML(b.end)} (${plural(days,'day')})<br>
   ${b.mode==='rent'?`Estimated rental charge: <strong>${money(b.total)}</strong> (${plural(days,'day')} × ${money(b.dailyPrice)}) · refundable deposit agreed in person: ${money(b.deposit)}`:'Free to borrow'}<br>
   ${b.note?`Note: ${escapeHTML(b.note)}<br>`:''}${b.decisionNote?`Update: ${escapeHTML(b.decisionNote)}<br>`:''}${item?'':'This listing is no longer listed. History is kept.'}</p>
   ${b.status==='accepted'?`<div class="accepted-box"><strong>✓ Accepted.</strong> Agree a time by message and meet at ${escapeHTML(item?.area||'a public campus spot')}. Inspect the item together. Nothing was charged through DormMart.</div>`:''}
   <div class="request-actions">${actions.map(([a,t,c])=>`<button type="button" class="${c}" data-booking-action="${a}" data-booking-id="${escapeHTML(b.id)}">${t}</button>`).join('')}${b.role==='requester'&&item&&!item.custom?`<button type="button" class="text-btn" data-message-item="${escapeHTML(b.itemId)}">Message owner</button>`:''}</div></article>`;
 }
 function renderBookings(error=''){
  if(!$('#modal').open||!$('#bookings-panel'))return;
  const mine=list.filter(b=>b.role==='requester'),incoming=list.filter(b=>b.role==='owner');
  const section=(title,items,empty)=>`<h3>${title} <small>(${items.length})</small></h3>${items.length?items.map(bookingHTML).join(''):`<p class="micro">${empty}</p>`}`;
  $('#bookings-panel').innerHTML=listState==='loading'?'<p role="status">Loading your bookings…</p>':listState==='error'?'<p>Bookings could not load. <button type="button" class="text-btn" id="bookings-retry">Try again</button></p>':listState==='unavailable'?'<p>Online booking requests are not available yet.</p>':
   `<p id="bookings-error" class="form-error" role="alert">${escapeHTML(error)}</p>${section('Requests for your items',incoming,'No one has requested your items yet.')}${section('Requests you sent',mine,'Open a rental or free-sharing listing to request dates.')}<p class="micro">DormMart records requests and decisions only. No money or deposit is collected here.</p>`;
  $('#bookings-retry')?.addEventListener('click',loadBookings);
 }
 async function loadBookings(){
  const generation=liveGeneration;listState='loading';renderBookings();
  try{
   if(!(await window.liveBackend.workflowsAvailable())){listState='unavailable'}
   else{list=await window.liveBackend.bookings();listState='ready'}
  }catch{listState='error'}
  if(generation===liveGeneration)renderBookings();
 }
 window.openLiveBookings=()=>{
  if(!signedIn()){accountPrompt('see your bookings');return}
  showModal('<p class="eyebrow">RENT, BORROW, RETURN</p><h2 id="modal-title">My bookings</h2><div id="bookings-panel"></div>');
  loadBookings();
 };
 document.addEventListener('click',async e=>{
  if(e.target.closest('[data-open-bookings]')){window.openLiveBookings();return}
  const button=e.target.closest('[data-booking-action]');if(!button||busy)return;
  const action=button.dataset.bookingAction,id=button.dataset.bookingId;
  busy=true;$$('[data-booking-action]').forEach(b=>b.disabled=true);
  try{
   const status=await window.liveBackend.decideBooking(id,action);
   toast({accepted:'Booking accepted. Those dates are now reserved.',rejected:'Request declined.',cancelled:'Booking cancelled.',completed:'Marked as completed.'}[status]||'Booking updated.');
   busy=false;await loadBookings();
   if(location.hash.startsWith('#item-'))route();
  }catch(err){busy=false;renderBookings(DormMartBackend.friendlyError(err,'The change could not be confirmed. Refresh the list before trying again.'))}
 });
 window.addEventListener('dormmart-account-change',()=>{list=[];listState='idle'});
}

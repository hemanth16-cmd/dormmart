// Headless Edge: guest browsing, signed-in bookings/request board (mock SDK) and demo isolation.
// The mock SDK mimics responses only; database rules are covered by tests/workflows.test.cjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)})});
const sdk=`export function createClient(url,key,options){window.clientOptions=options;return window.fakeClient}`;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const RENT='44444444-4444-4444-8444-444444444444',SALE='55555555-5555-4555-8555-555555555555',OWN='66666666-6666-4666-8666-666666666666',REQ='77777777-7777-4777-8777-777777777777';

function mock(ids){
 const {A,B,C,RENT,SALE,OWN,REQ}=ids;
 const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 window.day=day;window.fail={};window.delay={};window.loseResponse=0;window.authCalls=0;let user=null,callback=()=>{};
 const base={description:'Works well',category:'Outdoors',deposit:0,condition:'Good',area:'Library gate',status:'active',deleted_at:null,created_at:'2026-11-20T10:00:00Z',available_from:null,available_until:null,blocked_from:null,blocked_until:null};
 window.tables={
  profiles:[{id:A,full_name:'Alice',university:'Campus',bio:''},{id:B,full_name:'Bob',university:'Campus',bio:''},{id:C,full_name:'Cara',university:'Campus',bio:''}],
  products:[{...base,id:RENT,seller_id:B,title:'Camping tent',listing_type:'rent',price:50,deposit:500,available_from:day(0),available_until:day(40),created_at:'2026-11-21T10:00:00Z'},
   {...base,id:SALE,seller_id:B,title:'Desk lamp',listing_type:'sale',price:200},{...base,id:OWN,seller_id:A,title:'My kettle',listing_type:'sale',price:300}],
  product_images:[],conversations:[],messages:[],
  item_requests:[{id:REQ,requester_id:B,title:'Projector for movie night',note:'HDMI please',category:'Electronics',request_type:'rent',budget:300,needed_by:day(9),area:'Student centre',status:'open',archived_at:null,created_at:'2026-11-21T09:00:00Z'}],
  request_offers:[],
  booking_requests:[{id:'88888888-8888-4888-8888-888888888888',product_id:RENT,requester_id:C,owner_id:B,item_title:'Camping tent',listing_type:'rent',start_date:day(10),end_date:day(12),daily_price:50,deposit:500,estimated_total:100,note:'',status:'accepted',decision_note:'',created_at:'2026-11-21T09:00:00Z'}]
 };
 window.setUser=id=>{user=id?{id}:null;if(id)sessionStorage.setItem('test-session',id);else sessionStorage.removeItem('test-session');callback(id?'SIGNED_IN':'SIGNED_OUT',user?{user}:null)};
 const err=message=>({error:{message}});
 const wait=t=>new Promise(r=>setTimeout(r,t));
 function query(table){
  let filters=[],op='read',values,single=false,limit=null,range=null;
  const q={select(){return q},is(k,v){filters.push(r=>r[k]===v);return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,vs){filters.push(r=>vs.includes(r[k]));return q},or(){return q},order(){return q},
   range(a,b){range=[a,b];return q},limit(n){limit=n;return q},single(){single=true;return q},maybeSingle(){single=true;return q},
   update(v){op='update';values=v;return q},insert(v){op='insert';values=v;return q},
   then(resolve,reject){return (async()=>{
    if(window.delay[table])await wait(window.delay[table]);
    if(window.fail[table]>0){window.fail[table]--;return {error:{message:'Failed to fetch',name:'TypeError'}}}
    if(!window.tables[table])return {error:{code:'42P01',message:'missing'}};
    let rows=window.tables[table].filter(r=>filters.every(f=>f(r)));
    if(table==='booking_requests'||table==='request_offers')rows=rows.filter(r=>user&&[r.requester_id,r.owner_id,r.offerer_id].includes(user.id)||table==='request_offers'&&user&&window.tables.item_requests.some(x=>x.id===r.request_id&&x.requester_id===user.id));
    if(op==='update'){rows.forEach(r=>Object.assign(r,values,values.archived_at?{archived_at:new Date().toISOString()}:{}))}
    if(op==='insert'){const row={id:crypto.randomUUID(),...values,created_at:new Date().toISOString()};if(table==='item_requests')Object.assign(row,{requester_id:user.id,status:'open',archived_at:null});window.tables[table].push(row);rows=[row]}
    if(limit!==null)rows=rows.slice(0,limit);if(range)rows=rows.slice(range[0],range[1]+1);
    return {data:single?rows[0]:rows};
   })().then(resolve,reject)}};
  return q;
 }
 window.fakeClient={
  auth:{onAuthStateChange(fn){window.authCalls++;callback=fn},async getSession(){window.authCalls++;const id=sessionStorage.getItem('test-session');user=id?{id}:null;return {data:{session:user?{user}:null}}},
   async signInWithPassword(){window.authCalls++;window.setUser(A);return {data:{session:{user}}}},async signOut(){window.setUser(null);return {}}},
  storage:{from:()=>({getPublicUrl:p=>({data:{publicUrl:'https://example.invalid/'+p}}),upload:async()=>({data:{}})})},
  from:query,channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},
  async rpc(name,args){
   const T=window.tables;
   if(name==='dormmart_contract_version')return {data:4};
   if(name==='dormmart_booked_ranges')return {data:T.booking_requests.filter(b=>b.product_id===args.p_product&&b.status==='accepted').map(b=>({start_date:b.start_date,end_date:b.end_date}))};
   if(name==='dormmart_request_booking'){
    if(!T.booking_requests.some(b=>b.id===args.p_id)){
     if(T.booking_requests.some(b=>b.product_id===args.p_product&&b.status==='accepted'&&b.start_date<args.p_end&&b.end_date>args.p_start))return err('Those dates overlap an accepted booking');
     const p=T.products.find(x=>x.id===args.p_product),days=(Date.parse(args.p_end)-Date.parse(args.p_start))/864e5;
     T.booking_requests.push({id:args.p_id,product_id:p.id,requester_id:user.id,owner_id:p.seller_id,item_title:p.title,listing_type:p.listing_type,start_date:args.p_start,end_date:args.p_end,daily_price:p.price,deposit:p.deposit,estimated_total:p.price*days,note:args.p_note,status:'pending',decision_note:'',created_at:new Date().toISOString()});
    }
    if(window.loseResponse>0){window.loseResponse--;return {error:{message:'Failed to fetch',name:'TypeError'}}}
    return {data:args.p_id};
   }
   if(name==='dormmart_decide_booking'){
    const b=T.booking_requests.find(x=>x.id===args.p_id);
    if(args.p_action==='accept'){if(T.booking_requests.some(o=>o!==b&&o.product_id===b.product_id&&o.status==='accepted'&&o.start_date<b.end_date&&o.end_date>b.start_date))return err('Those dates overlap an accepted booking');b.status='accepted'}
    else b.status={reject:'rejected',cancel:'cancelled',complete:'completed'}[args.p_action];
    return {data:b.status};
   }
   if(name==='dormmart_offer_listing'){let o=T.request_offers.find(x=>x.request_id===args.p_request&&x.product_id===args.p_product);if(o)Object.assign(o,{note:args.p_note,status:'active'});else T.request_offers.push(o={id:crypto.randomUUID(),request_id:args.p_request,product_id:args.p_product,offerer_id:user.id,note:args.p_note,status:'active',created_at:new Date().toISOString()});return {data:o.id}}
   if(name==='dormmart_start_conversation'){const p=T.products.find(x=>x.id===args.p_product_id);let c=T.conversations.find(x=>x.product_id===p.id&&x.buyer_id===user.id);if(!c)T.conversations.push(c={id:crypto.randomUUID(),product_id:p.id,buyer_id:user.id,seller_id:p.seller_id,created_at:new Date().toISOString()});return {data:c.id}}
   return err('unknown rpc');
  }
 };
}

async function livePage(browser,guest,extra){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(mock,{A,B,C,RENT,SALE,OWN,REQ});
 if(extra)await page.addInitScript(extra);
 await page.route('**/backend-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.DORMMART_CONFIG={mode:'supabase',url:'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:'sb_publishable_test_only',schemaVerified:true,guestMode:${guest}}`}));
 await page.route('**/vendor/supabase.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
 return {page,errors};
}
const base=()=>'http://127.0.0.1:'+server.address().port+'/';

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  // ---------------- Guest mode ----------------
  {
   const {page,errors}=await livePage(browser,true,()=>{window.delay.products=700});
   await page.goto(base()+'#explore');
   await page.locator('#result-count').getByText('Loading listings…',{exact:true}).waitFor();
   assert.equal(await page.locator('#empty').isVisible(),false,'no misleading empty state while loading');
   await page.locator('#results .card').first().waitFor();
   assert.equal(await page.locator('#results .card').count(),3);
   assert.equal(await page.locator('#radius').isVisible(),false);assert.equal(await page.locator('#verified').isVisible(),false);
   assert.equal(await page.locator('#sort option[value=distance]').count(),0);assert.equal(await page.locator('#sort').inputValue(),'newest');
   const text=await page.locator('#explore-view').innerText();assert.doesNotMatch(text,/km away|No reviews|Email verified owners|Illustrative/);
   // Saved items: scoped to this browser's guest list and survive reload.
   await page.locator(`#results [data-save="${RENT}"]`).click();await page.getByText('Saved on this browser.').waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('dormmart-saved:live:guest')),JSON.stringify(['44444444-4444-4444-8444-444444444444']));
   await page.reload();await page.locator('#results .card').first().waitFor();assert.equal(await page.locator('#saved-count').innerText(),'1');
   // Item page: dates and estimate visible, request disabled, booked range shown, nothing implies payment.
   await page.evaluate(id=>location.hash='item-'+id,RENT);await page.locator('#item-title').waitFor();
   await page.getByText(/Booked from/).waitFor();
   assert.equal(await page.locator('#booking-form [type=submit]').isDisabled(),true);
   assert.match(await page.locator('#booking-form').innerText(),/Accounts are paused/);
   assert.match(await page.locator('#quote').innerText(),/1 day × ₹50/);
   assert.doesNotMatch(await page.locator('#item-view').innerText(),/Email not verified|No reviews|paid|charged to/i);
   // Request board: readable, but posting and offering are refused without pretending.
   await page.evaluate(()=>location.hash='wanted');await page.locator('.wanted-card').first().waitFor();
   assert.equal(await page.locator('.wanted-card').count(),1);assert.match(await page.locator('.board-notice').innerText(),/Browsing as a guest/);
   await page.locator('#new-wanted').click();assert.equal(await page.locator('#wanted-form').count(),0);await page.locator('#toast').getByText(/Accounts are paused/).waitFor();
   await page.locator('[data-wanted-offer]').click();assert.equal(await page.locator('#wanted-offer-form').count(),0);
   assert.equal(await page.evaluate(()=>window.tables.item_requests.length),1);
   // Missing item and catalogue failure with retry.
   await page.evaluate(()=>location.hash='item-99999999-9999-4999-8999-999999999999');await page.getByText('This item is no longer available.').waitFor();
   await page.evaluate(()=>{sessionStorage.setItem('failOnce','1')});
   await page.addInitScript(()=>{if(sessionStorage.getItem('failOnce')){sessionStorage.removeItem('failOnce');window.fail.products=1}});
   await page.evaluate(()=>location.hash='explore');await page.reload();
   await page.locator('#result-count').getByText('Listings could not load.').waitFor();
   await page.locator('#catalogue-retry').click();await page.locator('#results .card').first().waitFor();
   assert.equal(await page.evaluate(()=>window.authCalls),0,'guest mode never touches auth');
   for(const theme of ['dark','light']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    for(const width of [390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${theme} ${width}`)}
   }
   assert.deepEqual(errors,[]);
   await page.close();
  }

  // ---------------- Signed-in live (mock SDK) ----------------
  {
   const {page,errors}=await livePage(browser,false);
   await page.goto(base());
   await page.locator('#auth-form [type=submit]:enabled').waitFor();
   await page.locator('#demo-contact').fill('alice@example.test');await page.locator('#demo-password').fill('password');await page.locator('#auth-form [type=submit]').click();
   await page.locator('#main').waitFor({state:'visible'});
   // Booking with a lost response, then a safe retry: one request only.
   await page.evaluate(id=>location.hash='item-'+id,RENT);await page.locator('#booking-form [name=start]').waitFor();
   const [s,e]=await page.evaluate(()=>[day(2),day(5)]);
   await page.locator('#booking-form [name=start]').fill(s);await page.locator('#booking-form [name=end]').fill(e);
   assert.match(await page.locator('#quote').innerText(),/3 days × ₹50\s*₹150/);
   await page.locator('#booking-form [name=understand]').check();
   await page.evaluate(()=>window.loseResponse=1);
   await page.locator('#booking-form [type=submit]').click();await page.getByText(/Could not reach DormMart/).waitFor();
   await page.locator('#booking-form [type=submit]').click();await page.getByText('REQUEST SENT').waitFor();
   assert.equal(await page.evaluate(()=>window.tables.booking_requests.filter(b=>b.requester_id==='11111111-1111-4111-8111-111111111111').length),1);
   // Overlap with an accepted booking is refused by the date check before sending.
   await page.locator('#booking-done').click();
   const [s2,e2]=await page.evaluate(()=>[day(11),day(13)]);
   await page.locator('#booking-form [name=start]').fill(s2);await page.locator('#booking-form [name=end]').fill(e2);
   assert.match(await page.locator('#quote').innerText(),/overlap an accepted booking/);
   // My bookings shows the pending request with an accurate estimate.
   await page.locator('#requests-button').click();await page.getByText('Requests you sent').waitFor();
   assert.match(await page.locator('#bookings-panel').innerText(),/Waiting for owner[\s\S]*Estimated rental charge: ₹150/);
   await page.locator('#modal .close').click();
   // Request board: create, edit, close, reopen.
   await page.evaluate(()=>location.hash='wanted');await page.locator('.wanted-card').first().waitFor();
   await page.locator('#new-wanted').click();
   await page.locator('#wanted-form [name=title]').fill('Bike pump <b>');await page.locator('#wanted-form [name=area]').fill('Hostel gate');await page.locator('#wanted-form [name=note]').fill('Just for an hour');
   await page.locator('#wanted-mode').selectOption('share');await page.locator('#wanted-form [type=submit]').click();
   await page.getByText('Request published.').waitFor();await page.locator('.wanted-card.is-mine').waitFor();
   assert.match(await page.locator('.wanted-card.is-mine h2').innerText(),/Bike pump <b>/);
   await page.locator('[data-wanted-edit]').click();await page.locator('#wanted-form [name=title]').fill('Bike pump');await page.locator('#wanted-form [type=submit]').click();
   await page.getByText('Request updated.').waitFor();
   await page.locator('[data-wanted-status]').click();await page.getByText('Request closed.').waitFor();await page.locator('.wanted-card.is-mine .request-state').getByText('✓ Closed').waitFor();
   await page.locator('[data-wanted-status]').click();await page.getByText('Request reopened.').waitFor();
   // Switch to the owner: previous account state is cleared, incoming booking can be accepted.
   await page.evaluate(id=>window.setUser(id),B);await page.waitForFunction(()=>window.liveBackend.user?.id==='22222222-2222-4222-8222-222222222222'&&demoSignedIn);
   await page.locator('#requests-button').click();await page.getByText('Requests for your items').waitFor();
   const panel=await page.locator('#bookings-panel').innerText();assert.match(panel,/Requested by: Alice/);
   await page.locator('[data-booking-action=accept]').click();await page.getByText('Booking accepted. Those dates are now reserved.').waitFor();
   // A second overlapping pending request cannot also be accepted.
   await page.evaluate(([s,e])=>window.tables.booking_requests.push({id:crypto.randomUUID(),product_id:'44444444-4444-4444-8444-444444444444',requester_id:'33333333-3333-4333-8333-333333333333',owner_id:'22222222-2222-4222-8222-222222222222',item_title:'Camping tent',listing_type:'rent',start_date:s,end_date:e,daily_price:50,deposit:500,estimated_total:50,note:'',status:'pending',decision_note:'',created_at:new Date().toISOString()}),[s,await page.evaluate(()=>day(3))]);
   await page.locator('#modal .close').click();await page.locator('#requests-button').click();await page.locator('[data-booking-action=accept]').waitFor();
   await page.locator('[data-booking-action=accept]').click();await page.getByText('Those dates overlap an accepted booking.').waitFor();
   await page.locator('#modal .close').click();
   // Owner offers a listing against Alice's request.
   await page.evaluate(()=>location.hash='wanted');await page.locator('.wanted-card').first().waitFor();
   await page.locator('.wanted-card:not(.is-mine) [data-wanted-offer]').filter({hasNot:page.locator('[disabled]')}).first();
   const aliceCard=page.locator('.wanted-card',{hasText:'Bike pump'});await aliceCard.locator('[data-wanted-offer]').click();
   await page.locator('#wanted-offer-form [name=item]').selectOption({label:'Desk lamp · Buy'});await page.locator('#wanted-offer-form textarea').fill('Spare pump included');
   await page.locator('#wanted-offer-form [type=submit]').click();await page.getByText(/Offer sent/).waitFor();
   // Back to Alice: the offer is visible to the requester with a follow-up action.
   await page.evaluate(id=>window.setUser(id),A);await page.waitForFunction(()=>window.liveBackend.user?.id==='11111111-1111-4111-8111-111111111111'&&demoSignedIn);
   await page.evaluate(()=>location.hash='explore');await page.evaluate(()=>location.hash='wanted');await page.locator('.wanted-card.is-mine').waitFor();
   assert.match(await page.locator('.wanted-card.is-mine .request-offers').innerText(),/1 offer for you[\s\S]*Desk lamp · from Bob[\s\S]*Spare pump included/);
   await page.locator('.wanted-card.is-mine [data-wanted-delete]').click();await page.locator('#confirm-wanted-delete').click();await page.getByText('Request archived.').waitFor();
   assert.equal(await page.locator('.wanted-card.is-mine').count(),0);
   // Requester cancels their booking.
   await page.locator('#requests-button').click();await page.locator('[data-booking-action=cancel]').first().click();await page.getByText('Booking cancelled.').waitFor();
   assert.deepEqual(errors,[]);
   await page.close();
  }

  // ---------------- Demo mode isolation ----------------
  {
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(!r.url().startsWith(base()))external.push(r.url())});
   await page.goto(base());
   assert.match(await page.locator('.demo').innerText(),/Demo · no real transactions/);
   await page.locator('#demo-contact').fill('demo');await page.locator('#demo-password').fill('demo');await page.locator('#auth-form [type=submit]').click();
   await page.locator('#main').waitFor({state:'visible'});
   await page.evaluate(()=>location.hash='wanted');await page.locator('.board-notice').getByText('Demo noticeboard').waitFor();
   const rental=await page.evaluate(()=>LISTINGS.find(x=>x.mode==='rent'&&!listingUnavailable(x)).id);
   await page.evaluate(id=>location.hash='item-'+id,rental);await page.locator('#booking-form').waitFor();
   await page.locator('#booking-form [type=checkbox]').check();await page.locator('#booking-form [type=submit]').click();
   await page.getByText('DEMO REQUEST SENT').waitFor();
   assert.deepEqual(external,[],'demo mode makes no network requests outside the local site');
   assert.equal(await page.evaluate(()=>typeof window.liveBackend),'undefined');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS: guest browsing (loading/error/retry, no fabricated distance/review/verification, scoped saved items, read-only board, disabled booking with estimate, missing item, themes/widths, no auth calls); signed-in mock bookings (lost-response retry without duplicates, overlap refusal, owner accept, overlap accept rejected, requester cancel) and request board (create/edit/close/reopen/offer/archive, account switching); demo mode isolated from the network.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

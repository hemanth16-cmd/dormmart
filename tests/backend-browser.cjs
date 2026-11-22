// Browser integration with a controlled SDK double. Does not assert live RLS correctness.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data)})});
const sdk=`export function createClient(){return window.fakeClient}`;
function mock(){
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',product='33333333-3333-4333-8333-333333333333',own='44444444-4444-4444-8444-444444444444',chat='55555555-5555-4555-8555-555555555555';
 let callback=()=>{},user=null;window.failSend=false;window.failSave=false;
 const base={description:'Works well',category:'Electronics',mode:'buy',price:100,deposit:0,condition:'Good',area:'Campus gate',status:'available',created_at:'2026-11-22',available_from:null,available_until:null,blocked_from:null,blocked_until:null};
 window.tables={profiles:[{id:a,full_name:'Alice',university:'Campus',bio:''},{id:b,full_name:'Bob',university:'Campus',bio:''}],products:[{...base,id:product,owner_id:b,title:'Other owner camera'},{...base,id:own,owner_id:a,title:'My camera'}],product_images:[],conversations:[],messages:[]};
 window.switchAccount=()=>{user={id:b};callback('SIGNED_IN',{user})};
 function query(table){let filters=[],operation='read',values,single=false,limit=null,range=null;
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,vs){filters.push(r=>vs.includes(r[k]));return q},or(){return q},order(){return q},range(a,b){range=[a,b];return q},limit(n){limit=n;return q},single(){single=true;return q},update(v){operation='update';values=v;return q},insert(v){operation='insert';values=v;return q},then(resolve,reject){return Promise.resolve().then(()=>{
   if(table==='messages'&&operation==='insert'&&window.failSend)return {error:{message:'Network failed'}};
   let rows=window.tables[table].filter(r=>filters.every(f=>f(r)));
   if(operation==='update'){if(window.failSave)return {error:{message:'Denied'}};rows.forEach(r=>Object.assign(r,values))}
   if(operation==='insert'){if(window.tables[table].some(r=>r.id===values.id))return {error:{code:'23505'}};window.tables[table].push({...values,created_at:new Date().toISOString()})}
   if(limit!==null)rows=rows.slice(0,limit);if(range)rows=rows.slice(range[0],range[1]+1);
   return {data:single?rows[0]:rows};
  }).then(resolve,reject)}};return q;
 }
 window.fakeClient={auth:{onAuthStateChange(fn){callback=fn},async getSession(){const id=sessionStorage.getItem('test-session');user=id?{id}:null;return {data:{session:user?{user}:null}}},async signInWithPassword({password}){if(password==='wrong')return {error:{message:'Invalid'}};user={id:a};sessionStorage.setItem('test-session',a);const session={user};callback('SIGNED_IN',session);return {data:{session}}},async signUp(){return {data:{session:null}}},async signOut(){sessionStorage.removeItem('test-session');user=null;callback('SIGNED_OUT',null);return {}}},storage:{from:()=>({getPublicUrl:p=>({data:{publicUrl:'https://flwrsjhldghbullanaqz.supabase.co/storage/v1/object/public/product-images/'+p}}),upload:async()=>({data:{}})})},from:query,
 async rpc(name,args){
  if(name==='dormmart_contract_version')return {data:1};
  if(window.failSave)return {error:{message:'Denied'}};
  if(name==='dormmart_start_conversation'){if(!window.tables.conversations.length)window.tables.conversations.push({id:chat,product_id:product,buyer_id:a,seller_id:b});return {data:chat}}
  if(name==='dormmart_save_product'){const row=window.tables.products.find(p=>p.id===args.p_id);if(row)Object.assign(row,args.p_product);else window.tables.products.push({...args.p_product,id:args.p_id,owner_id:user.id,created_at:new Date().toISOString()});return {data:args.p_id}}
  if(name==='dormmart_delete_product'){window.tables.products=window.tables.products.filter(p=>p.id!==args.p_id);return {data:args.p_id}}
 },channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(mock);
  await page.route('**/backend-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.DORMMART_CONFIG={mode:'supabase',url:'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:'sb_publishable_test_only',schemaVerified:true}"}));
  await page.route('**/vendor/supabase.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('#auth-form [type=submit]:enabled').waitFor();
  await page.locator('#demo-contact').fill('alice@example.test');await page.locator('#demo-password').fill('wrong');await page.locator('#auth-form [type=submit]').click();
  await page.getByText(/Sign-in failed/).waitFor();assert.equal(await page.locator('#main').isVisible(),false);
  await page.locator('#demo-password').fill('correct-password');await page.locator('#auth-form [type=submit]').click();await page.locator('#main').waitFor({state:'visible'});
  assert.equal(await page.locator('#results .card').count(),2);
  await page.reload();await page.locator('#main').waitFor({state:'visible'});assert.equal(await page.locator('#results .card').count(),2);
  await page.evaluate(()=>location.hash='item-33333333-3333-4333-8333-333333333333');await page.locator('#item-title').waitFor();
  assert.equal(await page.locator('#item-title').innerText(),'Other owner camera');assert.equal(await page.locator('#booking-form button').count(),0);
  await page.locator('[data-message-item]').click();await page.locator('#message-form').waitFor();assert.equal(await page.locator('#simulate-reply').count(),0);
  await page.evaluate(()=>window.failSend=true);await page.locator('#message-text').fill('Hello <script>alert(1)</script>');await page.locator('#message-form button').click();await page.getByText(/Delivery could not be confirmed/).waitFor();
  assert.equal(await page.locator('#message-text').inputValue(),'Hello <script>alert(1)</script>');
  await page.evaluate(()=>window.failSend=false);await page.locator('#message-form button').click();await page.locator('.outgoing').waitFor();assert.equal(await page.locator('.message-bubble').count(),1);
  await page.locator('#account-button').click();await page.locator('#profile-form').waitFor();assert.equal(await page.locator('.owned-card').count(),1);
  await page.locator('#profile-form [name=name]').fill('Alice updated');await page.evaluate(()=>window.failSave=true);await page.locator('#profile-form button').click();await page.getByText(/Could not save profile/).waitFor();assert.equal(await page.locator('#profile-form [name=name]').inputValue(),'Alice updated');
  await page.evaluate(()=>window.failSave=false);await page.locator('#profile-form button').click();await page.getByRole('heading',{name:'Alice updated',exact:true}).waitFor();
  await page.locator('#profile-add').click();await page.locator('[data-listing-mode=buy]').click();
  for(const [name,value] of Object.entries({title:'New shared listing',price:'200',description:'Good condition',area:'Library gate'}))await page.locator('#listing-form [name='+name+']').fill(value);
  await page.locator('[name=photos]').setInputFiles(path.join(root,'assets/camera.jpg'));await page.locator('#photo-preview img').waitFor();
  await page.locator('#publish-listing').click();await page.locator('#modal').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.tables.products.some(p=>p.title==='New shared listing')),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dormmart-listings-v2')),null);
  await page.locator('#account-button').click();await page.locator('#profile-form').waitFor();
  await page.evaluate(()=>window.switchAccount());await page.getByRole('heading',{name:'Bob',exact:true}).waitFor();assert.equal(await page.locator('.owned-card').count(),1);assert.doesNotMatch(await page.locator('#profile-view').innerText(),/Alice updated|New shared listing/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#profile-signout').click();await page.locator('#auth-screen').waitFor({state:'visible'});assert.equal(await page.locator('#profile-view').innerText(),'');assert.equal(await page.locator('#results .card').count(),0);
  await page.route('**/backend-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.DORMMART_CONFIG={mode:'supabase',url:'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:'sb_secret_rejected_test',schemaVerified:true}"}));
  await page.reload();await page.getByText(/DormMart could not connect/).waitFor();assert.equal(await page.locator('#auth-form [type=submit]').isDisabled(),true);assert.equal(await page.locator('#main').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: live auth, UUID routing, listing publish, message retry, profile failure, account isolation and mobile layout (mock SDK).');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

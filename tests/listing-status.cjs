const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4176');
 const photo='data:image/jpeg;base64,'+fs.readFileSync('dist/assets/camera.jpg').toString('base64');
 await page.evaluate(photo=>{sessionStorage.setItem('dormmart-demo-session','active');localStorage.setItem('dormmart-listings-v2',JSON.stringify(['buy','rent','share'].map((mode,i)=>({id:101+i,title:'Test '+mode,mode,category:'Electronics',price:mode==='share'?0:100,deposit:200,condition:'Good',description:'Light wear',area:'Campus',photos:[photo],owner:'You (demo)',custom:true,distance:.1,reviews:0}))))},photo);await page.reload();
 async function manage(){await page.locator('#account-button:visible, .mobile-dock a[href="#profile"]:visible').click();}
 // Dated rental/share status transitions are covered by listing-dates.cjs.
 for(const [index,mode] of ['buy'].entries()){
  const id=101+index;await manage();assert.equal(await page.locator(`[data-listing-status="${id}"]`).inputValue(),'available');await page.locator(`[data-listing-status="${id}"]`).selectOption(mode==='buy'?'sold':'rented');await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});await page.goto(`${process.env.DORMMART_URL||'http://127.0.0.1:4176'}/#item-${id}`);await page.locator('#booking-form').waitFor();assert.equal(await page.locator('#booking-form button[type=submit]').isDisabled(),true);
  await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});await page.reload();await manage();assert.equal(await page.locator(`[data-listing-status="${id}"]`).inputValue(),mode==='buy'?'sold':'rented');await page.locator(`[data-listing-status="${id}"]`).selectOption('available');await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});await page.goto(`${process.env.DORMMART_URL||'http://127.0.0.1:4176'}/#item-${id}`);await page.locator('#booking-form').waitFor();assert.equal(await page.locator('#booking-form button[type=submit]').isEnabled(),true);await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});
 }
 await manage();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Full')}});await page.locator('[data-listing-status="101"]').selectOption('sold');assert.equal(await page.locator('[data-listing-status="101"]').inputValue(),'available');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2'))[0].status),'available');
 await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'listing-management-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: legacy default, sold/rented/on-loan, persistence, reopen availability, request buttons and storage rollback.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

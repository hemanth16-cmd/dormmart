const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4176');
 const photo='data:image/jpeg;base64,'+fs.readFileSync('dist/assets/camera.jpg').toString('base64');
 await page.evaluate(photo=>{sessionStorage.setItem('dormmart-demo-session','active');localStorage.setItem('dormmart-listings-v2',JSON.stringify([{id:101,title:'Test camera',mode:'rent',availableFrom:'2026-01-01',availableUntil:'2099-12-31',category:'Electronics',price:100,deposit:200,condition:'Good',description:'Light wear',area:'Campus',pickupAddress:{address:'Building 1',city:'Bengaluru',postcode:'560064'},photos:[photo],owner:'You (demo)',custom:true,distance:.1,reviews:0}]))},photo);await page.reload();
 async function edit(){await page.locator('#account-button').click();await page.locator('[data-edit-listing="101"]').click()}
 await edit();assert.equal(await page.locator('[name=title]').inputValue(),'Test camera');await page.locator('[name=title]').fill('Unsaved title');await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});
 await edit();assert.equal(await page.locator('[name=title]').inputValue(),'Test camera');await page.locator('[name=title]').fill('Updated camera');await page.locator('[name=price]').fill('175');await page.locator('[name=address]').fill('Building 2');await page.locator('#publish-listing').click();await page.getByRole('heading',{name:'Updated camera',exact:true}).waitFor();
 await page.reload();const items=await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2')));assert.equal(items.length,1);assert.equal(items[0].id,101);assert.equal(items[0].price,175);assert.equal(items[0].photos[0],photo);assert.equal(items[0].pickupAddress.address,'Building 2');
 await edit();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Full')}});await page.locator('[name=title]').fill('Must not save');await page.locator('#publish-listing').click();assert.ok((await page.locator('#listing-error').innerText()).includes('Could not save'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2'))[0].title),'Updated camera');assert.deepEqual(errors,[]);console.log('PASS: editor prefill, cancel, in-place update, photo preservation, persistence and storage failure.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

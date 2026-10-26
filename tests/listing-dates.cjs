const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4177');
 const photo='data:image/jpeg;base64,'+fs.readFileSync('dist/assets/camera.jpg').toString('base64');
 await page.evaluate(photo=>{localStorage.clear();sessionStorage.setItem('dormmart-demo-session','active');localStorage.setItem('dormmart-listings-v2',JSON.stringify([{id:101,title:'Date test camera',mode:'rent',category:'Electronics',price:100,deposit:0,condition:'Good',description:'Working',area:'Campus',pickupAddress:{address:'Gate',city:'Bengaluru',postcode:'560001'},photos:[photo],owner:'You',custom:true,distance:.1,reviews:0}]))},photo);await page.reload();
 async function manage(){await page.locator('#account-button').click();}
 await manage();await page.locator('[data-edit-listing="101"]').click();
 const f=page.locator('#listing-form');
 await f.locator('[name=availableFrom]').fill('2030-01-01');await f.locator('[name=availableUntil]').fill('2030-02-01');await f.locator('[name=hasBlockedDates]').check();
 await f.locator('[name=blockedFrom]').fill('2030-01-10');await f.locator('[name=blockedUntil]').fill('2030-01-09');await page.locator('#publish-listing').click();assert.match(await page.locator('#listing-error').innerText(),/blocked dates/);
 await f.locator('[name=blockedUntil]').fill('2030-01-15');await page.locator('#publish-listing').click();await page.reload();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2'))[0].blockedUntil),'2030-01-15');
 await page.evaluate(()=>openItem(101));assert.match(await page.locator('#item-view').innerText(),/Unavailable from 2030-01-10/);
 const b=page.locator('#booking-form');await b.locator('[name=start]').fill('2030-01-11');await b.locator('[name=end]').fill('2030-01-14');assert.match(await page.locator('#quote').innerText(),/already rented/);
 await b.locator('[name=start]').fill('2030-01-15');await b.locator('[name=end]').fill('2030-01-17');assert.match(await page.locator('#quote').innerText(),/Estimated total/);
 await b.locator('[type=checkbox]').check();await b.locator('[type=submit]').click();await page.locator('#done').click();await page.locator('#requests-button').click();await page.locator('[data-simulate-accept]').click();assert.match(await page.locator('#modal-body').innerText(),/on 2030-01-15/);
 await page.keyboard.press('Escape');await page.evaluate(()=>openItem(101));await b.locator('[name=start]').fill('2030-01-16');await b.locator('[name=end]').fill('2030-01-18');assert.match(await page.locator('#quote').innerText(),/accepted booking/);
 await page.keyboard.press('Escape');await manage();await page.locator('[data-listing-status]').selectOption('available');await page.keyboard.press('Escape');await manage();await page.locator('[data-listing-status]').selectOption('rented');assert.equal(await f.locator('[name=hasBlockedDates]').isChecked(),true);await page.keyboard.press('Escape');
 await manage();await page.locator('[data-edit-listing]').click();await f.locator('[name=mode]').selectOption('buy');assert.equal(await page.locator('#rental-dates').isVisible(),false);assert.equal(await f.locator('[name=availableFrom]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: date editing, validation, reload, blocked dates, adjacent booking, accepted overlap, status date form, sale mode.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

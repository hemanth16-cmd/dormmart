const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4175');
 await page.locator('#demo-contact').fill('demo');await page.locator('#demo-password').fill('demo');await page.locator('#auth-form button[type=submit]').click();
 for(const mode of ['buy','rent','share']){
  await page.locator('#list-button').click();
  assert.equal(await page.locator('#listing-form').isVisible(),false);
  await page.locator(`[data-listing-mode="${mode}"]`).click();
  await page.locator('[name=title]').fill('Test '+mode);
  await page.locator('#change-listing-mode').click();await page.locator(`[data-listing-mode="${mode}"]`).click();
  assert.equal(await page.locator('[name=title]').inputValue(),'Test '+mode);
  assert.equal(await page.locator('#deposit-label').isVisible(),mode==='rent');
  if(mode!=='share')await page.locator('[name=price]').fill('100');
  if(mode==='rent')await page.locator('[name=deposit]').fill('300');
  await page.locator('textarea[name=description]').fill('Light wear, fully working.');
  await page.locator('[name=area]').fill('Campus locality');await page.locator('[name=address]').fill('Private demo address 42');await page.locator('[name=city]').fill('Bengaluru');await page.locator('[name=postcode]').fill('12');
  await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/camera.jpg'));await page.locator('#photo-preview img').waitFor();
  if(await page.locator('[name=availableFrom]').isVisible()){await page.locator('[name=availableFrom]').fill('2026-01-01');await page.locator('[name=availableUntil]').fill('2099-12-31')}await page.locator('#publish-listing').click();assert.equal(await page.locator('#listing-form').isVisible(),true);
  await page.locator('[name=postcode]').fill('560064');if(await page.locator('[name=availableFrom]').isVisible()){await page.locator('[name=availableFrom]').fill('2026-01-01');await page.locator('[name=availableUntil]').fill('2099-12-31')}await page.locator('#publish-listing').click();
  await page.locator('#results').getByRole('link',{name:'Test '+mode,exact:true}).waitFor();
  await page.reload();await page.locator('#results').getByRole('link',{name:'Test '+mode,exact:true}).click();
  await page.locator('#modal[open]').waitFor();assert.ok(!(await page.locator('#modal-body').innerText()).includes('Private demo address 42'));
  await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});await page.locator('#account-button').click();await page.locator('.pickup-details summary').click();assert.ok((await page.locator('#profile-view').innerText()).includes('Private demo address 42'));
  await page.locator('[data-remove-listing]').click();await page.locator('#confirm-remove-listing').click();await page.evaluate(()=>{if(document.querySelector('#modal').open)closeModal();else{location.hash='explore';route()}});
 }
 await page.locator('#list-button').click();await page.locator('#listing-choice').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'listing-choice-mobile.png'});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'listing-choice-desktop.png'});
 assert.deepEqual(errors,[]);console.log('PASS: sell/rent/share, mode-first flow, back preserves draft, price/deposit visibility, PIN validation, photo upload, reload persistence, address separation, removal, mobile overflow.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4178');
 const photos=['camera','chair'].map(n=>'data:image/jpeg;base64,'+fs.readFileSync(`dist/assets/${n}.jpg`).toString('base64'));
 await page.evaluate(photos=>{sessionStorage.setItem('dormmart-demo-session','active');localStorage.setItem('dormmart-listings-v2',JSON.stringify([{id:101,title:'Photo test',mode:'rent',category:'Electronics',price:100,deposit:200,condition:'Good',description:'Working',area:'Campus',pickupAddress:{address:'Demo gate',city:'Bengaluru',postcode:'560064'},photos,owner:'You',custom:true,distance:.1,reviews:0}]))},photos);await page.reload();
 async function edit(){await page.locator('#account-button').click();await page.locator('#my-listings').click();await page.locator('[data-edit-listing="101"]').click()}
 const persisted=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2'))[0].photos);
 await edit();await page.locator('[data-cover-photo="1"]').click();assert.equal(await page.locator('#photo-preview img').first().getAttribute('src'),photos[1]);await page.locator('.close').click();assert.deepEqual(await persisted(),photos);
 await edit();await page.locator('[name=photos]').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('no image')});await page.getByText('Choose JPG, PNG or WebP photos, up to 8 MB each.',{exact:true}).waitFor();assert.equal(await page.locator('#photo-preview img').count(),2);
 await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/books.jpg'));await page.locator('.photo-tile').nth(2).waitFor();assert.equal(await page.locator('#photo-preview img').first().getAttribute('src'),photos[0]);
 await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/lamp.jpg'));assert.ok((await page.locator('#listing-error').innerText()).includes('up to three'));assert.equal(await page.locator('#photo-preview img').count(),3);
 await page.locator('[data-remove-photo="2"]').click();await page.locator('[data-cover-photo="1"]').click();await page.locator('#publish-listing').click();await page.getByRole('link',{name:'Photo test',exact:true}).waitFor();await page.reload();assert.deepEqual(await persisted(),[photos[1],photos[0]]);
 await page.goto('http://127.0.0.1:4178/#explore');await page.getByRole('link',{name:'Photo test',exact:true}).waitFor();assert.equal(await page.locator('#results .card').filter({hasText:'Photo test'}).locator('img').getAttribute('src'),photos[1]);
 await edit();await page.locator('[data-remove-photo="1"]').click();await page.locator('[data-remove-photo="0"]').click();await page.locator('#publish-listing').click();assert.ok((await page.locator('#listing-error').innerText()).includes('at least one'));assert.equal((await persisted()).length,2);
 await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/camera.jpg'));await page.locator('#photo-preview img').waitFor();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Full')}});await page.locator('#publish-listing').click();assert.ok((await page.locator('#listing-error').innerText()).includes('Could not save'));assert.equal((await persisted()).length,2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('PASS: cover selection, cancel, invalid upload preservation, append, limit, remove, persisted order, card cover, last-photo validation, storage rollback and mobile width.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

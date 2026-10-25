const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4177');
 const photo='data:image/jpeg;base64,'+fs.readFileSync('dist/assets/camera.jpg').toString('base64');
 await page.evaluate(photo=>{sessionStorage.setItem('dormmart-demo-session','active');localStorage.setItem('dormmart-listings-v2',JSON.stringify([{id:101,title:'Camera <test>',mode:'rent',category:'Electronics',price:100,condition:'Good',description:'Working',area:'Campus',photos:[photo],owner:'You',custom:true,distance:.1,reviews:0}]));localStorage.setItem('dormmart-saved','[101]');localStorage.setItem('dormmart-requests',JSON.stringify([{id:'request-1',itemId:101,status:'Pending owner acceptance'}]))},photo);await page.reload();
 async function manage(){await page.locator('#account-button').click();}
 const count=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-listings-v2')).length);
 await manage();await page.locator('[data-remove-listing]').click();assert.equal(await count(),1);assert.equal(await page.locator('#keep-listing').evaluate(e=>e===document.activeElement),true);assert.ok((await page.locator('#modal-body').innerText()).includes('Camera <test>'));
 await page.locator('#keep-listing').click();assert.equal(await count(),1);await page.locator('[data-remove-listing]').click();await page.keyboard.press('Escape');assert.equal(await count(),1);
 await manage();await page.locator('[data-remove-listing]').click();await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Storage full')}});await page.locator('#confirm-remove-listing').click();assert.ok((await page.locator('#remove-error').innerText()).includes('unchanged'));assert.equal(await count(),1);
 await page.reload();await manage();await page.locator('[data-remove-listing]').click();await page.locator('#confirm-remove-listing').click();assert.equal(await count(),0);await page.reload();assert.equal(await count(),0);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-saved'))),[]);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dormmart-requests')).length),1);assert.deepEqual(errors,[]);
 console.log('PASS: confirmation, safe initial focus, cancel/Escape, escaped title, storage failure, confirmed removal, reload persistence, saved cleanup and retained requests.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

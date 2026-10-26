const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4183');await page.locator('#demo-contact').fill('demo');await page.locator('#demo-password').fill('demo');await page.locator('#auth-form [type=submit]').click();
assert.equal(await page.locator('.depth-scene').count(),1);assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'true');
await page.screenshot({path:'motion-home-desktop.png',animations:'disabled'});
await page.locator('nav a[href="#explore"]').click();const card=page.locator('#results .card').first();await card.scrollIntoViewIfNeeded();await card.hover({position:{x:30,y:60}});await page.waitForFunction(()=>document.querySelector('#results .card').classList.contains('is-tilting'));
assert.notEqual(await card.evaluate(e=>getComputedStyle(e).transform),'none');await card.locator('[data-save]').click();assert.equal(await page.locator('#saved-count').innerText(),'1');
await page.locator('#results .card-link').first().click();await page.locator('#item-view').waitFor({state:'visible'});await page.locator('.item-back').click();
await page.locator('#motion-toggle').click();assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'false');await page.reload();assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.hero-object.camera').evaluate(e=>getComputedStyle(e).animationName),'none');
await page.locator('#motion-toggle').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#motion-toggle').disabled);assert.equal(await page.locator('.hero-object.camera').evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.is-tilting').count(),0);
await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('nav a[href="#home"]').click();
for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);if(width===390)await page.screenshot({path:'motion-home-mobile.png',animations:'disabled',fullPage:true});}
await page.locator('#account-button').click();await page.locator('#profile-view').waitFor({state:'visible'});assert.equal(await page.locator('#profile-add').isEnabled(),true);assert.deepEqual(errors,[]);
console.log('PASS: scene, pointer tilt, saved items, item modal, persistent motion switch, reduced motion, responsive layout, profile access and no runtime errors.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

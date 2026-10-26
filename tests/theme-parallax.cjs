const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.DORMMART_URL||'http://127.0.0.1:4184'));await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
await page.locator('#demo-contact').fill('demo');await page.locator('#demo-password').fill('demo');await page.locator('#auth-form [type=submit]').click();
await page.locator('.hero-art').hover({position:{x:300,y:180}});await page.waitForFunction(()=>document.querySelector('.camera').style.getPropertyValue('--drift-x')!=='');
const before=await page.locator('.camera').evaluate(e=>e.style.getPropertyValue('--drift-x'));await page.locator('.hero-art').hover({position:{x:100,y:320}});await page.waitForFunction(b=>document.querySelector('.camera').style.getPropertyValue('--drift-x')!==b,before);
await page.locator('.header .logo').hover();await page.waitForFunction(()=>document.querySelector('.camera').style.getPropertyValue('--drift-x')==='');
await page.screenshot({path:'dark-home.png',animations:'disabled'});
await page.locator('nav a[href="#explore"]').click();await page.locator('#results .card-link').first().click();await page.locator('#item-view').waitFor({state:'visible'});await page.screenshot({path:'dark-item.png',animations:'disabled'});await page.locator('.item-back').click();
await page.locator('#account-button').click();await page.locator('#profile-view').waitFor({state:'visible'});await page.screenshot({path:'dark-profile.png',animations:'disabled'});
await page.locator('nav a[href="#messages"]').click();await page.locator('#messages-view').waitFor({state:'visible'});await page.screenshot({path:'dark-messages.png',animations:'disabled'});
await page.locator('nav a[href="#home"]').click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.hero-art').hover();assert.equal(await page.locator('.camera').evaluate(e=>e.style.getPropertyValue('--drift-x')),'');
for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);if(width===390)await page.screenshot({path:'dark-mobile.png',animations:'disabled'});}
await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.deepEqual(errors,[]);
const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});await mobile.goto((process.env.DORMMART_URL||'http://127.0.0.1:4184'));assert.equal(await mobile.locator('html').getAttribute('data-theme'),'dark');await mobile.close();
console.log('PASS: parallax movement/reset, reduced motion, theme persistence, system theme, modal/profile/messages, 320–1440 widths, no runtime errors.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});


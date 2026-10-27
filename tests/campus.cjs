const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DORMMART_URL||'http://127.0.0.1:4187');
 await page.locator('#demo-contact').fill('demo');await page.locator('#demo-password').fill('demo');await page.locator('#auth-form button[type=submit]').click();
 assert.equal(await page.evaluate(()=>LISTINGS.filter(x=>!x.custom).length),20);
 assert.equal(await page.evaluate(()=>new Set(LISTINGS.map(x=>x.image)).size),20);
 await page.screenshot({path:'campus-home.png',fullPage:true});
 await page.locator('.header a[href="#wanted"]').click();await page.locator('#wanted-view').waitFor({state:'visible'});
 assert.equal(await page.locator('.wanted-card').count(),3);
 await page.locator('#new-wanted').click();await page.locator('#wanted-form [name=title]').fill('Tripod <test>');await page.locator('#wanted-form [name=area]').fill('Library');await page.locator('#wanted-form [name=note]').fill('Need a steady tripod for two days.');await page.locator('#wanted-mode').selectOption('share');assert.equal(await page.locator('#wanted-budget-label').isVisible(),false);await page.locator('#wanted-form button[type=submit]').click();
 assert.equal(await page.locator('.wanted-card').count(),1);assert.match(await page.locator('.wanted-card h2').innerText(),/Tripod <test>/);
 await page.reload();await page.locator('[data-wanted-filter=mine]').click();assert.equal(await page.locator('.wanted-card').count(),1);
 await page.locator('[data-wanted-edit]').click();await page.locator('#wanted-form [name=title]').fill('Tripod updated');await page.locator('#wanted-form button[type=submit]').click();assert.equal(await page.locator('.wanted-card h2').innerText(),'Tripod updated');
 await page.locator('[data-wanted-status]').click();assert.match(await page.locator('.request-state').innerText(),/Found it/);await page.locator('[data-wanted-status]').click();
 await page.locator('[data-wanted-delete]').click();await page.locator('#cancel-wanted-delete').click();assert.equal(await page.locator('.wanted-card').count(),1);
 await page.locator('[data-wanted-delete]').click();await page.locator('#confirm-wanted-delete').click();assert.equal(await page.locator('.wanted-card').count(),0);
 await page.locator('[data-wanted-filter=all]').click();await page.locator('[data-wanted-offer]').first().click();await page.locator('#offer-add-listing').waitFor();await page.locator('#modal .close').click();
 // Seed an owned listing to exercise offer persistence without repeating photo-upload tests.
 await page.evaluate(()=>{const item={...LISTINGS[0],id:9001,title:'My projector',custom:true,photos:[],status:'available'};userListings.push(item);LISTINGS.push(item)});
 await page.locator('[data-wanted-offer]').first().click();await page.locator('#wanted-offer-form textarea').fill('Available Friday, with HDMI cable.');await page.locator('#wanted-offer-form button').click();assert.match(await page.locator('.request-offers').innerText(),/saved demo offer/);
 await page.locator('.request-offers summary').click();await page.locator('.request-offers a').click();await page.locator('#item-view').waitFor({state:'visible'});await page.locator('.item-back').click();await page.locator('#wanted-view').waitFor({state:'visible'});await page.reload();assert.equal(await page.locator('.request-offers').count(),1);
 await page.locator('#wanted-search').fill('does not exist');assert.equal(await page.locator('.wanted-card').count(),0);await page.locator('#wanted-search').fill('');
 await page.screenshot({path:'campus-board.png',fullPage:true});
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);for(const hash of ['home','wanted','explore','profile','messages']){await page.evaluate(h=>location.hash=h,hash);await page.waitForTimeout(80);for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${theme} ${hash} ${width}`)}if(theme==='dark'&&hash==='home')await page.screenshot({path:'campus-dark.png',fullPage:true});if(theme==='dark'&&hash==='wanted')await page.screenshot({path:'campus-board-dark.png',fullPage:true});}}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.documentElement.dataset.theme='light';location.hash='home'});await page.waitForTimeout(100);await page.screenshot({path:'campus-mobile.png',fullPage:true});await page.locator('.collection-grid').screenshot({path:'campus-mobile-collections.png'});await page.locator('.mobile-dock a[href="#wanted"]').click();await page.locator('#wanted-view').waitFor({state:'visible'});
 // Simulate storage denial: a failed post must not appear as successfully saved.
 await page.evaluate(()=>Storage.prototype.setItem=function(){throw Error('quota')});await page.locator('#new-wanted').click();await page.locator('#wanted-form [name=title]').fill('Cannot save');await page.locator('#wanted-form [name=area]').fill('Library');await page.locator('#wanted-form [name=note]').fill('test');await page.locator('#wanted-form button[type=submit]').click();assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);assert.match(await page.locator('#toast').innerText(),/Could not save/);
 assert.deepEqual(errors,[]);console.log('PASS: 20 unique photos/items; requests, offers, persistence, ownership controls, safe text, storage failure; light/dark 320–1440px; mobile navigation.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

// Run with Playwright installed: node tests/browser.cjs [optional module path]
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4174');
 assert.equal(await page.locator('#auth-screen').isVisible(),true);
 await page.locator('#demo-contact').fill('anything');await page.locator('#demo-password').fill('x');await page.locator('#auth-form button[type=submit]').click();
 await page.locator('#home-view').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('anything')),false);
 await page.locator('#list-button').click();
 await page.locator('[name=title]').fill('My demo camera');await page.locator('#listing-form [name=mode]').selectOption('rent');
 await page.locator('[name=price]').fill('99');await page.locator('[name=deposit]').fill('200');await page.locator('textarea[name=description]').fill('Small scratch on base. Lens and buttons work.');await page.locator('[name=area]').fill('North gate');
 await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/camera.jpg'));
 await page.locator('#photo-preview img').waitFor();await page.locator('#publish-listing').click();
 await page.locator('#results').getByRole('link',{name:'My demo camera',exact:true}).waitFor();
 await page.reload();await page.locator('#results').getByRole('link',{name:'My demo camera',exact:true}).click();
 await page.getByText('Small scratch on base. Lens and buttons work.',{exact:true}).waitFor();
 assert.ok((await page.locator('#quote').innerText()).includes('299'));
 await page.locator('.close').click();
 await page.locator('#account-button').click();await page.locator('#my-listings').click();await page.locator('[data-remove-listing]').click();
 assert.ok((await page.locator('#modal-body').innerText()).includes('haven’t listed'));
 await page.locator('.close').click();
 for(const mode of ['buy','share']){
 await page.locator('#list-button').click();await page.locator('[name=title]').fill('Demo '+mode);await page.locator('#listing-form [name=mode]').selectOption(mode);
 if(mode==='buy')await page.locator('[name=price]').fill('450');
 await page.locator('textarea[name=description]').fill('Good condition, minor wear.');await page.locator('[name=area]').fill('Campus gate');await page.locator('[name=photos]').setInputFiles(path.resolve('dist/assets/chair.jpg'));await page.locator('#photo-preview img').waitFor();await page.locator('#publish-listing').click();await page.locator('#results').getByRole('link',{name:'Demo '+mode,exact:true}).waitFor();
 await page.locator('#account-button').click();await page.locator('#my-listings').click();await page.locator('[data-remove-listing]').click();await page.locator('.close').click();
 }
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4174/#home');await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Home overflow at ${width}`);await page.goto('http://127.0.0.1:4174/#explore');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Explore overflow at ${width}`)}
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.card').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.goto('http://127.0.0.1:4174/#home');await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'../dormmart-home-updated.png',fullPage:true});
 await page.locator('#account-button').click();await page.locator('#sign-out').click();assert.equal(await page.locator('#auth-screen').isVisible(),true);
 await page.screenshot({path:'../dormmart-login-updated.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: demo login, no contact storage, rental listing/photo/quote, persistence, removal, responsive widths, reduced motion, logout; no JS errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


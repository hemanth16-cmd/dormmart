#!/usr/bin/env node
/*
 * DormMart live verification against the REAL Supabase project.
 *
 * Run this yourself. It signs in three dedicated TEST accounts whose credentials live only
 * in the ignored file .env.test.local; it never prints passwords or full email addresses.
 *
 *   node scripts/live-check.cjs                  -> explains what it will do, writes nothing
 *   node scripts/live-check.cjs --sign-in-only   -> only diagnoses sign-in for A, B and C
 *   node scripts/live-check.cjs --confirm-writes -> full run (creates test data, see below)
 *
 * Data written with --confirm-writes (test accounts only):
 *   - A's profile bio is changed and then restored.
 *   - Three listings titled "[live check] ..." owned by A, with small photo uploads.
 *     They are ARCHIVED at the end (deleted_at set), never hard-deleted.
 *   - One conversation between B (buyer) and A (seller) with a few messages. These remain,
 *     because the app preserves chat history.
 *   - After migration 003 only: two booking requests on the test rental (then cancelled /
 *     declined), one "[live check]" item request by A (then archived) and one offer from B
 *     with a "[live check]" listing (then archived). History rows remain by design.
 * It uses only the publishable key: every request is subject to the same RLS as the app.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');

const root=path.resolve(__dirname,'..');
for(const file of ['.env.local','.env.test.local'])if(fs.existsSync(path.join(root,file)))process.loadEnvFile(path.join(root,file));
const URL_=process.env.SUPABASE_URL||'https://flwrsjhldghbullanaqz.supabase.co';
const KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'';
const args=new Set(process.argv.slice(2));
const accounts=['A','B','C'].map(n=>({name:n,email:process.env[`DORMMART_TEST_${n}_EMAIL`]||'',password:process.env[`DORMMART_TEST_${n}_PASSWORD`]||''}));
const mask=e=>e.replace(/^(.).*(@.*)$/,'$1***$2');

if(!/^sb_publishable_/.test(KEY)){console.error('SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) is missing from .env.local. Secret keys are refused.');process.exit(2)}
if(accounts.some(a=>!a.email||!a.password)){
  console.error('Missing test accounts. Create .env.test.local next to package.json with:\n'+
    accounts.map(a=>`DORMMART_TEST_${a.name}_EMAIL=...\nDORMMART_TEST_${a.name}_PASSWORD=...`).join('\n')+
    '\nUse three dedicated, confirmed test accounts (not real users). The file is ignored by Git.');
  process.exit(2);
}
if(!args.has('--confirm-writes')&&!args.has('--sign-in-only')){
  console.log(fs.readFileSync(__filename,'utf8').split('*/')[0].replace(/^\/\*\n?/,'').replace(/^ \* ?/gm,''));
  process.exit(0);
}

const results=[];let failed=0;
function record(ok,name,detail=''){results.push({ok,name});if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  -- '+detail:''}`)}
const prerequisites=new Set([
  'database contract version is 4',
  'trigger-created profiles exist for A, B and C',
  "A uploads photos into A's own folder",
  'A creates a sale listing with two photos (atomic RPC)',
  'A creates a rental with deposit, dates and a blocked range',
  'A creates a free-sharing listing',
  'B starts a conversation; repeating returns the same conversation',
  'B sends a message',
  'rental is still active for booking tests',
  'B requests the rental; retry with the same id does not duplicate',
  'C sends an overlapping pending request',
  'A posts a request; anonymous visitors can read it but not write'
]);
async function check(name,fn){try{const detail=await fn();record(true,name,typeof detail==='string'?detail:'')}catch(e){record(false,name,e.message);if(prerequisites.has(name))throw Error('Prerequisite failed; dependent checks were not run. Test records/uploads may remain. Fix the reported error before retrying.')}}
function must(cond,message){if(!cond)throw Error(message)}
const errText=e=>e?[e.code,e.statusCode||e.status,e.message].filter(Boolean).join(' / ').slice(0,160):'';
async function denied(promise,label){const r=await promise;must(r.error,`${label} was ALLOWED (expected denial)`);must(['42501','23514','23P01','P0001','AccessDenied','EntityTooLarge','InvalidMimeType','Duplicate'].includes(r.error.code),`${label}: unexpected error, not a proven denial: ${errText(r.error)}`);return 'denied: '+errText(r.error)}
const client=()=>createClient(URL_,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

function explainSignIn(error){
  return {
    invalid_credentials:'wrong password OR no such account (an unconfirmed account with the right password reports email_not_confirmed instead)',
    email_not_confirmed:'password is correct but the email is not confirmed: confirm it, or recreate the test user with "Auto Confirm User"',
    over_request_rate_limit:'too many attempts; wait and retry',
    user_banned:'account is banned'
  }[error?.code]||errText(error);
}

(async()=>{
  console.log(`Project: ${URL_}\n`);
  const users={};
  for(const a of accounts){
    const c=client();
    const {data,error}=await c.auth.signInWithPassword({email:a.email,password:a.password});
    record(!error,`sign in ${a.name} (${mask(a.email)})`,error?`${error.code||''}: ${explainSignIn(error)}`:'');
    if(!error)users[a.name]={c,id:data.user.id,confirmed:!!data.user.email_confirmed_at};
  }
  if(Object.keys(users).length<3){console.log(`\n${failed} failure(s). Fix sign-in before the full run.`);process.exit(1)}
  if(new Set(Object.values(users).map(u=>u.id)).size<3){record(false,'three distinct accounts','two variables point to the same account');process.exit(1)}
  if(args.has('--sign-in-only')){console.log('\nAll three test accounts can sign in.');process.exit(0)}

  const {A,B,C}=users,anon=client();
  const bucketA=A.c.storage.from('product-images'),bucketB=B.c.storage.from('product-images');
  const jpeg=fs.readFileSync(path.join(root,'dist/assets/camera.jpg'));
  const created=[];
  const listing={title:'[live check] Desk lamp',description:'Automated DormMart live verification listing.',category:'Home & living',listing_type:'sale',price:120,deposit:0,condition:'Good',area:'Library gate',status:'active',available_from:null,available_until:null,blocked_from:null,blocked_until:null};
  const upload=async(bucket,owner,product,bytes=jpeg,type='image/jpeg')=>{const p=`${owner}/${product}/${crypto.randomUUID()}.jpg`;const r=await bucket.upload(p,bytes,{contentType:type,upsert:false});return {path:p,...r}};
  const publicStatus=async p=>(await fetch(`${URL_}/storage/v1/object/public/product-images/${p}`,{method:'GET'})).status;
  const save=(u,id,product,paths,create)=>u.c.rpc('dormmart_save_product',{p_id:id,p_product:product,p_paths:paths,p_create:create});

  // ---------- Schema / profiles ----------
  await check('database contract version is 4',async()=>{const {data,error}=await A.c.rpc('dormmart_contract_version');must(!error,errText(error));must(data===4,'got '+data);return 'version '+data});
  await check('trigger-created profiles exist for A, B and C',async()=>{for(const u of [A,B,C]){const {data,error}=await u.c.from('profiles').select('id').eq('id',u.id).maybeSingle();must(!error&&data,'missing profile '+(error?errText(error):''))}});
  await check('A edits own profile and the change persists',async()=>{
    const before=(await A.c.from('profiles').select('bio').eq('id',A.id).single()).data;
    const marker='live check '+Date.now();
    const u=await A.c.from('profiles').update({bio:marker}).eq('id',A.id).select('bio').single();must(!u.error,errText(u.error));
    const fresh=client();await fresh.auth.signInWithPassword({email:accounts[0].email,password:accounts[0].password});
    const again=(await fresh.from('profiles').select('bio').eq('id',A.id).single()).data;must(again.bio===marker,'not persisted for a new session');
    await A.c.from('profiles').update({bio:before.bio}).eq('id',A.id);await fresh.auth.signOut();
  });
  await check('B cannot modify A\'s profile',async()=>{const r=await B.c.from('profiles').update({bio:'hacked'}).eq('id',A.id).select('id');must(!r.data?.length,'B updated A\'s profile!');return r.error?'denied: '+errText(r.error):'0 rows changed'});
  await check('anonymous visitor cannot read profiles, conversations or messages',async()=>{for(const t of ['profiles','conversations','messages']){const r=await anon.from(t).select('id').limit(1);must(!r.data?.length,`anon read ${t}`)}});

  // ---------- Photos ----------
  const P1=crypto.randomUUID(),P2=crypto.randomUUID(),P3=crypto.randomUUID();
  const ph1=await upload(bucketA,A.id,P1),ph2=await upload(bucketA,A.id,P1);
  await check('A uploads photos into A\'s own folder',async()=>{must(!ph1.error&&!ph2.error,errText(ph1.error||ph2.error))});
  await check('A cannot upload into B\'s folder',async()=>denied(bucketA.upload(`${B.id}/${P1}/${crypto.randomUUID()}.jpg`,jpeg,{contentType:'image/jpeg'}),'cross-folder upload'));
  await check('bucket rejects a file over 5 MiB',async()=>denied(bucketA.upload(`${A.id}/${P1}/${crypto.randomUUID()}.jpg`,Buffer.concat([jpeg,Buffer.alloc(5*1024*1024+1-jpeg.length)]),{contentType:'image/jpeg'}),'5 MiB + 1 byte upload'));
  await check('bucket rejects a non-image MIME type',async()=>denied(bucketA.upload(`${A.id}/${P1}/${crypto.randomUUID()}.txt`,Buffer.from('text'),{contentType:'text/plain'}),'text/plain upload'));
  await check('existing photo cannot be overwritten (no upsert)',async()=>denied(bucketA.upload(ph1.path,jpeg,{contentType:'image/jpeg',upsert:true}),'overwrite'));

  // ---------- Listings ----------
  await check('A creates a sale listing with two photos (atomic RPC)',async()=>{const r=await save(A,P1,listing,[ph1.path,ph2.path],true);must(!r.error,errText(r.error));created.push(P1)});
  await check('retrying the same create does not duplicate the listing',async()=>{const r=await save(A,P1,listing,[ph1.path,ph2.path],true);must(!r.error,errText(r.error));const n=(await A.c.from('products').select('id').eq('id',P1)).data.length;must(n===1,'rows: '+n)});
  await check('B sees A\'s active listing and its photos are publicly served',async()=>{const r=await B.c.from('products').select('id,seller_id').eq('id',P1).single();must(!r.error&&r.data.seller_id===A.id,'not visible');must(await publicStatus(ph1.path)===200,'photo not served')});
  await check('A reorders photos: second photo becomes the cover',async()=>{const r=await save(A,P1,{...listing,title:'[live check] Desk lamp (edited)'},[ph2.path,ph1.path],false);must(!r.error,errText(r.error));const imgs=(await B.c.from('product_images').select('storage_path,position').eq('product_id',P1).order('position')).data;must(imgs[0].storage_path===ph2.path&&imgs.length===2,'order wrong')});
  await check('A changes availability to sold and back to active',async()=>{for(const status of ['sold','active']){const r=await save(A,P1,{...listing,status},[ph2.path,ph1.path],false);must(!r.error,errText(r.error))}});
  await check('server rejects invalid combination (sale listing marked reserved/rented)',async()=>denied(save(A,P1,{...listing,status:'reserved'},[ph2.path],false),'sale+reserved'));
  await check('server rejects a title over 70 characters',async()=>denied(save(A,P1,{...listing,title:'x'.repeat(71)},[ph2.path],false),'long title'));
  await check('B cannot edit A\'s listing directly',async()=>{const r=await B.c.from('products').update({title:'stolen'}).eq('id',P1).select('id');must(!r.data?.length,'B updated A\'s product!');return r.error?'denied: '+errText(r.error):'0 rows changed'});
  await check('B cannot edit A\'s listing via RPC',async()=>{const bp=await upload(bucketB,B.id,P1);return denied(save(B,P1,listing,[bp.path],false),'B save on A product')});
  await check('B cannot attach images to A\'s listing',async()=>denied(B.c.from('product_images').insert({product_id:P1,storage_path:ph1.path,position:5}),'image insert'));
  await check('B cannot archive A\'s listing',async()=>denied(B.c.rpc('dormmart_delete_product',{p_id:P1}),'B archive'));
  await check('B cannot delete A\'s photo file',async()=>{await bucketB.remove([ph1.path]);must(await publicStatus(ph1.path)===200,'file was deleted!')});
  await check('A cannot delete a photo that is still referenced',async()=>{await bucketA.remove([ph1.path]);must(await publicStatus(ph1.path)===200,'referenced file was deleted!')});
  await check('A removes a photo from the listing, then may delete the unreferenced file',async()=>{const r=await save(A,P1,listing,[ph2.path],false);must(!r.error,errText(r.error));await bucketA.remove([ph1.path]);const s=await publicStatus(ph1.path);must(s===400||s===404,'retired file still served: '+s)});
  const rentPhoto=await upload(bucketA,A.id,P2),sharePhoto=await upload(bucketA,A.id,P3);
  const today=new Date(),d=n=>new Date(today.getTime()+n*864e5).toISOString().slice(0,10);
  await check('rental requires availability dates',async()=>denied(save(A,P2,{...listing,listing_type:'rent',deposit:500,price:50},[rentPhoto.path],true),'rent without dates'));
  await check('A creates a rental with deposit, dates and a blocked range',async()=>{const r=await save(A,P2,{...listing,title:'[live check] Tent rental',listing_type:'rent',price:50,deposit:500,available_from:d(1),available_until:d(30),blocked_from:d(5),blocked_until:d(7)},[rentPhoto.path],true);must(!r.error,errText(r.error));created.push(P2)});
  await check('free-sharing listing must have price 0',async()=>denied(save(A,P3,{...listing,listing_type:'share',price:10,available_from:d(1),available_until:d(10)},[sharePhoto.path],true),'share with price'));
  await check('A creates a free-sharing listing',async()=>{const r=await save(A,P3,{...listing,title:'[live check] Toolkit to borrow',listing_type:'share',price:0,available_from:d(1),available_until:d(10)},[sharePhoto.path],true);must(!r.error,errText(r.error));created.push(P3)});

  // ---------- Messaging ----------
  let chat;
  await check('B starts a conversation; repeating returns the same conversation',async()=>{const r1=await B.c.rpc('dormmart_start_conversation',{p_product_id:P1}),r2=await B.c.rpc('dormmart_start_conversation',{p_product_id:P1});must(!r1.error&&r1.data===r2.data,errText(r1.error||r2.error)||'different ids');chat=r1.data});
  await check('A cannot start a conversation with themself',async()=>denied(A.c.rpc('dormmart_start_conversation',{p_product_id:P1}),'self conversation'));
  await check('forged conversation (C as fake seller) is rejected',async()=>denied(B.c.from('conversations').insert({product_id:P1,buyer_id:B.id,seller_id:C.id}),'forged seller'));
  let realtimeReceived=null;
  const channel=A.c.channel('live-check-'+Date.now()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{if(p.new?.conversation_id===chat)realtimeReceived=p.new.id});
  const subscribed=await new Promise(res=>{const t=setTimeout(()=>res('TIMED_OUT'),15000);channel.subscribe(s=>{if(s==='SUBSCRIBED'||s==='CHANNEL_ERROR'){clearTimeout(t);res(s)}})});
  record(subscribed==='SUBSCRIBED','A subscribes to realtime message updates',subscribed);
  const m1=crypto.randomUUID();
  await check('B sends a message',async()=>{const r=await B.c.from('messages').insert({id:m1,conversation_id:chat,sender_id:B.id,content:'Hi, is the lamp still available?'});must(!r.error,errText(r.error))});
  await check('retrying the same message id does not duplicate it',async()=>{const r=await B.c.from('messages').insert({id:m1,conversation_id:chat,sender_id:B.id,content:'Hi, is the lamp still available?'});must(r.error?.code==='23505','expected duplicate-key, got '+(errText(r.error)||'success'));const n=(await B.c.from('messages').select('id').eq('id',m1)).data.length;must(n===1,'copies: '+n)});
  await check('A receives B\'s message through realtime within 10 s',async()=>{for(let i=0;i<40&&realtimeReceived!==m1;i++)await new Promise(r=>setTimeout(r,250));must(realtimeReceived===m1,'no realtime event (fallback polling would still refresh)')});
  await A.c.removeChannel(channel);
  await check('B cannot send as A (sender spoofing)',async()=>denied(B.c.from('messages').insert({conversation_id:chat,sender_id:A.id,content:'spoofed'}),'spoofed sender'));
  await check('blank message is rejected',async()=>denied(B.c.from('messages').insert({conversation_id:chat,sender_id:B.id,content:'  \n '}),'blank message'));
  await check('A replies and B loads the full history in order',async()=>{const r=await A.c.from('messages').insert({conversation_id:chat,sender_id:A.id,content:'Yes, pick it up at the library gate.'});must(!r.error,errText(r.error));const h=(await B.c.from('messages').select('sender_id').eq('conversation_id',chat).order('created_at').order('id')).data;must(h.length===2&&h[0].sender_id===B.id&&h[1].sender_id===A.id,'history: '+JSON.stringify(h.map(x=>x.sender_id===A.id?'A':'B')))});
  await check('history persists for a fresh session (refresh) and both sides see 2 messages',async()=>{const fresh=client();const r=await fresh.auth.signInWithPassword({email:accounts[0].email,password:accounts[0].password});must(!r.error,errText(r.error));const h=(await fresh.from('messages').select('id').eq('conversation_id',chat)).data||[];await fresh.auth.signOut();must(h.length===2,'A sees '+h.length)});
  await check('C cannot read the conversation or its messages',async()=>{const a=await C.c.from('conversations').select('id').eq('id',chat),b=await C.c.from('messages').select('id').eq('conversation_id',chat);must(!a.data?.length&&!b.data?.length,'C can read private chat!')});
  await check('C cannot post into the conversation',async()=>denied(C.c.from('messages').insert({conversation_id:chat,sender_id:C.id,content:'intrusion'}),'C message'));

  // ---------- Archive ----------
  await check('A archives the listing',async()=>{const r=await A.c.rpc('dormmart_delete_product',{p_id:P1});must(!r.error,errText(r.error))});
  await check('archived listing is hidden from B but chat history survives',async()=>{const p=await B.c.from('products').select('id').eq('id',P1);must(!p.data?.length,'still visible');const h=await B.c.from('messages').select('id').eq('conversation_id',chat);must(h.data?.length===2,'history lost: '+h.data?.length)});
  await check('A still sees the archived row with deleted_at set',async()=>{const r=await A.c.from('products').select('deleted_at,status').eq('id',P1).single();must(r.data?.deleted_at&&r.data.status==='inactive','not archived')});
  await check('no new conversation can start on an archived listing',async()=>denied(C.c.rpc('dormmart_start_conversation',{p_product_id:P1}),'start on archived'));
  await check('archived photos stay in place',async()=>{must(await publicStatus(ph2.path)===200,'photo removed')});

  // ---------- Request board and bookings (only after migration 003, contract 4) ----------
  const contract=(await A.c.rpc('dormmart_contract_version')).data;
  if(contract>=4){
    const rentId=P2;
    const book=(u,id,s,e)=>u.c.rpc('dormmart_request_booking',{p_id:id,p_product:rentId,p_start:s,p_end:e,p_note:'[live check]'});
    const decide=(u,id,action)=>u.c.rpc('dormmart_decide_booking',{p_id:id,p_action:action,p_note:''});
    const b1=crypto.randomUUID(),c1=crypto.randomUUID();
    await check('rental is still active for booking tests',async()=>{const r=await A.c.from('products').select('status,deleted_at').eq('id',rentId).single();must(r.data?.status==='active'&&!r.data.deleted_at,'rental not active')});
    await check('B requests the rental; retry with the same id does not duplicate',async()=>{const r1=await book(B,b1,d(2),d(4)),r2=await book(B,b1,d(2),d(4));must(!r1.error&&!r2.error,errText(r1.error||r2.error));const n=(await B.c.from('booking_requests').select('id').eq('id',b1)).data.length;must(n===1,'rows '+n);const row=(await B.c.from('booking_requests').select('estimated_total,status').eq('id',b1).single()).data;must(Number(row.estimated_total)===100&&row.status==='pending','estimate/status '+JSON.stringify(row))});
    await check('booking inside the blocked range is refused',async()=>denied(book(B,crypto.randomUUID(),d(5),d(6)),'blocked dates'));
    await check('A cannot book own listing',async()=>denied(book(A,crypto.randomUUID(),d(8),d(9)),'own booking'));
    await check('C sends an overlapping pending request',async()=>{const r=await book(C,c1,d(3),d(5));must(!r.error,errText(r.error))});
    await check('C cannot see B\'s booking; B cannot accept own request',async()=>{const r=await C.c.from('booking_requests').select('id').eq('id',b1);must(!r.data?.length,'C sees B booking');return denied(decide(B,b1,'accept'),'requester accept')});
    await check('direct writes to bookings are refused',async()=>denied(B.c.from('booking_requests').update({status:'accepted'}).eq('id',b1).select('id'),'direct update'));
    await check('A accepts B; accepting the overlapping C request is refused',async()=>{const r=await decide(A,b1,'accept');must(r.data==='accepted',errText(r.error));return denied(decide(A,c1,'accept'),'overlapping accept')});
    await check('anonymous visitors see booked dates only',async()=>{const r=await anon.rpc('dormmart_booked_ranges',{p_product:rentId});must(!r.error&&r.data.length===1&&Object.keys(r.data[0]).sort().join()==='end_date,start_date','ranges '+JSON.stringify(r.data||r.error))});
    await check('B cancels; A declines C',async()=>{const r1=await decide(B,b1,'cancel'),r2=await decide(A,c1,'reject');must(r1.data==='cancelled'&&r2.data==='rejected',errText(r1.error||r2.error))});
    let reqId;
    await check('A posts a request; anonymous visitors can read it but not write',async()=>{const r=await A.c.from('item_requests').insert({title:'[live check] Projector',note:'Automated test request',area:'Library',request_type:'rent',budget:100,category:'Electronics'}).select('id,requester_id').single();must(!r.error&&r.data.requester_id===A.id,errText(r.error));reqId=r.data.id;const g=await anon.from('item_requests').select('id').eq('id',reqId);must(g.data?.length===1,'anon cannot read');return denied(anon.from('item_requests').insert({title:'x',note:'x',area:'x',request_type:'sale'}),'anon insert')});
    await check('B cannot edit A\'s request',async()=>{const r=await B.c.from('item_requests').update({title:'hacked'}).eq('id',reqId).select('id');must(!r.data?.length,'B edited A request')});
    const sale2=crypto.randomUUID();const bPhoto=await upload(bucketB,B.id,sale2);
    await check('B lists an item and offers it; C cannot see the offer; A can',async()=>{const p=await save(B,sale2,{...listing,title:'[live check] Spare projector'},[bPhoto.path],true);must(!p.error,errText(p.error));const o=await B.c.rpc('dormmart_offer_listing',{p_request:reqId,p_product:sale2,p_note:'Have one'});must(!o.error,errText(o.error));const c=await C.c.from('request_offers').select('id').eq('request_id',reqId);must(!c.data?.length,'C sees offer');const a=await A.c.from('request_offers').select('id').eq('request_id',reqId);must(a.data?.length===1,'A cannot see offer')});
    await check('B cannot offer A\'s listing',async()=>denied(B.c.rpc('dormmart_offer_listing',{p_request:reqId,p_product:rentId,p_note:'not mine'}),'foreign listing offer'));
    await check('A closes, reopens and archives the request',async()=>{for(const v of [{status:'closed'},{status:'open'},{archived_at:new Date().toISOString()}]){const r=await A.c.from('item_requests').update(v).eq('id',reqId).select('id');must(!r.error&&r.data.length===1,errText(r.error))}const g=await anon.from('item_requests').select('id').eq('id',reqId);must(!g.data?.length,'archived still public')});
    await B.c.rpc('dormmart_delete_product',{p_id:sale2});
  } else console.log(`INFO  contract ${contract}: request board and booking checks skipped (apply 002 and 003 first)`);

  // Archive the remaining test listings (rental and sharing).
  for(const id of created.slice(1))await A.c.rpc('dormmart_delete_product',{p_id:id});

  // ---------- Informational ----------
  const visible=(await A.c.from('product_images').select('storage_path')).data||[];
  const legacy=visible.filter(i=>!/^[0-9a-f-]{36}\/[A-Za-z0-9_./-]+$/i.test(i.storage_path)).length;
  console.log(`INFO  visible image rows with a non-standard path: ${legacy} (these photos are hidden in the app; tell Claude if > 0)`);

  await check('sign-out ends access to private data',async()=>{await B.c.auth.signOut();const r=await B.c.from('messages').select('id').eq('conversation_id',chat);must(!r.data?.length,'still readable after sign-out')});
  for(const u of [A,C])await u.c.auth.signOut();
  console.log(`\n${results.length-failed}/${results.length} checks passed. Test-listing archival was attempted; test chat history is retained. Review any failures before treating cleanup as complete.`);
  process.exit(failed?1:0);
})().catch(e=>{console.error('Live check aborted:',e.message);process.exit(1)});

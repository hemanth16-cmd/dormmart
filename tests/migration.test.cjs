const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',P='44444444-4444-4444-8444-444444444444';
test('migration against reported schema: real PostgreSQL RLS, transactions, preservation and hostile writes',async t=>{
 const db=new PGlite();
 try{
  await db.exec(read('tests/fixtures/reported-schema.sql'));
  await db.exec(read('tests/fixtures/reported-policies.sql'));
  for(const id of [A,B,C])await db.query('insert into auth.users(id) values($1)',[id]);
  const profiles=await db.query('select count(*)::int as n from profiles');assert.equal(profiles.rows[0].n,3);
  // Legacy both listing and photo: no pre-existing data is removed or converted.
  await db.query("insert into products(id,seller_id,title,price,listing_type) values($1,$2,'Legacy both',50,'both')",[P,A]);
  await db.query('insert into product_images(product_id,storage_path) values($1,$2)',[P,A+'/legacy.png']);
  await db.exec(read('supabase/001-align-existing-schema.sql'));
  assert.equal((await db.query('select dormmart_contract_version() as v')).rows[0].v,2);
  assert.equal((await db.query('select listing_type from products where id=$1',[P])).rows[0].listing_type,'both');
  assert.equal((await db.query('select position from product_images where product_id=$1',[P])).rows[0].position,0);
  async function actor(id,role='authenticated') {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
  const product={title:'Desk',description:'Good desk',category:'Furniture',listing_type:'sale',price:100,deposit:0,condition:'Good',area:'Library gate',status:'active',available_from:null,available_until:null,blocked_from:null,blocked_until:null};
  const photo=A+'/'+P+'/'+P+'.jpg';
  await actor(A);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('product-images',$1,$2)",[photo,A]);
  const save=async(input=product,paths=[photo])=>db.query('select dormmart_save_product($1,$2::jsonb,$3::text[],false)',[P,JSON.stringify(input),paths]);
  await save();
  await t.test('failed image commit rolls back the product update',async()=>{
    await assert.rejects(save({...product,title:'Must not persist'},[A+'/'+P+'/missing.jpg']),/Upload image first/);
    assert.equal((await db.query('select title from products where id=$1',[P])).rows[0].title,'Desk');
  });
  await t.test('referenced storage objects cannot be deleted by owner',async()=>{
    assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[photo])).rows.length,0);
  });
  await actor(B);
  await t.test('other account cannot edit the product or attach its own photos',async()=>{
    await assert.rejects(save({...product,title:'Stolen'}),/Invalid image ownership/);
    assert.equal((await db.query("update products set title='Stolen' where id=$1 returning id",[P])).rows.length,0);
    await assert.rejects(db.query('insert into product_images(product_id,storage_path,position) values($1,$2,1)',[P,photo]),/row-level security/);
  });
  await t.test('forged seller rejected; valid conversation start converges',async()=>{
    await assert.rejects(db.query('insert into conversations(product_id,buyer_id,seller_id) values($1,$2,$3)',[P,B,C]),/row-level security/);
  });
  const chat=(await db.query('select dormmart_start_conversation($1) as id',[P])).rows[0].id;
  assert.equal((await db.query('select dormmart_start_conversation($1) as id',[P])).rows[0].id,chat);
  await db.query('insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[chat,B,'Hello']);
  await assert.rejects(db.query('insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[chat,A,'Spoofed']),/row-level security/);
  await assert.rejects(db.query('insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[chat,B,' \n\t ']),/dormmart_message_nonblank/);
  await actor(C);
  await t.test('unrelated third account cannot read or send private messages',async()=>{
    assert.equal((await db.query('select * from messages')).rows.length,0);
    assert.equal((await db.query('select * from conversations')).rows.length,0);
    await assert.rejects(db.query('insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[chat,C,'Intrusion']),/row-level security/);
  });
  await actor(A);
  // Product image references must belong to an actual uploaded object owned by the seller.
  await assert.rejects(db.query('insert into product_images(product_id,storage_path,position) values($1,$2,1)',[P,B+'/fake.jpg']),/row-level security/);
  await db.query('select dormmart_delete_product($1)',[P]);
  await assert.rejects(save(),/unavailable or not owned/);
  await actor(B);
  await t.test('archive preserves chat, messages and product identity',async()=>{
    assert.equal((await db.query('select * from messages where conversation_id=$1',[chat])).rows.length,1);
    assert.equal((await db.query('select * from conversations where id=$1',[chat])).rows.length,1);
    assert.equal((await db.query('select title from products where id=$1',[P])).rows.length,0);
    await db.query('insert into messages(conversation_id,sender_id,content) values($1,$2,$3)',[chat,B,'After archive']);
  });
  await actor(C);assert.equal((await db.query('select * from products where id=$1',[P])).rows.length,0);
  await assert.rejects(db.query('select dormmart_start_conversation($1)',[P]),/Invalid recipient/);
  await actor(null,'anon');
  assert.equal((await db.query('select * from products')).rows.length,0);
  await assert.rejects(db.exec('truncate products cascade'),/permission denied/);
  await assert.rejects(db.query('select dormmart_delete_product($1)',[P]),/permission denied/);
 }finally{await db.close()}
});

test('migration 002: server timestamps, unreferenced-upload report and single application',async()=>{
 const db=new PGlite();
 try{
  await db.exec(read('tests/fixtures/reported-schema.sql'));
  await db.exec(read('tests/fixtures/reported-policies.sql'));
  for(const id of [A,B,C])await db.query('insert into auth.users(id) values($1)',[id]);
  await db.exec(read('supabase/001-align-existing-schema.sql'));
  await db.exec(read('supabase/002-server-timestamps-and-upload-report.sql'));
  assert.equal((await db.query('select dormmart_contract_version() as v')).rows[0].v,3);
  await assert.rejects(db.exec(read('supabase/002-server-timestamps-and-upload-report.sql')),/Expected contract_version 2/);
  await db.exec('rollback').catch(()=>{});
  async function actor(id,role='authenticated') {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
  const photo=A+'/'+P+'/one.jpg',retired=A+'/'+P+'/retired.jpg';
  const product={title:'Lamp',description:'Bright lamp',category:'Home',listing_type:'sale',price:10,deposit:0,condition:'Good',area:'Hostel gate',status:'active',available_from:null,available_until:null,blocked_from:null,blocked_until:null};
  await actor(A);
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('product-images',$1,$2),('product-images',$3,$2)",[photo,A,retired]);
  await db.query('select dormmart_save_product($1,$2::jsonb,$3::text[],true)',[P,JSON.stringify(product),[photo]]);
  await t_assertServerTime('products',P);
  // Direct REST-style insert with a forged timestamp is overwritten.
  const chat=(await db.query('select dormmart_start_conversation($1) as id',[P]).catch(e=>e));
  assert.match(String(chat.message||''),/Invalid recipient/);
  await actor(B);
  const chatId=(await db.query('select dormmart_start_conversation($1) as id',[P])).rows[0].id;
  const m=(await db.query("insert into messages(conversation_id,sender_id,content,created_at) values($1,$2,'Hi','2000-01-01') returning created_at",[chatId,B])).rows[0];
  assert.ok(new Date(m.created_at).getFullYear()>2020,'message timestamp is server-assigned');
  await actor(A);
  const before=(await db.query('select created_at from products where id=$1',[P])).rows[0].created_at;
  await db.query("update products set created_at='2099-01-01',title='Lamp 2' where id=$1",[P]);
  assert.equal(String((await db.query('select created_at from products where id=$1',[P])).rows[0].created_at),String(before));
  // Report is not callable by app users.
  await assert.rejects(db.query('select * from dormmart_unreferenced_uploads()'),/permission denied/);
  await actor(null,'anon');
  await assert.rejects(db.query('select * from dormmart_unreferenced_uploads()'),/permission denied/);
  await db.exec('reset role');
  await db.query("update storage.objects set created_at=now()-interval '3 days'");
  const report=(await db.query("select name from dormmart_unreferenced_uploads('24 hours')")).rows.map(r=>r.name);
  assert.deepEqual(report,[retired],'only the unreferenced file is reported; referenced photo is kept');
  // Grace period has a 1 hour floor.
  await db.query("update storage.objects set created_at=now()-interval '10 minutes'");
  assert.equal((await db.query("select name from dormmart_unreferenced_uploads('0 seconds')")).rows.length,0);
  async function t_assertServerTime(table,id){const r=(await db.query(`select created_at from ${table} where id=$1`,[id])).rows[0];assert.ok(r.created_at)}
 }finally{await db.close()}
});

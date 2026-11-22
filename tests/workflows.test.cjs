// Migration 003 on real PostgreSQL (PGlite): request board, offers and bookings.
// RLS, grants, triggers and the exclusion constraint are exercised with hostile callers.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {btree_gist}=require('@electric-sql/pglite/contrib/btree_gist');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const RENT='44444444-4444-4444-8444-444444444444',SHARE='55555555-5555-4555-8555-555555555555',SALE='66666666-6666-4666-8666-666666666666',BPROD='77777777-7777-4777-8777-777777777777';
const uuid=()=>crypto.randomUUID();

async function setup(){
  const db=new PGlite({extensions:{btree_gist}});
  await db.exec(read('tests/fixtures/reported-schema.sql'));
  await db.exec(read('tests/fixtures/reported-policies.sql'));
  for(const id of [A,B,C])await db.query('insert into auth.users(id) values($1)',[id]);
  await db.exec(read('supabase/001-align-existing-schema.sql'));
  return db;
}
async function day(db,n){return (await db.query(`select (current_date + ${Number(n)})::text as d`)).rows[0].d}
function actorFor(db){return async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}}

test('003 refuses to run before 002',async()=>{
  const db=await setup();
  try{await assert.rejects(db.exec(read('supabase/003-requests-offers-bookings.sql')),/Expected contract_version 3/)}
  finally{await db.close()}
});

test('003: request board, offers and bookings under RLS',async t=>{
  const db=await setup();
  try{
    await db.exec(read('supabase/002-server-timestamps-and-upload-report.sql'));
    await db.exec(read('supabase/003-requests-offers-bookings.sql'));
    assert.equal((await db.query('select dormmart_contract_version() as v')).rows[0].v,4);
    await assert.rejects(db.exec(read('supabase/003-requests-offers-bookings.sql')),/Expected contract_version 3/);
    await db.exec('rollback').catch(()=>{});
    const as=actorFor(db);
    const d=n=>day(db,n);
    // Seed listings as the database owner (fixture setup, not a client path).
    const base={description:'x',category:'Other',condition:'Good',area:'Gate',status:'active'};
    await db.query(`insert into products(id,seller_id,title,description,category,condition,area,status,listing_type,price,deposit,available_from,available_until,blocked_from,blocked_until)
      values($1,$2,'Tent',$3,$4,$5,$6,$7,'rent',50,500,current_date,current_date+40,current_date+20,current_date+22)`,[RENT,A,base.description,base.category,base.condition,base.area,base.status]);
    await db.query(`insert into products(id,seller_id,title,description,category,condition,area,status,listing_type,price,deposit,available_from,available_until)
      values($1,$2,'Toolkit','x','Other','Good','Gate','active','share',0,0,current_date,current_date+30)`,[SHARE,A]);
    await db.query(`insert into products(id,seller_id,title,description,category,condition,area,status,listing_type,price) values($1,$2,'Desk','x','Other','Good','Gate','active','sale',100)`,[SALE,A]);
    await db.query(`insert into products(id,seller_id,title,description,category,condition,area,status,listing_type,price) values($1,$2,'Lamp','x','Other','Good','Gate','active','sale',20)`,[BPROD,B]);

    // ---------------- Item requests ----------------
    let requestId;
    await t.test('signed-in user creates a request; requester and status are server-controlled',async()=>{
      await as(A);
      requestId=(await db.query(`insert into item_requests(title,note,category,request_type,budget,needed_by,area) values('Projector','For movie night','Electronics','rent',300,current_date+5,'Library') returning id,requester_id,status`)).rows[0];
      assert.equal(requestId.requester_id,A);assert.equal(requestId.status,'open');requestId=requestId.id;
      await assert.rejects(db.query(`insert into item_requests(requester_id,title,note,request_type,area) values($1,'Fake','x','sale','Gate')`,[B]),/permission denied/);
      await assert.rejects(db.query(`insert into item_requests(title,note,request_type,area,needed_by) values('Old','x','sale','Gate',current_date-1)`),/past/);
      await assert.rejects(db.query(`insert into item_requests(title,note,request_type,area,budget) values('Free','x','share','Gate',10)`),/item_requests_values/);
    });
    await t.test('guests can read open requests but never write',async()=>{
      await as(null,'anon');
      assert.equal((await db.query('select id from item_requests')).rows.length,1);
      await assert.rejects(db.query(`insert into item_requests(title,note,request_type,area) values('x','x','sale','x')`),/permission denied/);
      await assert.rejects(db.query(`update item_requests set title='hacked'`),/permission denied/);
      await assert.rejects(db.query('select * from request_offers'),/permission denied/);
      await assert.rejects(db.query('select * from booking_requests'),/permission denied/);
    });
    await t.test('only the requester edits, closes and reopens',async()=>{
      await as(B);
      assert.equal((await db.query(`update item_requests set title='hacked' where id=$1 returning id`,[requestId])).rows.length,0);
      await assert.rejects(db.query(`update item_requests set requester_id=$1 where id=$2`,[B,requestId]),/permission denied/);
      await as(A);
      await db.query(`update item_requests set status='closed' where id=$1`,[requestId]);
      await db.query(`update item_requests set status='open', title='Projector (HDMI)' where id=$1`,[requestId]);
      assert.equal((await db.query('select title,status from item_requests where id=$1',[requestId])).rows[0].status,'open');
    });

    // ---------------- Offers ----------------
    let offerId;
    await t.test('B offers own active listing; requester sees it; third party does not',async()=>{
      await as(B);
      offerId=(await db.query('select dormmart_offer_listing($1,$2,$3) as id',[requestId,BPROD,'I have a lamp'])).rows[0].id;
      assert.equal((await db.query('select dormmart_offer_listing($1,$2,$3) as id',[requestId,BPROD,'Updated note'])).rows[0].id,offerId,'re-offer updates instead of duplicating');
      await assert.rejects(db.query('select dormmart_offer_listing($1,$2,$3)',[requestId,RENT,'Not mine']),/row-level security/);
      await as(A);
      assert.equal((await db.query('select note from request_offers where request_id=$1',[requestId])).rows[0].note,'Updated note');
      await assert.rejects(db.query('select dormmart_offer_listing($1,$2,$3)',[requestId,SALE,'Own request']),/row-level security/);
      await as(C);
      assert.equal((await db.query('select * from request_offers')).rows.length,0);
    });
    await t.test('offers close with the request; offerer can withdraw',async()=>{
      await as(B);
      await db.query(`update request_offers set status='withdrawn' where id=$1`,[offerId]);
      await assert.rejects(db.query(`update request_offers set product_id=$1 where id=$2`,[SALE,offerId]),/permission denied/);
      await as(A);await db.query(`update item_requests set status='closed' where id=$1`,[requestId]);
      await as(B);
      await assert.rejects(db.query('select dormmart_offer_listing($1,$2,$3)',[requestId,BPROD,'Again']),/row-level security/);
      await as(A);await db.query(`update item_requests set status='open' where id=$1`,[requestId]);
    });
    await t.test('archived requests disappear for others, keep offers, and cannot be edited or restored',async()=>{
      await as(A);
      await db.query(`update item_requests set archived_at='2000-01-01' where id=$1`,[requestId]);
      const row=(await db.query('select archived_at from item_requests where id=$1',[requestId])).rows[0];
      assert.ok(new Date(row.archived_at).getFullYear()>2020,'archive time is server-assigned');
      await assert.rejects(db.query(`update item_requests set archived_at=null where id=$1`,[requestId]),/Archived requests cannot be changed/);
      await as(B);assert.equal((await db.query('select * from item_requests where id=$1',[requestId])).rows.length,0);
      await as(null,'anon');assert.equal((await db.query('select * from item_requests where id=$1',[requestId])).rows.length,0);
      await as(A);assert.equal((await db.query('select * from request_offers where request_id=$1',[requestId])).rows.length,1);
    });

    // ---------------- Bookings ----------------
    const book=async(id,product,start,end,note='')=>(await db.query('select dormmart_request_booking($1,$2,$3::date,$4::date,$5) as id',[id,product,start,end,note])).rows[0].id;
    const decide=async(id,action)=>(await db.query('select dormmart_decide_booking($1,$2) as s',[id,action])).rows[0].s;
    const b1=uuid(),c1=uuid();
    await t.test('request computes an estimate and is idempotent',async()=>{
      await as(B);
      assert.equal(await book(b1,RENT,await d(2),await d(5),'Weekend trip'),b1);
      assert.equal(await book(b1,RENT,await d(2),await d(5)),b1);
      const row=(await db.query('select status,estimated_total,deposit,owner_id from booking_requests where id=$1',[b1])).rows[0];
      assert.equal(row.status,'pending');assert.equal(Number(row.estimated_total),150);assert.equal(Number(row.deposit),500);assert.equal(row.owner_id,A);
      assert.equal((await db.query('select count(*)::int n from booking_requests')).rows[0].n,1);
    });
    await t.test('server enforces dates, listing type, ownership and limits',async()=>{
      await as(B);
      await assert.rejects(book(uuid(),RENT,await d(-1),await d(2)),/Pickup date has passed/);
      await assert.rejects(book(uuid(),RENT,await d(3),await d(3)),/return date after/);
      await assert.rejects(book(uuid(),RENT,await d(35),await d(45)),/availability window/);
      await assert.rejects(book(uuid(),RENT,await d(19),await d(21)),/unavailable on some/);
      await assert.rejects(book(uuid(),RENT,await d(1),await d(33)),/at most 30 days/);
      await assert.rejects(book(uuid(),SHARE,await d(1),await d(9)),/at most 7 days/);
      await assert.rejects(book(uuid(),SALE,await d(1),await d(2)),/Only rental and free-sharing/);
      await assert.rejects(db.query(`insert into booking_requests(product_id,requester_id,owner_id,item_title,listing_type,start_date,end_date,daily_price,deposit,estimated_total,status) values($1,$2,$3,'x','rent',current_date+1,current_date+2,0,0,0,'accepted')`,[RENT,B,A]),/permission denied/);
      await assert.rejects(db.query(`update booking_requests set status='accepted' where id=$1`,[b1]),/permission denied/);
      await as(A);await assert.rejects(book(uuid(),RENT,await d(1),await d(2)),/your own listing/);
      await as(null,'anon');await assert.rejects(book(uuid(),RENT,await d(1),await d(2)),/permission denied/);
      await as(B);
      assert.equal(Number((await db.query('select estimated_total from booking_requests where id=$1',[await book(uuid(),SHARE,await d(1),await d(3))])).rows[0].estimated_total),0,'sharing is free');
    });
    await t.test('bookings are private to requester and owner',async()=>{
      await as(C);
      assert.equal(await book(c1,RENT,await d(4),await d(6)),c1,'overlapping PENDING requests are allowed');
      assert.equal((await db.query('select id from booking_requests')).rows.length,1,'C sees only own');
      await assert.rejects(decide(b1,'cancel'),/not found/);
      await as(A);assert.equal((await db.query('select id from booking_requests where product_id=$1',[RENT])).rows.length,2);
    });
    await t.test('only the owner accepts; overlapping accept is rejected',async()=>{
      await as(B);await assert.rejects(decide(b1,'accept'),/not allowed/);
      await as(A);
      assert.equal(await decide(b1,'accept'),'accepted');
      await assert.rejects(decide(c1,'accept'),/overlap an accepted booking/);
      await as(C);await assert.rejects(book(uuid(),RENT,await d(3),await d(4)),/overlap an accepted booking/);
      await as(null,'anon');
      const ranges=(await db.query('select start_date::text s,end_date::text e from dormmart_booked_ranges($1)',[RENT])).rows;
      assert.deepEqual(ranges,[{s:await d(2),e:await d(5)}],'public ranges show dates only');
    });
    await t.test('exclusion constraint blocks overlapping accepted rows even without the function (race backstop)',async()=>{
      await db.exec('reset role');
      await assert.rejects(db.query(`update booking_requests set status='accepted' where id=$1`,[c1]),/booking_no_overlap/);
    });
    await t.test('requester cancels; freed dates can then be accepted; reject and complete rules',async()=>{
      await as(B);assert.equal(await decide(b1,'cancel'),'cancelled');
      await as(A);assert.equal(await decide(c1,'accept'),'accepted');
      await assert.rejects(decide(c1,'complete'),/not allowed/,'cannot complete before pickup day');
      await as(B);const today=uuid();await book(today,SHARE,await d(0),await d(1));
      await as(A);assert.equal(await decide(today,'accept'),'accepted');assert.equal(await decide(today,'complete'),'completed');
      await as(B);const r=uuid();await book(r,SHARE,await d(2),await d(3));
      await as(A);assert.equal(await decide(r,'reject'),'rejected');await assert.rejects(decide(r,'accept'),/not allowed/);
    });
    await t.test('archiving a listing rejects pending requests, keeps history, withdraws offers',async()=>{
      await as(B);const pending=uuid();await book(pending,RENT,await d(8),await d(10));
      await as(A);await db.query('select dormmart_delete_product($1)',[RENT]);
      await as(B);
      const row=(await db.query('select status,decision_note,item_title from booking_requests where id=$1',[pending])).rows[0];
      assert.equal(row.status,'rejected');assert.match(row.decision_note,/removed/);assert.equal(row.item_title,'Tent');
      assert.equal((await db.query('select count(*)::int n from booking_requests where product_id=$1',[RENT])).rows[0].n,2,'B keeps both of its own booking records');
      await assert.rejects(book(uuid(),RENT,await d(25),await d(26)),/not available/);
      await as(C);assert.equal((await db.query('select status from booking_requests where id=$1',[c1])).rows[0].status,'accepted','accepted history stays');
      await as(A);await db.query('select dormmart_delete_product($1)',[SALE]);
      await as(B);await db.query('select dormmart_delete_product($1)',[BPROD]);
      assert.equal((await db.query('select status from request_offers where id=$1',[offerId])).rows[0].status,'withdrawn');
    });
  }finally{await db.close()}
});

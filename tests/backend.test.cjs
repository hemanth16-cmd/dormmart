const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBackend,validateConfig,productInput}=require('../dist/backend.js');
const {authErrorMessage}=require('../dist/backend.js');
test('auth failures distinguish credentials, confirmation, rate limits and network without leaking raw errors',()=>{
 // invalid_credentials is wrong password/no account; Supabase reports unconfirmed only after a correct password.
 assert.match(authErrorMessage({code:'invalid_credentials'}),/incorrect, or no account exists/);
 assert.match(authErrorMessage({code:'email_not_confirmed'}),/password is correct, but this email address is not confirmed/);
 assert.match(authErrorMessage({code:'over_email_send_rate_limit'},'resend'),/^Confirmation email not sent. No email was sent/);
 assert.match(authErrorMessage({code:'otp_expired'},'link'),/^Email link not accepted..*expired/);
 assert.match(authErrorMessage({code:'email_address_not_authorized'},'signup'),/custom email \(SMTP\)/);
 assert.match(authErrorMessage({code:'same_password'},'reset'),/^Password not changed./);
 assert.match(authErrorMessage({code:'weak_password'},false),/^Sign-in failed/);
 assert.match(authErrorMessage({status:429}),/Too many attempts/);
 assert.match(authErrorMessage({name:'AuthRetryableFetchError'}),/Could not reach/);
 assert.match(authErrorMessage({code:'weak_password'},true),/Account creation failed/);
 assert.doesNotMatch(authErrorMessage({code:'<private>',message:'password=secret',stack:'private-token'}),/private|secret|token/);
});
const config={mode:'supabase',url:'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:'sb_publishable_test_only',schemaVerified:true};
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const item={id,ownerId:owner,title:'Desk',description:'Good desk',category:'Furniture',mode:'buy',price:100,deposit:0,condition:'Good',area:'Main gate',photos:['data:image/jpeg;base64,/9j/'],pickupAddress:{address:'PRIVATE'},verified:true,student:true};
function fixture(fail=false){
 const calls=[];
 const storage={getPublicUrl:path=>({data:{publicUrl:config.url+'/storage/v1/object/public/product-images/'+path}}),upload:async(path)=>{calls.push(['upload',path]);return {data:{path}}},remove:async()=>{calls.push(['remove']);return {data:[]}}};
 const client={storage:{from:()=>storage},rpc:async(name,args)=>{calls.push([name,args]);return fail?{error:Error('RLS denied')}:{data:args.p_id}}};
 const backend=createBackend(client,config);backend.setUser({id:owner});return {backend,calls};
}
test('reject secret keys, legacy JWTs, wrong project and unverified schema',()=>{
 for(const patch of [{publishableKey:'sb_secret_fake'},{publishableKey:'eyJhbGciOiJIUzI1NiJ9.fake.sig'},{url:'https://other.supabase.co'},{schemaVerified:false}])assert.throws(()=>validateConfig({...config,...patch}));
 assert.equal(validateConfig(config),config);
});
test('listing payload excludes private addresses, badges and caller-supplied ownership',()=>{
 const value=productInput(item);for(const key of ['pickupAddress','verified','student','ownerId','id','photos'])assert.equal(value[key],undefined);
 assert.throws(()=>productInput({...item,price:NaN}));assert.throws(()=>productInput({...item,title:' '}));
});
test('UI modes/statuses map to the existing schema without renaming columns',()=>{
 assert.equal(productInput(item).listing_type,'sale');
 assert.equal(productInput(item).status,'active');
 assert.equal(productInput({...item,mode:'rent',status:'rented'}).status,'reserved');
 assert.equal(productInput({...item,mode:'share'}).listing_type,'share');
 assert.equal(productInput({...item,mode:'share'}).price,0);
 assert.equal(productInput({...item,listingType:'both'}).listing_type,'both');
 assert.equal(productInput({...item,listingType:'both',mode:'rent'}).listing_type,'rent');
});
test('upload uses account/product namespace and one atomic metadata call',async()=>{
 const {backend,calls}=fixture();const result=await backend.saveListing(item,null);
 assert.match(calls[0][1],new RegExp('^'+owner+'/'+result.id+'/'));
 assert.equal(calls[1][0],'dormmart_save_product');assert.equal(calls[1][1].p_create,true);
 assert.equal(result.pickupAddress,undefined);assert.equal(result.verified,false);
});
test('failed metadata commit does not delete potentially committed image files',async()=>{
 const {backend,calls}=fixture(true);await assert.rejects(backend.saveListing(item,null),/RLS denied/);
 assert.deepEqual(calls.map(c=>c[0]),['upload','dormmart_save_product']);
});
test('another owner and a signed-out user cannot initiate listing writes',async()=>{
 const {backend,calls}=fixture();await assert.rejects(backend.saveListing(item,{...item,ownerId:id}),/own listing/);
 backend.setUser(null);await assert.rejects(backend.deleteListing(item),/sign in/);assert.equal(calls.length,0);
});
test('image reordering reuses storage paths without uploading or deleting files',async()=>{
 const {backend,calls}=fixture();const existing={...item,photos:['https://image-a','https://image-b'],imagePaths:[`${owner}/${id}/${id}.jpg`,`${owner}/${id}/${owner}.jpg`]};
 await backend.saveListing({...existing,photos:[...existing.photos].reverse()},existing);
 assert.equal(calls.length,1);assert.deepEqual(calls[0][1].p_paths,[...existing.imagePaths].reverse());
});
test('message retry only accepts an existing identical message owned by this sender',async()=>{
 let old={sender_id:owner,conversation_id:id,content:'Hello'};
 const query={insert:async()=>({error:{code:'23505'}}),select(){return this},eq(){return this},single:async()=>({data:old})};
 const client={storage:{from:()=>({})},from:()=>query};const backend=createBackend(client,config);backend.setUser({id:owner});
 await backend.sendMessage(id,'Hello',id);
 old={...old,sender_id:id};await assert.rejects(backend.sendMessage(id,'Hello',id));
 await assert.rejects(backend.sendMessage(id,' ',id),/Write a message/);
});
test('UUID listings sort by creation date and do not invent distance',()=>{
 const {filterListings}=require('../dist/data.js');const items=[{...item,distance:null,createdAt:'2026-01-01'}, {...item,id:owner,distance:null,createdAt:'2026-02-01'}];
 assert.deepEqual(filterListings(items,{mode:'all',category:'all',radius:1,price:'',query:'',sort:'newest'}).map(x=>x.id),[owner,id]);
});

test('request payload is an allowlist and maps modes to database words',()=>{
 const {requestInput}=require('../dist/backend.js');
 const value=requestInput({title:' Tent ',note:' Two nights ',area:' Gate ',mode:'buy',budget:'250',category:'Outdoors',date:'2030-01-02',requester_id:'x',status:'closed',archived_at:'now'});
 assert.deepEqual(value,{title:'Tent',note:'Two nights',area:'Gate',category:'Outdoors',request_type:'sale',budget:250,needed_by:'2030-01-02'});
 assert.equal(requestInput({title:'a',note:'b',area:'c',mode:'share',budget:99}).budget,0,'sharing requests are always free');
 for(const bad of [{title:'',note:'b',area:'c',mode:'rent'},{title:'a',note:'b',area:'c',mode:'swap'},{title:'a',note:'b',area:'c',mode:'rent',budget:-1},{title:'a'.repeat(81),note:'b',area:'c',mode:'rent'}])assert.throws(()=>requestInput(bad));
});
test('workflow errors: known server rules shown, everything else generic',()=>{
 const {friendlyError}=require('../dist/backend.js');
 assert.equal(friendlyError({message:'Those dates overlap an accepted booking'}),'Those dates overlap an accepted booking.');
 assert.equal(friendlyError({code:'42501',message:'new row violates row-level security policy for table "x"'}),'You do not have permission for that action.');
 assert.match(friendlyError({name:'TypeError',message:'Failed to fetch'}),/Could not reach DormMart/);
 assert.doesNotMatch(friendlyError({message:'duplicate key value violates unique constraint "secret_internal"'}),/secret_internal/);
});

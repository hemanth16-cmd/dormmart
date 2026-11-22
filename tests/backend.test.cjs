const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBackend,validateConfig,productInput}=require('../dist/backend.js');
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

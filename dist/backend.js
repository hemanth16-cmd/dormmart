/* Supabase boundary. No service-role credentials, demo imports or private addresses. */
(function(root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const columns = {
    profiles: 'id,full_name,university,bio',
    products: 'id,owner_id,title,description,category,mode,price,deposit,condition,area,status,available_from,available_until,blocked_from,blocked_until,created_at',
    product_images: 'product_id,storage_path,position',
    conversations: 'id,product_id,buyer_id,seller_id,created_at',
    messages: 'id,conversation_id,sender_id,content,created_at'
  };
  function validateConfig(config) {
    if (config.mode !== 'supabase') throw Error('Live backend is not enabled.');
    if (config.url !== 'https://flwrsjhldghbullanaqz.supabase.co') throw Error('Unexpected Supabase project.');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '')) throw Error('A Supabase publishable key is required. Secret keys are never accepted.');
    if (config.schemaVerified !== true) throw Error('Verify the database contract and policies before enabling Supabase.');
    return config;
  }
  function unwrap(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  function requireId(id) { if (!UUID.test(id || '')) throw Error('Invalid record ID.'); return id; }
  function productInput(item) {
    if (!['buy','rent','share'].includes(item.mode) || !item.title?.trim() || item.title.length > 70 || !item.description?.trim() || item.description.length > 1000 || !item.area?.trim()) throw Error('Check the listing details.');
    if (!Number.isFinite(item.price) || item.price < 0 || item.price > 1000000 || !Number.isFinite(item.deposit) || item.deposit < 0 || item.deposit > 1000000) throw Error('Check the price and deposit.');
    // Deliberate allowlist: never publish pickupAddress, badges, ownership or demo flags.
    return {title:item.title.trim(), description:item.description.trim(), category:item.category,
      mode:item.mode, price:item.mode==='share'?0:item.price, deposit:item.mode==='rent'?item.deposit:0,
      condition:item.condition, area:item.area.trim(), status:item.status || 'available',
      available_from:item.availableFrom || null, available_until:item.availableUntil || null,
      blocked_from:item.blockedFrom || null, blocked_until:item.blockedUntil || null};
  }
  function createBackend(client, config) {
    validateConfig(config);
    let user = null, channel = null;
    const bucket = client.storage.from('product-images');
    const uid = () => { if (!user) throw Error('Please sign in again.'); return requireId(user.id); };
    async function rows(table, query) {
      const request=(query || client.from(table).select(columns[table])).order(table==='product_images'?'product_id':'id');
      if(table==='product_images')request.order('position');
      const result=[];
      for(let offset=0;offset<20000;offset+=200){
        const page=unwrap(await request.range(offset,offset+199))||[];
        result.push(...page);if(page.length<200)return result;
      }
      throw Error('Too many results. Narrow the server query before loading this catalogue.');
    }
    function imageURL(path) {
      if (typeof path !== 'string' || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/i.test(path)) throw Error('Invalid product image path.');
      return bucket.getPublicUrl(path).data.publicUrl;
    }
    function mapProduct(row, images, names) {
      requireId(row.id); requireId(row.owner_id);
      return {id:row.id,ownerId:row.owner_id,title:row.title,description:row.description,category:row.category,
        mode:row.mode,price:Number(row.price),deposit:Number(row.deposit),condition:row.condition,area:row.area,
        status:row.status,availableFrom:row.available_from||'',availableUntil:row.available_until||'',
        blockedFrom:row.blocked_from||'',blockedUntil:row.blocked_until||'',createdAt:row.created_at,
        photos:images.filter(i=>i.product_id===row.id).sort((a,b)=>a.position-b.position).map(i=>imageURL(i.storage_path)),
        imagePaths:images.filter(i=>i.product_id===row.id).sort((a,b)=>a.position-b.position).map(i=>i.storage_path),
        owner:row.owner_id===user?.id?'You':names.get(row.owner_id)||'Campus neighbour',
        custom:row.owner_id===user?.id, live:true, distance:null, verified:false, student:false,
        reviews:0,rating:null,alternative:false};
    }
    return {
      client, get user() { return user; }, setUser(value) { user=value; },
      async checkSchema() {
        for (const [table, select] of Object.entries(columns)) unwrap(await client.from(table).select(select).limit(0));
        const version=unwrap(await client.rpc('dormmart_contract_version'));
        if (version !== 1) throw Error('Unsupported DormMart database contract.');
      },
      async catalogue() {
        const [products, images, profiles]=await Promise.all([rows('products'),rows('product_images'),rows('profiles',client.from('profiles').select('id,full_name'))]);
        const names=new Map(profiles.map(p=>[p.id,p.full_name]));
        return products.map(p=>mapProduct(p,images,names));
      },
      async profile() {
        const row=unwrap(await client.from('profiles').select(columns.profiles).eq('id',uid()).single());
        return {name:row.full_name||'',campus:row.university||'',bio:row.bio||''};
      },
      async saveProfile(value) {
        if (value.name.length>60 || value.campus.length>100 || value.bio.length>300) throw Error('Profile is too long.');
        unwrap(await client.from('profiles').update({full_name:value.name,university:value.campus,bio:value.bio}).eq('id',uid()).select('id').single());
      },
      async saveListing(item, existing) {
        const owner=uid(), id=requireId(existing?existing.id:item.id);
        if (existing && existing.ownerId!==owner) throw Error('You can only edit your own listing.');
        if (!Array.isArray(item.photos) || item.photos.length<1 || item.photos.length>3) throw Error('Choose one to three photos.');
        const input=productInput(item), paths=[];
        try {
          for (const photo of item.photos) {
            const oldIndex=existing?.photos.indexOf(photo) ?? -1;
            if (oldIndex>=0) { paths.push(existing.imagePaths[oldIndex]); continue; }
            if (!/^data:image\/jpeg;base64,/.test(photo)) throw Error('Unsupported photo.');
            const blob=await (await fetch(photo)).blob();
            if (blob.size>8*1024*1024) throw Error('Photo is too large.');
            const path=`${owner}/${id}/${crypto.randomUUID()}.jpg`;
            unwrap(await bucket.upload(path,blob,{contentType:'image/jpeg',upsert:false}));
            paths.push(path);
          }
          // Database function commits product and image rows in one transaction under RLS.
          unwrap(await client.rpc('dormmart_save_product',{p_id:id,p_product:input,p_paths:paths,p_create:!existing}));
        } catch(error) {
          // A network timeout may occur after commit. Do not delete possibly referenced images.
          // Unreferenced uploads are reconciled by an owner/admin maintenance job (see docs).
          throw error;
        }
        // Retired files are also reconciled separately to avoid racing another editor.
        return {...item,id,ownerId:owner,owner:'You',custom:true,live:true,pickupAddress:undefined,
          photos:paths.map(imageURL),imagePaths:paths,verified:false,student:false,alternative:false,distance:null};
      },
      async deleteListing(item) {
        if(item.ownerId!==uid()) throw Error('You can only remove your own listing.');
        unwrap(await client.rpc('dormmart_delete_product',{p_id:requireId(item.id)}));
      },
      async inbox() {
        const owner=uid();
        const chats=await rows('conversations',client.from('conversations').select(columns.conversations).or(`buyer_id.eq.${owner},seller_id.eq.${owner}`));
        if (!chats.length) return [];
        const messages=await rows('messages',client.from('messages').select(columns.messages).in('conversation_id',chats.map(c=>c.id)).order('created_at').order('id'));
        const people=await rows('profiles',client.from('profiles').select('id,full_name'));
        const products=await rows('products',client.from('products').select('id,title'));
        return chats.map(c=>({id:requireId(c.id),itemId:c.product_id,title:products.find(p=>p.id===c.product_id)?.title||'Removed listing',
          owner:people.find(p=>p.id===(c.buyer_id===owner?c.seller_id:c.buyer_id))?.full_name||'Campus neighbour',
          messages:messages.filter(m=>m.conversation_id===c.id).map(m=>({id:m.id,text:m.content,time:m.created_at,from:m.sender_id===owner?'you':'other'}))}));
      },
      async startConversation(item) {
        if(item.ownerId===uid()) throw Error('This is your listing.');
        return requireId(unwrap(await client.rpc('dormmart_start_conversation',{p_product_id:requireId(item.id)})));
      },
      async sendMessage(id, text, messageId) {
        const sender=uid(); text=text.trim();
        if(!text || text.length>1000) throw Error('Write a message of 1–1000 characters.');
        // Stable ID makes retries safe if the first response is lost.
        const result=await client.from('messages').insert({id:requireId(messageId),conversation_id:requireId(id),sender_id:sender,content:text});
        if(result.error?.code==='23505') {
          const old=unwrap(await client.from('messages').select('id,sender_id,conversation_id,content').eq('id',messageId).single());
          if(old.sender_id!==sender || old.conversation_id!==id || old.content!==text) throw result.error;
        } else unwrap(result);
      },
      subscribe(refresh, status) {
        this.unsubscribe();
        channel=client.channel('dormmart-inbox-'+uid())
          .on('postgres_changes',{event:'*',schema:'public',table:'messages'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'conversations'},refresh)
          .subscribe(status);
      },
      unsubscribe() { if(channel) { client.removeChannel(channel); channel=null; } }
    };
  }
  const api={createBackend,validateConfig,productInput,requireId,columns};
  if(typeof module!=='undefined') module.exports=api;
  else root.DormMartBackend=api;
})(typeof window!=='undefined'?window:globalThis);

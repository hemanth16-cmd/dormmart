/* Supabase boundary. No service-role credentials, demo imports or private addresses. */
(function(root) {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const columns = {
    profiles: 'id,full_name,university,bio',
    products: 'id,seller_id,title,description,category,listing_type,price,deposit,condition,area,status,available_from,available_until,blocked_from,blocked_until,created_at,deleted_at',
    product_images: 'product_id,storage_path,position',
    conversations: 'id,product_id,buyer_id,seller_id,created_at',
    messages: 'id,conversation_id,sender_id,content,created_at'
  };
  // Migration 003 tables. Kept apart so the core contract check works without them.
  const workflowColumns = {
    item_requests: 'id,requester_id,title,note,category,request_type,budget,needed_by,area,status,archived_at,created_at',
    request_offers: 'id,request_id,product_id,offerer_id,note,status,created_at',
    booking_requests: 'id,product_id,requester_id,owner_id,item_title,listing_type,start_date,end_date,daily_price,deposit,estimated_total,note,status,decision_note,created_at,decided_at'
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
  function authErrorMessage(error, context='signin') {
    // Never display/log raw errors: they may contain user input or request details.
    if (context===true) context='signup';
    if (context===false) context='signin';
    const code=/^[a-z][a-z0-9_]{0,63}$/.test(error?.code||'')?error.code:'';
    const hints={
      // Supabase checks the password before confirmation, so this never means "unconfirmed".
      invalid_credentials:'The email or password is incorrect, or no account exists for this email. An unconfirmed account with the correct password shows a confirmation message instead. Use “Forgot password?” to set a new password.',
      email_not_confirmed:'Your password is correct, but this email address is not confirmed yet. Open the newest confirmation email, or use “Resend confirmation”.',
      email_provider_disabled:'Email sign-in is disabled for this project.',
      signup_disabled:'New account registration is disabled for this project.',
      user_already_exists:'An account with this email already exists. Sign in or use “Forgot password?”.',
      email_exists:'An account with this email already exists. Sign in or use “Forgot password?”.',
      email_address_invalid:'Enter a valid email address you can receive mail at.',
      email_address_not_authorized:'This project cannot send email to that address yet. The project owner must set up custom email (SMTP).',
      over_request_rate_limit:'Too many attempts. Wait a few minutes before trying again.',
      over_email_send_rate_limit:'No email was sent because the project’s email limit was reached. Wait before trying again; earlier links stop working once a newer one is sent.',
      user_banned:'This account is currently restricted. Contact the project owner.',
      weak_password:'Choose a stronger password that meets the project password requirements.',
      same_password:'Choose a password different from your current one.',
      validation_failed:'Check the email address and password format.',
      otp_expired:'This email link is invalid, expired or already used. Request a new one below.',
      access_denied:'This email link is invalid, expired or already used. Request a new one below.',
      flow_state_expired:'This email link has expired. Request a new one below.',
      flow_state_not_found:'This email link can no longer be used here. If you just confirmed your email, sign in.',
      session_not_found:'Your session has expired. Sign in again.',
      session_expired:'Your session has expired. Sign in again.',
      refresh_token_not_found:'Your session has expired. Sign in again.',
      reauthentication_needed:'Sign in again before changing your password.',
      captcha_failed:'The required CAPTCHA verification failed or is missing.',
      unexpected_failure:'The sign-in service encountered an error. Check the project Auth logs.'
    };
    let hint=hints[code];
    if(!hint&&(error?.name==='AuthRetryableFetchError'||error?.name==='TypeError'))hint='Could not reach the sign-in service. Check your connection or browser network blocking, then retry.';
    if(!hint&&error?.status===429)hint=hints.over_request_rate_limit;
    if(!hint)hint='Please retry. If it continues, share this message so we can check the cause.';
    const prefix={signin:'Sign-in failed. ',signup:'Account creation failed. ',forgot:'Reset email not sent. ',resend:'Confirmation email not sent. ',reset:'Password not changed. ',link:'Email link not accepted. '}[context]||'Request failed. ';
    return prefix+hint+(code?' ('+code+')':'');
  }
  function requireId(id) { if (!UUID.test(id || '')) throw Error('Invalid record ID.'); return id; }
  function productInput(item) {
    if (!['buy','rent','share'].includes(item.mode) || !item.title?.trim() || item.title.length > 70 || !item.description?.trim() || item.description.length > 1000 || !item.area?.trim()) throw Error('Check the listing details.');
    if (!Number.isFinite(item.price) || item.price < 0 || item.price > 1000000 || !Number.isFinite(item.deposit) || item.deposit < 0 || item.deposit > 1000000) throw Error('Check the price and deposit.');
    // Deliberate allowlist: never publish pickupAddress, badges, ownership or demo flags.
    return {title:item.title.trim(), description:item.description.trim(), category:item.category,
      listing_type:item.listingType==='both'&&item.mode==='buy'?'both':{buy:'sale',rent:'rent',share:'share'}[item.mode], price:item.mode==='share'?0:item.price, deposit:item.mode==='rent'?item.deposit:0,
      condition:item.condition, area:item.area.trim(), status:{available:'active',rented:'reserved',sold:'sold',inactive:'inactive'}[item.status||'available'],
      available_from:item.availableFrom || null, available_until:item.availableUntil || null,
      blocked_from:item.blockedFrom || null, blocked_until:item.blockedUntil || null};
  }
  function requestInput(value) {
    const title=String(value.title||'').trim(), note=String(value.note||'').trim(), area=String(value.area||'').trim();
    const type={buy:'sale',rent:'rent',share:'share'}[value.mode];
    const budget=type==='share'?0:Number(value.budget||0);
    if(!type||!title||title.length>80||!note||note.length>600||!area||area.length>100) throw Error('Check the request details.');
    if(!Number.isFinite(budget)||budget<0||budget>1000000) throw Error('Check the budget.');
    if(value.date&&!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw Error('Check the needed-by date.');
    // Allowlist: requester, status, archive state and timestamps are server-controlled.
    return {title,note,area,category:String(value.category||'Other').slice(0,80)||'Other',request_type:type,budget,needed_by:value.date||null};
  }
  // Only our own database messages are shown verbatim; anything else becomes a generic message.
  const KNOWN_ERRORS=/^(Choose a return date after the pickup date|Pickup date has passed|Bookings can last at most \d+ days|Choose dates within the owner's availability window|The item is unavailable on some of those dates|Those dates overlap an accepted booking|This listing is not available|Only rental and free-sharing listings can be booked|You cannot book your own listing|You already have three pending requests for this item|This listing is no longer available|This action is not allowed for this booking|Booking not found|Archived requests cannot be changed|Needed-by date cannot be in the past)$/;
  function friendlyError(error, fallback='Something went wrong. Your changes are preserved; please try again.') {
    const message=String(error?.message||'');
    if(KNOWN_ERRORS.test(message)) return message+'.';
    if(error?.code==='42501'||/row-level security/.test(message)) return 'You do not have permission for that action.';
    if(error?.name==='TypeError'||/fetch|network/i.test(message)) return 'Could not reach DormMart. Check your connection; your changes are preserved.';
    return fallback;
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
      if (typeof path !== 'string' || !/^[a-f0-9-]{36}\/[A-Za-z0-9_./-]+$/i.test(path) || path.split('/').some(part=>!part||part==='.'||part==='..')) throw Error('Invalid product image path.');
      return bucket.getPublicUrl(path).data.publicUrl;
    }
    function ownImages(images, productId) {
      return images.filter(i=>i.product_id===productId).sort((a,b)=>a.position-b.position)
        .filter(i=>{try{imageURL(i.storage_path);return true}catch{return false}});
    }
    function mapRequest(r, me, names, offers, products) {
      const mine=r.requester_id===me;
      const related=offers.filter(o=>o.request_id===r.id&&(mine||o.offerer_id===me));
      return {id:r.id,title:r.title,note:r.note,category:r.category||'Other',mode:{sale:'buy',rent:'rent',share:'share'}[r.request_type],
        budget:Number(r.budget)||0,date:r.needed_by||'',area:r.area,status:r.status,mine,live:true,createdAt:r.created_at,
        owner:mine?'You':names.get(r.requester_id)||'Campus neighbour',
        offers:related.map(o=>{const p=products.get(o.product_id);return {id:o.id,itemId:o.product_id,title:p?.title||'Unavailable listing',
          note:o.note,status:o.status,mine:o.offerer_id===me,from:o.offerer_id===me?'You':names.get(o.offerer_id)||'Campus neighbour',
          available:!!p&&p.status==='active'&&!p.deleted_at}})};
    }
    function mapProduct(row, images, names) {
      requireId(row.id); requireId(row.seller_id);
      return {id:row.id,ownerId:row.seller_id,title:row.title,description:row.description||'',category:row.category||'Other',
        mode:{sale:'buy',rent:'rent',share:'share',both:'buy'}[row.listing_type],listingType:row.listing_type,price:Number(row.price),deposit:Number(row.deposit),condition:row.condition,area:row.area,
        status:{active:'available',reserved:'rented',sold:'sold',inactive:'inactive'}[row.status],availableFrom:row.available_from||'',availableUntil:row.available_until||'',
        blockedFrom:row.blocked_from||'',blockedUntil:row.blocked_until||'',createdAt:row.created_at,
        // A malformed legacy path hides that one photo instead of breaking the whole catalogue.
        photos:ownImages(images,row.id).map(i=>imageURL(i.storage_path)),
        imagePaths:ownImages(images,row.id).map(i=>i.storage_path),
        owner:row.seller_id===user?.id?'You':names.get(row.seller_id)||'Campus neighbour',
        custom:row.seller_id===user?.id, live:true, distance:null, verified:false, student:false,
        reviews:0,rating:null,alternative:false};
    }
    return {
      client, get user() { return user; }, setUser(value) { user=value; },
      version:null,
      async checkSchema() {
        for (const [table, select] of Object.entries(columns)) unwrap(await client.from(table).select(select).limit(0));
        const version=unwrap(await client.rpc('dormmart_contract_version'));
        // 2 = 001; 3 = 002 hardening; 4 = 003 request board and bookings. Core works with all.
        if (![2,3,4].includes(version)) throw Error('Unsupported DormMart database contract.');
        this.version=version;
        return version;
      },
      // Guests cannot call contract_version, so probe the public request table instead.
      async workflowsAvailable() {
        if (this.version!==null) return this.version>=4;
        const result=await client.from('item_requests').select('id').limit(1);
        if (!result.error) return true;
        if (['42P01','PGRST205','PGRST204'].includes(result.error.code) || result.error.status===404) return false;
        throw result.error;
      },
      // ---------- Request board ----------
      async requests() {
        const me=user?.id||null;
        const list=await rows('item_requests',client.from('item_requests').select(workflowColumns.item_requests));
        const offers=me?await rows('request_offers',client.from('request_offers').select(workflowColumns.request_offers)):[];
        const ids=[...new Set([...list.map(r=>r.requester_id),...offers.map(o=>o.offerer_id)])];
        const names=me&&ids.length?new Map((await rows('profiles',client.from('profiles').select('id,full_name').in('id',ids))).map(p=>[p.id,p.full_name])):new Map();
        const productIds=[...new Set(offers.map(o=>o.product_id))];
        const titles=productIds.length?new Map((await rows('products',client.from('products').select('id,title,status,deleted_at').in('id',productIds))).map(p=>[p.id,p])):new Map();
        return list.filter(r=>!r.archived_at).map(r=>mapRequest(r,me,names,offers,titles))
          .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
      },
      async saveRequest(value, existingId=null) {
        uid();
        const row=requestInput(value);
        const query=existingId?client.from('item_requests').update(row).eq('id',requireId(existingId)):client.from('item_requests').insert(row);
        const saved=unwrap(await query.select('id').single());
        return saved.id;
      },
      async setRequestStatus(id, status) {
        uid(); if(!['open','closed'].includes(status)) throw Error('Invalid status.');
        unwrap(await client.from('item_requests').update({status}).eq('id',requireId(id)).select('id').single());
      },
      async archiveRequest(id) {
        uid();
        // The server replaces this value with its own clock and refuses any later change.
        unwrap(await client.from('item_requests').update({archived_at:new Date().toISOString()}).eq('id',requireId(id)).select('id').single());
      },
      async offerListing(requestId, productId, note) {
        uid(); note=String(note||'').trim();
        if(!note||note.length>400) throw Error('Write offer details of 1–400 characters.');
        return unwrap(await client.rpc('dormmart_offer_listing',{p_request:requireId(requestId),p_product:requireId(productId),p_note:note}));
      },
      async withdrawOffer(offerId) {
        uid(); unwrap(await client.from('request_offers').update({status:'withdrawn'}).eq('id',requireId(offerId)).select('id').single());
      },
      // ---------- Bookings ----------
      async bookedRanges(productId) {
        return (unwrap(await client.rpc('dormmart_booked_ranges',{p_product:requireId(productId)}))||[]).map(r=>({start:r.start_date,end:r.end_date}));
      },
      async requestBooking(id, productId, start, end, note='') {
        uid(); note=String(note||'').trim();
        if(note.length>500) throw Error('Keep the note under 500 characters.');
        return unwrap(await client.rpc('dormmart_request_booking',{p_id:requireId(id),p_product:requireId(productId),p_start:start,p_end:end,p_note:note}));
      },
      async bookings() {
        const me=uid();
        const list=await rows('booking_requests',client.from('booking_requests').select(workflowColumns.booking_requests));
        const ids=[...new Set(list.map(b=>b.requester_id===me?b.owner_id:b.requester_id))];
        const names=ids.length?new Map((await rows('profiles',client.from('profiles').select('id,full_name').in('id',ids))).map(p=>[p.id,p.full_name])):new Map();
        return list.map(b=>({id:b.id,itemId:b.product_id,itemTitle:b.item_title,mode:b.listing_type,start:b.start_date,end:b.end_date,
          status:b.status,dailyPrice:Number(b.daily_price),deposit:Number(b.deposit),total:Number(b.estimated_total),
          note:b.note||'',decisionNote:b.decision_note||'',role:b.owner_id===me?'owner':'requester',
          counterpart:names.get(b.owner_id===me?b.requester_id:b.owner_id)||'Campus neighbour',createdAt:b.created_at}))
          .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
      },
      async decideBooking(id, action, note='') {
        uid(); if(!['accept','reject','cancel','complete'].includes(action)) throw Error('Invalid action.');
        return unwrap(await client.rpc('dormmart_decide_booking',{p_id:requireId(id),p_action:action,p_note:String(note||'').trim().slice(0,200)}));
      },
      async catalogue({publicOnly=false}={}) {
        const query=client.from('products').select(columns.products).is('deleted_at',null);
        if(publicOnly)query.eq('status','active');
        const [products, images, profiles]=await Promise.all([rows('products',query),rows('product_images'),publicOnly?Promise.resolve([]):rows('profiles',client.from('profiles').select('id,full_name'))]);
        const names=new Map(profiles.map(p=>[p.id,p.full_name]));
        return products.map(p=>mapProduct(p,images,names));
      },
      async profile() {
        const id=uid();
        let row=unwrap(await client.from('profiles').select(columns.profiles).eq('id',id).maybeSingle());
        if (!row) {
          // Accounts created before the signup trigger existed have no profile row; create only our own.
          const created=await client.from('profiles').insert({id}).select(columns.profiles).single();
          row=created.error?.code==='23505'?unwrap(await client.from('profiles').select(columns.profiles).eq('id',id).single()):unwrap(created);
        }
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
            if (blob.size>5*1024*1024) throw Error('Uploaded photos must be 5 MiB or smaller.');
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
        // Only fetch the people and listings referenced by this inbox.
        const people=await rows('profiles',client.from('profiles').select('id,full_name').in('id',[...new Set(chats.map(c=>c.buyer_id===owner?c.seller_id:c.buyer_id))]));
        const products=await rows('products',client.from('products').select('id,title').in('id',[...new Set(chats.map(c=>c.product_id))]));
        return chats.map(c=>({id:requireId(c.id),itemId:c.product_id,title:products.find(p=>p.id===c.product_id)?.title||'Unavailable listing',
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
  const api={createBackend,validateConfig,productInput,requestInput,friendlyError,requireId,columns,workflowColumns,authErrorMessage};
  if(typeof module!=='undefined') module.exports=api;
  else root.DormMartBackend=api;
})(typeof window!=='undefined'?window:globalThis);

/* Live orchestration reuses the existing renderers and forms. Demo mode is untouched. */
if (LIVE_MODE) {
  let client, currentUserId=null, inboxSequence=0, refreshTimer, signingUp=false, initialized=false;
  const pendingMessages=new Map();
  const authForm=$('#auth-form'), submit=authForm.querySelector('[type=submit]');
  const notice=$('.auth-panel .notice');
  notice.setAttribute('role','status');
  notice.textContent='Connecting to DormMart…';
  submit.disabled=true;
  $('#demo-contact').type='email'; $('#demo-contact').autocomplete='email';
  $('#demo-contact').placeholder='Your email address';
  $('#demo-contact').parentElement.firstChild.textContent='Email';
  $('#demo-password').autocomplete='current-password'; $('#demo-password').placeholder='Your password';
  submit.textContent='Sign in ↗';
  const toggle=document.createElement('button'); toggle.type='button';toggle.className='text-btn';
  toggle.textContent='Create an account';toggle.disabled=true;authForm.append(toggle);
  toggle.onclick=()=>{signingUp=!signingUp;submit.textContent=signingUp?'Create account ↗':'Sign in ↗';toggle.textContent=signingUp?'Already registered? Sign in':'Create an account';$('#demo-password').autocomplete=signingUp?'new-password':'current-password';$('#demo-password').minLength=signingUp?8:1;notice.textContent=signingUp?'Check your email after signing up to confirm your account.':'Sign in with your email and password.'};
  $('.demo > span').textContent='Your campus marketplace · No payments or online bookings';
  function clearAccount() {
    liveGeneration++; inboxSequence++; pendingMessages.clear(); clearTimeout(refreshTimer);
    window.liveBackend?.unsubscribe();
    demoSignedIn=false; LISTINGS.splice(0);userListings.splice(0);conversations=[];saved=[];requests=[];
    profile={name:'',campus:'',bio:''};
    if($('#modal').open)closeModal();
    for(const id of ['profile-view','messages-view','item-view'])$('#'+id).replaceChildren();
    $('#auth-form').reset();syncAuth();render();
    window.dispatchEvent(new Event('dormmart-account-change'));
  }
  async function refreshInbox() {
    if(!demoSignedIn)return;
    const generation=liveGeneration, sequence=++inboxSequence;
    try {
      const next=await liveBackend.inbox();
      if(generation!==liveGeneration||sequence!==inboxSequence)return;
      conversations=next;
      if(location.hash.startsWith('#messages')){
        const draft=$('#message-text')?.value||'',focused=document.activeElement?.id==='message-text';
        const selected=location.hash.startsWith('#messages-')?location.hash.slice(10):null;
        renderMessages(selected);
        if($('#message-text')){$('#message-text').value=draft;if(focused)$('#message-text').focus()}
      }
    } catch { if(generation===liveGeneration)toast('Messages could not refresh. Your draft is preserved.'); }
  }
  const scheduleRefresh=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshInbox,200)};
  async function applySession(session) {
    const id=session?.user?.id||null;
    if(initialized&&id===currentUserId)return;
    initialized=true;currentUserId=id;clearAccount();liveBackend.setUser(session?.user||null);
    if(!id){notice.textContent='Sign in with your email and password.';return}
    const generation=liveGeneration;notice.textContent='Loading your account…';
    try {
      await liveBackend.checkSchema();
      const [items,details,chats]=await Promise.all([liveBackend.catalogue(),liveBackend.profile(),liveBackend.inbox()]);
      if(generation!==liveGeneration)return;
      LISTINGS.push(...items);userListings.push(...items.filter(x=>x.custom));profile=details;conversations=chats;
      demoSignedIn=true;updateCategoryDropdown();syncAuth();render();route();
      liveBackend.subscribe(scheduleRefresh,status=>{
        if(status==='SUBSCRIBED')scheduleRefresh();
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')toast('Live updates are reconnecting. Messages also refresh periodically.');
      });
    } catch {
      if(generation!==liveGeneration)return;
      initialized=false;
      notice.textContent='Could not load your account. Check the connection and database compatibility, then sign in again. No demo data has been substituted.';
    }
  }
  window.liveSignOut=async()=>{
    try { const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await applySession(null); }
    catch {toast('Sign out failed. Please try again.');}
  };
  window.liveStartConversation=async id=>{
    const item=LISTINGS.find(x=>x.id===id),generation=liveGeneration;
    if(!demoSignedIn||!item||item.custom)return;
    try {
      const chatId=await liveBackend.startConversation(item);
      await refreshInbox();if(generation!==liveGeneration)return;
      location.hash='messages-'+chatId;route();
    } catch { if(generation===liveGeneration)toast('Could not open the conversation. Please try again.'); }
  };
  window.bindLiveMessageForm=active=>{
    $('#simulate-reply')?.remove();
    const form=$('#message-form'),input=$('#message-text'),error=$('#message-error'),button=form.querySelector('button');
    form.onsubmit=async e=>{
      e.preventDefault(); const text=input.value.trim();
      if(!text){error.textContent='Write a message before sending.';return}
      if(button.disabled)return;
      const generation=liveGeneration;
      let pending=pendingMessages.get(active.id);
      if(!pending||pending.text!==text){pending={text,id:crypto.randomUUID()};pendingMessages.set(active.id,pending)}
      button.disabled=true;error.textContent='';
      try {
        await liveBackend.sendMessage(active.id,text,pending.id);
        if(generation!==liveGeneration)return;
        pendingMessages.delete(active.id);
        const current=$('#message-text');
        const selected=location.hash.startsWith('#messages-')?location.hash.slice(10):conversations[0]?.id;
        if(current&&selected===active.id&&current.value.trim()===text)current.value='';
        await refreshInbox();
      } catch {if(generation===liveGeneration&&error.isConnected)error.textContent='Delivery could not be confirmed. Your draft is preserved; retrying this message is safe.';}
      finally {if(button.isConnected)button.disabled=false}
    };
    $('.message-history').scrollTop=$('.message-history').scrollHeight;
  };
  authForm.onsubmit=async e=>{
    e.preventDefault();if(!client||submit.disabled||!authForm.reportValidity())return;
    const credentials={email:$('#demo-contact').value.trim(),password:$('#demo-password').value};
    submit.disabled=true;toggle.disabled=true;notice.textContent=signingUp?'Creating your account…':'Signing in…';
    try {
      const {data,error}=signingUp?await client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword(credentials);
      if(error)throw error;
      $('#demo-password').value='';
      if(signingUp&&!data.session)notice.textContent='Check your email to confirm your account, then sign in.';
      else await applySession(data.session);
    } catch { notice.textContent=signingUp?'Could not create your account. Check your details or try signing in.':'Sign-in failed. Check your email, password and email confirmation, then retry.'; }
    finally {submit.disabled=false;toggle.disabled=false}
  };
  (async()=>{
    try {
      DormMartBackend.validateConfig(window.DORMMART_CONFIG);
      const {createClient}=await import('./vendor/supabase.js');
      client=createClient(DORMMART_CONFIG.url,DORMMART_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'dormmart-supabase-auth'}});
      window.liveBackend=DormMartBackend.createBackend(client,DORMMART_CONFIG);
      // Never await Supabase calls inside its auth event callback.
      client.auth.onAuthStateChange((event,session)=>{
        if((session?.user?.id||null)!==currentUserId)clearAccount();
        setTimeout(()=>applySession(session),0);
      });
      const {data,error}=await client.auth.getSession();if(error)throw error;
      await applySession(data.session);submit.disabled=false;toggle.disabled=false;
      setInterval(()=>{if(!document.hidden)refreshInbox()},15000);
      window.addEventListener('online',scheduleRefresh);
      window.addEventListener('focus',scheduleRefresh);
    } catch {notice.textContent='DormMart could not connect. Check the public configuration and reload. Sign-in is unavailable until the connection is ready.';}
  })();
}

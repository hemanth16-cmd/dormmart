/* Live orchestration reuses the existing renderers and forms. Demo mode is untouched. */
if (LIVE_MODE && !GUEST_MODE) {
  let client, currentUserId=null, inboxSequence=0, refreshTimer, initialized=false;
  let authMode='signin', authBusy=false, authReady=false, recoveryPending=false, linkNotice='';
  const pendingMessages=new Map(), cooldownUntil=new Map();
  const EMAIL_COOLDOWN_MS=60000;
  const authForm=$('#auth-form'), submit=authForm.querySelector('[type=submit]');
  const notice=$('.auth-panel .notice');
  const email=$('#demo-contact'), password=$('#demo-password');
  const emailLabel=email.closest('label'), passwordLabel=password.closest('label');
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  notice.textContent='Connecting to DormMart…';
  submit.disabled=true;
  // Stay type=text: the existing CSS styles text inputs only. Email keyboard + pattern validate instead.
  email.inputMode='email';email.autocomplete='email';email.spellcheck=false;email.autocapitalize='none';
  email.pattern='[^@\\s]+@[^@\\s]+\\.[^@\\s]+';email.title='Enter an email address, e.g. name@college.edu';email.placeholder='Your email address';email.maxLength=254;
  emailLabel.firstChild.textContent='Email';
  password.placeholder='Your password';password.maxLength=72;
  // Existing text-button style; no new CSS.
  const links=document.createElement('p');authForm.append(links);
  $('.demo > span').textContent='Your campus marketplace · No payments or online bookings';

  const modes={
    signin:{submit:'Sign in ↗',password:'current-password',min:1,note:'Sign in with your DormMart email and password.',busy:'Signing in…'},
    signup:{submit:'Create account ↗',password:'new-password',min:8,note:'Use at least 8 characters. We will email you a confirmation link before you can sign in.',busy:'Creating your account…'},
    forgot:{submit:'Email me a reset link ↗',note:'Enter your account email. If it is registered, we will send a password reset link.',busy:'Requesting a reset link…'},
    resend:{submit:'Resend confirmation email ↗',note:'Enter the email you signed up with. Only the newest confirmation link works.',busy:'Requesting a confirmation email…'},
    reset:{submit:'Save new password ↗',password:'new-password',min:8,note:'Reset link accepted. Choose a new password of at least 8 characters.',busy:'Saving your new password…'}
  };
  function linkButton(label,next){
    const button=document.createElement('button');button.type='button';button.className='text-btn';
    button.textContent=label;button.disabled=authBusy||!authReady;button.onclick=next;return button;
  }
  function linksFor(mode){
    const to=next=>()=>setMode(next);
    const parts={
      signin:[linkButton('Create an account',to('signup')),linkButton('Forgot password?',to('forgot')),linkButton('Resend confirmation',to('resend'))],
      signup:[linkButton('Already registered? Sign in',to('signin')),linkButton('Resend confirmation',to('resend'))],
      forgot:[linkButton('Back to sign in',to('signin'))],
      resend:[linkButton('Back to sign in',to('signin'))],
      reset:[linkButton('Cancel and sign out',cancelRecovery)]
    }[mode];
    return parts.flatMap((button,index)=>index?[document.createTextNode(' · '),button]:[button]);
  }
  function setMode(mode,message){
    authMode=mode;const config=modes[mode],usesPassword='password' in config;
    emailLabel.hidden=mode==='reset';email.required=mode!=='reset';email.disabled=mode==='reset';
    passwordLabel.hidden=!usesPassword;password.required=usesPassword;password.disabled=!usesPassword;
    if(usesPassword){password.autocomplete=config.password;password.minLength=config.min}
    passwordLabel.firstChild.textContent=mode==='reset'?'New password':'Password';
    submit.textContent=config.submit;
    links.replaceChildren(...linksFor(mode));
    notice.textContent=message||config.note;
    setBusy(authBusy);
  }
  function setBusy(busy,message){
    authBusy=busy;submit.disabled=busy||!authReady;
    for(const button of links.querySelectorAll('button'))button.disabled=busy||!authReady;
    if(message)notice.textContent=message;
  }
  const cooldownKey=(action,address)=>action+':'+address;
  function cooldownSeconds(action,address){return Math.max(0,Math.ceil(((cooldownUntil.get(cooldownKey(action,address))||0)-Date.now())/1000))}
  function startCooldown(address){for(const action of ['signup','resend','forgot'])cooldownUntil.set(cooldownKey(action,address),Date.now()+EMAIL_COOLDOWN_MS)}
  // The redirect target must be listed under Supabase Auth > URL Configuration > Redirect URLs.
  const redirectURL=()=>location.origin+location.pathname;

  // Read Supabase email-link results before the SDK or the hash router touches the URL.
  function readAuthRedirect(){
    const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
    const code=hash.get('error_code')||query.get('error_code'),failed=hash.get('error')||query.get('error');
    if(code||failed){
      history.replaceState(null,'',location.pathname);
      linkNotice=DormMartBackend.authErrorMessage({code:code||'',name:'AuthRedirectError'},'link');
      return;
    }
    if(hash.get('access_token')&&hash.get('type')==='recovery')recoveryPending=true;
    if(hash.get('access_token')&&hash.get('type')==='signup')linkNotice='confirmed';
  }

  function clearAccount() {
    liveGeneration++; inboxSequence++; pendingMessages.clear(); clearTimeout(refreshTimer);
    window.liveBackend?.unsubscribe();
    demoSignedIn=false; LISTINGS.splice(0);userListings.splice(0);conversations=[];requests=[];
    setStorageScope(null);catalogueState='loading';
    profile={name:'',campus:'',bio:''};
    if($('#modal').open)closeModal();
    for(const id of ['profile-view','messages-view','item-view'])$('#'+id).replaceChildren();
    const keepEmail=email.value;authForm.reset();if(authMode!=='signin')email.value=keepEmail;
    syncAuth();render();
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
    if(recoveryPending&&id){
      // A recovery link signs the user in. Require a new password before loading private data.
      if(authMode!=='reset'){currentUserId=null;initialized=true;clearAccount();liveBackend.setUser(session.user);setMode('reset')}
      return;
    }
    if(initialized&&id===currentUserId)return;
    initialized=true;currentUserId=id;clearAccount();liveBackend.setUser(session?.user||null);
    if(!id){
      if(authMode==='reset')setMode('signin');
      if(linkNotice&&linkNotice!=='confirmed'){notice.textContent=linkNotice;linkNotice=''}
      else if(authMode==='signin')notice.textContent=modes.signin.note;
      return;
    }
    const generation=liveGeneration;notice.textContent='Loading your account…';
    try {
      await liveBackend.checkSchema();
      const [items,details,chats]=await Promise.all([liveBackend.catalogue(),liveBackend.profile(),liveBackend.inbox()]);
      if(generation!==liveGeneration)return;
      LISTINGS.push(...items);userListings.push(...items.filter(x=>x.custom));profile=details;conversations=chats;
      setStorageScope(id);catalogueState='ready';
      demoSignedIn=true;updateCategoryDropdown();syncAuth();render();route();
      if(linkNotice==='confirmed'){toast('Email confirmed. Welcome to DormMart.');linkNotice=''}
      liveBackend.subscribe(scheduleRefresh,status=>{
        if(status==='SUBSCRIBED')scheduleRefresh();
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')toast('Live updates are reconnecting. Messages also refresh periodically.');
      });
    } catch {
      if(generation!==liveGeneration)return;
      initialized=false;
      notice.textContent='Signed in, but your account could not be loaded. Check the connection and database compatibility, then reload. No demo data has been substituted.';
    }
  }
  async function cancelRecovery(){
    recoveryPending=false;setBusy(true,'Signing out…');
    try{await client.auth.signOut({scope:'local'})}catch{}
    setBusy(false);currentUserId=undefined;initialized=false;await applySession(null);setMode('signin');
  }
  window.liveSignOut=async()=>{
    try { const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;await applySession(null);setMode('signin','You have signed out.'); }
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
    e.preventDefault();if(!client||!authReady||authBusy||!authForm.reportValidity())return;
    const mode=authMode,address=email.value.trim().toLowerCase(),secret=password.value;
    if(['signup','resend','forgot'].includes(mode)){
      const wait=cooldownSeconds(mode,address);
      if(wait>0){notice.textContent=`An email was just requested for this address. Wait ${wait} seconds before requesting another.`;return}
    }
    setBusy(true,modes[mode].busy);
    try {
      if(mode==='signin'){
        const {data,error}=await client.auth.signInWithPassword({email:address,password:secret});
        if(error)throw error;
        password.value='';await applySession(data.session);
      } else if(mode==='signup'){
        const {data,error}=await client.auth.signUp({email:address,password:secret,options:{emailRedirectTo:redirectURL()}});
        if(error)throw error;
        password.value='';startCooldown(address);
        if(data.session)await applySession(data.session);
        else {
          // Supabase hides whether a confirmed account exists; an empty identity list signals that case.
          const existing=Array.isArray(data.user?.identities)&&data.user.identities.length===0;
          setMode('signin',existing?'No new account was created. If this email is already registered, sign in or use “Forgot password?”.':`Almost there. Open the confirmation link sent to ${address} (check spam), then sign in here.`);
          email.value=address;
        }
      } else if(mode==='resend'){
        const {error}=await client.auth.resend({type:'signup',email:address,options:{emailRedirectTo:redirectURL()}});
        if(error)throw error;
        startCooldown(address);setMode('signin',`If ${address} has an unconfirmed account, a new confirmation link was sent. Only the newest link works.`);email.value=address;
      } else if(mode==='forgot'){
        const {error}=await client.auth.resetPasswordForEmail(address,{redirectTo:redirectURL()});
        if(error)throw error;
        startCooldown(address);setMode('signin',`If ${address} is registered, a password reset link was sent. It works once and expires.`);email.value=address;
      } else if(mode==='reset'){
        const {error}=await client.auth.updateUser({password:secret});
        if(error)throw error;
        password.value='';recoveryPending=false;
        const {data}=await client.auth.getSession();
        setMode('signin');currentUserId=undefined;initialized=false;await applySession(data.session);
        toast('Password updated.');
      }
    } catch(error) {
      notice.textContent=DormMartBackend.authErrorMessage(error,mode);
    } finally {setBusy(false)}
  };
  (async()=>{
    try {
      readAuthRedirect();
      DormMartBackend.validateConfig(window.DORMMART_CONFIG);
      const {createClient}=await import('./vendor/supabase.js');
      client=createClient(DORMMART_CONFIG.url,DORMMART_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'dormmart-supabase-auth'}});
      window.liveBackend=DormMartBackend.createBackend(client,DORMMART_CONFIG);
      // Never await Supabase calls inside its auth event callback.
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='PASSWORD_RECOVERY')recoveryPending=true;
        if(!recoveryPending&&(session?.user?.id||null)!==currentUserId)clearAccount();
        setTimeout(()=>applySession(session),0);
      });
      const {data,error}=await client.auth.getSession();
      authReady=true;setMode('signin');
      // A stale stored session is treated as signed out, not as a connection failure.
      await applySession(error?null:data.session);
      if(error&&!linkNotice)notice.textContent='Your previous session expired. Please sign in again.';
      setInterval(()=>{if(!document.hidden)refreshInbox()},15000);
      window.addEventListener('online',scheduleRefresh);
      window.addEventListener('focus',scheduleRefresh);
    } catch {authReady=false;setBusy(false);notice.textContent='DormMart could not connect. Check the public configuration and reload. Sign-in is unavailable until the connection is ready.';}
  })();
}

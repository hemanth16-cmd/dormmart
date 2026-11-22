/* Temporary public browsing. Never restore an account or request private data. */
if (GUEST_MODE) {
  $('.demo > span').textContent='Guest browsing · Accounts temporarily paused';
  const status=document.createElement('p');status.id='guest-status';status.className='notice wrap';
  status.setAttribute('role','status');status.textContent='Loading public listings…';
  $('#main').prepend(status);
  setStorageScope('guest');
  syncAuth();route();
  let backend,loading=false;
  async function refreshPublicListings(){
    if(!backend||loading)return;
    loading=true;if(catalogueState!=='ready'){catalogueState='loading';render()}
    try{
      const items=await backend.catalogue({publicOnly:true});
      LISTINGS.splice(0,LISTINGS.length,...items);
      catalogueState='ready';updateCategoryDropdown();render();route();
      status.replaceChildren(document.createTextNode(items.length?'Browse public listings without an account.':'No public listings yet. Accounts are paused; you can still explore the site.'));
    }catch{
      catalogueState='error';render();if(location.hash.startsWith('#item-'))route();
      status.replaceChildren(document.createTextNode('Public listings could not load. '));
      const retry=document.createElement('button');retry.type='button';retry.className='text-btn';retry.textContent='Try again';retry.onclick=refreshPublicListings;status.append(retry);
    }finally{loading=false}
  }
  (async()=>{
    try{
      DormMartBackend.validateConfig(DORMMART_CONFIG);
      const {createClient}=await import('./vendor/supabase.js');
      // Separate nonpersistent client: existing stored auth tokens are never read or sent.
      const client=createClient(DORMMART_CONFIG.url,DORMMART_CONFIG.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'dormmart-public-guest'}});
      backend=DormMartBackend.createBackend(client,DORMMART_CONFIG);
      // Read-only access for the public request board and booking calendars.
      window.publicBackend=backend;window.retryCatalogue=refreshPublicListings;
      await refreshPublicListings();
      window.refreshWantedBoard?.();
      window.addEventListener('online',refreshPublicListings);
    }catch{catalogueState='error';render();status.textContent='Public listings are unavailable. Check the connection and reload.';}
  })();
}

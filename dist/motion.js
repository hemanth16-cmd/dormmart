/* Progressive motion: no content is hidden while waiting for JavaScript. */
(()=>{
 const root=document.documentElement, reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
 const toggle=document.getElementById('motion-toggle');
 let optedOut=false,activeCard=null,frame=0,enabled=false;
 try{optedOut=localStorage.getItem('dormmart-motion')==='off'}catch{}
 const animations=new Set(),seen=new WeakSet();
 const selectors='.hero-copy > *, .section-heading, .card, .owned-card, .how li, .profile-panel, .profile-stats > div, .conversation, .community-empty';
 function resetTilt(){if(frame)cancelAnimationFrame(frame);frame=0;if(activeCard){activeCard.classList.remove('is-tilting');for(const name of ['--tilt-x','--tilt-y','--shine-x','--shine-y'])activeCard.style.removeProperty(name);activeCard=null}}
 function sync(){enabled=!optedOut&&!reduced.matches;root.classList.toggle('motion-off',!enabled);toggle.hidden=false;toggle.disabled=reduced.matches;toggle.textContent=reduced.matches?'Motion: reduced':'Motion: '+(enabled?'on':'off');toggle.setAttribute('aria-pressed',String(enabled));toggle.setAttribute('aria-label',reduced.matches?'Motion reduced by your device settings':enabled?'Pause decorative motion':'Enable decorative motion');if(!enabled){resetTilt();animations.forEach(a=>a.cancel());animations.clear()}}
 root.classList.add('motion-ready');sync();reduced.addEventListener('change',sync);fine.addEventListener('change',resetTilt);
 toggle.onclick=()=>{optedOut=!optedOut;try{localStorage.setItem('dormmart-motion',optedOut?'off':'on')}catch{}sync()};
 function reveal(el){if(seen.has(el))return;seen.add(el);if(!enabled||!el.animate)return;const siblings=el.parentElement?Array.from(el.parentElement.children).indexOf(el):0;const animation=el.animate([{opacity:.25,translate:'0 16px'},{opacity:1,translate:'0 0'}],{duration:480,delay:Math.min(siblings,4)*45,easing:'cubic-bezier(.2,.7,.2,1)'});animations.add(animation);animation.onfinish=()=>animations.delete(animation);animation.oncancel=()=>animations.delete(animation)}
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){reveal(entry.target);observer.unobserve(entry.target)}}),{threshold:.08});
  function watch(node){if(!(node instanceof Element))return;if(node.matches(selectors))observer.observe(node);node.querySelectorAll(selectors).forEach(el=>observer.observe(el))}
  watch(document.getElementById('main'));
  // Stop the ambient scene when it is outside the viewport, including other pages.
  const hero=document.querySelector('.hero-art');
  if(hero)new IntersectionObserver(entries=>{hero.classList.toggle('scene-paused',!entries[0].isIntersecting)},{threshold:0}).observe(hero);
  new MutationObserver(records=>records.forEach(record=>{record.addedNodes.forEach(watch);record.removedNodes.forEach(node=>{if(!(node instanceof Element))return;observer.unobserve(node);node.querySelectorAll(selectors).forEach(el=>observer.unobserve(el))})})).observe(document.getElementById('main'),{childList:true,subtree:true});
 }
 document.addEventListener('pointermove',event=>{
  if(!enabled||!fine.matches||event.pointerType==='touch')return;
  const card=event.target.closest('.card,.owned-card,.profile-stats>div');
  if(card!==activeCard){resetTilt();activeCard=card}if(!card)return;
  const rect=card.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
  if(frame)cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{frame=0;if(!card.isConnected)return;card.classList.add('is-tilting');card.style.setProperty('--tilt-x',((.5-y)*5).toFixed(2)+'deg');card.style.setProperty('--tilt-y',((x-.5)*5).toFixed(2)+'deg');card.style.setProperty('--shine-x',x*100+'%');card.style.setProperty('--shine-y',y*100+'%')});
 },{passive:true});
 document.addEventListener('pointerout',event=>{if(!event.relatedTarget)resetTilt()},{passive:true});
 window.addEventListener('scroll',resetTilt,{passive:true});window.addEventListener('blur',resetTilt);window.addEventListener('hashchange',resetTilt);
 document.addEventListener('visibilitychange',()=>{root.classList.toggle('motion-paused',document.hidden);if(document.hidden)resetTilt()});
})();

/* Layered hero parallax follows the cursor without intercepting clicks or touch. */
(()=>{
 const hero=document.querySelector('.hero'),root=document.documentElement;
 if(!hero)return;
 const fine=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const layers=[['.camera',14],['.chair',24],['.depth-ring',-12],['.depth-halo',-6],['.depth-orb',20],['.depth-cube',-22],['.art-spark',28],['.floating-note',12],['.round-sticker',18]].map(([selector,depth])=>({el:hero.querySelector(selector),depth})).filter(x=>x.el);
 layers.forEach(({el})=>el.classList.add('parallax-layer'));
 let frame=0;
 function reset(){cancelAnimationFrame(frame);frame=0;layers.forEach(({el})=>{el.style.removeProperty('--drift-x');el.style.removeProperty('--drift-y')})}
 hero.addEventListener('pointermove',e=>{
  if(!fine.matches||reduced.matches||root.classList.contains('motion-off')||e.pointerType==='touch')return;
  const box=hero.getBoundingClientRect(),x=Math.max(-1,Math.min(1,((e.clientX-box.left)/box.width-.5)*2)),y=Math.max(-1,Math.min(1,((e.clientY-box.top)/box.height-.5)*2));
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;layers.forEach(({el,depth})=>{el.style.setProperty('--drift-x',(x*depth).toFixed(2)+'px');el.style.setProperty('--drift-y',(y*depth*.65).toFixed(2)+'px')})});
 },{passive:true});
 hero.addEventListener('pointerleave',reset);window.addEventListener('scroll',reset,{passive:true});window.addEventListener('blur',reset);window.addEventListener('hashchange',reset);fine.addEventListener('change',reset);reduced.addEventListener('change',reset);
 new MutationObserver(()=>{if(root.classList.contains('motion-off')||document.hidden)reset()}).observe(root,{attributes:true,attributeFilter:['class']});
})();


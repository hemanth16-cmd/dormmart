/* Apply before paint, then wire the theme control after the document is ready. */
(()=>{
 const root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');
 let preference=null;try{const stored=localStorage.getItem('dormmart-theme');if(['dark','light'].includes(stored))preference=stored}catch{}
 function apply(){const dark=(preference|| (system.matches?'dark':'light'))==='dark';root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';const button=document.getElementById('theme-toggle');if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');button.querySelector('.theme-label').textContent=dark?'Light mode':'Dark mode';button.querySelector('[aria-hidden]').textContent=dark?'☀':'☾'}document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#171b22':'#edece6')}
 apply();system.addEventListener('change',()=>{if(!preference)apply()});
 document.addEventListener('DOMContentLoaded',()=>{apply();document.getElementById('theme-toggle').onclick=()=>{preference=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('dormmart-theme',preference)}catch{}apply()}});
})();

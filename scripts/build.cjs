const fs=require('node:fs');
const path=require('node:path');
const {validateConfig}=require('../dist/backend.js');
async function build(env=process.env, outDir='build') {
  if(!['build','build-demo'].includes(outDir))throw Error('Output must be build or build-demo');
  const mode=env.DORMMART_BACKEND||'demo';
  if(!['demo','supabase'].includes(mode))throw Error('DORMMART_BACKEND must be demo or supabase');
  const config=mode==='demo'?{mode}:validateConfig({mode,url:env.SUPABASE_URL||'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,schemaVerified:env.DORMMART_SCHEMA_VERIFIED==='true',guestMode:env.DORMMART_GUEST_MODE==='true'});
  const output=path.resolve(__dirname,'..',outDir);
  // Generated configuration goes in ignored build/, never tracked dist/.
  fs.mkdirSync(output,{recursive:true});
  fs.cpSync(path.resolve(__dirname,'../dist'),output,{recursive:true,filter:source=>path.basename(source)!=='vendor'});
  if(mode==='supabase')await require('esbuild').build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:path.resolve(__dirname,'..')},bundle:true,format:'esm',platform:'browser',minify:true,outfile:path.join(output,'vendor/supabase.js')});
  fs.writeFileSync(path.join(output,'backend-config.js'),'// Generated public configuration.\nwindow.DORMMART_CONFIG = '+JSON.stringify(config)+';\n');
}
if(require.main===module){
  const localEnv=path.resolve(__dirname,'../.env.local');
  if(fs.existsSync(localEnv))process.loadEnvFile(localEnv);
  // --demo: isolated browser-only demo in build-demo/. No Supabase URL, key or SDK is included.
  const demo=process.argv.includes('--demo');
  build(demo?{DORMMART_BACKEND:'demo'}:process.env,demo?'build-demo':'build').then(()=>console.log('Built '+(demo?'build-demo/ (isolated demo)':'build/ ('+(process.env.DORMMART_BACKEND||'demo')+(process.env.DORMMART_GUEST_MODE==='true'?', guest mode':'')+')'))).catch(error=>{console.error(error.message);process.exitCode=1});
}
module.exports={build};

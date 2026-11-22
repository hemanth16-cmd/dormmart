const fs=require('node:fs');
const path=require('node:path');
const {validateConfig}=require('../dist/backend.js');
async function build(env=process.env) {
  const mode=env.DORMMART_BACKEND||'demo';
  if(!['demo','supabase'].includes(mode))throw Error('DORMMART_BACKEND must be demo or supabase');
  const config=mode==='demo'?{mode}:validateConfig({mode,url:env.SUPABASE_URL||'https://flwrsjhldghbullanaqz.supabase.co',publishableKey:env.SUPABASE_PUBLISHABLE_KEY,schemaVerified:env.DORMMART_SCHEMA_VERIFIED==='true'});
  // Validation occurs before anything is written. No arbitrary env values enter client code.
  if(mode==='supabase')await require('esbuild').build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:path.resolve(__dirname,'..')},bundle:true,format:'esm',platform:'browser',minify:true,outfile:path.resolve(__dirname,'../dist/vendor/supabase.js')});
  fs.writeFileSync(path.resolve(__dirname,'../dist/backend-config.js'),'// Generated public configuration. Never include secret keys.\nwindow.DORMMART_CONFIG = '+JSON.stringify(config)+';\n');
}
if(require.main===module)build().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={build};

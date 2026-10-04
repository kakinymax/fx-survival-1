import {readdir,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {build} from 'esbuild';

const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',txt:'text/plain; charset=utf-8',woff:'font/woff'};
const assets={};
for(const file of await readdir('dist',{recursive:true})){
  if(file.startsWith('server/'))continue;
  const type=types[file.split('.').at(-1)];if(!type)continue;
  const binary=file.endsWith('.woff'),data=await readFile('dist/'+file);
  assets['/'+file]={content:data.toString(binary?'base64':'utf8'),type,binary};
}
await writeFile('server/generated-assets.js','export default '+JSON.stringify(assets)+';');
await mkdir('dist/server',{recursive:true});
try{await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'})}
finally{await rm('server/generated-assets.js',{force:true})}
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'fx-survival',main:'index.js',compatibility_date:'2026-10-02',d1_databases:[{binding:'DB',database_name:'fx-survival-local',database_id:'00000000-0000-0000-0000-000000000001'}]},null,2));

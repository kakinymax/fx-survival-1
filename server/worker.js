import {matchRequest,statisticsRequest} from './api.js';
import assets from './generated-assets.js';

export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/statistics')return statisticsRequest(request,env);
  if(path.startsWith('/api/'))return path.startsWith('/api/matches/')?matchRequest(request,env):new Response('Not found',{status:404});
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:asset.content,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};

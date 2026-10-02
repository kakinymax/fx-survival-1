import {matchRequest,statisticsRequest,recordsRequest,tripsRequest,modesRequest,legendsRequest} from './api.js';
import assets from './generated-assets.js';

export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/statistics')return statisticsRequest(request,env);
  if(path==='/api/records')return recordsRequest(request,env);
  if(path==='/api/modes')return modesRequest(request,env);
  if(path==='/api/legends')return legendsRequest(request,env);
  if(path==='/api/trips'||path.startsWith('/api/trips/'))return tripsRequest(request,env);
  if(path.startsWith('/api/'))return path.startsWith('/api/matches/')?matchRequest(request,env):new Response('Not found',{status:404});
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  return new Response(request.method==='HEAD'?null:asset.content,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};

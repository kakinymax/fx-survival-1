import {matchRequest,statisticsRequest,recordsRequest,tripsRequest,modesRequest,legendsRequest,cpuCareersRequest,personalBestsRequest} from './api.js';
import assets from './generated-assets.js';
import {secureResponse} from './http-security.js';
import {rateLimitRequest} from './rate-limit.js';

export default {async fetch(request,env){return secureResponse(await route(request,env))}};
async function route(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){
    const limited=await rateLimitRequest(request,env.DB);if(limited)return limited;
  }
  if(path==='/api/statistics')return statisticsRequest(request,env);
  if(path==='/api/cpu-careers')return cpuCareersRequest(request,env);
  if(path.startsWith('/api/matches/')&&path.endsWith('/bests'))return personalBestsRequest(request,env);
  if(path==='/api/records')return recordsRequest(request,env);
  if(path==='/api/modes')return modesRequest(request,env);
  if(path==='/api/legends')return legendsRequest(request,env);
  if(path==='/api/trips'||path.startsWith('/api/trips/'))return tripsRequest(request,env);
  if(path.startsWith('/api/'))return path.startsWith('/api/matches/')?matchRequest(request,env):new Response('Not found',{status:404});
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const body=request.method==='HEAD'?null:asset.binary?Uint8Array.from(atob(asset.content),c=>c.charCodeAt(0)):asset.content;
  return new Response(body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}

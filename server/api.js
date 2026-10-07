import {validateMatchRecord} from '../dist/records.js';
import {storeMatch,readStatistics,readRecords,readMatch,readTrips,changeTrip,readModes,readLegends,readCpuCareers,readPersonalBests} from './database.js';
import {TRIP_IDS,validateTripChange} from './trips.js';
import {legendQuery} from './legends.js';
import {sameOriginWrite,readJsonBody} from './http-security.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function cpuCareersRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'CPUの戦績にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{return json(await readCpuCareers(env.DB,owner))}
  catch(error){console.error('CPU career read failed',error);return json({error:'CPUの戦績を読み込めませんでした'},503)}
}
export async function personalBestsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'自己記録にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const route=new URL(request.url).pathname.match(/^\/api\/matches\/([-a-zA-Z0-9_]{1,100})\/bests$/);if(!route)return json({error:'試合が見つかりません'},404);
  try{const bests=await readPersonalBests(env.DB,owner,route[1]);return bests?json(bests):json({error:'試合が見つかりません'},404)}
  catch(error){console.error('Personal best read failed',error);return json({error:'自己記録を確認できませんでした'},503)}
}
export async function legendsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'記録の表示にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  let query;try{query=legendQuery(new URL(request.url).searchParams)}catch{return json({error:'表示条件を確認できませんでした。再読み込みしてください'},400)}
  try{return json(await readLegends(env.DB,owner,query))}
  catch(error){console.error('Legends read failed',error);return json({error:'殿堂入りの記録を読み込めませんでした'},503)}
}
export async function modesRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'戦績の表示にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{return json(await readModes(env.DB,owner))}
  catch(error){console.error('Mode statistics read failed',error);return json({error:'モード別戦績を読み込めませんでした'},503)}
}
export async function statisticsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'戦績の表示にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{return json(await readStatistics(env.DB,owner))}
  catch(error){console.error('Statistics read failed',error);return json({error:'戦績を読み込めませんでした'},503)}
}
export async function recordsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'戦績の表示にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{return json(await readRecords(env.DB,owner))}
  catch(error){console.error('Records read failed',error);return json({error:'歴代記録を読み込めませんでした'},503)}
}
export async function tripsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'TRIPの表示・変更にはログインが必要です'},401);
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/api/trips'){
    try{return json(await readTrips(env.DB,owner))}
    catch(error){console.error('Trips read failed',error);return json({error:'TRIPを読み込めませんでした'},503)}
  }
  const id=url.pathname.slice('/api/trips/'.length);
  if(url.pathname==='/api/trips')return json({error:'Method not allowed'},405);
  if(!TRIP_IDS.includes(id))return json({error:'TRIPが見つかりません'},404);
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  if(!sameOriginWrite(request))return json({error:'Forbidden'},403);
  const input=await readJsonBody(request,2000);if(input.status)return json({error:input.error},input.status);
  let change;
  try{change=validateTripChange(input.value)}
  catch{return json({error:'計測設定を確認できませんでした'},400)}
  try{
    const result=await changeTrip(env.DB,owner,id,change);
    return result.conflict?json({error:'別の画面でTRIPが更新されました。再読み込みして確認してください。',trip:result.trip},409):json({trip:result.trip});
  }catch(error){console.error('Trip update failed',error);return json({error:'TRIPを保存できませんでした。再試行できます。'},503)}
}
export async function matchRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'戦績にはログインが必要です'},401);
  if(request.method==='GET'){
    const id=new URL(request.url).pathname.slice('/api/matches/'.length);
    if(!/^[-a-zA-Z0-9_]{1,100}$/.test(id))return json({error:'試合が見つかりません'},404);
    try{const record=await readMatch(env.DB,owner,id);return record?json({record}):json({error:'試合が見つかりません'},404)}
    catch(error){console.error('Match read failed',error);return json({error:'試合記録を読み込めませんでした'},503)}
  }
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  const url=new URL(request.url);
  if(!sameOriginWrite(request))return json({error:'Forbidden'},403);
  const input=await readJsonBody(request,128000);if(input.status)return json({error:input.error},input.status);
  let record;
  try{
    record=validateMatchRecord(input.value);
    if(url.pathname!==`/api/matches/${record.id}`)throw Error('ID mismatch');
  }catch{return json({error:'試合記録を確認できませんでした'},400)}
  try{
    const result=await storeMatch(env.DB,owner,record);
    if(result.conflict)return json({error:'同じゲームIDの異なる記録が保存されています'},409);
    return json({record:result.record});
  }catch(error){console.error('Match save failed',error);return json({error:'戦績を保存できませんでした'},503)}
}

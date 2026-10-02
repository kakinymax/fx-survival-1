import {validateMatchRecord} from '../dist/records.js';
import {storeMatch,readStatistics,readRecords,readMatch,readTrips,changeTrip,readModes} from './database.js';
import {TRIP_IDS,validateTripChange} from './trips.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
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
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Forbidden'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const reader=request.body?.getReader();if(!reader)return json({error:'Empty change'},400);
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000){await reader.cancel();return json({error:'Change too large'},413)}chunks.push(value)}
  let change;
  try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}change=validateTripChange(JSON.parse(new TextDecoder().decode(bytes)))}
  catch(error){return json({error:error.message||'計測設定を確認できませんでした'},400)}
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
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return json({error:'Forbidden'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  // A bounded streaming read also covers clients that omit Content-Length.
  const reader=request.body?.getReader();if(!reader)return json({error:'Empty record'},400);
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128000){await reader.cancel();return json({error:'Record too large'},413)}chunks.push(value)}
  let record;
  try{
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    record=validateMatchRecord(JSON.parse(new TextDecoder().decode(bytes)));
    if(url.pathname!==`/api/matches/${record.id}`)throw Error('ID mismatch');
  }catch{return json({error:'試合記録を確認できませんでした'},400)}
  try{
    const result=await storeMatch(env.DB,owner,record);
    if(result.conflict)return json({error:'同じゲームIDの異なる記録が保存されています'},409);
    return json({record:result.record});
  }catch(error){console.error('Match save failed',error);return json({error:'戦績を保存できませんでした'},503)}
}

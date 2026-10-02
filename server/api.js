import {validateMatchRecord} from '../dist/records.js';
import {storeMatch,readStatistics} from './database.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function statisticsRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'戦績の表示にはログインが必要です'},401);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{return json(await readStatistics(env.DB,owner))}
  catch(error){console.error('Statistics read failed',error);return json({error:'戦績を読み込めませんでした'},503)}
}
export async function matchRequest(request,env){
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'保存にはログインが必要です'},401);
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

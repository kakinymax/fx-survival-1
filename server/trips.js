import {createLifetimeAccumulator} from './statistics.js';

export const TRIP_IDS=['a','b'];
export const tripLabel=id=>`TRIP ${id.toUpperCase()}`;
export function tripSettings(row,id=row?.trip_id){
  if(!row)return {id,name:tripLabel(id),schemaVersion:1,startedAt:null,boundaryGameId:null,revision:0,updatedAt:null};
  if(row.schema_version!==1)throw Error('Unsupported trip version');
  return {id:row.trip_id,name:row.name,schemaVersion:row.schema_version,startedAt:row.started_at,boundaryGameId:row.boundary_game_id,revision:row.revision,updatedAt:row.updated_at};
}
// End time, rather than upload time, determines the interval. Older completed
// games delivered by the retry queue must never enter a newly reset meter.
export function createTripAccumulator(settings){
  const meters=settings.map(trip=>({trip,stats:createLifetimeAccumulator(),startGameId:null,startGameAt:null}));
  function add(record){
    for(const meter of meters){
      if(!meter.trip.startedAt||record.endedAt<=meter.trip.startedAt||record.id===meter.trip.boundaryGameId)continue;
      meter.stats.add(record);
      if(record.ownerPlayerId!==null&&(!meter.startGameAt||record.endedAt<meter.startGameAt||record.endedAt===meter.startGameAt&&record.id<meter.startGameId)){
        meter.startGameAt=record.endedAt;meter.startGameId=record.id;
      }
    }
  }
  function result(){return {trips:meters.map(m=>({...m.trip,startGameId:m.startGameId,stats:m.stats.result().lifetime}))}}
  return {add,result};
}
export function aggregateTrips(records,settings){const stats=createTripAccumulator(settings);for(const record of records)stats.add(record);return stats.result()}
export function validateTripChange(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!['reset','rename'].includes(input.action)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.requestId!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(input.requestId??''))throw Error('計測設定を確認できませんでした');
  const keys=['action','expectedRevision','requestId',...(input.action==='rename'?['name']:[])];
  if(Object.keys(input).some(key=>!keys.includes(key)))throw Error('計測設定を確認できませんでした');
  if(input.action==='rename'&&(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>20))throw Error('名前は1〜20文字で入力してください');
  return {...input,...(input.action==='rename'?{name:input.name.trim()}:{})};
}
export const tripChangeSignature=change=>JSON.stringify({action:change.action,expectedRevision:change.expectedRevision,...(change.action==='rename'?{name:change.name}:{})});

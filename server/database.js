import {createLifetimeAccumulator,summarizeMatch} from './statistics.js';
import {createRecordAccumulator} from './rankings.js';
import {createModeAccumulator} from './modes.js';
import {TRIP_IDS,tripLabel,tripSettings,createTripAccumulator,tripChangeSignature} from './trips.js';

async function scanMatches(db,ownerId,visit,{after=null}={}){
  let cursor=null;
  // Scan all saved games using bounded reads. The recent-game limit must never
  // become the lifetime aggregation limit. Equal timestamps use the game ID.
  while(true){
    const statement=after?(cursor?
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? AND ended_at>? AND (ended_at,game_id)<(?,?) ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId,after,cursor.ended_at,cursor.game_id):
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? AND ended_at>? ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId,after)):(cursor?
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? AND (ended_at,game_id)<(?,?) ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId,cursor.ended_at,cursor.game_id):
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId));
    const page=await statement.all();if(!page.success)throw Error('Match history read failed');
    for(const row of page.results)visit(JSON.parse(row.record_json));
    if(page.results.length<25)break;
    cursor=page.results.at(-1);
  }
}
export async function readStatistics(db,ownerId){
  const stats=createLifetimeAccumulator(),recentGames=[];
  await scanMatches(db,ownerId,record=>{stats.add(record);if(recentGames.length<10)recentGames.push(summarizeMatch(record))});
  return {...stats.result(),recentGames};
}
export async function readRecords(db,ownerId){
  const stats=createLifetimeAccumulator(),records=createRecordAccumulator();
  await scanMatches(db,ownerId,record=>{stats.add(record);records.add(record)});
  return {...stats.result(),...records.result()};
}
export async function readModes(db,ownerId){
  const stats=createModeAccumulator();
  await scanMatches(db,ownerId,record=>stats.add(record));
  return stats.result();
}
export async function readMatch(db,ownerId,id){
  const row=await db.prepare('SELECT record_json FROM matches WHERE owner_id=? AND game_id=?').bind(ownerId,id).first();
  return row?JSON.parse(row.record_json):null;
}
export async function readTrips(db,ownerId){
  const page=await db.prepare('SELECT * FROM trips WHERE owner_id=? AND trip_id IN (?,?)').bind(ownerId,...TRIP_IDS).all();
  if(!page.success)throw Error('Trip settings read failed');
  const settings=TRIP_IDS.map(id=>tripSettings(page.results.find(row=>row.trip_id===id),id)),stats=createTripAccumulator(settings);
  const starts=settings.flatMap(trip=>trip.startedAt?[trip.startedAt]:[]).sort();
  if(starts.length)await scanMatches(db,ownerId,record=>stats.add(record),{after:starts[0]});
  return stats.result();
}
export async function changeTrip(db,ownerId,id,change,now=new Date().toISOString()){
  const signature=tripChangeSignature(change);
  let write;
  if(change.expectedRevision===0){
    write=db.prepare('INSERT INTO trips (owner_id,trip_id,schema_version,name,started_at,boundary_game_id,revision,updated_at,last_request_id,last_request_json) VALUES (?,?,1,?,?,(SELECT game_id FROM matches WHERE owner_id=? AND ended_at<=? ORDER BY ended_at DESC,game_id DESC LIMIT 1),1,?,?,?) ON CONFLICT (owner_id,trip_id) DO NOTHING')
      .bind(ownerId,id,change.action==='rename'?change.name:tripLabel(id),change.action==='reset'?now:null,ownerId,change.action==='reset'?now:'',now,change.requestId,signature);
  }else if(change.action==='reset'){
    write=db.prepare('UPDATE trips SET started_at=?,boundary_game_id=(SELECT game_id FROM matches WHERE owner_id=? AND ended_at<=? ORDER BY ended_at DESC,game_id DESC LIMIT 1),revision=revision+1,updated_at=?,last_request_id=?,last_request_json=? WHERE owner_id=? AND trip_id=? AND schema_version=1 AND revision=? AND last_request_id<>?')
      .bind(now,ownerId,now,now,change.requestId,signature,ownerId,id,change.expectedRevision,change.requestId);
  }else{
    write=db.prepare('UPDATE trips SET name=?,revision=revision+1,updated_at=?,last_request_id=?,last_request_json=? WHERE owner_id=? AND trip_id=? AND schema_version=1 AND revision=? AND last_request_id<>?')
      .bind(change.name,now,change.requestId,signature,ownerId,id,change.expectedRevision,change.requestId);
  }
  // D1 batch makes the compare-and-swap and its acknowledgement one transaction.
  const results=await db.batch([write,db.prepare('SELECT * FROM trips WHERE owner_id=? AND trip_id=?').bind(ownerId,id)]);
  if(results.some(result=>!result.success))throw Error('Trip update failed');
  const row=results[1].results[0],trip=tripSettings(row,id);
  return {trip,conflict:!row||row.last_request_id!==change.requestId||row.last_request_json!==signature};
}

export async function storeMatch(db,ownerId,record){
  const serialized=JSON.stringify(record);
  await db.prepare('INSERT INTO matches (owner_id,game_id,schema_version,ended_at,record_json) VALUES (?,?,?,?,?) ON CONFLICT (owner_id,game_id) DO NOTHING')
    .bind(ownerId,record.id,record.schemaVersion,record.endedAt,serialized).run();
  const row=await db.prepare('SELECT record_json FROM matches WHERE owner_id=? AND game_id=?').bind(ownerId,record.id).first();
  if(!row)throw Error('Stored match was not found');
  return {record:JSON.parse(row.record_json),conflict:row.record_json!==serialized};
}

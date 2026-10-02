import {createLifetimeAccumulator,summarizeMatch} from './statistics.js';

export async function readStatistics(db,ownerId){
  const stats=createLifetimeAccumulator(),recentGames=[];
  let cursor=null;
  // Scan all saved games using bounded reads. The recent-game limit must never
  // become the lifetime aggregation limit. Equal timestamps use the game ID.
  while(true){
    const statement=cursor?
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? AND (ended_at,game_id)<(?,?) ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId,cursor.ended_at,cursor.game_id):
      db.prepare('SELECT game_id,ended_at,record_json FROM matches WHERE owner_id=? ORDER BY ended_at DESC,game_id DESC LIMIT 25').bind(ownerId);
    const page=await statement.all();if(!page.success)throw Error('Match history read failed');
    for(const row of page.results){const record=JSON.parse(row.record_json);stats.add(record);if(recentGames.length<10)recentGames.push(summarizeMatch(record))}
    if(page.results.length<25)break;
    cursor=page.results.at(-1);
  }
  return {...stats.result(),recentGames};
}

export async function storeMatch(db,ownerId,record){
  const serialized=JSON.stringify(record);
  await db.prepare('INSERT INTO matches (owner_id,game_id,schema_version,ended_at,record_json) VALUES (?,?,?,?,?) ON CONFLICT (owner_id,game_id) DO NOTHING')
    .bind(ownerId,record.id,record.schemaVersion,record.endedAt,serialized).run();
  const row=await db.prepare('SELECT record_json FROM matches WHERE owner_id=? AND game_id=?').bind(ownerId,record.id).first();
  if(!row)throw Error('Stored match was not found');
  return {record:JSON.parse(row.record_json),conflict:row.record_json!==serialized};
}

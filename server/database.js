export async function storeMatch(db,ownerId,record){
  const serialized=JSON.stringify(record);
  await db.prepare('INSERT INTO matches (owner_id,game_id,schema_version,ended_at,record_json) VALUES (?,?,?,?,?) ON CONFLICT (owner_id,game_id) DO NOTHING')
    .bind(ownerId,record.id,record.schemaVersion,record.endedAt,serialized).run();
  const row=await db.prepare('SELECT record_json FROM matches WHERE owner_id=? AND game_id=?').bind(ownerId,record.id).first();
  if(!row)throw Error('Stored match was not found');
  return {record:JSON.parse(row.record_json),conflict:row.record_json!==serialized};
}

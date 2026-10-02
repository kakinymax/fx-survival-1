import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';

export const matches=sqliteTable('matches',{
  ownerId:text('owner_id').notNull(),
  gameId:text('game_id').notNull(),
  schemaVersion:integer('schema_version').notNull(),
  endedAt:text('ended_at').notNull(),
  record:text('record_json').notNull(),
},table=>[primaryKey({columns:[table.ownerId,table.gameId]})]);

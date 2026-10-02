import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';

export const matches=sqliteTable('matches',{
  ownerId:text('owner_id').notNull(),
  gameId:text('game_id').notNull(),
  schemaVersion:integer('schema_version').notNull(),
  endedAt:text('ended_at').notNull(),
  record:text('record_json').notNull(),
},table=>[primaryKey({columns:[table.ownerId,table.gameId]}),index('idx_matches_owner_ended_game').on(table.ownerId,table.endedAt,table.gameId)]);

// One row per owner and meter. Additional named meters can use new trip IDs.
// Totals remain derived from matches; only the measurement boundary is stored.
export const trips=sqliteTable('trips',{
  ownerId:text('owner_id').notNull(),
  tripId:text('trip_id').notNull(),
  schemaVersion:integer('schema_version').notNull(),
  name:text('name').notNull(),
  startedAt:text('started_at'),
  boundaryGameId:text('boundary_game_id'),
  revision:integer('revision').notNull(),
  updatedAt:text('updated_at').notNull(),
  lastRequestId:text('last_request_id').notNull(),
  lastRequest:text('last_request_json').notNull(),
},table=>[primaryKey({columns:[table.ownerId,table.tripId]})]);

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, submitOrder, resolveRound, commitDecisions } from '../dist/engine.js';
import { createSoloGame, submitSoloOrder, resolveSoloRound, commitSoloDecision, fastForwardSolo } from '../dist/solo.js';
import { ensureGameIdentity } from '../dist/records.js';
import { createRecordStore } from '../dist/record-store.js';
import { tripSettings } from '../server/trips.js';
import { createLocalApi } from '../mobile/local-api.js';

function record(id, { solo = false, big = false, endedAt = '2026-10-09T00:00:00.000Z' } = {}) {
  const random = () => 1;
  const game = solo ? createSoloGame('同じ名前', big ? 'tryjpy' : 'classic', random) : createGame(['同じ名前', '同じ名前'], 'manual');
  ensureGameIdentity(game, { newGame: true, now: '2026-10-01T00:00:00.000Z', id: () => id });
  for (let n = 1; n <= (big ? 12 : 1); n++) {
    if (solo) submitSoloOrder(game, { side: 'buy', leverage: big ? 100 : 1 });
    else while (game.phase === 'order') submitOrder(game, { side: 'buy', leverage: 50 });
    Object.assign(game, { direction: 'up', first: big ? 6 : 4, second: big ? 6 : null, phase: 'market-ready' });
    if (solo) {
      resolveSoloRound(game, random);
      if (game.phase === 'results') commitSoloDecision(game, big ? 'continue' : 'fix', random);
    } else { resolveRound(game); commitDecisions(game, { 0: 'fix', 1: 'fix' }); }
  }
  if (solo && game.phase !== 'end') fastForwardSolo(game, random);
  ensureGameIdentity(game, { now: endedAt });
  return game.finalRecord;
}
function archive(records = []) {
  const rows = new Map(records.map(r => [r.id, structuredClone(r)]));
  return { rows, snapshot: async () => ({ records: structuredClone([...rows.values()]), trips: ['a', 'b'].map(id => tripSettings(null, id)) }),
    readMatch: async id => structuredClone(rows.get(id) ?? null),
    storeMatch: async r => {
      const previous = rows.get(r.id);
      if (!previous) rows.set(r.id, structuredClone(r));
      return { record: structuredClone(rows.get(r.id)), conflict: !!previous && JSON.stringify(previous) !== JSON.stringify(r) };
    } };
}
const read = async (api, path) => (await api(path)).json();
const write = (api, r, path = r.id) => api('/api/matches/' + path, { method: 'PUT', body: JSON.stringify(r) });

test('device history includes all games but personal statistics include only the solo human', async () => {
  const api = createLocalApi({ repository: archive([record('table'), record('solo', { solo: true })]) });
  const stats = await read(api, '/api/statistics');
  assert.equal(stats.totalSavedGames, 2); assert.equal(stats.lifetime.plays, 1); assert.equal(stats.unassignedGames, 1);
  assert.equal(stats.lifetime.initialTotal, '1000'); assert.equal(stats.recentGames.length, 2);
  assert(stats.cpuCareers.every(c => c.plays === 1));
  const rankings = await read(api, '/api/records');
  assert.equal(rankings.scopes.self.participants, 1); assert.equal(rankings.scopes.human.participants, 3); assert.equal(rankings.scopes.cpu.participants, 3);
  const modes = await read(api, '/api/modes');
  assert.equal(modes.modes.find(m => m.stage.id === 'classic').stats.plays, 1);
  const trips = await read(api, '/api/trips'); assert(trips.trips.every(t => t.startedAt === null && t.stats.plays === 0));
  assert.equal((await read(api, '/api/legends?scope=human')).participants, 3);
  assert.equal((await read(api, '/api/cpu-careers')).cpuCareers.length, 3);
  assert.equal((await read(api, '/api/matches/table')).record.ownerPlayerId, null);
});
test('recent ten never limits lifetime, equal timestamps use the archive ID, and large amounts stay exact', async () => {
  const big = record('game-12', { solo: true, big: true });
  const rows = Array.from({ length: 13 }, (_, i) => ({ ...structuredClone(big), id: `game-${String(i).padStart(2, '0')}` }));
  const api = createLocalApi({ repository: archive(rows) });
  const stats = await read(api, '/api/statistics');
  assert.equal(stats.totalSavedGames, 13); assert.equal(stats.lifetime.plays, 13);
  assert.equal(stats.lifetime.highestFinal, String(1000n * 21n ** 12n));
  assert.equal(stats.lifetime.finalTotal, String(13000n * 21n ** 12n));
  assert.equal(stats.recentGames.length, 10); assert.equal(stats.recentGames[0].id, 'game-12');
  const bests = await read(api, '/api/matches/game-12/bests');
  assert.equal(bests.previousGames, 12); assert.deepEqual(bests.events, []);
});
test('writes accept legacy stage labels without changing snapshots and reject conflicts, malformed records and routes', async () => {
  const repository = archive(), api = createLocalApi({ repository });
  const r = record('legacy'); r.stage.name = 'クラシック';
  const before = JSON.stringify(r);
  assert.equal((await write(api, r)).status, 200); assert.equal((await write(api, r)).status, 200);
  assert.equal(repository.rows.size, 1); assert.equal(JSON.stringify((await read(api, '/api/matches/legacy')).record), before);
  assert.equal((await write(api, { ...r, endedAt: '2026-10-09T01:00:00.000Z' })).status, 409);
  assert.equal((await write(api, r, 'different')).status, 400);
  const invalid = structuredClone(r); invalid.players[0].wealth = '9999';
  assert.equal((await write(api, invalid)).status, 400);
  assert.equal((await api('/api/matches/legacy', { method: 'PUT', body: 'x'.repeat(128001) })).status, 413);
  assert.equal((await api('/api/matches/missing')).status, 404);
  assert.equal((await api('/api/matches/missing/bests')).status, 404);
  assert.equal((await api('/api/legends?scope=unknown')).status, 400);
  assert.equal((await api('/api/statistics', { method: 'DELETE' })).status, 405);
  assert.equal((await api('https://example.test/api/statistics')).status, 404);
  assert.equal((await api('/api/unknown')).status, 404);
  assert.equal(JSON.stringify(r), before);
});
test('old prototype outbox migrates only after the archive acknowledgement; failures remain retryable', async () => {
  const r = record('pending'), values = new Map([['fx-survival-pending-records-v1', JSON.stringify({ version: 1, records: [r] })]]);
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const repository = archive(); let writable = false;
  const commit = repository.storeMatch;
  repository.storeMatch = async r => { if (!writable) throw new Error('Storage full'); return commit(r); };
  const store = createRecordStore({ storage, fetcher: createLocalApi({ repository }) });
  await store.retryAll();
  assert.equal(store.state(r.id), 'error'); assert.equal(store.pendingCount(), 1);
  assert.deepEqual(JSON.parse(storage.getItem('fx-survival-pending-records-v1')).records, [r]);
  assert.equal(repository.rows.size, 0);
  writable = true; await store.retryAll();
  assert.equal(store.state(r.id), 'saved'); assert.equal(store.pendingCount(), 0);
  assert.equal(storage.getItem('fx-survival-pending-records-v1'), null);
  assert.deepEqual(repository.rows.get(r.id), r);
  assert.equal((await read(createLocalApi({ repository }), '/api/statistics')).totalSavedGames, 1);
});
test('storage failures never return empty successful statistics or fallback to a network request', async () => {
  const api = createLocalApi({ repository: { snapshot: async () => { throw new Error('blocked'); } } });
  assert.equal((await api('/api/statistics')).status, 503);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api('/api/statistics', { signal: controller.signal }));
  let calls = 0; const previousFetch = globalThis.fetch, previousBuild = globalThis.FX_SURVIVAL_BUILD;
  globalThis.fetch = async () => { calls++; return new Response('web'); };
  try {
    globalThis.FX_SURVIVAL_BUILD = { kind: 'mobile-local', apiFetch: api };
    const local = await import('../dist/platform.js?local-test');
    assert.equal((await local.apiFetch('/api/statistics')).status, 503); assert.equal(calls, 0);
    delete globalThis.FX_SURVIVAL_BUILD;
    const web = await import('../dist/platform.js?web-test');
    assert.equal(await (await web.apiFetch('/api/statistics')).text(), 'web'); assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; globalThis.FX_SURVIVAL_BUILD = previousBuild; }
});

import { TRIP_IDS, tripSettings, tripChangeSignature } from '../server/trips.js';

export const LOCAL_RECORDS_DB = 'fx-survival-records-v1';
const publicTrip = row => {
  const { lastRequestId, lastRequestSignature, ...trip } = row;
  return trip;
};

// Acknowledgements resolve after the transaction commits. The existing outbox
// must retain its snapshot until the durable archive has accepted that snapshot.
export function createLocalRepository({ indexedDB = globalThis.indexedDB, name = LOCAL_RECORDS_DB } = {}) {
  let databasePromise;
  function database() {
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      let failed = false;
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('matches', { keyPath: 'id' });
        request.result.createObjectStore('trips', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { failed = true; reject(new Error('Local database is blocked')); };
      request.onsuccess = () => {
        const db = request.result;
        if (failed) { db.close(); return; }
        db.onversionchange = () => { db.close(); databasePromise = null; };
        resolve(db);
      };
    }).catch(error => { databasePromise = null; throw error; });
    return databasePromise;
  }
  async function transact(stores, mode, run) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction aborted'));
      try { run(transaction, value => { result = value; }); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }
  function snapshot() {
    return transact(['matches', 'trips'], 'readonly', (transaction, done) => {
      const result = { records: [], trips: [] };
      transaction.objectStore('matches').getAll().onsuccess = event => {
        result.records = event.target.result;
        if (result.records.some(record => record.schemaVersion !== 1)) transaction.abort();
      };
      transaction.objectStore('trips').getAll().onsuccess = event => {
        const rows = event.target.result;
        if (rows.some(row => row.schemaVersion !== 1 || !TRIP_IDS.includes(row.id))) { transaction.abort(); return; }
        result.trips = TRIP_IDS.map(id => {
          const row = rows.find(row => row.id === id);
          return row ? publicTrip(row) : tripSettings(null, id);
        });
      };
      done(result);
    });
  }
  function readMatch(id) {
    return transact(['matches'], 'readonly', (transaction, done) => {
      transaction.objectStore('matches').get(id).onsuccess = event => done(event.target.result ?? null);
    });
  }
  function storeMatch(record) {
    return transact(['matches'], 'readwrite', (transaction, done) => {
      const store = transaction.objectStore('matches');
      store.get(record.id).onsuccess = event => {
        const previous = event.target.result;
        if (previous) done({ record: previous, conflict: JSON.stringify(previous) !== JSON.stringify(record) });
        else { store.add(record); done({ record, conflict: false }); }
      };
    });
  }
  function changeTrip(id, change, now) {
    const signature = tripChangeSignature(change);
    return transact(['matches', 'trips'], 'readwrite', (transaction, done) => {
      const store = transaction.objectStore('trips');
      store.get(id).onsuccess = event => {
        const row = event.target.result;
        if (row && row.schemaVersion !== 1) { transaction.abort(); return; }
        const trip = row ? publicTrip(row) : tripSettings(null, id);
        if (trip.revision !== change.expectedRevision || row?.lastRequestId === change.requestId) {
          done({ trip, conflict: row?.lastRequestId !== change.requestId || row?.lastRequestSignature !== signature });
          return;
        }
        const updated = { ...trip, revision: trip.revision + 1, updatedAt: now,
          lastRequestId: change.requestId, lastRequestSignature: signature };
        function commit() { store.put(updated); done({ trip: publicTrip(updated), conflict: false }); }
        if (change.action === 'rename') { updated.name = change.name; commit(); }
        else {
          updated.startedAt = now;
          transaction.objectStore('matches').getAll().onsuccess = event => {
            const prior = event.target.result.filter(record => record.endedAt <= now)
              .sort((a, b) => a.endedAt === b.endedAt ? a.id > b.id ? -1 : a.id < b.id ? 1 : 0 : a.endedAt > b.endedAt ? -1 : 1);
            updated.boundaryGameId = prior[0]?.id ?? null;
            commit();
          };
        }
      };
    });
  }
  return { snapshot, readMatch, storeMatch, changeTrip };
}

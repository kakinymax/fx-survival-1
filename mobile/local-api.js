import { validateMatchRecord } from '../dist/records.js';
import { createLifetimeAccumulator, summarizeMatch } from '../server/statistics.js';
import { createRecordAccumulator } from '../server/rankings.js';
import { createFeedbackAccumulator } from '../server/feedback.js';
import { createCpuCareerAccumulator, createPersonalBestAccumulator } from '../server/career.js';
import { aggregateModes } from '../server/modes.js';
import { aggregateLegends, legendQuery } from '../server/legends.js';
import { aggregateTrips, validateTripChange } from '../server/trips.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const newest = (a, b) => a.endedAt === b.endedAt ? a.id > b.id ? -1 : a.id < b.id ? 1 : 0 : a.endedAt > b.endedAt ? -1 : 1;

// This transport performs no network requests. Only the mobile build installs
// it; the regular Web build retains its authenticated Worker/D1 transport.
export function createLocalApi({ repository, now = () => new Date().toISOString() }) {
  return async function localApi(input, options = {}) {
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    if (typeof input !== 'string' || !input.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    const url = new URL(input, 'https://local.invalid'), path = url.pathname, method = options.method ?? 'GET';
    try {
      if (method === 'PUT') {
        const match = path.match(/^\/api\/matches\/([-a-zA-Z0-9_]{1,100})$/);
        const trip = path.match(/^\/api\/trips\/([ab])$/);
        if (!match && !trip) return json({ error: 'Not found' }, 404);
        const limit = match ? 128000 : 2000;
        if (typeof options.body !== 'string') return json({ error: 'Invalid body' }, 400);
        if (new TextEncoder().encode(options.body).length > limit) return json({ error: 'Record too large' }, 413);
        let record, change;
        try {
          const body = JSON.parse(options.body);
          if (match) { record = validateMatchRecord(body); if (record.id !== match[1]) throw new Error('ID mismatch'); }
          else change = validateTripChange(body);
        } catch { return json({ error: '記録を確認できませんでした' }, 400); }
        if (match) {
          const result = await repository.storeMatch(record);
          return result.conflict ? json({ error: '同じゲームIDの異なる記録が保存されています' }, 409) : json({ record: result.record });
        }
        const result = await repository.changeTrip(trip[1], change, now());
        return result.conflict ? json({ error: 'TRIPが更新されています。再読み込みしてください。', trip: result.trip }, 409) : json({ trip: result.trip });
      }
      if (method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      const match = path.match(/^\/api\/matches\/([-a-zA-Z0-9_]{1,100})(\/bests)?$/);
      if (match && !match[2]) {
        const record = await repository.readMatch(match[1]);
        if (record && record.schemaVersion !== 1) throw new Error('Unsupported local record');
        return record ? json({ record }) : json({ error: '試合が見つかりません' }, 404);
      }
      if (!match && !['/api/statistics', '/api/records', '/api/cpu-careers', '/api/modes', '/api/legends', '/api/trips'].includes(path))
        return json({ error: 'Not found' }, 404);
      let query;
      if (path === '/api/legends') {
        try { query = legendQuery(url.searchParams); }
        catch { return json({ error: '表示条件を確認できませんでした' }, 400); }
      }
      const { records, trips } = await repository.snapshot();
      records.sort(newest);
      if (path === '/api/modes') return json(aggregateModes(records));
      if (path === '/api/legends') return json(aggregateLegends(records, query));
      if (path === '/api/trips') return json(aggregateTrips(records, trips));
      if (match) {
        const target = records.find(record => record.id === match[1]);
        if (!target) return json({ error: '試合が見つかりません' }, 404);
        const bests = createPersonalBestAccumulator(target);
        for (const record of records) bests.add(record);
        return json(bests.result());
      }
      const lifetime = createLifetimeAccumulator(), rankings = createRecordAccumulator(), feedback = createFeedbackAccumulator(), cpu = createCpuCareerAccumulator();
      for (const record of records) { lifetime.add(record); rankings.add(record); feedback.add(record); cpu.add(record); }
      if (path === '/api/cpu-careers') return json({ cpuCareers: cpu.result() });
      if (path === '/api/records') return json({ ...lifetime.result(), ...rankings.result() });
      return json({ ...lifetime.result(), feedback: feedback.result(), cpuCareers: cpu.result(), recentGames: records.slice(0, 10).map(summarizeMatch) });
    } catch { return json({ error: '端末の記録を読み書きできませんでした。再試行できます。' }, 503); }
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBack } from '../mobile/navigation.js';

test('Android Back closes the top overlay, returns to game, then minimizes without replaying history', async () => {
  const closed = [], overlays = [{ close: () => closed.push('rules') }, { close: () => closed.push('preview') }];
  let minimized = 0;
  const location = { hash: '#stats' };
  const document = { querySelectorAll: () => overlays };
  const minimize = async () => { minimized++; };
  await handleBack({ document, location, minimize });
  assert.deepEqual(closed, ['preview']);
  assert.equal(location.hash, '#stats');
  assert.equal(minimized, 0);
  overlays.length = 0;
  await handleBack({ document, location, minimize });
  assert.equal(location.hash, '');
  assert.equal(minimized, 0);
  await handleBack({ document, location, minimize });
  assert.equal(minimized, 1);
});

// The regular Web build has no marker and keeps the existing authenticated API.
export const mobilePrototype = globalThis.FX_SURVIVAL_BUILD?.kind === 'mobile-prototype';

export async function apiFetch(input, options) {
  if (mobilePrototype) throw new Error('オンライン戦績はアプリ試作では未接続です。');
  return fetch(input, options);
}

// The regular Web build has no marker and keeps the existing authenticated API.
export const mobilePrototype = globalThis.FX_SURVIVAL_BUILD?.kind === 'mobile-prototype';
export const mobileLocalRecords = globalThis.FX_SURVIVAL_BUILD?.kind === 'mobile-local';

export async function apiFetch(input, options) {
  if (mobilePrototype) throw new Error('オンライン戦績はアプリ試作では未接続です。');
  if (mobileLocalRecords) return globalThis.FX_SURVIVAL_BUILD.apiFetch(input, options);
  return fetch(input, options);
}

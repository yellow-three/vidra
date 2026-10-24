import type { AppSettings } from '../types';
import { appApi } from '../lib/appApi';

let cache: AppSettings | null = null;
let pending: Promise<AppSettings> | null = null;

async function load(): Promise<AppSettings> {
  const s = await appApi.getSettings();
  cache = s;
  return s;
}

export function getSettings(): Promise<AppSettings> {
  if (cache) return Promise.resolve(cache);
  if (!pending) pending = load();
  return pending;
}

export function invalidateSettings() {
  cache = null;
  pending = null;
}

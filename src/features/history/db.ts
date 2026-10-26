import Database from '@tauri-apps/plugin-sql';
import { appApi } from '../../lib/appApi';
import { createHistoryRepo, type HistoryRepo } from './historyRepo';

// Rust tarafindaki DB_URL ile ayni olmali (src-tauri/src/lib.rs); migration'lari plugin calistirir.
const DB_URL = 'sqlite:youtube-downloader.db';

let repo: Promise<HistoryRepo> | null = null;

/** Gecmis deposu; ilk acilista settings.json'daki eski gecmisi bir kez SQLite'a tasir. */
export function getHistoryRepo(): Promise<HistoryRepo> {
  repo ??= (async () => {
    const created = createHistoryRepo(await Database.load(DB_URL));
    const legacy = await appApi.getLegacyHistory();
    if (legacy.length) {
      await created.importLegacy(legacy);
      await appApi.clearLegacyHistory();
    }
    return created;
  })().catch((error) => {
    repo = null;
    throw error;
  });
  return repo;
}

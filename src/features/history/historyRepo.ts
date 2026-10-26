// Indirme gecmisi SQLite'ta (tauri-plugin-sql). Sema: src-tauri/migrations/001_history.sql

import type { HistoryItem } from '../../types';

/** plugin-sql `Database` nesnesinin kullandigimiz kismi; testler gercek SQLite ile karsilar. */
export interface SqlDb {
  select<T>(query: string, params?: unknown[]): Promise<T[]>;
  execute(query: string, params?: unknown[]): Promise<unknown>;
}

interface Row {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  format_id: string;
  quality: string;
  ext: string;
  file_size: string;
  file_path: string;
  completed_at: number;
}

const toItem = (r: Row): HistoryItem => ({
  id: r.id,
  title: r.title,
  url: r.url,
  thumbnail: r.thumbnail ?? undefined,
  formatId: r.format_id,
  quality: r.quality,
  ext: r.ext,
  fileSize: r.file_size,
  filePath: r.file_path,
  completedAt: String(r.completed_at),
});

/** Gecmis Unix saniyesi tutar; eski kayitlarda ISO metni de olabilir. */
function toSeconds(value: string): number {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.floor(n);
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

const INSERT = `INSERT OR IGNORE INTO history
  (id, title, url, thumbnail, format_id, quality, ext, file_size, file_path, completed_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

const params = (h: HistoryItem) => [
  h.id, h.title, h.url, h.thumbnail ?? null, h.formatId, h.quality, h.ext, h.fileSize, h.filePath, toSeconds(h.completedAt),
];

export function createHistoryRepo(db: SqlDb) {
  return {
    findAll: async () =>
      (await db.select<Row>('SELECT * FROM history ORDER BY completed_at DESC, rowid DESC')).map(toItem),

    create: (item: HistoryItem) => db.execute(INSERT, params(item)),

    delete: (id: string) => db.execute('DELETE FROM history WHERE id = $1', [id]),

    clear: () => db.execute('DELETE FROM history'),

    /** settings.json'daki eski gecmisi aktarir; zaten olan kimlikleri atlar. Eklenen sayisini dondurur. */
    async importLegacy(items: HistoryItem[]): Promise<number> {
      const existing = new Set((await db.select<{ id: string }>('SELECT id FROM history')).map((r) => r.id));
      const fresh = items.filter((h) => h.id && !existing.has(h.id));
      for (const item of fresh) await db.execute(INSERT, params(item));
      return fresh.length;
    },
  };
}

export type HistoryRepo = ReturnType<typeof createHistoryRepo>;

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HistoryItem } from '../../types';
import { createHistoryRepo, type SqlDb } from './historyRepo';

const schema = readFileSync(new URL('../../../src-tauri/migrations/001_history.sql', import.meta.url), 'utf8');

/** plugin-sql'in `$1` parametrelerini node:sqlite'in `?1` bicimine ceviren gercek SQLite. */
function memoryDb(): SqlDb {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  const sql = (q: string) => q.replace(/\$(\d+)/g, '?$1');
  return {
    select: async <T,>(q: string, params: unknown[] = []) => db.prepare(sql(q)).all(...(params as never[])) as T[],
    execute: async (q: string, params: unknown[] = []) => { db.prepare(sql(q)).run(...(params as never[])); },
  };
}

const item = (id: string, completedAt: string, extra: Partial<HistoryItem> = {}): HistoryItem => ({
  id,
  title: `Video ${id}`,
  url: `https://youtu.be/${id}`,
  thumbnail: 'https://i.ytimg.com/x.jpg',
  formatId: 'video-720',
  quality: '720p',
  ext: 'mp4',
  fileSize: '1.0 MB',
  filePath: `/out/${id}.mp4`,
  completedAt,
  ...extra,
});

let repo: ReturnType<typeof createHistoryRepo>;
beforeEach(() => { repo = createHistoryRepo(memoryDb()); });

describe('history repo (SQLite)', () => {
  it('kayitlari en yeniden eskiye dondurur ve alanlari korur', async () => {
    await repo.create(item('a', '100'));
    await repo.create(item('b', '300', { thumbnail: undefined }));
    await repo.create(item('c', '200'));

    const all = await repo.findAll();
    expect(all.map((h) => h.id)).toEqual(['b', 'c', 'a']);
    expect(all[2]).toEqual(item('a', '100'));
    expect(all[0].thumbnail).toBeUndefined();
  });

  it('tek kaydi siler ve tumunu temizler', async () => {
    await repo.create(item('a', '1'));
    await repo.create(item('b', '2'));
    await repo.delete('a');
    expect((await repo.findAll()).map((h) => h.id)).toEqual(['b']);
    await repo.clear();
    expect(await repo.findAll()).toEqual([]);
  });

  it('eski settings.json gecmisini tasir; tekrar tasimada kopya olusturmaz', async () => {
    const legacy = [item('x', '50'), item('y', 'Sat Jun 01 2026')];
    expect(await repo.importLegacy(legacy)).toBe(2);
    expect(await repo.importLegacy(legacy)).toBe(0);
    const all = await repo.findAll();
    expect(all.map((h) => h.id)).toEqual(['y', 'x']);
    // ISO/serbest metin tarihleri saniyeye cevrilir, cozulemeyenler 0 olur.
    expect(all[0].completedAt).toBe(String(Math.floor(Date.parse('Sat Jun 01 2026') / 1000)));
  });
});

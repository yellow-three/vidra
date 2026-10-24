import { describe, expect, it } from 'vitest';
import { createLimiter } from './limiter';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createLimiter', () => {
  it('ayni anda en fazla `max` isi calistirir, biteni siradakiyle doldurur', async () => {
    const limiter = createLimiter(2);
    const started: string[] = [];
    const jobs = { a: deferred(), b: deferred(), c: deferred() };
    for (const id of ['a', 'b', 'c'] as const) {
      void limiter.run(id, async () => { started.push(id); await jobs[id].promise; });
    }
    await flush();
    expect(started).toEqual(['a', 'b']);
    expect(limiter.isQueued('c')).toBe(true);

    jobs.a.resolve();
    await flush();
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('siradaki isi iptal edince hic calistirmaz ve null doner', async () => {
    const limiter = createLimiter(1);
    const block = deferred();
    void limiter.run('a', () => block.promise);
    let ran = false;
    const result = limiter.run('b', async () => { ran = true; return 'x'; });

    expect(limiter.dequeue('b')).toBe(true);
    expect(await result).toBeNull();
    block.resolve();
    await flush();
    expect(ran).toBe(false);
  });

  it('hata veren is yer acar', async () => {
    const limiter = createLimiter(1);
    await expect(limiter.run('a', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await limiter.run('b', async () => 'ok')).toBe('ok');
  });
});

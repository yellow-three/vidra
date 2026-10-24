// Es zamanli is sinirlayici: indirme kuyrugu ayni anda en fazla `max` indirme calistirir.

export interface Limiter {
  /** Isi sira gelince calistirir; calismadan sirdan cikarilirsa `null` doner. */
  run<T>(id: string, job: () => Promise<T>): Promise<T | null>;
  isQueued(id: string): boolean;
  /** Henuz baslamamis isi siradan cikarir. */
  dequeue(id: string): boolean;
}

interface Waiting {
  id: string;
  start: () => void;
  skip: () => void;
}

export function createLimiter(max: number): Limiter {
  let active = 0;
  const waiting: Waiting[] = [];

  const next = () => {
    if (active >= max) return;
    waiting.shift()?.start();
  };

  return {
    run<T>(id: string, job: () => Promise<T>): Promise<T | null> {
      return new Promise<T | null>((resolve, reject) => {
        const start = () => {
          active++;
          job()
            .then(resolve, reject)
            .finally(() => {
              active--;
              next();
            });
        };
        waiting.push({ id, start, skip: () => resolve(null) });
        next();
      });
    },

    isQueued: (id) => waiting.some((w) => w.id === id),

    dequeue(id) {
      const idx = waiting.findIndex((w) => w.id === id);
      if (idx === -1) return false;
      waiting.splice(idx, 1)[0].skip();
      return true;
    },
  };
}

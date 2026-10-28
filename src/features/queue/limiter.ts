// Es zamanli is sinirlayici: indirme kuyrugu ayni anda en fazla `max` indirme calistirir.

export interface Limiter {
  /** Isi sira gelince calistirir; calismadan sirdan cikarilirsa `null` doner. */
  run<T>(id: string, job: () => Promise<T>): Promise<T | null>;
  isQueued(id: string): boolean;
  /** Henuz baslamamis isi siradan cikarir. */
  dequeue(id: string): boolean;
  /** Ayarlardan gelen yeni sinir; artarsa bekleyenler hemen baslar, azalirsa calisanlar surer. */
  setMax(max: number): void;
  /** Bekleyen isleri verilen kimlik sirasina dizer (kuyrukta yukari/asagi tasima). */
  reorder(ids: string[]): void;
}

interface Waiting {
  id: string;
  start: () => void;
  skip: () => void;
}

export function createLimiter(initialMax: number): Limiter {
  let max = initialMax;
  let active = 0;
  let waiting: Waiting[] = [];

  const next = () => {
    while (active < max && waiting.length) waiting.shift()!.start();
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

    setMax(value) {
      max = Math.max(1, value);
      next();
    },

    reorder(ids) {
      const rank = new Map(ids.map((id, i) => [id, i]));
      // Listede olmayanlar (beklenmez ama) sona, kendi siralariyla.
      waiting = [...waiting].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    },
  };
}

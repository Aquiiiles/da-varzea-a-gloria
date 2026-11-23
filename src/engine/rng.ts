/**
 * PRNG determinístico (mulberry32) + utilitários.
 * Regra de ouro do motor: NUNCA usar Math.random(). Toda aleatoriedade vem daqui.
 */

export interface Rng {
  /** float em [0, 1) */
  next(): number;
  /** inteiro em [min, max] (inclusivo) */
  int(min: number, max: number): number;
  /** float em [min, max) */
  float(min: number, max: number): number;
  /** true com probabilidade p */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** escolhe por peso; pesos <= 0 são ignorados */
  weighted<T>(arr: readonly T[], weight: (item: T) => number): T;
  shuffle<T>(arr: readonly T[]): T[];
  /** amostra de Poisson (Knuth) — ok para lambda pequeno (gols) */
  poisson(lambda: number): number;
  /** aproximação de normal (soma de 3 uniformes), média 0, desvio ~sd */
  normal(sd: number): number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash 32-bit (FNV-1a + avalanche) de uma lista de partes. Usado para derivar sub-seeds. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = typeof part === 'number' ? `#${part}` : `$${part}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0xff;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick em lista vazia');
      return arr[Math.floor(next() * arr.length)];
    },
    weighted: (arr, weight) => {
      let total = 0;
      for (const item of arr) total += Math.max(0, weight(item));
      if (total <= 0) return rng.pick(arr);
      let r = next() * total;
      for (const item of arr) {
        r -= Math.max(0, weight(item));
        if (r < 0) return item;
      }
      return arr[arr.length - 1];
    },
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    poisson: (lambda) => {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L && k < 20);
      return k - 1;
    },
    normal: (sd) => (next() + next() + next() - 1.5) * 2 * sd,
  };
  return rng;
}

/** RNG derivado de forma estável: mesma seed + mesmos rótulos = mesma sequência. */
export function deriveRng(seed: number, ...labels: (number | string)[]): Rng {
  return createRng(hashSeed(seed, ...labels));
}

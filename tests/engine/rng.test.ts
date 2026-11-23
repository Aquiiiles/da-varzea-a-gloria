import { createRng, deriveRng, hashSeed, mulberry32 } from '../../src/engine/rng';

describe('PRNG', () => {
  it('mulberry32 é determinístico', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('seeds diferentes geram sequências diferentes', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('valores ficam em [0,1) e int respeita os limites', () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('poisson tem média próxima de lambda', () => {
    const r = createRng(99);
    let sum = 0;
    const N = 20_000;
    for (let i = 0; i < N; i++) sum += r.poisson(1.4);
    expect(sum / N).toBeGreaterThan(1.33);
    expect(sum / N).toBeLessThan(1.47);
  });

  it('deriveRng depende de todos os rótulos', () => {
    expect(deriveRng(1, 2, 'liga').next()).toBe(deriveRng(1, 2, 'liga').next());
    expect(hashSeed(1, 2, 'liga')).not.toBe(hashSeed(1, 3, 'liga'));
    expect(hashSeed(1, 'a', 'bc')).not.toBe(hashSeed(1, 'ab', 'c'));
  });

  it('shuffle preserva os elementos', () => {
    const r = createRng(5);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

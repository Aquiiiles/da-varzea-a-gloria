import { goalRates, playKnockout, playMatch } from '../../src/engine/match';
import { createRng } from '../../src/engine/rng';

describe('partida', () => {
  it('forças iguais em campo neutro dão médias iguais', () => {
    const [h, a] = goalRates(50, 50, 0);
    expect(h).toBeCloseTo(a);
  });

  it('mando de campo favorece o mandante', () => {
    const [h, a] = goalRates(50, 50, 3);
    expect(h).toBeGreaterThan(a);
  });

  it('time mais forte vence bem mais vezes, mas zebra existe', () => {
    const r = createRng(1);
    let strongWins = 0;
    let weakWins = 0;
    for (let i = 0; i < 5000; i++) {
      const m = playMatch(r, 'fraco', 'forte', 58, 70, 1.5);
      if (m.ag > m.hg) strongWins++;
      if (m.hg > m.ag) weakWins++;
    }
    expect(strongWins / 5000).toBeGreaterThan(0.6);
    expect(weakWins).toBeGreaterThan(0);
    expect(weakWins / 5000).toBeLessThan(0.15);
  });

  it('mata-mata sempre tem vencedor', () => {
    const r = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const m = playKnockout(r, 'a', 'b', 50, 50, 0);
      expect(['a', 'b']).toContain(m.winner);
      if (m.pens) expect(m.pens[0]).not.toBe(m.pens[1]);
    }
  });
});

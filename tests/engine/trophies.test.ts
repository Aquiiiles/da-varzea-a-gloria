import { clubRecords, trophies } from '../../src/engine/trophies';
import { playRun } from './helpers';

describe('sala de troféus e recordes', () => {
  const s = playRun(4); // o assistente costuma ganhar títulos nesta seed

  it('cada título de liga do histórico vira troféu com o ano', () => {
    const titles = s.history.filter((r) => r.position === 1);
    const fromTrophies = trophies(s)
      .filter((t) => t.id.startsWith('liga-'))
      .reduce((n, t) => n + t.years.length, 0);
    expect(fromTrophies).toBe(titles.length);
    for (const t of trophies(s)) expect(t.years.length).toBeGreaterThan(0);
  });

  it('títulos de liga vêm ordenados da divisão mais alta para a mais baixa', () => {
    const tiers = trophies(s).filter((t) => t.id.startsWith('liga-')).map((t) => t.tier ?? 9);
    expect(tiers).toEqual(tiers.slice().sort((a, b) => a - b));
  });

  it('recordes coerentes com o histórico', () => {
    const rec = clubRecords(s);
    expect(rec.topScorer!.goals).toBeGreaterThan(0);
    const seasons = Object.values(rec.seasonsByTier).reduce((a, b) => a + (b ?? 0), 0);
    expect(seasons).toBe(s.history.length);
    const [mine, theirs] = rec.biggestWin!.score.split(' x ').map(Number);
    expect(mine).toBeGreaterThan(theirs);
    if (rec.worstDefeat) {
      const [a, b] = rec.worstDefeat.score.split(' x ').map(Number);
      expect(a).toBeLessThan(b);
    }
  });
});

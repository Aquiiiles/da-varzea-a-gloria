import { computeScore, levelFor, runStats, type RunStats } from '../../src/engine/score';
import { patterned, playRun } from './helpers';

const base: RunStats = {
  seasons: 25, promotions: 0, relegations: 0, leagueTitles: 0, premierTitles: 0, bestTier: 8, barred: 0,
  giantKills: 0, biggestUpset: null, cupWins: 0, championsWins: 0, worldWins: 0, bankrupt: false, soul: 80,
  idol: null, trajectory: Array(25).fill(8),
};

describe('escada de níveis', () => {
  it('falência = Fechou as portas', () => {
    expect(levelFor({ ...base, bankrupt: true, premierTitles: 2, bestTier: 1 }).level).toBe(1);
  });
  it('nunca saiu do fundo = Time de pub', () => {
    expect(levelFor(base).title).toBe('Time de pub');
  });
  it('níveis intermediários', () => {
    expect(levelFor({ ...base, giantKills: 1 }).level).toBe(3);
    expect(levelFor({ ...base, promotions: 3, bestTier: 6 }).level).toBe(4);
    expect(levelFor({ ...base, promotions: 4, bestTier: 4 }).level).toBe(5);
    expect(levelFor({ ...base, promotions: 7, bestTier: 1 }).level).toBe(6);
    expect(levelFor({ ...base, bestTier: 1, premierTitles: 1 }).level).toBe(7);
  });
  it('8 a 10 exigem Copa dos Campeões', () => {
    expect(levelFor({ ...base, bestTier: 1, premierTitles: 10 }).level).toBe(7);
    expect(levelFor({ ...base, bestTier: 1, championsWins: 1 }).level).toBe(8);
    expect(levelFor({ ...base, bestTier: 1, championsWins: 2 }).level).toBe(9);
    expect(levelFor({ ...base, bestTier: 1, championsWins: 1, worldWins: 1 }).level).toBe(10);
    expect(levelFor({ ...base, bestTier: 1, worldWins: 1 }).level).toBeLessThan(8);
  });
  it('alma < 30 = clube de plástico', () => {
    expect(levelFor({ ...base, soul: 29 }).label).toMatch(/clube de plástico/);
    expect(levelFor({ ...base, soul: 30 }).plastic).toBe(false);
  });
  it('pontuação cresce com conquistas', () => {
    expect(computeScore({ ...base, premierTitles: 1 })).toBeGreaterThan(computeScore(base));
  });
  it('estatísticas de uma run real são coerentes', () => {
    const s = playRun(31, patterned);
    const st = runStats(s);
    expect(st.trajectory).toHaveLength(s.history.length);
    expect(st.bestTier).toBeLessThanOrEqual(Math.min(...st.trajectory));
  });
});

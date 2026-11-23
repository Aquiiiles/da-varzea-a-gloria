import { roundRobin, simulateLeague, simulatePlayoff, sortTable, emptyRow } from '../../src/engine/league';
import { createRng } from '../../src/engine/rng';
import { ALL_TIERS, TIERS } from '../../src/data/pyramid';

const ids = Array.from({ length: 24 }, (_, i) => `c${i}`);
const flat = { strength: () => 50, homeAdv: () => 3 };

describe('liga', () => {
  it('turno e returno: cada par se enfrenta 2x, uma em cada casa', () => {
    const rounds = roundRobin(ids);
    expect(rounds).toHaveLength(46);
    const seen = new Set<string>();
    for (const round of rounds) {
      const inRound = new Set<string>();
      for (const [h, a] of round) {
        expect(inRound.has(h) || inRound.has(a)).toBe(false); // ninguém joga 2x na rodada
        inRound.add(h); inRound.add(a);
        const key = `${h}>${a}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(24 * 23);
  });

  it('número ímpar de clubes funciona (folga)', () => {
    const rounds = roundRobin(['a', 'b', 'c']);
    expect(rounds.flat()).toHaveLength(6);
  });

  it('tabela é consistente', () => {
    const { table, rounds } = simulateLeague(createRng(1), ids, flat);
    expect(table).toHaveLength(24);
    expect(rounds.flat()).toHaveLength(552);
    const gf = table.reduce((s, r) => s + r.gf, 0);
    const ga = table.reduce((s, r) => s + r.ga, 0);
    expect(gf).toBe(ga);
    for (const r of table) {
      expect(r.played).toBe(46);
      expect(r.won + r.drawn + r.lost).toBe(46);
      expect(r.points).toBe(r.won * 3 + r.drawn);
    }
    for (let i = 1; i < table.length; i++) expect(table[i - 1].points).toBeGreaterThanOrEqual(table[i].points);
  });

  it('desconto de pontos é aplicado', () => {
    const { table } = simulateLeague(createRng(1), ids, flat, { c0: 10 });
    const row = table.find((r) => r.clubId === 'c0')!;
    expect(row.deduction).toBe(10);
    expect(row.points).toBe(row.won * 3 + row.drawn - 10);
  });

  it('desempate: pontos > saldo > gols pró', () => {
    const a = { ...emptyRow('a'), points: 10, gf: 10, ga: 5 };
    const b = { ...emptyRow('b'), points: 10, gf: 12, ga: 5 };
    const c = { ...emptyRow('c'), points: 10, gf: 13, ga: 6 };
    expect(sortTable([a, b, c]).map((r) => r.clubId)).toEqual(['c', 'b', 'a']);
  });

  it('playoff devolve um vencedor do grupo', () => {
    const po = simulatePlayoff(createRng(2), ['a', 'b', 'c', 'd'], flat);
    expect(['a', 'b', 'c', 'd']).toContain(po.winner);
    expect(po.semis).toHaveLength(2);
  });

  it('a pirâmide fecha a conta: quem sobe de N+1 = quem cai de N', () => {
    for (const t of ALL_TIERS) {
      if (t === 8) continue;
      const below = TIERS[(t + 1) as 1];
      expect(below.autoUp + (below.playoff ? 1 : 0)).toBe(TIERS[t].down);
    }
  });
});

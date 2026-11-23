import { cityName, personName, proClubName, varzeaClubName } from '../../src/engine/names';
import { createRng } from '../../src/engine/rng';
import { CITY_ADJ, CITY_AVOID, CITY_MASC } from '../../src/data/names';
import { newGame } from '../../src/engine/game';
import { simulateSeason } from '../../src/engine/season';
import { twoLegs } from '../../src/engine/competitions';
import { FOUNDATION } from './helpers';

describe('nomes brasileiros', () => {
  it('nomes de jogador não se repetem quando há um conjunto de usados', () => {
    const rng = createRng(1);
    const taken = new Set<string>();
    for (let i = 0; i < 800; i++) personName(rng, taken);
    expect(taken.size).toBe(800);
  });

  it('cidades concordam em gênero e evitam cidades reais famosas', () => {
    const rng = createRng(2);
    const femAdj = new Set(CITY_ADJ.filter(([m, f]) => m !== f).map(([, f]) => f));
    for (let i = 0; i < 2000; i++) {
      const c = cityName(rng);
      expect(CITY_AVOID).not.toContain(c);
      const [noun, adj] = c.split(' ');
      if (adj && CITY_MASC.includes(noun)) expect(femAdj.has(adj)).toBe(false);
    }
  });

  it('clubes têm cara de Brasil', () => {
    const rng = createRng(3);
    expect(varzeaClubName(rng)).toMatch(/do /);
    for (let i = 0; i < 50; i++) expect(proClubName(rng).length).toBeGreaterThan(5);
  });
});

describe('formatos', () => {
  it('ida e volta: o vencedor sai do agregado ou dos pênaltis', () => {
    const rng = createRng(4);
    const ctx = { strength: () => 60, homeAdv: () => 1.5 };
    for (let i = 0; i < 300; i++) {
      const [m1, m2] = twoLegs(rng, ctx, 'a', 'b');
      expect(m1.home).toBe('b');
      expect(m2.home).toBe('a');
      const aggA = m1.ag + m2.hg;
      const aggB = m1.hg + m2.ag;
      if (aggA !== aggB) expect(m2.winner).toBe(aggA > aggB ? 'a' : 'b');
      else expect(m2.pens).toBeDefined();
    }
  });

  it('Várzea: 1ª fase em turno único (19 jogos) e mata-mata', () => {
    const s = structuredClone(newGame(10, FOUNDATION));
    for (const f of s.player.squad) f.ovr = 80;
    const r = simulateSeason(s);
    const varzea = r.comps[0];
    expect(varzea.id).toBe('varzea');
    expect(varzea.tables[0].rows).toHaveLength(20);
    expect(varzea.tables[0].rows.every((row) => row.played === 19)).toBe(true);
    expect(varzea.ties.length).toBeGreaterThan(0);
    expect(r.worldNews.length).toBeGreaterThan(8);
  });
});

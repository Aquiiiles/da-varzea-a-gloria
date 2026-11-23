import { bestEleven, develop, makeFootballer, marketValue, marketWage, scoutRange, squadStrength } from '../../src/engine/footballers';
import { createRng } from '../../src/engine/rng';
import type { Footballer, Position } from '../../src/engine/types';

const rng = () => createRng(1);
function man(id: number, pos: Position, ovr: number, age = 25): Footballer {
  return { id, name: `J${id}`, pos, age, ovr, pot: ovr, potLo: ovr, potHi: ovr, wage: 1, contract: 2, goals: 0, apps: 0, joined: 1, homegrown: false };
}
const squad442 = (ovr: number) => [
  man(1, 'GOL', ovr), ...[2, 3, 4, 5].map((i) => man(i, 'DEF', ovr)), ...[6, 7, 8, 9].map((i) => man(i, 'MEI', ovr)), man(10, 'ATA', ovr), man(11, 'ATA', ovr),
];

describe('jogadores', () => {
  it('salário cresce com o overall', () => {
    expect(marketWage(60)).toBeGreaterThan(marketWage(50));
    expect(marketWage(80)).toBeGreaterThan(marketWage(70) * 5);
  });

  it('jovem com potencial vale mais que veterano do mesmo overall', () => {
    const young = { ...man(1, 'MEI', 60, 19), pot: 80 };
    const old = man(2, 'MEI', 60, 33);
    expect(marketValue(young)).toBeGreaterThan(marketValue(old) * 3);
  });

  it('melhor XI respeita o 4-4-2 e penaliza improviso', () => {
    const full = squad442(60);
    expect(bestEleven(full).ids.size).toBe(11);
    expect(squadStrength(full)).toBeCloseTo(60 - 1, 0); // sem banco = leve penalidade
    const noKeeper = full.filter((f) => f.pos !== 'GOL').concat(man(12, 'DEF', 60));
    expect(squadStrength(noKeeper)).toBeLessThan(squadStrength(full));
  });

  it('olheiro melhor = faixa de potencial mais estreita (nível 4 = exato)', () => {
    const [lo0, hi0] = scoutRange(rng(), 70, 0);
    const [lo4, hi4] = scoutRange(rng(), 70, 4);
    expect(hi0 - lo0).toBeGreaterThan(hi4 - lo4);
    expect([lo4, hi4]).toEqual([70, 70]);
    expect(lo0).toBeLessThanOrEqual(70 + 6);
  });

  it('jovens evoluem até o potencial; veteranos caem', () => {
    const r = createRng(9);
    let youngGain = 0;
    let oldLoss = 0;
    for (let i = 0; i < 200; i++) {
      const y = { ...man(1, 'MEI', 50, 18), pot: 75 };
      develop(r, y, { ct: 2, fitness: 0, inEleven: true });
      youngGain += y.ovr - 50;
      expect(y.ovr).toBeLessThanOrEqual(75);
      const o = man(2, 'MEI', 70, 34);
      develop(r, o, { ct: 0, fitness: 0, inEleven: true });
      oldLoss += 70 - o.ovr;
    }
    expect(youngGain / 200).toBeGreaterThan(3);
    expect(oldLoss / 200).toBeGreaterThan(2.5);
  });

  it('gera jogador com dados coerentes', () => {
    const f = makeFootballer(rng(), { id: 1, ovr: 55, age: 18, scout: 2, season: 1 });
    expect(f.pot).toBeGreaterThanOrEqual(f.ovr);
    expect(f.potLo).toBeLessThanOrEqual(f.potHi);
    expect(f.wage).toBeGreaterThan(0);
  });
});

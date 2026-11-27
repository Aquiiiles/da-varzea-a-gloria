import { describe, expect, it } from 'vitest';
import { newGame } from '../../src/engine/game';
import { lineupStrength } from '../../src/engine/footballers';
import { DETAIL_GROUP, FORMATION_DETAILS, bestLineup, detailOf, slotPenalty, traitMods, traitsOf } from '../../src/engine/traits';
import { formationSlots } from '../../src/engine/footballers';
import type { Foundation, Formation } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

describe('posições detalhadas e características', () => {
  const all = newGame(7, COACH).clubs.flatMap((c) => c.squad);
  it('cada jogador tem posição detalhada da sua área e de 0 a 2 características', () => {
    const details = new Set(all.map(detailOf));
    expect(details.size).toBe(7);
    for (const f of all.slice(0, 300)) {
      expect(DETAIL_GROUP[detailOf(f)]).toBe(f.pos);
      expect(traitsOf(f).length).toBeLessThanOrEqual(2);
      expect(new Set(traitsOf(f)).size).toBe(traitsOf(f).length);
    }
  });
  it('vagas detalhadas batem com as vagas do esquema', () => {
    for (const fm of ['4-4-2', '4-3-3', '3-5-2', '4-5-1'] as Formation[]) {
      expect(FORMATION_DETAILS[fm]).toHaveLength(11);
      formationSlots(fm).forEach((g, i) => {
        const d = FORMATION_DETAILS[fm][i];
        // o ala do 3-5-2 é lateral jogando no meio
        if (!(fm === '3-5-2' && d === 'LAT') && !(fm === '4-5-1' && d === 'PON')) expect(DETAIL_GROUP[d]).toBe(g);
      });
    }
  });
  it('na posição exata não perde nada; na mesma área, um pouco; o melhor XI usa isso', () => {
    const f = all.find((x) => detailOf(x) === 'ZAG')!;
    expect(slotPenalty('ZAG', f)).toBe(0);
    expect(slotPenalty('LAT', f)).toBe(2);
    expect(slotPenalty('CA', f)).toBeGreaterThan(2);
    const squad = newGame(7, COACH).clubs[0].squad;
    const ids = bestLineup(squad, '4-4-2');
    expect(ids).toHaveLength(11);
    const reversed = [...ids].reverse();
    expect(lineupStrength(squad, '4-4-2', ids)!).toBeGreaterThanOrEqual(lineupStrength(squad, '4-4-2', reversed)!);
  });
  it('características mexem no jogo: marcador segura, finalizador marca', () => {
    const fin = all.filter((f) => f.pos === 'ATA' && traitsOf(f).includes('finalizacao')).slice(0, 2);
    const mar = all.filter((f) => traitsOf(f).includes('marcacao')).slice(0, 2);
    expect(traitMods(fin, { tactic: null, profile: 'equilibrado', corner: 'curto' }).mine).toBeGreaterThan(1);
    expect(traitMods(mar, { tactic: null, profile: 'equilibrado', corner: 'curto' }).theirs).toBeLessThan(1);
  });
});

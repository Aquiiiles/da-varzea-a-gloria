import { describe, expect, it } from 'vitest';
import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { liveRatings, roundOn } from '../../src/engine/round';
import { matchStamina, referenceTiredness, staminaTimeline, teamTiredness } from '../../src/engine/stamina';
import { captainBoost, resolveRoles } from '../../src/engine/roles';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function atMatch(seed: number): GameState {
  let s = apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
  s.career!.board.confidence = 100;
  for (let i = 0; i < 3; i++) s = apply(s, { t: 'advance', to: 0 });
  while (!s.calendar!.matches.some((m) => m.day === s.reveal)) s = apply(s, { t: 'advance', to: 0 });
  return s;
}

describe('fôlego durante o jogo', () => {
  const base = { firstIds: [1, 2, 3], baseTactic: 'equilibrado' as const, pre: () => 0, age: () => 26, gone: [] };
  it('cai a cada bloco; quem entra vem inteiro; pressão cansa mais', () => {
    const tl = staminaTimeline({ ...base, changes: [{ minute: 60, ids: [1, 2, 4] }] });
    expect(tl[0].get(1)).toBe(100);
    expect(tl[12].get(1)!).toBeLessThan(75);
    expect(tl[12].has(3)).toBe(false);
    expect(tl[12].get(4)).toBe(100);
    const press = staminaTimeline({ ...base, baseTactic: 'pressao', changes: [] });
    const calm = staminaTimeline({ ...base, changes: [] });
    expect(press[18].get(1)!).toBeLessThan(calm[18].get(1)!);
  });
  it('sem trocas, o time cansa mais que o padrão do auxiliar no fim', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const inp = { ...base, firstIds: ids, changes: [] };
    const tl = staminaTimeline(inp);
    const ref = referenceTiredness(inp);
    expect(teamTiredness(tl[17])).toBeGreaterThan(ref[17]);
    expect(teamTiredness(tl[5])).toBeCloseTo(ref[5]);
  });
  it('o fôlego do jogo real começa de quem jogou e cai até o fim', () => {
    const s = atMatch(31);
    const tl = matchStamina(s, s.reveal!)!;
    expect(tl).toHaveLength(19);
    const id = [...tl[0].keys()][0];
    expect(tl[18].get(id) ?? 0).toBeLessThan(tl[0].get(id)!);
  });
});

describe('notas ao vivo', () => {
  it('notas de 3 a 10 para quem jogou, autores dos gols do seu time são de quem estava em campo', () => {
    const s = atMatch(31);
    const r = roundOn(s, s.reveal!)!;
    const notes = liveRatings(s, r, 90);
    expect(notes.length).toBeGreaterThanOrEqual(11);
    for (const n of notes) {
      expect(n.rating).toBeGreaterThanOrEqual(3);
      expect(n.rating).toBeLessThanOrEqual(10);
    }
    const tl = matchStamina(s, s.reveal!)!;
    for (const g of r.moment.events.filter((e) => e.kind === 'gol' && e.mine && e.minute <= 90 && e.who !== undefined)) {
      expect(tl[Math.min(17, Math.floor((g.minute - 1) / 5))].has(g.who!)).toBe(true);
    }
    expect(JSON.stringify(liveRatings(s, r, 90))).toBe(JSON.stringify(notes));
  });
});

describe('funções no time', () => {
  it('capitão escolhido vale; fora de campo passa a braçadeira com metade do efeito', () => {
    const s = newGame(7, COACH);
    const squad = s.clubs[0].squad;
    const pick = squad[3];
    const r = resolveRoles(squad, { captain: pick.id, pens: null, fk: null });
    expect(r.captain!.id).toBe(pick.id);
    const without = resolveRoles(squad.filter((f) => f.id !== pick.id), { captain: pick.id, pens: null, fk: null });
    expect(without.vice).toBe(true);
    expect(captainBoost(without.captain, true)).toBeCloseTo(captainBoost(without.captain, false) / 2);
  });
  it('ação de funções: no elenco, pelo link e durante a temporada', () => {
    let s = apply(newGame(7, COACH), { t: 'job', idx: 0 });
    const f = s.player.squad[0];
    s = apply(s, { t: 'roles', roles: { captain: f.id, pens: null, fk: f.id } });
    expect(s.player.roles).toEqual({ captain: f.id, pens: null, fk: f.id });
    expect(canApply(s, { t: 'roles', roles: { captain: 999999, pens: null, fk: null } })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'roles', roles: { captain: f.id, pens: null, fk: 12 } }))).toEqual({ t: 'roles', roles: { captain: f.id, pens: null, fk: 12 } });
    s = apply(s, { t: 'play' });
    s = apply(s, { t: 'roles', roles: { captain: null, pens: f.id, fk: null } });
    expect(s.live!.lineups.at(-1)!.roles).toEqual({ captain: null, pens: f.id, fk: null });
  });
});

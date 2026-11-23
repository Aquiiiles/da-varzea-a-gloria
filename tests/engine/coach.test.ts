import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { simulateSeason } from '../../src/engine/season';
import { bestEleven, FORMATIONS } from '../../src/engine/footballers';
import { coachAccepts, coachRequest, moraleEdge } from '../../src/engine/clubops';
import type { GameState } from '../../src/engine/types';
import { FOUNDATION } from './helpers';

function setup(mutate: (s: GameState) => void = () => {}): GameState {
  const s = structuredClone(newGame(55, FOUNDATION));
  mutate(s);
  return s;
}

describe('técnico de verdade', () => {
  it('o esquema define quantos de cada posição entram no time', () => {
    const s = newGame(1, FOUNDATION);
    for (const f of ['4-4-2', '4-3-3', '3-5-2', '4-5-1'] as const) {
      const xi = bestEleven(s.player.squad, f).ids;
      expect(xi.size).toBe(11);
      const byPos = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
      for (const p of s.player.squad) if (xi.has(p.id)) byPos[p.pos]++;
      // com elenco suficiente, o XI segue o esquema
      expect(byPos).toEqual(FORMATIONS[f]);
    }
  });

  it('candidatos estrelados demais recusam clube pequeno', () => {
    const s = newGame(2, FOUNDATION);
    const star = { ...s.office.coaches[0]!, rating: 4 };
    expect(coachAccepts(star, 7)).toBe(false);
    expect(coachAccepts(star, 2)).toBe(true);
    const st = structuredClone(s);
    st.office.coaches[0] = star;
    expect(canApply(st, { t: 'coach', idx: 0 })).toBe(false);
  });

  it('o técnico faz um pedido por janela', () => {
    const s = newGame(3, FOUNDATION);
    expect(s.office.request).not.toBeNull();
    expect(s.office.request!.text.length).toBeGreaterThan(10);
  });

  it('pedido atendido sobe a moral; ignorado desce', () => {
    const base = setup((s) => {
      s.office.request = { kind: 'nao_vender', playerId: s.player.squad[0].id, text: 'x' };
    });
    const ok = structuredClone(base);
    const before = ok.player.coach.morale;
    const r1 = simulateSeason(ok);
    expect(r1.coachReport.met).toBe(true);
    const bad = structuredClone(base);
    bad.player.squad = bad.player.squad.slice(1);
    const r2 = simulateSeason(bad);
    expect(r2.coachReport.met).toBe(false);
    expect(r1.coachReport.morale).toBeGreaterThan(r2.coachReport.morale);
    expect(r1.coachReport.morale - before).toBeGreaterThan(r2.coachReport.morale - before);
  });

  it('moral no chão: o técnico pede demissão e entra um interino', () => {
    const s = setup((s) => {
      s.player.coach.morale = 5;
      s.office.request = null;
    });
    const name = s.player.coach.name;
    const r = simulateSeason(s);
    expect(r.coachReport.left).toContain(name);
    expect(s.player.coach.name).toContain('interino');
  });

  it('moral mexe na força (−1 a +1)', () => {
    expect(moraleEdge(0)).toBe(-1);
    expect(moraleEdge(50)).toBe(0);
    expect(moraleEdge(100)).toBe(1);
  });

  it('trocar o esquema: uma vez por janela e custa moral; codec ida e volta', () => {
    const s = newGame(4, FOUNDATION);
    const target = s.player.coach.formation === '3-5-2' ? '4-3-3' : '3-5-2';
    const after = apply(s, { t: 'formation', f: target });
    expect(after.player.coach.formation).toBe(target);
    expect(after.player.coach.morale).toBe(s.player.coach.morale - 10);
    expect(canApply(after, { t: 'formation', f: '4-5-1' })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'formation', f: '4-5-1' }))).toEqual({ t: 'formation', f: '4-5-1' });
  });

  it('pedido "contratar" aponta a posição mais carente do esquema', () => {
    const s = newGame(5, FOUNDATION);
    const p = structuredClone(s.player);
    p.squad = p.squad.filter((f) => f.pos !== 'GOL');
    const req = coachRequest(p, '4-4-2', 50, bestEleven(p.squad).ids);
    expect(req?.kind).toBe('contratar');
    expect(req?.pos).toBe('GOL');
  });
});

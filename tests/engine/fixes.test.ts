import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function season(seed: number): GameState {
  return apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
}

describe('correções', () => {
  it('a tabela é sorteada: a 1ª rodada não é sempre fora de casa', () => {
    let home = 0;
    for (let seed = 1; seed <= 20; seed++) if (season(seed).calendar!.matches[0].home) home++;
    expect(home).toBeGreaterThan(3);
    expect(home).toBeLessThan(17);
  });

  it('estratégia: muda quando quiser, vale só para os jogos seguintes e vai no link', () => {
    for (const v of ['equilibrado', 'ofensivo', 'retranqueiro', 'contra_ataque', 'pressao'] as const) {
      expect(decodeAction(encodeAction({ t: 'tactic', v }))).toEqual({ t: 'tactic', v });
    }
    let s = season(3);
    while (s.reveal! < 60) s = apply(s, { t: 'advance', to: 1 });
    const past = s.calendar!.matches.filter((m) => m.day <= s.reveal!);
    const t = apply(s, { t: 'tactic', v: 'ofensivo' });
    expect(t.calendar!.matches.filter((m) => m.day <= s.reveal!)).toEqual(past);
    expect(t.player.tactic).toBe('ofensivo');
    // ofensivo: mais gols nos jogos seguintes (pró e contra) do que retranca
    const r = apply(s, { t: 'tactic', v: 'retranqueiro' });
    const goals = (x: GameState) => x.calendar!.matches.filter((m) => m.day > s.reveal!).reduce((n, m) => n + m.gf + m.ga, 0);
    expect(goals(t)).toBeGreaterThan(goals(r));
  });

  it('no modo presidente, a estratégia é do técnico contratado (não dá para mudar)', () => {
    const s = newGame(1, { name: 'Unidos', colors: ['#c8102e', '#ffffff'], origin: 'pub' });
    expect(canApply(s, { t: 'tactic', v: 'ofensivo' })).toBe(false);
  });

  it('modo técnico: peneira sai da verba da diretoria', () => {
    const s = apply(newGame(2, COACH), { t: 'job', idx: 0 });
    s.player.cash = 1e6;
    s.career!.board.budget = 0;
    expect(canApply(s, { t: 'tryout' })).toBe(false);
    s.career!.board.budget = 1e6;
    expect(canApply(s, { t: 'tryout' })).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { apply, newGame } from '../../src/engine/game';
import { myPosition, opponentInfo, roundOn, tableAfter } from '../../src/engine/round';
import { PLAYER_ID } from '../../src/engine/season';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function season(seed = 7): GameState {
  return apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
}

describe('rodada a rodada', () => {
  it('a rodada traz o jogo do técnico primeiro e os outros jogos do mesmo dia da fase', () => {
    let s = season();
    expect(myPosition(s, s.reveal!)).toBeNull(); // antes do 1º jogo não há posição
    s = apply(s, { t: 'advance', to: 0 });
    const r = roundOn(s, s.reveal!)!;
    expect(r).toBeTruthy();
    expect(r.games[0].mine).toBe(true);
    const m = s.calendar!.matches.find((x) => x.day === s.reveal)!;
    const myScore = r.moment.playerHome ? [r.games[0].hg, r.games[0].ag] : [r.games[0].ag, r.games[0].hg];
    expect(myScore).toEqual([m.gf, m.ga]);
    if (r.stage) {
      const sameDay = r.stage.matches.filter(([d]) => d === r.day);
      expect(r.games.length).toBe(sameDay.length);
      for (const g of r.games) expect(g.goals.length).toBe(g.hg + g.ag);
      for (const g of r.games.slice(1)) expect(g.goals.every((x) => x.minute >= 1 && x.minute <= 90)).toBe(true);
    }
    // determinístico: a mesma rodada conta a mesma história
    expect(JSON.stringify(roundOn(s, s.reveal!))).toBe(JSON.stringify(r));
  });

  it('tabela depois da rodada: setas somam zero e a posição do técnico bate', () => {
    let s = season(3);
    for (let i = 0; i < 4; i++) s = apply(s, { t: 'advance', to: 0 });
    const r = roundOn(s, s.reveal!);
    if (!r?.stage) return;
    const rows = tableAfter(r.stage, r.day);
    expect(rows.reduce((sum, x) => sum + x.delta, 0)).toBe(0);
    const me = rows.find((x) => x.clubId === PLAYER_ID)!;
    expect(myPosition(s, s.reveal!)!.pos).toBe(me.pos);
  });

  it('adversário: forma dos últimos jogos (até 5) e posição', () => {
    let s = season(5);
    for (let i = 0; i < 6; i++) s = apply(s, { t: 'advance', to: 0 });
    const next = s.calendar!.matches.find((m) => m.day > s.reveal!)!;
    const info = opponentInfo(s, next);
    expect(info.name).toBe(next.opponent);
    expect(info.form.length).toBeLessThanOrEqual(5);
    expect(info.form.every((x) => ['V', 'E', 'D'].includes(x))).toBe(true);
  });
});

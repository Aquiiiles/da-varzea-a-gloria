import { apply, newGame, replay } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { WINDOWS, matchDay, weekdayOf } from '../../src/engine/calendar';
import { partialTable, upcomingMatches } from '../../src/engine/calendarView';
import type { GameState } from '../../src/engine/types';
import { FOUNDATION } from './helpers';

function playedSeason(seed = 31): GameState {
  let s = newGame(seed, FOUNDATION);
  if (s.office.event) s = apply(s, { t: 'event', choice: 1 });
  return apply(s, { t: 'play' });
}

describe('calendário', () => {
  it('rodadas em datas diferentes, no dia da semana da competição e dentro da janela', () => {
    for (const total of [21, 38]) {
      const days = Array.from({ length: total }, (_, k) => matchDay('serie-a', 2030, k, total));
      expect(new Set(days).size).toBe(total);
      expect(days).toEqual([...days].sort((a, b) => a - b));
      for (const d of days) {
        expect(d).toBeGreaterThanOrEqual(WINDOWS['serie-a'].start);
        expect(d).toBeLessThanOrEqual(WINDOWS['serie-a'].end);
        expect([0, 3]).toContain(weekdayOf(2030, d));
      }
    }
  });

  it('jogar a temporada abre o calendário no começo; os jogos do clube vêm em ordem de data', () => {
    const s = playedSeason();
    expect(s.phase).toBe('season');
    expect(s.calendar).toBeTruthy();
    expect(s.reveal).toBe(s.calendar!.start);
    const days = s.calendar!.matches.map((m) => m.day);
    expect(days.length).toBeGreaterThan(15);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    // a tabela parcial (prévia) no fim bate com a tabela final, que só sai ao fechar a temporada
    const stage = s.calendar!.stages[0];
    const done = apply(s, { t: 'advance', to: 3 });
    const finalRows = done.history.at(-1)!.comps[0].tables[0].rows.map((r) => [r.clubId, r.points]);
    expect(partialTable(stage, s.calendar!.end).map((r) => [r.clubId, r.points])).toEqual(finalRows);
  });

  it('avançar: próximo jogo, semana, mês e fim', () => {
    let s = playedSeason();
    const cal = s.calendar!;
    s = apply(s, { t: 'advance', to: 0 });
    expect(s.reveal).toBe(cal.matches[0].day);
    const d = s.reveal!;
    s = apply(s, { t: 'advance', to: 1 });
    expect(s.reveal).toBe(d + 7);
    s = apply(s, { t: 'advance', to: 2 });
    expect(s.reveal!).toBeGreaterThan(d + 7);
    // os próximos jogos nunca mostram o que já passou
    for (const m of upcomingMatches(cal, s.reveal!)) expect(m.day).toBeGreaterThan(s.reveal!);
    s = apply(s, { t: 'advance', to: 3 });
    expect(s.reveal).toBeNull();
    expect(() => apply(s, { t: 'advance', to: 0 })).toThrow();
    s = apply(s, { t: 'next' });
    expect(s.calendar).toBeNull();
    expect(s.phase).toBe('office');
  });

  it('o avanço vai no link (codec) e o replay volta ao mesmo dia', () => {
    for (const to of [0, 1, 2, 3] as const) expect(decodeAction(encodeAction({ t: 'advance', to }))).toEqual({ t: 'advance', to });
    let s = playedSeason(44);
    s = apply(s, { t: 'advance', to: 0 });
    s = apply(s, { t: 'advance', to: 2 });
    const r = replay(s.seed, s.foundation, s.actions);
    expect(r.reveal).toBe(s.reveal);
    expect(JSON.stringify(r)).toBe(JSON.stringify(s));
  });

  it('avançar não muda nenhum resultado (a temporada já foi simulada)', () => {
    const a = apply(playedSeason(9), { t: 'advance', to: 3 });
    let b = playedSeason(9);
    b = apply(b, { t: 'advance', to: 1 });
    b = apply(b, { t: 'advance', to: 3 });
    expect(JSON.stringify(b.history)).toBe(JSON.stringify(a.history));
    expect(b.player).toEqual(a.player);
  });
});

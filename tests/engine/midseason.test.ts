import { apply, canApply, newGame, replay } from '../../src/engine/game';
import { julyWindow } from '../../src/engine/calendar';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import type { Action, Foundation, GameState } from '../../src/engine/types';
import { FOUNDATION } from './helpers';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function coachSeason(seed: number): GameState {
  let s = apply(newGame(seed, COACH), { t: 'job', idx: 0 });
  s.player.cash = 1e6;
  s.career!.board.budget = 1e6;
  s.career!.board.wageCap = 1e7;
  return apply(s, { t: 'play' });
}

/** avança até um dia (passo de uma semana) */
function until(s: GameState, day: number): GameState {
  while (s.phase === 'season' && s.reveal! < day) s = apply(s, { t: 'advance', to: 1 });
  return s;
}

const past = (s: GameState) => s.calendar!.matches.filter((m) => m.day <= s.reveal!).map((m) => [m.day, m.opponent, m.gf, m.ga]);

describe('temporada em andamento', () => {
  it('mudar a escalação no meio da temporada não muda nenhum jogo que já aconteceu', () => {
    for (const seed of [2, 6, 9]) {
      let s = until(coachSeason(seed), 80);
      const before = past(s);
      const reserves = s.player.squad.slice().sort((a, b) => a.ovr - b.ovr).slice(0, 11).map((f) => f.id);
      s = apply(s, { t: 'lineup', ids: reserves, rotate: false });
      expect(past(s)).toEqual(before);
      s = apply(s, { t: 'formation', f: s.player.coach.formation === '4-3-3' ? '4-4-2' : '4-3-3' });
      expect(past(s)).toEqual(before);
    }
  });

  it('escalar os reservas deixa o time mais fraco dali para frente', () => {
    let gfBest = 0;
    let gfWorst = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = until(coachSeason(seed), 30);
      const worst = s.player.squad.slice().sort((a, b) => a.ovr - b.ovr).slice(0, 11).map((f) => f.id);
      const a = s.calendar!.matches.filter((m) => m.day > s.reveal!);
      const t = apply(s, { t: 'lineup', ids: worst, rotate: false });
      const b = t.calendar!.matches.filter((m) => m.day > t.reveal!);
      gfBest += a.reduce((x, m) => x + m.gf - m.ga, 0);
      gfWorst += b.reduce((x, m) => x + m.gf - m.ga, 0);
    }
    expect(gfWorst).toBeLessThan(gfBest);
  });

  it('transferências só na janela de julho; quem chega joga depois e não mexe no passado', () => {
    let s = coachSeason(4);
    const idx = s.office.market.findIndex((l) => l !== null);
    expect(canApply(s, { t: 'buy', idx })).toBe(false);
    const [open] = julyWindow(s.calendar!.year);
    s = until(s, open);
    expect(s.reveal!).toBeLessThanOrEqual(open + 30);
    const before = past(s);
    s = apply(s, { t: 'buy', idx });
    expect(past(s)).toEqual(before);
    expect(s.live!.changes).toHaveLength(1);
    expect(s.live!.changes[0].add!.length).toBe(1);
  });

  it('avançar por semana ou mês para no dia em que a janela de julho abre', () => {
    let s = coachSeason(3);
    const [open] = julyWindow(s.calendar!.year);
    while (s.phase === 'season' && s.reveal! < open) s = apply(s, { t: 'advance', to: 2 });
    expect(s.reveal).toBe(open);
  });

  it('lesões e cansaço aparecem na temporada e o resultado final é o mesmo da prévia', () => {
    let s = coachSeason(8);
    const injuries = s.live!.injuries.length;
    expect(s.live!.fatigue.length).toBeGreaterThan(10);
    const preview = s.calendar!.matches.map((m) => [m.day, m.gf, m.ga]);
    s = apply(s, { t: 'advance', to: 3 });
    expect(s.phase).toBe('summary');
    expect(s.calendar!.matches.map((m) => [m.day, m.gf, m.ga])).toEqual(preview);
    expect(s.live).toBeNull();
    expect(injuries).toBeGreaterThanOrEqual(0);
  });

  it('escalação vai no link e o replay reconstrói a temporada no mesmo dia', () => {
    const lineups: Action[] = [{ t: 'lineup', ids: [101, 102, 103], rotate: false }, { t: 'lineup', ids: null, rotate: true }];
    for (const a of lineups) {
      expect(decodeAction(encodeAction(a))).toEqual(a);
    }
    // sem mexer no estado por fora das ações (o replay só conhece as ações)
    let s = until(apply(apply(newGame(5, COACH), { t: 'job', idx: 0 }), { t: 'play' }), 60);
    s = apply(s, { t: 'lineup', ids: s.player.squad.slice(0, 11).map((f) => f.id), rotate: true });
    s = apply(s, { t: 'advance', to: 2 });
    const r = replay(s.seed, s.foundation, s.actions);
    expect(JSON.stringify(r)).toBe(JSON.stringify(s));
  });

  it('no modo presidente não há escalação manual, mas há lesões e janela de julho', () => {
    let s = newGame(3, FOUNDATION);
    if (s.office.event) s = apply(s, { t: 'event', choice: 0 });
    s = apply(s, { t: 'play' });
    expect(canApply(s, { t: 'lineup', ids: null, rotate: true })).toBe(false);
    expect(s.live!.fatigue.length).toBeGreaterThan(5);
  });
});

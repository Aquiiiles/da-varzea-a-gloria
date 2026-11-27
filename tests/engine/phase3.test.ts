import { apply, canApply, newGame, replay } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { currentInterview } from '../../src/engine/interview';
import { trophies } from '../../src/engine/trophies';
import type { Foundation, GameState } from '../../src/engine/types';
import { FOUNDATION } from './helpers';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function finished(seed: number, f = FOUNDATION): GameState {
  let s = newGame(seed, f);
  if (s.career) s = apply(s, { t: 'job', idx: 0 });
  if (s.office.event) s = apply(s, { t: 'event', choice: 0 });
  return apply(apply(s, { t: 'play' }), { t: 'advance', to: 3 });
}

describe('campeonatos da base', () => {
  it('toda temporada tem Copa de Juniores e Estadual Sub-17; Brasileiro Sub-20 só para Séries A e B', () => {
    const r = finished(4).history.at(-1)!;
    expect(r.youth!.map((y) => y.name)).toEqual(['Copinha', 'Estadual Sub-17']);
    const juniores = r.youth![0];
    expect(juniores.games.length).toBeGreaterThanOrEqual(3);
    expect(juniores.games.length).toBeLessThanOrEqual(7);
    const s = newGame(4, FOUNDATION);
    s.player.national = 1;
    s.player.stateDiv = 'A';
    s.player.tier = 1;
    if (s.office.event) s.office.eventChoice = 0;
    const done = apply(apply(s, { t: 'play' }), { t: 'advance', to: 3 });
    expect(done.history.at(-1)!.youth!.map((y) => y.name)).toContain('Brasileiro Sub-20');
  });

  it('base forte ganha títulos, vira manchete, troféu e destaque com potencial', () => {
    let s = newGame(6, FOUNDATION);
    for (const y of s.player.youth) y.ovr = 70;
    for (let i = 0; i < 8; i++) s.player.youth.push({ ...s.player.squad[i], id: 9000 + i, age: 17, ovr: 70, homegrown: true });
    if (s.office.event) s = apply(s, { t: 'event', choice: 0 });
    const potBefore = new Map(s.player.youth.map((y) => [y.id, y.pot]));
    s = apply(apply(s, { t: 'play' }), { t: 'advance', to: 3 });
    const r = s.history.at(-1)!;
    expect(r.youth!.some((y) => y.won)).toBe(true);
    expect(r.headlines.some((h) => h.startsWith('BASE:'))).toBe(true);
    expect(trophies(s).some((t) => t.id.startsWith('base-'))).toBe(true);
    const star = s.player.youth.find((y) => y.highlight);
    if (star) expect(star.pot).toBeGreaterThanOrEqual(potBefore.get(star.id)!);
  });
});

describe('entrevistas e coletivas', () => {
  /** avança jogo a jogo até aparecer uma entrevista */
  function untilInterview(seed: number): GameState {
    let s = apply(newGame(seed, COACH), { t: 'job', idx: 0 });
    s = apply(s, { t: 'play' });
    while (s.phase === 'season' && !currentInterview(s)) s = apply(s, { t: 'advance', to: 0 });
    return s;
  }

  it('aparecem pelo momento do jogo, com 3 tons; responder mexe na torcida/diretoria no fim', () => {
    const s = untilInterview(4);
    const it = currentInterview(s)!;
    expect(it).toBeTruthy();
    expect(it.questions[0].answers.map((a) => a.tone)).toEqual(['humilde', 'confiante', 'polêmico']);
    const calm = apply(s, { t: 'interview', day: it.day, q: 0, a: 0 });
    const spicy = apply(s, { t: 'interview', day: it.day, q: 0, a: 2 });
    expect(canApply(calm, { t: 'interview', day: it.day, q: 0, a: 1 })).toBe(false);
    // responder não muda os jogos
    expect(calm.calendar).toEqual(s.calendar);
    const end = (x: GameState) => apply(x, { t: 'advance', to: 3 });
    const a = end(calm);
    const b = end(spicy);
    const fxA = it.questions[0].answers[0].effect;
    const fxB = it.questions[0].answers[2].effect;
    if ((fxA.board ?? 0) !== (fxB.board ?? 0) && !a.career!.unemployed && !b.career!.unemployed) {
      expect(Math.sign(a.career!.board.confidence - b.career!.board.confidence)).toBe(Math.sign((fxA.board ?? 0) - (fxB.board ?? 0)));
    }
    // mesmos jogos e manchetes (a cobrança da diretoria depende da confiança, que a resposta muda)
    const games = (x: GameState) => x.history.at(-1)!.headlines.filter((h) => !h.startsWith('Cadeira balança'));
    expect(games(a)).toEqual(games(b));
  });

  it('pular não registra nada; a entrevista vai no link e o replay bate', () => {
    expect(decodeAction(encodeAction({ t: 'interview', day: 123, q: 1, a: 2 }))).toEqual({ t: 'interview', day: 123, q: 1, a: 2 });
    let s = untilInterview(9);
    const it = currentInterview(s)!;
    s = apply(s, { t: 'interview', day: it.day, q: 0, a: 1 });
    s = apply(s, { t: 'advance', to: 1 });
    expect(JSON.stringify(replay(s.seed, s.foundation, s.actions))).toBe(JSON.stringify(s));
  });
});

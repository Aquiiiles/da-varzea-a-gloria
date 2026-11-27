import { describe, expect, it } from 'vitest';
import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { pendingCourting, pendingDilemmas } from '../../src/engine/decisions';
import { blockMods, opponentProfile, refereeFor, DEFAULT_SET_PIECES } from '../../src/engine/matchday';
import { roundOn } from '../../src/engine/round';
import type { Action, Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };
const start = (seed: number) => apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });

/** Avança dia a dia até `pred` (ou o fim da temporada). */
function until(s: GameState, pred: (s: GameState) => boolean): GameState {
  for (let i = 0; i < 120 && s.phase === 'season' && !pred(s); i++) {
    s.career!.board.confidence = 100;
    s = apply(s, { t: 'advance', to: 0 });
  }
  return s;
}

describe('dia de jogo', () => {
  it('perfil do adversário e árbitro são fixos e variados', () => {
    expect(opponentProfile(1, 1, 'X')).toBe(opponentProfile(1, 1, 'X'));
    const profiles = new Set(Array.from({ length: 60 }, (_, i) => opponentProfile(1, 1, `clube ${i}`)));
    expect(profiles.size).toBeGreaterThanOrEqual(5);
    const refs = new Set(Array.from({ length: 60 }, (_, i) => refereeFor(1, 1, i).profile));
    expect(refs.size).toBe(4);
  });
  it('efeitos: retranca trava o ataque, individual neutraliza bola parada, torcida empurra quem perde em casa', () => {
    const base = { block: 3, tactic: 'equilibrado' as const, setPieces: DEFAULT_SET_PIECES, home: true, ref: 'normal' as const, behind: false, mood: 50, setPieceEdge: 0 };
    expect(blockMods({ ...base, profile: 'retranca' }).mult[0]).toBeLessThan(1);
    expect(blockMods({ ...base, profile: 'bola_parada' }).mult[1]).toBeGreaterThan(blockMods({ ...base, profile: 'bola_parada', setPieces: { corner: 'curto', marking: 'individual' } }).mult[1]);
    expect(blockMods({ ...base, profile: 'equilibrado', behind: true, mood: 90 }).delta[0]).toBeGreaterThan(0);
    expect(blockMods({ ...base, profile: 'equilibrado', behind: true, mood: 10 }).delta[0]).toBeLessThan(0);
    expect(blockMods({ ...base, profile: 'equilibrado', ref: 'caseiro' }).delta[0]).toBeGreaterThan(0);
  });
  it('bola parada: ação, link e escalação no meio da temporada', () => {
    let s = apply(newGame(7, COACH), { t: 'job', idx: 0 });
    s = apply(s, { t: 'setpieces', v: { corner: 'area', marking: 'individual' } });
    expect(s.player.setPieces).toEqual({ corner: 'area', marking: 'individual' });
    const a: Action = { t: 'setpieces', v: { corner: 'area', marking: 'zona' } };
    expect(decodeAction(encodeAction(a))).toEqual(a);
    s = apply(s, { t: 'play' });
    s = apply(s, a);
    expect(s.live!.lineups.at(-1)!.setPieces).toEqual(a.v);
  });
});

describe('decisões fora de campo', () => {
  it('notícias com escolha aparecem na data, respondem uma vez e vão no link', () => {
    let s = start(7);
    expect(s.live!.dilemmas).toHaveLength(2);
    s = until(s, (x) => pendingDilemmas(x).length > 0);
    const open = pendingDilemmas(s);
    expect(open.length).toBeGreaterThan(0);
    const { idx } = open[0];
    const news = s.news.length;
    s = apply(s, { t: 'dilemma', idx, choice: 0 });
    expect(s.news.length).toBe(news + 1);
    expect(s.live!.dilemmas![idx].choice).toBe(0);
    expect(canApply(s, { t: 'dilemma', idx, choice: 1 })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'dilemma', idx: 1, choice: 2 }))).toEqual({ t: 'dilemma', idx: 1, choice: 2 });
  });
  it('assédio ao craque: vender tira o jogador do elenco e põe dinheiro no caixa', () => {
    let found: GameState | null = null;
    for (let seed = 1; seed < 20 && !found; seed++) {
      const s = start(seed);
      if (s.live!.courting) found = until(s, (x) => pendingCourting(x) !== null);
    }
    expect(found).not.toBeNull();
    const s = found!;
    const c = pendingCourting(s)!;
    const cash = s.player.cash;
    const sold = apply(s, { t: 'courted', choice: 1 });
    expect(sold.player.squad.some((f) => f.id === c.playerId)).toBe(false);
    expect(sold.player.cash).toBe(cash + c.fee);
    const kept = apply(s, { t: 'courted', choice: 0 });
    expect(kept.player.squad.some((f) => f.id === c.playerId)).toBe(true);
    expect(canApply(kept, { t: 'courted', choice: 2 })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'courted', choice: 2 }))).toEqual({ t: 'courted', choice: 2 });
  });
});

describe('pênaltis ao vivo', () => {
  it('cobranças vêm do motor, a narração bate com o placar e a ordem escolhida entra no jogo', () => {
    let s: GameState | null = null;
    let day = -1;
    for (let seed = 1; seed < 40 && day < 0; seed++) {
      const t = start(seed);
      const m = t.calendar!.matches.find((x) => x.pens && x.kicks);
      if (m) {
        s = until(t, (x) => x.reveal! >= m.day);
        day = m.day;
      }
    }
    expect(day).toBeGreaterThan(0);
    const st = s!;
    const m = st.calendar!.matches.find((x) => x.day === day)!;
    expect(m.kickers!.length).toBeGreaterThan(0);
    const r = roundOn(st, day)!;
    const kicks = r.moment.events.filter((e) => e.kick !== undefined);
    expect(kicks.length).toBeGreaterThan(0);
    const last = r.moment.events.at(-1)!;
    expect(last.kind).toBe('penaltis');
    // a ordem escolhida vira a fila do motor
    const ids = [...m.kickers!].reverse().slice(0, 5);
    const t = apply(st, { t: 'penorder', day, ids });
    const m2 = t.calendar!.matches.find((x) => x.day === day)!;
    if (m2.kickers) expect(m2.kickers.slice(0, ids.length)).toEqual(ids);
    expect(canApply(t, { t: 'penorder', day, ids })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'penorder', day, ids }))).toEqual({ t: 'penorder', day, ids });
  });
});

describe('expulsão: arrumar o time com um a menos', () => {
  it('aceita a vaga vazia (0) na posição escolhida, o formato antigo de 10 e recusa 11', () => {
    let s = start(2);
    const red = (s.live!.cards ?? []).find((c) => c.kind === 'vermelho' && (c.minute ?? 60) < 70)!;
    expect(red).toBeTruthy();
    s = until(s, (x) => x.reveal! >= red.day);
    const day = red.day;
    const minute = Math.min(85, Math.max(5, Math.ceil(((red.minute ?? 60) + 1) / 5) * 5));
    const xi = s.live!.elevens.find((e) => e.day === day)!.ids;
    const ten = xi.filter((id) => id !== red.id);
    const withHole = xi.map((id) => (id === red.id ? 0 : id)).reverse();
    expect(canApply(s, { t: 'halftime', day, minute, ids: withHole })).toBe(true);
    expect(canApply(s, { t: 'halftime', day, minute, ids: ten })).toBe(true);
    const bench = s.player.squad.find((f) => !xi.includes(f.id))!;
    expect(canApply(s, { t: 'halftime', day, minute, ids: [...ten, bench.id] })).toBe(false);
    const t = apply(s, { t: 'halftime', day, minute, ids: withHole });
    expect(decodeAction(encodeAction({ t: 'halftime', day, minute, ids: withHole }))).toEqual({ t: 'halftime', day, minute, ids: withHole });
    // o que aconteceu antes da mexida não muda
    const before = s.calendar!.matches.find((m) => m.day === day)!.blocks!.slice(0, minute / 5);
    expect(t.calendar!.matches.find((m) => m.day === day)!.blocks!.slice(0, minute / 5)).toEqual(before);
  });
});

describe('esquema no meio do jogo', () => {
  it('troca o esquema no intervalo: vale dali para frente, vai no link e precisa das posições', () => {
    let s = start(7);
    s = until(s, (x) => x.calendar!.matches.some((m) => m.day === x.reveal));
    const day = s.reveal!;
    const xi = s.live!.elevens.find((e) => e.day === day)!.ids;
    const a = { t: 'halftime' as const, day, ids: [...xi], formation: '3-5-2' as const };
    expect(canApply(s, { t: 'halftime', day, minute: 45, ids: null, formation: '3-5-2' })).toBe(false);
    const t = apply(s, a);
    expect(t.live!.halftimes!.at(-1)!.formation).toBe('3-5-2');
    expect(decodeAction(encodeAction(a))).toEqual(a);
    const before = s.calendar!.matches.find((m) => m.day === day)!.blocks!.slice(0, 9);
    expect(t.calendar!.matches.find((m) => m.day === day)!.blocks!.slice(0, 9)).toEqual(before);
    expect(roundOn(t, day)!.changes.at(-1)!.formation).toBe('3-5-2');
  });
});

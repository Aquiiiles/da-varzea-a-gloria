import { describe, expect, it } from 'vitest';
import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { boardWatch } from '../../src/engine/boardwatch';
import { coachRanking } from '../../src/engine/ranking';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function running(seed: number): GameState {
  return apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
}

/** força uma sequência de derrotas nos primeiros jogos do calendário (só o que a diretoria vê) */
function losing(s: GameState, n: number): GameState {
  const t = structuredClone(s);
  for (const m of t.calendar!.matches.slice(0, n)) {
    m.gf = 0;
    m.ga = 2;
    m.advanced = m.advanced === null ? null : false;
  }
  return t;
}

describe('diretoria durante a temporada', () => {
  it('sequência ruim com confiança baixa: ultimato; sem vitória: demitido na hora', () => {
    const s = losing(running(3), 12);
    s.career!.board.confidence = 30;
    s.career!.board.personality = 'imediatista';
    const fired = boardWatch(s, -1, s.calendar!.matches[11].day);
    expect(fired).not.toBeNull();
    expect(s.news.some((n) => n.startsWith('ULTIMATO:'))).toBe(true);
    expect(s.news.some((n) => n.startsWith('DEMITIDO'))).toBe(true);
  });

  it('confiança alta: nada de ultimato', () => {
    const s = losing(running(3), 8);
    s.career!.board.confidence = 90;
    expect(boardWatch(s, -1, s.calendar!.matches[7].day)).toBeNull();
    expect(s.career!.ultimatum ?? null).toBeNull();
  });

  it('demitido pelo ultimato: a temporada acaba ali e o técnico fica sem clube', () => {
    // procura uma seed em que o time vá mal o bastante; força confiança baixa
    for (let seed = 1; seed < 40; seed++) {
      let s = running(seed);
      s.career!.board.confidence = 20;
      s.career!.board.personality = 'imediatista';
      s = apply(s, { t: 'advance', to: 3 });
      if (s.phase === 'summary' && s.career!.unemployed && s.career!.stints.at(-1)!.exit === 'demitido') {
        expect(s.history.at(-1)!.coachNews!.some((n) => n.includes('ultimato'))).toBe(true);
        return;
      }
    }
    throw new Error('nenhuma demissão por ultimato');
  });
});

describe('proposta no meio da temporada (pré-contrato)', () => {
  it('aceitar: no fim do ano a única proposta é a combinada', () => {
    for (let seed = 1; seed < 60; seed++) {
      let s = running(seed);
      s.career!.reputation = 70;
      s.career!.board.confidence = 95;
      for (let i = 0; i < 40 && !s.career!.midOffer && s.phase === 'season'; i++) s = apply(s, { t: 'advance', to: 2 });
      if (!s.career!.midOffer || s.phase !== 'season') continue;
      const offer = s.career!.midOffer.offer;
      expect(decodeAction(encodeAction({ t: 'precontract', accept: true }))).toEqual({ t: 'precontract', accept: true });
      s = apply(s, { t: 'precontract', accept: true });
      expect(canApply(s, { t: 'precontract', accept: false })).toBe(false);
      s = apply(apply(s, { t: 'advance', to: 3 }), { t: 'next' });
      if (s.career!.stints.at(-2)?.exit === 'demitido') continue;
      expect(s.career!.unemployed).toBe(true);
      expect(s.career!.offers.map((o) => o.clubId)).toEqual([offer.clubId]);
      s = apply(s, { t: 'job', idx: 0 });
      expect(s.player.name).toBe(offer.club);
      return;
    }
    throw new Error('nenhuma proposta no meio da temporada');
  });
});

describe('dança dos técnicos', () => {
  it('clubes da IA trocam de técnico e o ranking acompanha o técnico', () => {
    let s = apply(newGame(5, COACH), { t: 'job', idx: 0 });
    for (let i = 0; i < 3; i++) {
      if (s.career!.unemployed) s = apply(s, { t: 'job', idx: 0 });
      s = apply(apply(s, { t: 'play' }), { t: 'next' });
    }
    expect((s.coachMoves ?? []).length).toBeGreaterThan(0);
    expect(s.history.at(-1)!.worldNews.some((n) => n.startsWith('DANÇA DOS TÉCNICOS'))).toBe(true);
    expect(Object.keys(s.coachPoints!).every((k) => k === 'me' || k.startsWith('t:'))).toBe(true);
    const rows = coachRanking(s);
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
    expect(rows.filter((r) => r.me)).toHaveLength(1);
  });
});

describe('números da carreira', () => {
  it('soma jogos, campanha e títulos de cada temporada', () => {
    let s = apply(newGame(6, COACH), { t: 'job', idx: 0 });
    for (let i = 0; i < 2; i++) {
      if (s.career!.unemployed) s = apply(s, { t: 'job', idx: 0 });
      s = apply(apply(s, { t: 'play' }), { t: 'next' });
    }
    const rec = s.career!.record!;
    expect(rec.games).toBeGreaterThan(10);
    expect(rec.w + rec.d + rec.l).toBe(rec.games);
    expect(rec.bestUnbeaten).toBeGreaterThanOrEqual(rec.unbeaten);
    const stintGames = s.career!.stints.reduce((sum, st) => sum + (st.w ?? 0) + (st.d ?? 0) + (st.l ?? 0), 0);
    expect(stintGames).toBe(rec.games);
  });
});

describe('notícias por temporada', () => {
  it('cada notícia tem a temporada em que saiu (o fim do ano conta na temporada que acabou)', () => {
    let s = apply(newGame(6, COACH), { t: 'job', idx: 0 });
    s = apply(apply(s, { t: 'play' }), { t: 'next' });
    if (s.career!.unemployed) s = apply(s, { t: 'job', idx: 0 });
    s = apply(s, { t: 'play' });
    const tags = s.newsSeasons!;
    expect(tags).toHaveLength(s.news.length);
    expect(tags.every((t, i) => i === 0 || t >= tags[i - 1])).toBe(true);
    const headlines = s.history[0].headlines;
    const idx = s.news.indexOf(headlines[0]);
    if (idx >= 0) expect(tags[idx]).toBe(1);
    expect(tags.at(-1)).toBe(2);
  });
});

describe('base e lista de observação (técnico)', () => {
  it('observar: marca, desmarca, máximo de 20 e vai no replay', () => {
    let s = apply(newGame(9, COACH), { t: 'job', idx: 0 });
    const others = s.clubs.flatMap((c) => c.squad).slice(0, 21);
    s = apply(s, { t: 'watch', id: others[0].id });
    expect(s.watch).toEqual([others[0].id]);
    s = apply(s, { t: 'watch', id: others[0].id });
    expect(s.watch).toEqual([]);
    for (const f of others.slice(0, 20)) s = apply(s, { t: 'watch', id: f.id });
    expect(canApply(s, { t: 'watch', id: others[20].id })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'watch', id: 77 }))).toEqual({ t: 'watch', id: 77 });
    // na janela seguinte, avisos dos observados
    s = apply(apply(s, { t: 'play' }), { t: 'next' });
    expect(s.news.some((n) => n.startsWith('OBSERVADO'))).toBe(true);
  });

  it('técnico sobe garoto da base no meio da temporada (fora da janela)', () => {
    let s = apply(apply(newGame(9, COACH), { t: 'job', idx: 0 }), { t: 'play' });
    s = apply(s, { t: 'advance', to: 0 });
    const y = s.player.youth[0];
    if (!y || s.player.squad.length >= 28) return;
    const t = apply(s, { t: 'promote', id: y.id });
    expect(t.player.squad.some((f) => f.id === y.id)).toBe(true);
  });
});

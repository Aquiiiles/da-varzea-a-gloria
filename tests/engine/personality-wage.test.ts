import { describe, expect, it } from 'vitest';
import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { personalityOf, benchFactor, cardFactor, scoldThreshold } from '../../src/engine/personality';
import type { Foundation } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

describe('personalidade do jogador', () => {
  it('fixa por jogador, com todos os tipos aparecendo num elenco grande', () => {
    const s = newGame(7, COACH);
    const all = s.clubs.flatMap((c) => c.squad);
    const kinds = new Set(all.map(personalityOf));
    expect(kinds.size).toBe(5);
    for (const f of all.slice(0, 50)) expect(personalityOf(f)).toBe(personalityOf({ id: f.id, name: f.name }));
  });
  it('efeitos: ambicioso sofre mais no banco, temperamental leva mais cartão e aceita menos bronca', () => {
    expect(benchFactor('ambicioso')).toBeGreaterThan(benchFactor('leal'));
    expect(cardFactor('temperamental')).toBeGreaterThan(cardFactor('profissional'));
    expect(scoldThreshold('temperamental')).toBeGreaterThan(scoldThreshold('profissional'));
  });
});

describe('salário do técnico', () => {
  it('propostas têm salário; aceitar vira o salário da carreira', () => {
    const s = newGame(7, COACH);
    const c = s.career!;
    expect(c.offers.every((o) => (o.wage ?? 0) > 0)).toBe(true);
    const t = apply(s, { t: 'job', idx: 0 });
    expect(t.career!.wage).toBe(s.career!.offers[0].wage);
    expect(t.player.coach.wage).toBe(t.career!.wage);
  });
  it('negociar: uma tentativa só, sobe 25% ou fica; vai e volta pelo link', () => {
    const s = newGame(7, COACH);
    const before = s.career!.offers[1].wage!;
    const t = apply(s, { t: 'jobwage', idx: 1 });
    const o = t.career!.offers[1];
    expect(o.negotiated).toBeTruthy();
    expect(o.wage).toBe(o.negotiated === 'ok' ? Math.round(before * 1.25) : before);
    expect(canApply(t, { t: 'jobwage', idx: 1 })).toBe(false);
    expect(decodeAction(encodeAction({ t: 'jobwage', idx: 1 }))).toEqual({ t: 'jobwage', idx: 1 });
  });
  it('o salário da temporada entra no patrimônio', () => {
    let s = apply(apply(newGame(9, COACH), { t: 'job', idx: 0 }), { t: 'play' });
    for (let i = 0; i < 200 && s.phase === 'season'; i++) s = apply(s, { t: 'advance', to: 3 });
    expect(s.career!.earnings ?? 0).toBeGreaterThan(0);
  });
});

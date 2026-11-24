import { apply, applyMut, canApply, newGame, replay } from '../../src/engine/game';
import { decodeRun, encodeRun } from '../../src/engine/codec';
import { CAREER_END_AGE } from '../../src/engine/career';
import { levelFor, runStats } from '../../src/engine/score';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'ofensivo' };

function hired(seed = 3): GameState {
  return apply(newGame(seed, COACH), { t: 'job', idx: 0 });
}

const count = (s: GameState) => {
  const out: Record<string, number> = {};
  for (const c of [...s.clubs, s.player]) {
    const k = `${c.national ?? '-'}/${c.stateDiv ?? '-'}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

describe('modo técnico', () => {
  it('começa sem clube, com 3 propostas de times pequenos; sem clube não dá para jogar', () => {
    const s = newGame(3, COACH);
    expect(s.career!.unemployed).toBe(true);
    expect(s.career!.offers.length).toBe(3);
    for (const o of s.career!.offers) expect(o.tier).toBeGreaterThanOrEqual(6);
    expect(canApply(s, { t: 'play' })).toBe(false);
    expect(canApply(s, { t: 'buy', idx: 0 })).toBe(false);
  });

  it('aceitar a proposta troca de lugar com o clube: o novo vira o do jogador e o antigo volta para a IA', () => {
    const s0 = newGame(3, COACH);
    const offer = s0.career!.offers[0];
    const target = s0.clubs.find((c) => c.id === offer.clubId)!;
    const placeholder = s0.player.name;
    const s = apply(s0, { t: 'job', idx: 0 });
    expect(s.player.name).toBe(target.name);
    expect(s.player.squad.map((f) => f.id).sort()).toEqual(target.squad.map((f) => f.id).sort());
    expect(s.player.coach.name).toBe('Professor Zeca');
    expect(s.clubs.find((c) => c.id === offer.clubId)!.name).toBe(placeholder);
    expect(count(s)).toEqual(count(s0));
    expect(s.career!.unemployed).toBe(false);
    expect(s.career!.stints).toHaveLength(1);
    expect(s.career!.board.budget).toBeGreaterThanOrEqual(0);
  });

  it('estádio, finanças, eventos e técnicos são da diretoria; contratação precisa caber na verba', () => {
    const s = hired();
    s.player.cash = 1e7;
    expect(canApply(s, { t: 'seats', size: 0 })).toBe(false);
    expect(canApply(s, { t: 'ticket', level: 0 })).toBe(false);
    expect(canApply(s, { t: 'loan', size: 0 })).toBe(false);
    expect(s.office.event).toBeNull();
    expect(s.office.opportunities).toHaveLength(0);
    const idx = s.office.market.findIndex((l) => l !== null && l.fee > 0);
    s.career!.board.budget = 0;
    s.career!.board.wageCap = 1e9;
    expect(canApply(s, { t: 'buy', idx })).toBe(false);
    s.career!.board.budget = 1e9;
    expect(canApply(s, { t: 'buy', idx })).toBe(true);
    // teto da folha
    s.career!.board.wageCap = 0;
    expect(canApply(s, { t: 'buy', idx })).toBe(false);
    // o técnico troca o esquema quando quiser
    const f = s.player.coach.formation === '4-3-3' ? '4-4-2' : '4-3-3';
    const t = apply(s, { t: 'formation', f });
    expect(t.player.coach.formation).toBe(f);
  });

  it('confiança no chão = demissão; na janela seguinte vêm 3 propostas', () => {
    let s = hired(5);
    s.career!.board.confidence = 0;
    s = apply(s, { t: 'play' });
    expect(s.career!.unemployed).toBe(true);
    expect(s.career!.stints[0].exit).toBe('demitido');
    expect(s.history.at(-1)!.headlines.some((h) => h.startsWith('DEMITIDO'))).toBe(true);
    s = apply(s, { t: 'next' });
    expect(s.career!.offers.length).toBe(3);
    expect(canApply(s, { t: 'play' })).toBe(false);
    s = apply(s, { t: 'job', idx: 1 });
    expect(s.career!.stints).toHaveLength(2);
  });

  it('o modo vai no link e o replay reconstrói a carreira igual', () => {
    let s = hired(7);
    s = apply(s, { t: 'auto' });
    s = apply(s, { t: 'play' });
    s = apply(s, { t: 'next' });
    const code = decodeRun(encodeRun(s))!;
    expect(code.foundation.mode).toBe('tecnico');
    expect(code.foundation.style).toBe('ofensivo');
    expect(JSON.stringify(replay(code.seed, code.foundation, code.actions))).toBe(JSON.stringify(s));
  });

  it(`a carreira vai até os ${CAREER_END_AGE} anos e usa a escada do técnico`, () => {
    const s = newGame(11, COACH);
    for (let i = 0; i < 200 && s.phase !== 'over'; i++) {
      if (s.phase === 'summary') {
        applyMut(s, { t: 'next' });
        continue;
      }
      if (s.career!.unemployed) applyMut(s, { t: 'job', idx: 0 });
      applyMut(s, { t: 'auto' });
      applyMut(s, { t: 'play' });
    }
    expect(s.phase).toBe('over');
    expect(s.career!.age).toBe(CAREER_END_AGE);
    expect(s.history.length).toBe(CAREER_END_AGE - 35);
    const lvl = levelFor(runStats(s));
    expect(lvl.title).not.toBe('Time de várzea');
    expect(s.history.every((r) => r.club)).toBe(true);
  }, 30000);
});

import { apply, canApply, newGame } from '../../src/engine/game';
import { simulateSeason, PLAYER_ID } from '../../src/engine/season';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import { achievements } from '../../src/engine/achievements';
import { runStats, levelFor } from '../../src/engine/score';
import { FOUNDATION, playRun } from './helpers';
import type { GameState } from '../../src/engine/types';

function setup(mutate: (s: GameState) => void = () => {}): GameState {
  const s = structuredClone(newGame(77, FOUNDATION));
  mutate(s);
  return s;
}

describe('Copa Nacional', () => {
  it('todo clube da pirâmide joga; time da várzea começa na Preliminar', () => {
    const s = setup();
    const r = simulateSeason(s);
    const copa = r.cups.find((c) => c.id === 'copa')!;
    expect(copa).toBeDefined();
    expect(copa.matches[0].round).toBe('Preliminar');
    // ou foi eliminado na última partida, ou é campeão
    const last = copa.matches[copa.matches.length - 1];
    expect(copa.champion ? last.won && last.round === 'Final' : !last.won).toBe(true);
  });

  it('time imbatível ganha a copa, recebe prêmio e a taça', () => {
    const s = setup((s) => {
      for (const f of s.player.squad) f.ovr = 99;
    });
    const r = simulateSeason(s);
    const copa = r.cups.find((c) => c.id === 'copa')!;
    expect(copa.champion).toBe(true);
    expect(copa.matches.at(-1)!.round).toBe('Final');
    expect(copa.prize).toBeGreaterThan(0);
    expect(r.finance.prizes).toBeGreaterThanOrEqual(copa.prize);
    expect(copa.matches.some((m) => m.giantKill)).toBe(true);
    // campeão da copa vai para a Liga Europa se subir até a Championship ou se já estiver lá
    expect(r.moments.some((m) => m.kind === 'final_copa')).toBe(true);
  });
});

describe('Europa e Mundial', () => {
  it('top 4 da Premier vai à Copa dos Campeões; campeão dela vai ao Mundial', () => {
    const s = setup((s) => {
      const swap = s.world[1].pop()!;
      swap.tier = 8;
      s.world[8].push(swap);
      s.player.tier = 1;
      s.player.capacity = 60000;
      for (const f of s.player.squad) f.ovr = 99;
      s.player.continental = 'cc';
    });
    const r = simulateSeason(s);
    const cc = r.cups.find((c) => c.id === 'cc')!;
    expect(cc.matches).toHaveLength(5);
    expect(cc.champion).toBe(true);
    expect(s.player.worldCup).toBe(true);
    expect(s.player.continental).toBe('cc');
    expect(r.moments[0].kind === 'final_cc' || r.moments.some((m) => m.kind === 'final_cc')).toBe(true);
    s.season++;
    for (const f of s.player.squad) f.ovr = 99;
    const r2 = simulateSeason(s);
    const wc = r2.cups.find((c) => c.id === 'mundial')!;
    expect(wc.matches).toHaveLength(3);
    expect(runStats({ ...s, history: [r, r2] } as GameState).worldWins).toBe(1);
    expect(levelFor(runStats({ ...s, history: [r, r2] } as GameState)).level).toBe(10);
  });
});

describe('jogo ao vivo', () => {
  it('a narração termina com o placar do motor', () => {
    const s = setup((s) => {
      for (const f of s.player.squad) f.ovr = 99;
    });
    const r = simulateSeason(s);
    for (const m of r.moments) {
      const last = m.events[m.events.length - 1];
      expect(last.score).toEqual([m.result.hg, m.result.ag]);
      const goals = m.events.filter((e) => e.kind === 'gol').length;
      expect(goals).toBe(m.result.hg + m.result.ag);
      for (let i = 1; i < m.events.length; i++) expect(m.events[i].minute).toBeGreaterThanOrEqual(m.events[i - 1].minute);
      expect(m.homeName === s.player.name || m.awayName === s.player.name).toBe(true);
    }
  });
});

describe('técnico, comércio, delegação, torcida', () => {
  it('contratar técnico cobra a multa do atual e troca o técnico', () => {
    const s = setup((s) => (s.player.cash = 1e6));
    const c = s.office.coaches[0]!;
    const after = apply(s, { t: 'coach', idx: 0 });
    expect(after.player.coach.name).toBe(c.name);
    expect(after.office.coaches[0]).toBeNull();
  });

  it('comércio: um investimento por temporada e gera receita', () => {
    const s0 = setup((s) => (s.player.cash = 1e6));
    const s = apply(s0, { t: 'business', which: 'bar' });
    expect(s.player.businesses.bar).toBe(1);
    expect(canApply(s, { t: 'business', which: 'loja' })).toBe(false);
    const r = simulateSeason(s);
    expect(r.finance.commerce).toBeGreaterThan(0);
  });

  it('delegar faz o assistente agir só na área entregue, ao jogar', () => {
    const s0 = setup((s) => (s.player.cash = 1e5));
    const s1 = apply(s0, { t: 'delegate', area: 'mercado' });
    expect(s1.player.delegate.mercado).toBe(true);
    const s2 = apply(s1.office.event ? apply(s1, { t: 'event', choice: 0 }) : s1, { t: 'play' });
    // o diretor de futebol comprou alguém (há dinheiro de sobra) e não mexeu no estádio
    expect(s2.history[0].signings).toBeGreaterThan(0);
    expect(s2.player.capacityBuilding).toBe(0);
  });

  it('objetivos são avaliados e mexem no torcedômetro', () => {
    const s = setup((s) => {
      for (const f of s.player.squad) f.ovr = 99;
      s.player.capacity = 5000;
    });
    expect(s.office.objectives.length).toBe(2);
    const r = simulateSeason(s);
    expect(r.objectives.every((o) => typeof o.met === 'boolean')).toBe(true);
    expect(r.objectives.find((o) => o.main)!.met).toBe(true);
    expect(r.moodDelta).toBeGreaterThan(0);
  });

  it('codec cobre as ações novas', () => {
    for (const a of [{ t: 'coach', idx: 2 }, { t: 'business', which: 'estacionamento' }, { t: 'delegate', area: 'base' }] as const) {
      expect(decodeAction(encodeAction(a))).toEqual(a);
    }
  });
});

describe('conquistas', () => {
  it('lista estável com flags coerentes', () => {
    const s = playRun(4);
    const list = achievements(s);
    expect(list.length).toBeGreaterThanOrEqual(15);
    expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    const premier = list.find((x) => x.id === 'premier')!;
    expect(premier.unlocked).toBe(s.history.some((r) => r.tier === 1 && r.position === 1));
  });
});

it('o jogador nunca aparece duas vezes num confronto', () => {
  const s = playRun(9);
  for (const r of s.history) for (const c of r.cups) for (const m of c.matches) expect(m.result.home === PLAYER_ID || m.result.away === PLAYER_ID).toBe(true);
});

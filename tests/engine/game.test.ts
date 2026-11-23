import { apply, canApply, newGame, replay, tryApply } from '../../src/engine/game';
import { decodeAction, decodeRun, encodeAction, encodeRun } from '../../src/engine/codec';
import { simulateSeason, PLAYER_ID } from '../../src/engine/season';
import { MAX_SEASONS, TIERS, ALL_TIERS, SQUAD_MIN, YOUTH_AGE_LIMIT } from '../../src/data/pyramid';
import type { Action, Footballer, GameState } from '../../src/engine/types';
import { FOUNDATION, mixed, playRun } from './helpers';

describe('determinismo', () => {
  it('mesma seed + mesmas ações = mesma run (estado idêntico)', () => {
    const a = playRun(12345, mixed);
    const b = playRun(12345, mixed);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('replay a partir do log de ações reconstrói exatamente o estado', () => {
    const played = playRun(777, mixed);
    const rebuilt = replay(777, FOUNDATION, played.actions);
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(played));
  });

  it('seed diferente gera run diferente', () => {
    expect(JSON.stringify(playRun(1).history)).not.toBe(JSON.stringify(playRun(2).history));
  });

  it('apply não muta o estado anterior', () => {
    const s = newGame(5, FOUNDATION);
    const before = JSON.stringify(s);
    apply(s, { t: 'auto' });
    apply(s, { t: 'ticket', level: 2 });
    apply(s, { t: 'loan', size: 1 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('o motor não usa Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random proibido no motor');
    };
    try {
      expect(() => playRun(3, mixed)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('URL da run', () => {
  it('todas as ações fazem ida e volta no codec', () => {
    const all: Action[] = [
      { t: 'buy', idx: 3 }, { t: 'sell', id: 1042 }, { t: 'release', id: 7 }, { t: 'renew', id: 12 },
      { t: 'promote', id: 99 }, { t: 'cut', id: 100 }, { t: 'tryout' }, { t: 'sign', idx: 4 },
      { t: 'seats', size: 2 }, { t: 'facility', which: 'medical' }, { t: 'staff', which: 'scout', dir: -1 },
      { t: 'ticket', level: 0 }, { t: 'loan', size: 1 }, { t: 'opp', idx: 1 }, { t: 'event', choice: 1 },
      { t: 'auto' }, { t: 'play' }, { t: 'next' },
    ];
    for (const a of all) expect(decodeAction(encodeAction(a))).toEqual(a);
  });

  it('encode/decode da run inteira + replay idêntico', () => {
    const played = playRun(424242, mixed);
    const code = decodeRun(encodeRun(played))!;
    expect(code.seed).toBe(424242);
    expect(code.foundation).toEqual(played.foundation);
    expect(code.actions).toEqual(played.actions);
    const rebuilt = replay(code.seed, code.foundation, code.actions);
    expect(JSON.stringify(rebuilt.history)).toBe(JSON.stringify(played.history));
  });

  it('rejeita lixo', () => {
    expect(decodeRun('s=!!&o=p')).toBeNull();
    expect(decodeRun('s=abc&o=x&k=ffffff-000000')).toBeNull();
    expect(decodeRun('s=abc&o=p&k=ffffff-000000&a=q9')).toBeNull();
  });
});

describe('fluxo da run', () => {
  it('começa na Liga Regional com elenco, mercado e oportunidades', () => {
    const s = newGame(1, FOUNDATION);
    expect(s.player.tier).toBe(8);
    expect(s.phase).toBe('office');
    expect(s.player.squad.length).toBeGreaterThanOrEqual(SQUAD_MIN);
    expect(s.office.market).toHaveLength(8);
    expect(s.office.opportunities.length).toBeGreaterThanOrEqual(1);
  });

  it('termina em no máximo 25 temporadas', () => {
    for (const seed of [1, 2, 3]) {
      const s = playRun(seed);
      expect(s.history.length).toBeLessThanOrEqual(MAX_SEASONS);
      expect(s.over).not.toBeNull();
      if (s.over === 'fim') expect(s.history.length).toBe(MAX_SEASONS);
    }
  });

  it('a pirâmide mantém o tamanho de todas as divisões', () => {
    let s = newGame(99, FOUNDATION);
    for (let i = 0; i < 10 && s.phase !== 'over'; i++) {
      s = apply(s, { t: 'auto' });
      s = apply(s, { t: 'play' });
      for (const t of ALL_TIERS) expect(s.world[t]).toHaveLength(TIERS[t].size - (s.player.tier === t ? 1 : 0));
      if (s.phase === 'summary') s = apply(s, { t: 'next' });
    }
  });

  it('não joga com evento pendente; ações fora de fase são recusadas', () => {
    let s = newGame(1, FOUNDATION);
    s.office.event = { id: 'x', title: '', text: '', weight: 1, options: [{ label: 'a', effects: [], headline: 'a' }, { label: 'b', effects: [], headline: 'b' }] };
    expect(canApply(s, { t: 'play' })).toBe(false);
    s = apply(s, { t: 'event', choice: 0 });
    s = apply(s, { t: 'play' });
    expect(s.phase).toBe('summary');
    expect(tryApply(s, { t: 'buy', idx: 0 })).toBeNull();
  });
});

/** Estado no início da temporada, para testar regras. */
function setup(mutate: (s: GameState) => void = () => {}): GameState {
  const s = structuredClone(newGame(2024, FOUNDATION));
  mutate(s);
  return s;
}

function superSquad(s: GameState, ovr: number) {
  for (const f of s.player.squad) f.ovr = ovr;
}

describe('mercado e elenco', () => {
  it('compra exige caixa', () => {
    const s = setup((s) => (s.player.cash = 0));
    const idx = s.office.market.findIndex((l) => l && l.fee > 0);
    expect(canApply(s, { t: 'buy', idx })).toBe(false);
    s.player.cash = 1e6;
    const after = apply(s, { t: 'buy', idx });
    expect(after.player.squad.length).toBe(s.player.squad.length + 1);
    expect(after.player.cash).toBe(1e6 - s.office.market[idx]!.fee);
    expect(after.office.market[idx]).toBeNull();
  });

  it('não vende abaixo do elenco mínimo', () => {
    const s = setup((s) => (s.player.squad = s.player.squad.slice(0, SQUAD_MIN)));
    expect(canApply(s, { t: 'sell', id: s.player.squad[0].id })).toBe(false);
  });

  it('venda rende dinheiro e o jogador vai para os ex-jogadores', () => {
    const s = setup();
    const f = s.player.squad[0];
    const after = apply(s, { t: 'sell', id: f.id });
    expect(after.player.cash).toBeGreaterThan(s.player.cash);
    expect(after.player.alumni.map((x) => x.id)).toContain(f.id);
  });

  it('renovação só no último ano de contrato', () => {
    const s = setup();
    const f = s.player.squad[0];
    f.contract = 2;
    expect(canApply(s, { t: 'renew', id: f.id })).toBe(false);
    f.contract = 1;
    const after = apply(s, { t: 'renew', id: f.id });
    expect(after.player.squad[0].contract).toBe(4);
  });

  it('contrato que acaba: o jogador sai de graça', () => {
    const s = setup();
    const f = s.player.squad[0];
    f.contract = 1;
    f.age = 22;
    const r = simulateSeason(s);
    expect(s.player.squad.some((x) => x.id === f.id)).toBe(false);
    expect(r.departures.join(' ')).toContain(f.name);
  });

  it('peneira: uma por temporada, custa dinheiro e traz 5 candidatos', () => {
    const s = setup((s) => (s.player.cash = 1000));
    const after = apply(s, { t: 'tryout' });
    expect(after.office.tryout).toHaveLength(5);
    expect(after.player.cash).toBeLessThan(1000);
    expect(canApply(after, { t: 'tryout' })).toBe(false);
    const signed = apply(after, { t: 'sign', idx: 0 });
    const c = after.office.tryout![0]!;
    const where = c.age <= 19 ? signed.player.youth : signed.player.squad;
    expect(where.some((x) => x.id === c.id)).toBe(true);
  });

  it('garoto que passa da idade limite sai da base', () => {
    const s = setup();
    s.player.youth = [{ ...s.player.squad[0], id: 9999, age: YOUTH_AGE_LIMIT, homegrown: true } as Footballer];
    simulateSeason(s);
    expect(s.player.youth.some((y) => y.id === 9999)).toBe(false);
  });

  it('elenco nunca fica abaixo do mínimo (completa com amadores)', () => {
    const s = setup((s) => (s.player.squad = s.player.squad.slice(0, 5)));
    simulateSeason(s);
    expect(s.player.squad.length).toBeGreaterThanOrEqual(SQUAD_MIN);
  });
});

describe('estádio e trava de acesso', () => {
  it('campeão SEM estádio é barrado e não sobe', () => {
    const s = setup((s) => {
      superSquad(s, 85);
      s.player.capacity = 300; // Liga Regional Premier exige 800
    });
    const r = simulateSeason(s);
    expect(r.position).toBe(1);
    expect(r.outcome).toBe('barrado_estadio');
    expect(r.nextTier).toBe(8);
    expect(r.stadiumRequired).toBe(TIERS[7].minStadium);
    const second = r.table[1].clubId;
    expect(s.world[7].map((c) => c.id)).toContain(second);
    expect(r.playoff).toBeUndefined();
  });

  it('obra em andamento conta na vistoria do fim da temporada', () => {
    const s = setup((s) => {
      superSquad(s, 85);
      s.player.capacity = 300;
      s.player.capacityBuilding = 600;
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('campeao');
    expect(s.player.capacity).toBe(900);
    expect(s.player.capacityBuilding).toBe(0);
  });

  it('ampliação: uma obra por temporada, entra como "em obras"', () => {
    const s = setup((s) => (s.player.cash = 1e6));
    const after = apply(s, { t: 'seats', size: 0 });
    expect(after.player.capacityBuilding).toBeGreaterThan(0);
    expect(after.player.capacity).toBe(s.player.capacity);
    expect(canApply(after, { t: 'seats', size: 1 })).toBe(false);
  });

  it('time fraco numa divisão alta cai', () => {
    const s = setup((s) => {
      const swap = s.world[4].pop()!;
      swap.tier = 8;
      s.world[8].push(swap);
      s.player.tier = 4;
      s.player.capacity = 20000;
      superSquad(s, 40);
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('queda');
    expect(r.nextTier).toBe(5);
  });

  it('o clube do jogador não sai da pirâmide mesmo sendo lanterna', () => {
    const s = setup((s) => superSquad(s, 25));
    const r = simulateSeason(s);
    expect(r.position).toBe(TIERS[8].size);
    expect(r.nextTier).toBe(8);
    expect(r.table.some((row) => row.clubId === PLAYER_ID)).toBe(true);
  });
});

describe('caixa e falência', () => {
  it('caixa negativo dispara venda forçada', () => {
    const s = setup((s) => (s.player.cash = -2000));
    const before = s.player.squad.length;
    const r = simulateSeason(s);
    expect(r.departures.some((d) => d.includes('às pressas'))).toBe(true);
    expect(s.player.squad.length).toBeLessThanOrEqual(before + SQUAD_MIN);
  });

  it('2º ano seguido no vermelho gera perda de pontos', () => {
    const s = setup((s) => {
      s.player.cash = -1e6;
      s.player.negativeSeasons = 1;
    });
    simulateSeason(s);
    expect(s.player.negativeSeasons).toBe(2);
    expect(s.player.pendingDeduction).toBe(10);
  });

  it('se a dívida piora depois disso, é falência', () => {
    const s = setup((s) => {
      s.player.cash = -1e6;
      s.player.negativeSeasons = 2;
      for (const f of s.player.squad) f.wage = 500; // folha impagável
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('falencia');
    expect(s.over).toBe('falencia');
  });

  it('empréstimo entra no caixa e vira parcela negativa por 3 temporadas', () => {
    const s = setup();
    const after = apply(s, { t: 'loan', size: 0 });
    expect(after.player.cash).toBeGreaterThan(s.player.cash);
    const parcela = after.player.sponsors.find((x) => x.perSeason < 0)!;
    expect(parcela.seasonsLeft).toBe(3);
    expect(canApply(after, { t: 'loan', size: 0 })).toBe(false);
  });
});

describe('desempenho', () => {
  it('uma temporada (todas as 8 divisões + elenco) roda em menos de 50ms', () => {
    const s = newGame(1, FOUNDATION);
    simulateSeason(structuredClone(s));
    const N = 20;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const c = structuredClone(s);
      c.season = i + 1;
      simulateSeason(c);
    }
    expect((performance.now() - t0) / N).toBeLessThan(50);
  });
});

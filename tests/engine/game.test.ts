import { advance, choose, newGame, replay } from '../../src/engine/game';
import { decodeRun, encodeRun } from '../../src/engine/codec';
import { simulateSeason, PLAYER_ID } from '../../src/engine/season';
import { MAX_SEASONS, TIERS, ALL_TIERS } from '../../src/data/pyramid';
import type { GameState } from '../../src/engine/types';
import { FOUNDATION, patterned, playRun } from './helpers';

describe('determinismo', () => {
  it('mesma seed + mesmas escolhas = mesma run (estado idêntico)', () => {
    const a = playRun(12345, patterned);
    const b = playRun(12345, patterned);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('replay a partir das escolhas reconstrói exatamente o estado', () => {
    const played = playRun(777, patterned);
    const rebuilt = replay(777, FOUNDATION, played.choices);
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(played));
  });

  it('seed diferente gera run diferente', () => {
    const a = playRun(1, patterned);
    const b = playRun(2, patterned);
    expect(JSON.stringify(a.history)).not.toBe(JSON.stringify(b.history));
  });

  it('escolha diferente muda a run', () => {
    const s = newGame(5, FOUNDATION);
    const a = choose(s, 0);
    const b = choose(s, 1);
    expect(JSON.stringify(a.player)).not.toBe(JSON.stringify(b.player));
  });

  it('choose não muta o estado anterior', () => {
    const s = newGame(5, FOUNDATION);
    const before = JSON.stringify(s);
    choose(s, 2);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('o motor não usa Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('Math.random proibido no motor');
    };
    try {
      expect(() => playRun(3, patterned)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('URL da run', () => {
  it('encode/decode ida e volta + replay idêntico', () => {
    const played = playRun(424242, patterned);
    const q = encodeRun(played);
    const code = decodeRun(q)!;
    expect(code.seed).toBe(424242);
    expect(code.foundation).toEqual(played.foundation);
    expect(code.choices).toEqual(played.choices);
    const rebuilt = replay(code.seed, code.foundation, code.choices);
    expect(JSON.stringify(rebuilt.history)).toBe(JSON.stringify(played.history));
  });

  it('rejeita lixo', () => {
    expect(decodeRun('s=!!&o=p')).toBeNull();
    expect(decodeRun('s=abc&o=x&k=ffffff-000000')).toBeNull();
    expect(decodeRun('s=abc&o=p&k=zzz-000000')).toBeNull();
  });
});

describe('fluxo da run', () => {
  it('começa na Liga Regional com 3 cartas', () => {
    const s = newGame(1, FOUNDATION);
    expect(s.player.tier).toBe(8);
    expect(s.offer).toHaveLength(3);
    expect(new Set(s.offer.map((c) => c.id)).size).toBe(3);
    expect(s.phase).toBe('draft');
  });

  it('a run termina em no máximo 25 temporadas', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = playRun(seed, patterned);
      expect(s.history.length).toBeLessThanOrEqual(MAX_SEASONS);
      expect(s.over).not.toBeNull();
      if (s.over === 'fim') expect(s.history.length).toBe(MAX_SEASONS);
    }
  });

  it('a pirâmide mantém o tamanho de todas as divisões a cada temporada', () => {
    let s = newGame(99, FOUNDATION);
    for (let i = 0; i < 12 && s.phase !== 'over'; i++) {
      if (s.phase === 'summary') s = advance(s);
      s = choose(s, 0);
      if (s.phase === 'event') s = choose(s, 0);
      for (const t of ALL_TIERS) {
        const expected = TIERS[t].size - (s.player.tier === t ? 1 : 0);
        expect(s.world[t]).toHaveLength(expected);
      }
    }
  });

  it('rejeita escolha inválida', () => {
    const s = newGame(1, FOUNDATION);
    expect(() => choose(s, 3)).toThrow();
    expect(() => choose(s, -1)).toThrow();
    expect(() => advance(s)).toThrow();
  });
});

/** Prepara um estado no início de temporada para testes de regra. */
function setup(mutate: (s: GameState) => void): GameState {
  const s = structuredClone(newGame(2024, FOUNDATION));
  mutate(s);
  return s;
}

describe('acesso, queda e trava de estádio', () => {
  it('campeão SEM estádio é barrado e não sobe', () => {
    const s = setup((s) => {
      s.player.strength = 99;
      s.player.capacity = 300; // Liga Regional Premier exige 800
    });
    const r = simulateSeason(s);
    expect(r.position).toBe(1);
    expect(r.outcome).toBe('barrado_estadio');
    expect(r.nextTier).toBe(8);
    expect(r.stadiumRequired).toBe(TIERS[7].minStadium);
    expect(s.player.tier).toBe(8);
    expect(r.headlines[0]).toMatch(/barrado/i);
  });

  it('quando o líder é barrado, a vaga vai para o próximo elegível', () => {
    const s = setup((s) => {
      s.player.strength = 99;
      s.player.capacity = 300;
    });
    const r = simulateSeason(s);
    // o 2º colocado herda a vaga direta
    const secondId = r.table[1].clubId;
    expect(s.world[7].map((c) => c.id)).toContain(secondId);
    // e o jogador barrado não disputa o playoff
    expect(r.playoff).toBeUndefined();
  });

  it('campeão COM estádio sobe', () => {
    const s = setup((s) => {
      s.player.strength = 99;
      s.player.capacity = 5000;
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('campeao');
    expect(r.nextTier).toBe(7);
    expect(s.player.tier).toBe(7);
  });

  it('time fraco numa divisão alta cai', () => {
    const s = setup((s) => {
      // move o jogador para a Liga 2 trocando de lugar com um clube de lá
      const swap = s.world[4].pop()!;
      swap.tier = 8;
      s.world[8].push(swap);
      s.player.tier = 4;
      s.player.strength = 5;
      s.player.capacity = 20000;
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('queda');
    expect(r.nextTier).toBe(5);
  });

  it('o clube do jogador não sai da pirâmide mesmo sendo lanterna da Liga Regional', () => {
    const s = setup((s) => {
      s.player.strength = 1;
    });
    const r = simulateSeason(s);
    expect(r.position).toBe(TIERS[8].size);
    expect(r.nextTier).toBe(8);
    expect(r.table.some((row) => row.clubId === PLAYER_ID)).toBe(true);
  });
});

describe('caixa e falência', () => {
  it('2º ano seguido no vermelho gera perda de pontos na temporada seguinte', () => {
    const s = setup((s) => {
      s.player.cash = -100000;
      s.player.negativeSeasons = 1;
    });
    simulateSeason(s);
    expect(s.player.negativeSeasons).toBe(2);
    expect(s.player.pendingDeduction).toBe(10);
    const r2 = simulateSeason({ ...s, season: s.season + 1 });
    expect(r2.deduction).toBe(10);
  });

  it('se a dívida piora depois disso, é falência', () => {
    const s = setup((s) => {
      s.player.cash = -100000;
      s.player.negativeSeasons = 2;
      s.player.strength = 70; // folha altíssima: a dívida só cresce
    });
    const r = simulateSeason(s);
    expect(r.outcome).toBe('falencia');
    expect(s.over).toBe('falencia');
  });

  it('caixa positivo zera o contador', () => {
    const s = setup((s) => {
      s.player.cash = 100000;
      s.player.negativeSeasons = 2;
    });
    simulateSeason(s);
    expect(s.player.negativeSeasons).toBe(0);
  });
});

describe('desempenho', () => {
  it('uma temporada (todas as 8 divisões) roda em menos de 50ms', () => {
    const s = newGame(1, FOUNDATION);
    simulateSeason(structuredClone(s)); // aquecimento do JIT
    const N = 20;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const c = structuredClone(s);
      c.season = i + 1;
      simulateSeason(c);
    }
    const per = (performance.now() - t0) / N;
    expect(per).toBeLessThan(50);
  });
});

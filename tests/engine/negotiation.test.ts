import { apply, canApply, newGame, replay } from '../../src/engine/game';
import { decodeAction, encodeAction, decodeRun, encodeRun } from '../../src/engine/codec';
import { simulateSeason } from '../../src/engine/season';
import { clubAsking, playerAsking } from '../../src/engine/negotiation';
import { squadStrength } from '../../src/engine/footballers';
import { targetStrength } from '../../src/engine/aisquad';
import type { Action, Club, GameState } from '../../src/engine/types';
import { FOUNDATION, mixed, playRun } from './helpers';

function setup(mutate: (s: GameState) => void = () => {}): GameState {
  const s = structuredClone(newGame(321, FOUNDATION));
  mutate(s);
  return s;
}

/** Um clube do mesmo nível do jogador e seu melhor jogador. */
function target(s: GameState): { club: Club; id: number } {
  const club = s.clubs.find((c) => c.stateDiv === 'V')!;
  const f = club.squad.slice().sort((a, b) => b.ovr - a.ovr)[0];
  return { club, id: f.id };
}

describe('elencos da IA', () => {
  it('todo clube tem elenco e a força bate com o time titular', () => {
    const s = newGame(1, FOUNDATION);
    for (const c of s.clubs) {
      expect(c.squad.length).toBeGreaterThanOrEqual(18);
      expect(Math.abs(c.strength - squadStrength(c.squad))).toBeLessThan(0.11);
    }
    const names = s.clubs.flatMap((c) => c.squad.map((f) => f.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('a força da IA fica perto do alvo do nível ao longo da carreira', () => {
    const s = playRun(6);
    const diffs = s.clubs.map((c) => squadStrength(c.squad) - targetStrength(c));
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    expect(Math.abs(mean)).toBeLessThan(1.5);
  });

  it('notícias trazem artilheiro e transferências reais', () => {
    const s = structuredClone(newGame(2, FOUNDATION));
    const r = simulateSeason(s);
    expect(r.worldNews.some((n) => n.includes('artilheiro da Série A'))).toBe(true);
    expect(r.worldNews.some((n) => n.startsWith('MERCADO:'))).toBe(true);
  });
});

describe('negociação', () => {
  it('proposta pelo preço pedido e salário pedido: contratado, clube perde o jogador', () => {
    const s = setup((s) => (s.player.cash = 1e6));
    const { club, id } = target(s);
    const f = club.squad.find((x) => x.id === id)!;
    const fee = clubAsking(s, club, f);
    const wage = Math.ceil(playerAsking(s, club, f) * 10) / 10;
    const after = apply(s, { t: 'bid', club: club.id, player: id, fee, wage, years: 3 });
    expect(after.office.negotiations[0].status).toBe('aceita');
    expect(after.player.squad.some((x) => x.id === id)).toBe(true);
    expect(after.clubs.find((c) => c.id === club.id)!.squad.some((x) => x.id === id)).toBe(false);
    expect(after.player.cash).toBe(1e6 - fee);
    expect(after.player.squad.find((x) => x.id === id)!.contract).toBe(3);
  });

  it('taxa um pouco abaixo: contraproposta do clube; muito abaixo: recusa', () => {
    const s = setup((s) => (s.player.cash = 1e6));
    const { club, id } = target(s);
    const f = club.squad.find((x) => x.id === id)!;
    const ask = clubAsking(s, club, f);
    const counter = apply(s, { t: 'bid', club: club.id, player: id, fee: Math.round(ask * 0.9), wage: 999, years: 2 });
    expect(counter.office.negotiations[0].status).toBe('contra_clube');
    expect(counter.office.negotiations[0].askFee).toBe(ask);
    const low = apply(s, { t: 'bid', club: club.id, player: id, fee: 1, wage: 999, years: 2 });
    expect(low.office.negotiations[0].status).toBe('recusada');
  });

  it('salário baixo: o jogador faz contraproposta', () => {
    const s = setup((s) => (s.player.cash = 1e6));
    const { club, id } = target(s);
    const f = club.squad.find((x) => x.id === id)!;
    const want = playerAsking(s, club, f);
    const out = apply(s, { t: 'bid', club: club.id, player: id, fee: clubAsking(s, club, f), wage: Math.round(want * 9) / 10, years: 2 });
    expect(out.office.negotiations[0].status).toBe('contra_jogador');
  });

  it('no máximo 3 rodadas; precisa de caixa para a taxa; valores inválidos são recusados', () => {
    let s = setup((s) => (s.player.cash = 1e6));
    const { club, id } = target(s);
    for (let i = 0; i < 3; i++) s = apply(s, { t: 'bid', club: club.id, player: id, fee: 1, wage: 1, years: 1 });
    expect(canApply(s, { t: 'bid', club: club.id, player: id, fee: 1, wage: 1, years: 1 })).toBe(false);
    const poor = setup((s) => (s.player.cash = 0));
    expect(canApply(poor, { t: 'bid', club: club.id, player: id, fee: 10, wage: 1, years: 1 })).toBe(false);
    expect(canApply(poor, { t: 'bid', club: club.id, player: id, fee: 0, wage: 1.25, years: 1 })).toBe(false);
  });

  it('jogador vendido vai para um clube da IA de verdade', () => {
    const s = setup();
    const f = s.player.squad[0];
    const after = apply(s, { t: 'sell', id: f.id });
    expect(after.clubs.some((c) => c.squad.some((x) => x.id === f.id))).toBe(true);
  });

  it('codec da proposta faz ida e volta e o replay reproduz a negociação', () => {
    const a: Action = { t: 'bid', club: 'c42', player: 1234, fee: 350, wage: 27.5, years: 4 };
    expect(decodeAction(encodeAction(a))).toEqual(a);
    expect(decodeAction(encodeAction({ t: 'renew', id: 77 }))).toEqual({ t: 'renew', id: 77 });
    const s0 = setup((s) => (s.player.cash = 1e6));
    const { club, id } = target(s0);
    let s = newGame(321, FOUNDATION);
    s = apply(s, { t: 'bid', club: club.id, player: id, fee: 1, wage: 5, years: 2 });
    const code = decodeRun(encodeRun(s))!;
    expect(JSON.stringify(replay(code.seed, code.foundation, code.actions))).toBe(JSON.stringify(s));
  });
});

describe('contratos transparentes', () => {
  it('intenções decididas na abertura da janela para quem está no último ano', () => {
    const s = playRun(8, mixed);
    void s;
    const g = newGame(8, FOUNDATION);
    for (const f of g.player.squad) {
      if (f.contract === 1 && f.intent !== 'aposenta') expect(['renova', 'aumento', 'sai', 'clube_maior']).toContain(f.intent);
      if (f.contract > 1 && f.age < 33) expect(f.intent).toBeUndefined();
    }
  });

  it('o fim da temporada cumpre a intenção: quem ia sair sai, quem renova fica', () => {
    const s = setup();
    const [a, b] = s.player.squad;
    a.contract = 1;
    a.intent = 'sai';
    a.age = 24;
    b.contract = 1;
    b.intent = 'renova';
    b.age = 24;
    const r = simulateSeason(s);
    expect(s.player.squad.some((x) => x.id === a.id)).toBe(false);
    expect(s.player.squad.some((x) => x.id === b.id)).toBe(true);
    expect(r.departures.join(' ')).toContain(a.name);
  });

  it('dá para convencer quem quer sair, pagando mais', () => {
    const s = setup();
    const f = s.player.squad[0];
    f.contract = 1;
    f.intent = 'sai';
    const before = f.wage;
    const after = apply(s, { t: 'renew', id: f.id });
    const g = after.player.squad.find((x) => x.id === f.id)!;
    expect(g.contract).toBeGreaterThan(1);
    expect(g.intent).toBeUndefined();
    expect(g.wage).toBeGreaterThan(before);
    s.player.squad[0].intent = 'aposenta';
    expect(canApply(s, { t: 'renew', id: f.id })).toBe(false);
  });
});

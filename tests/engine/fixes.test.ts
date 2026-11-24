import { apply, canApply, newGame } from '../../src/engine/game';
import { decodeAction, encodeAction } from '../../src/engine/codec';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function season(seed: number): GameState {
  return apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
}

describe('correções', () => {
  it('a tabela é sorteada: a 1ª rodada não é sempre fora de casa', () => {
    let home = 0;
    for (let seed = 1; seed <= 20; seed++) if (season(seed).calendar!.matches[0].home) home++;
    expect(home).toBeGreaterThan(3);
    expect(home).toBeLessThan(17);
  });

  it('estratégia: muda quando quiser, vale só para os jogos seguintes e vai no link', () => {
    for (const v of ['equilibrado', 'ofensivo', 'retranqueiro', 'contra_ataque', 'pressao'] as const) {
      expect(decodeAction(encodeAction({ t: 'tactic', v }))).toEqual({ t: 'tactic', v });
    }
    let s = season(3);
    while (s.reveal! < 60) s = apply(s, { t: 'advance', to: 1 });
    const past = s.calendar!.matches.filter((m) => m.day <= s.reveal!);
    const t = apply(s, { t: 'tactic', v: 'ofensivo' });
    expect(t.calendar!.matches.filter((m) => m.day <= s.reveal!)).toEqual(past);
    expect(t.player.tactic).toBe('ofensivo');
    // ofensivo: mais gols nos jogos seguintes (pró e contra) do que retranca
    const r = apply(s, { t: 'tactic', v: 'retranqueiro' });
    const goals = (x: GameState) => x.calendar!.matches.filter((m) => m.day > s.reveal!).reduce((n, m) => n + m.gf + m.ga, 0);
    expect(goals(t)).toBeGreaterThan(goals(r));
  });

  it('no modo presidente, a estratégia é do técnico contratado (não dá para mudar)', () => {
    const s = newGame(1, { name: 'Unidos', colors: ['#c8102e', '#ffffff'], origin: 'pub' });
    expect(canApply(s, { t: 'tactic', v: 'ofensivo' })).toBe(false);
  });

  it('modo técnico: peneira sai da verba da diretoria', () => {
    const s = apply(newGame(2, COACH), { t: 'job', idx: 0 });
    s.player.cash = 1e6;
    s.career!.board.budget = 0;
    expect(canApply(s, { t: 'tryout' })).toBe(false);
    s.career!.board.budget = 1e6;
    expect(canApply(s, { t: 'tryout' })).toBe(true);
  });
});

describe('propostas pelos seus jogadores', () => {
  const withOffer = (): GameState => {
    const s = newGame(5, { name: 'Unidos', colors: ['#c8102e', '#ffffff'], origin: 'pub' });
    const f = s.player.squad[0];
    s.office.offers = [{ playerId: f.id, fee: 100, club: s.clubs[0].name, clubTier: s.clubs[0].tier, max: 130 }];
    return s;
  };

  it('negociar: até o limite do clube vende pelo valor pedido', () => {
    const s = withOffer();
    const cash = s.player.cash;
    const t = apply(s, { t: 'counter', idx: 0, fee: 125 });
    expect(t.player.cash).toBe(cash + 125);
    expect(t.office.offers[0]).toBeNull();
  });

  it('negociar acima do limite: o clube faz a última oferta; insistir faz ele desistir', () => {
    let s = withOffer();
    s = apply(s, { t: 'counter', idx: 0, fee: 200 });
    expect(s.office.offers[0]!.fee).toBe(130);
    expect(s.office.offers[0]!.final).toBe(true);
    s = apply(s, { t: 'counter', idx: 0, fee: 150 });
    expect(s.office.offers[0]).toBeNull();
  });

  it('recusar tira a proposta; pedir menos que a oferta não vale; tudo vai no link', () => {
    const s = withOffer();
    expect(canApply(s, { t: 'counter', idx: 0, fee: 90 })).toBe(false);
    expect(apply(s, { t: 'reject', idx: 0 }).office.offers[0]).toBeNull();
    expect(decodeAction(encodeAction({ t: 'counter', idx: 1, fee: 4500 }))).toEqual({ t: 'counter', idx: 1, fee: 4500 });
    expect(decodeAction(encodeAction({ t: 'reject', idx: 2 }))).toEqual({ t: 'reject', idx: 2 });
  });

  it('segurar quem quer ir para um clube maior custa no máximo 2,5x o salário', async () => {
    const { renewalOffer } = await import('../../src/engine/office');
    const f = { ...newGame(1, COACH).player.squad[0], ovr: 80, wage: 10, intent: 'clube_maior' as const };
    const offer = renewalOffer(f)!;
    expect(offer.wage).toBeLessThanOrEqual(25);
    expect(offer.wage).toBeGreaterThan(10);
  });
});

describe('perfil do jogador na negociação', () => {
  it('o melhor titular pesa mais que o pior reserva, e o substituto é de fora do time', async () => {
    const { playerImportance, bestEleven } = await import('../../src/engine/footballers');
    const s = newGame(3, { name: 'Unidos', colors: ['#c8102e', '#ffffff'], origin: 'pub' });
    const sq = s.player.squad;
    const xi = bestEleven(sq, s.player.coach.formation).ids;
    const best = sq.filter((f) => xi.has(f.id)).sort((a, b) => b.ovr - a.ovr)[0];
    const worst = sq.filter((f) => !xi.has(f.id)).sort((a, b) => a.ovr - b.ovr)[0];
    const a = playerImportance(sq, s.player.coach.formation, best.id);
    const b = playerImportance(sq, s.player.coach.formation, worst.id);
    expect(a.starter).toBe(true);
    expect(b.starter).toBe(false);
    expect(a.delta).toBeGreaterThanOrEqual(b.delta);
    expect(a.replacement).not.toBeNull();
    expect(xi.has(a.replacement!.id)).toBe(false);
    expect(b.replacement).toBeNull();
  });
});

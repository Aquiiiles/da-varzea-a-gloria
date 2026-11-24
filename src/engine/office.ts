import { SEAT_PACKS, STADIUM_FINANCE, TIERS, seatCost } from '../data/pyramid';
import { scaled } from './effects';
import { seasonFinance } from './finance';
import { marketValue, marketWage, round1 } from './footballers';
import type { Effect, Footballer, GameState, Tier } from './types';

/* ------------------------------ Custos (também usados pela UI) ------------------------------ */

export function seatsFor(capacity: number, size: 0 | 1 | 2): { seats: number; cost: number; down: number; perSeason: number } {
  const pack = SEAT_PACKS[size];
  const seats = Math.max(pack.min, Math.round((capacity * pack.pct) / 100) * 100);
  const cost = Math.round(seats * seatCost(capacity));
  const down = Math.round(cost * STADIUM_FINANCE.down);
  const perSeason = Math.round(((cost - down) * (1 + STADIUM_FINANCE.interest)) / STADIUM_FINANCE.seasons);
  return { seats, cost, down, perSeason };
}

export function loanFor(tier: Tier, size: 0 | 1): { amount: number; perSeason: number } {
  const amount = Math.round([15, 40][size] * TIERS[tier].moneyScale);
  return { amount, perSeason: -Math.round((amount * 1.3) / 3) };
}

export function sellPrice(state: GameState, id: number): number {
  const f = state.player.squad.find((x) => x.id === id);
  return f ? Math.round(marketValue(f) * 0.85) : 0;
}

/** Multa para dispensar: metade dos salários restantes do contrato. */
export function releaseCost(state: GameState, id: number): number {
  const f = state.player.squad.find((x) => x.id === id);
  return f ? Math.round(f.wage * f.contract * 0.5) : 0;
}

/**
 * Salário na renovação: valor de mercado do overall ATUAL (veterano em queda aceita redução).
 * Quem evoluiu pede 10% a mais; cria da base aceita 5% a menos.
 */
/** Aumento máximo numa renovação (fração do salário atual). Crias da casa pedem menos. */
export const MAX_RAISE = { normal: 0.4, homegrown: 0.3 };
/** Salário pode cair no máximo 20% numa renovação (veterano em queda). */
export const MAX_CUT = 0.2;

/** Quanto o jogador valeria no mercado se renovasse sem limite (base para decidir se ele quer um clube maior). */
export function renewTarget(ovr: number, currentWage: number, homegrown = false): number {
  const market = marketWage(ovr);
  const mult = homegrown ? 0.95 : market > currentWage ? 1.1 : 1;
  return round1(market * mult);
}

/**
 * Salário da renovação: o de mercado, mas com aumento de no máximo 40% (30% para crias da casa)
 * e redução de no máximo 20%. Na vida real ninguém dobra o salário numa renovação.
 */
export function renewWage(ovr: number, currentWage: number, homegrown = false): number {
  const target = renewTarget(ovr, currentWage, homegrown);
  if (currentWage <= 0) return target;
  const hi = currentWage * (1 + (homegrown ? MAX_RAISE.homegrown : MAX_RAISE.normal));
  const lo = currentWage * (1 - MAX_CUT);
  return round1(Math.min(hi, Math.max(lo, target)));
}

export function effectsCashCost(state: GameState, effects: readonly Effect[]): number {
  let c = 0;
  for (const e of effects) if (e.type === 'add' && e.stat === 'cash') c += scaled(state, e.value, e.scale);
  return c < 0 ? -c : 0;
}

/** Jogos em casa esperados na temporada (estadual + série nacional). */
export function expectedHomeGames(p: GameState['player']): number {
  const est = p.stateDiv === 'A' ? 8 : p.stateDiv === 'B' ? 8 : p.stateDiv === 'V' ? 10 : 0;
  const nat = p.national === 1 || p.national === 2 ? 19 : p.national === 3 ? 11 : p.national === 4 ? 4 : 0;
  return est + nat;
}

/** Projeção das finanças da temporada (campanha de meio de tabela). */
export function projectFinance(state: GameState) {
  const p = state.player;
  return seasonFinance(p, p.tier, expectedHomeGames(p), 10, 20);
}


/**
 * Proposta de renovação antecipada (ou para convencer quem quer sair).
 * Quem quer sair aceita ganhando 30% acima do mercado; quem cresceu demais exige salário de clube grande.
 */
export function renewalOffer(f: Footballer): { wage: number; label: string } | null {
  if (f.intent === 'aposenta') return null;
  const base = f.askWage ?? renewWage(f.ovr, f.wage, f.homegrown);
  if (f.intent === 'sai') return { wage: round1(base * 1.3), label: 'Convencer a ficar' };
  // cobrir a proposta do clube maior: o salário de mercado dele, mas no máximo 2,5x o atual (ninguém pede 10x)
  if (f.intent === 'clube_maior') {
    const target = Math.max(base, marketWage(f.ovr) * 1.15) * 1.1;
    return { wage: round1(Math.max(base, Math.min(target, f.wage * 2.5))), label: 'Cobrir a proposta do clube maior' };
  }
  return { wage: base, label: 'Renovar agora' };
}

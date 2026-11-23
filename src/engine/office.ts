import { SEAT_PACKS, TIERS, seatCost } from '../data/pyramid';
import { scaled } from './effects';
import { seasonFinance } from './finance';
import { marketValue, marketWage, round1 } from './footballers';
import type { Effect, GameState, Tier } from './types';

/* ------------------------------ Custos (também usados pela UI) ------------------------------ */

export function seatsFor(capacity: number, size: 0 | 1 | 2): { seats: number; cost: number } {
  const pack = SEAT_PACKS[size];
  const seats = Math.max(pack.min, Math.round((capacity * pack.pct) / 100) * 100);
  return { seats, cost: Math.round(seats * seatCost(capacity)) };
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

/** Salário pedido na renovação: o de mercado + 10%. Cria da base aceita o valor de mercado, sem os 10%. */
export function renewWage(ovr: number, currentWage: number, homegrown = false): number {
  return round1(Math.max(currentWage, marketWage(ovr) * (homegrown ? 1 : 1.1)));
}

export function effectsCashCost(state: GameState, effects: readonly Effect[]): number {
  let c = 0;
  for (const e of effects) if (e.type === 'add' && e.stat === 'cash') c += scaled(state, e.value, e.scale);
  return c < 0 ? -c : 0;
}

/** Projeção das finanças da temporada (posição no meio da tabela). */
export function projectFinance(state: GameState) {
  const p = state.player;
  const size = TIERS[p.tier].size;
  return seasonFinance(p, p.tier, size - 1, Math.ceil(size / 2), size);
}


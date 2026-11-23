import { TIERS } from '../data/pyramid';
import type { FinanceReport, PlayerClub } from './types';

/** Folha salarial anual (mil £) cresce exponencialmente com a força do elenco. */
export function wageBill(strength: number): number {
  return Math.round(4 * Math.pow(1.075, strength));
}

export function ticketPrice(tier: PlayerClub['tier']): number {
  void tier;
  return 0.0024;
}

export function attendance(p: PlayerClub): number {
  return Math.min(p.capacity, p.fans);
}

/** Calcula as finanças da temporada que acabou de ser jogada (na divisão `tier`). */
export function seasonFinance(p: PlayerClub, homeGames: number): FinanceReport {
  const rules = TIERS[p.tier];
  const tickets = Math.round(attendance(p) * homeGames * ticketPrice(p.tier));
  const merch = Math.round(p.hype * 0.15 * rules.moneyScale);
  const tv = rules.tv + merch;
  const sponsors = p.sponsors.reduce((sum, s) => sum + s.perSeason, 0);
  const wages = wageBill(p.strength);
  const staffLevels = p.staff.coach + p.staff.scout + p.staff.fitness + p.staff.academy;
  const upkeep = Math.round(p.capacity * 0.0015 + staffLevels * 1.5 * rules.moneyScale);
  const net = tickets + tv + sponsors - wages - upkeep;
  return { tickets, tv, sponsors, wages, upkeep, net, cashEnd: p.cash + net };
}

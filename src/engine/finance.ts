import { FACILITY_COST, FACILITY_UPKEEP_RATE, SEAT_UPKEEP, STAFF_WAGE, TIERS } from '../data/pyramid';
import { commerce, moodAttendance } from './clubops';
import type { FinanceReport, PlayerClub, Tier } from './types';

/** Política de ingresso: multiplicador de preço e de procura. */
export const TICKET_POLICY = [
  { label: 'Popular', price: 0.7, demand: 1.2, fanGrowth: 0.04, soul: 1 },
  { label: 'Normal', price: 1, demand: 1, fanGrowth: 0, soul: 0 },
  { label: 'Caro', price: 1.5, demand: 0.75, fanGrowth: -0.05, soul: -1 },
] as const;

export function payroll(p: PlayerClub): number {
  return p.squad.reduce((s, f) => s + f.wage, 0) + p.youth.reduce((s, f) => s + f.wage, 0) + p.onLoan.reduce((s, f) => s + (f.recovering ? f.wage : 0), 0);
}

export function staffCost(p: PlayerClub): number {
  return p.coach.wage + STAFF_WAGE[p.staff.scout] + STAFF_WAGE[p.staff.fitness];
}

export function facilityInvested(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += FACILITY_COST[i];
  return total;
}

export function upkeep(p: PlayerClub): number {
  const fac = facilityInvested(p.facilities.ct) + facilityInvested(p.facilities.academy) + facilityInvested(p.facilities.medical);
  return Math.round(p.capacity * SEAT_UPKEEP + fac * FACILITY_UPKEEP_RATE);
}

export function attendance(p: PlayerClub): number {
  return Math.round(Math.min(p.capacity, p.fans * TICKET_POLICY[p.ticket].demand * moodAttendance(p.mood)));
}

/** Patrocínio master: depende da divisão, do tamanho da torcida e do hype. */
export function masterSponsor(p: PlayerClub, tier: Tier): number {
  const r = TIERS[tier];
  const fanRatio = Math.min(1.6, Math.sqrt(p.fans / r.typicalFans));
  return Math.round(r.sponsor * (0.5 + 0.4 * fanRatio) * (1 + p.hype / 250) * (0.9 + p.mood / 500));
}

/**
 * Finanças de uma temporada. `position`/`size` dão a premiação por colocação
 * (use a posição esperada para projeções).
 */
/** Sócios-torcedores: uma fatia da torcida que cresce com o humor. */
export function socios(p: PlayerClub): number {
  return Math.round(p.fans * (0.03 + p.mood / 1000));
}

/** Arena: ingresso mais caro (camarotes e conforto) e, na multiuso, receita de shows e eventos. */
export const ARENA = {
  arena: { cost: 120000, seats: 15000, ticket: 1.2, label: 'Arena moderna', text: 'Estádio novo com camarotes: +15 mil lugares e ingresso 20% mais rentável.' },
  multiuso: { cost: 300000, seats: 10000, ticket: 1.35, label: 'Arena multiuso', text: 'Cobertura e estrutura para shows: +10 mil lugares, ingresso 35% mais rentável e receita de eventos o ano todo.' },
  naming: { perSeason: 12000, seasons: 10, label: 'Naming rights', text: 'Vende o nome da arena para uma empresa: R$ 12 mi por temporada durante 10 temporadas.' },
} as const;

export function seasonFinance(p: PlayerClub, tier: Tier, homeGames: number, position: number, size: number, prizes = 0, idolGoals = 0): FinanceReport {
  const r = TIERS[tier];
  const att = attendance(p);
  const arenaMult = p.arena === 2 ? ARENA.multiuso.ticket : p.arena === 1 ? ARENA.arena.ticket : 1;
  const tickets = Math.round(att * homeGames * r.ticket * TICKET_POLICY[p.ticket].price * arenaMult);
  const nSocios = socios(p);
  const members = Math.round(nSocios * r.ticket * 6);
  const events = p.arena === 2 ? Math.round(r.tv * 0.08) : 0;
  const prize = Math.round(r.tv * 0.4 * ((size - position) / (size - 1)));
  const tv = r.tv + prize;
  const sponsors = masterSponsor(p, tier) + p.sponsors.reduce((sum, s) => sum + s.perSeason, 0);
  const wages = Math.round(payroll(p));
  const staff = staffCost(p);
  const shop = commerce(p, att, homeGames, idolGoals);
  const up = upkeep(p) + shop.upkeep;
  const net = tickets + tv + sponsors + shop.revenue + prizes + members + events - wages - staff - up;
  return { tickets, tv, sponsors, wages, staff, upkeep: up, commerce: shop.revenue, prizes, members, socios: nSocios, events, net, cashEnd: p.cash + net, attendance: att };
}

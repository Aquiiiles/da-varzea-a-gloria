import { BUSINESSES, BUSINESS_UPKEEP_RATE, COACH_FIRST, COACH_WAGE } from '../data/club';
import { LAST_NAMES } from '../data/names';
import { TIERS } from '../data/pyramid';
import type { Rng } from './rng';
import { clamp } from './util';
import type { BusinessId, Coach, CoachStyle, Footballer, Objective, PlayerClub, Tier } from './types';

/* ------------------------------ Técnico ------------------------------ */

const STYLES: CoachStyle[] = ['ofensivo', 'retranqueiro', 'formador', 'motivador', 'estrategista'];

export function startingCoach(): Coach {
  return { name: 'Seu Zé', style: 'motivador', rating: 0, wage: 0, age: 58 };
}

/** 3 candidatos por janela; o nível típico acompanha a divisão do clube. */
export function coachCandidates(rng: Rng, tier: Tier): Coach[] {
  const base = clamp(Math.round((8 - tier) / 2), 0, 3);
  const out: Coach[] = [];
  const styles = rng.shuffle(STYLES);
  for (let i = 0; i < 3; i++) {
    const rating = clamp(base + rng.int(-1, 1) + (i === 0 ? 1 : 0), 0, 4);
    out.push({
      name: `${rng.pick(COACH_FIRST)} ${rng.pick(LAST_NAMES)}`,
      style: styles[i],
      rating,
      wage: Math.round(COACH_WAGE[rating] * rng.float(0.85, 1.3)),
      age: rng.int(34, 66),
    });
  }
  return out;
}

/** Multa para trocar de técnico: metade do salário anual do atual. */
export function coachSeverance(c: Coach): number {
  return Math.round(c.wage * 0.5);
}

/* ------------------------------ Comércio local ------------------------------ */

export function businessInvested(id: BusinessId, level: number): number {
  const info = BUSINESSES.find((b) => b.id === id)!;
  let total = 0;
  for (let i = 0; i < level; i++) total += info.cost[i];
  return total;
}

export interface CommerceReport {
  revenue: number;
  upkeep: number;
  byBusiness: Record<BusinessId, number>;
}

/** Receita anual do comércio. `attendance` = público médio; `homeGames` = jogos em casa. */
export function commerce(p: PlayerClub, attendance: number, homeGames: number, idolGoals: number): CommerceReport {
  const b = p.businesses;
  const crowd = attendance * homeGames; // total de torcedores na temporada
  const by: Record<BusinessId, number> = {
    bar: crowd * 0.001 * b.bar,
    foodtruck: crowd * 0.0006 * b.foodtruck * (1 + p.hype / 100),
    loja: p.fans * 0.004 * b.loja * (1 + p.hype / 120) * (idolGoals >= 40 ? 1.3 : 1),
    estacionamento: Math.max(0, attendance - 1500) * homeGames * 0.0012 * b.estacionamento,
    escolinha: 4 * b.escolinha * Math.sqrt(TIERS[p.tier].moneyScale),
  };
  let revenue = 0;
  let invested = 0;
  for (const info of BUSINESSES) {
    by[info.id] = Math.round(by[info.id]);
    revenue += by[info.id];
    invested += businessInvested(info.id, b[info.id]);
  }
  return { revenue, upkeep: Math.round(invested * BUSINESS_UPKEEP_RATE), byBusiness: by };
}

/* ------------------------------ Torcedômetro ------------------------------ */

/** Multiplicador de público pelo humor da torcida (0,85 a 1,15). */
export function moodAttendance(mood: number): number {
  return 0.85 + mood / 333;
}

export function moodLabel(mood: number): string {
  if (mood >= 85) return 'Em festa';
  if (mood >= 65) return 'Animada';
  if (mood >= 45) return 'Desconfiada';
  if (mood >= 25) return 'Impaciente';
  return 'Em protesto';
}

/* ------------------------------ Objetivos ------------------------------ */

/** Posição esperada pela força: quantos clubes da divisão são mais fortes + 1. */
export function expectedRank(teamStrength: number, rivals: number[]): number {
  return 1 + rivals.filter((s) => s > teamStrength).length;
}

export function seasonObjectives(rng: Rng, tier: Tier, expected: number, rivalSameTier: boolean): Objective[] {
  const r = TIERS[tier];
  const size = r.size;
  const out: Objective[] = [];
  if (tier === 1) {
    if (expected <= 2) out.push({ kind: 'titulo', text: 'Diretoria: ser campeão da Premier', main: true, target: 1 });
    else if (expected <= 6) out.push({ kind: 'top4', text: 'Diretoria: terminar no top 4 (vaga na Copa dos Campeões)', main: true, target: 4 });
    else if (expected <= size - 6) out.push({ kind: 'meio', text: `Diretoria: terminar até o ${Math.ceil(size / 2) + 2}º lugar`, main: true, target: Math.ceil(size / 2) + 2 });
    else out.push({ kind: 'nao_cair', text: 'Diretoria: não cair', main: true, target: size - r.down });
  } else {
    const poEnd = r.playoff ? r.playoff[1] : r.autoUp;
    if (expected <= r.autoUp + 1) out.push({ kind: 'subir', text: 'Diretoria: conquistar o acesso', main: true, target: r.autoUp });
    else if (expected <= Math.ceil(size / 3)) out.push({ kind: 'brigar', text: `Diretoria: brigar pelo acesso (terminar até o ${poEnd}º)`, main: true, target: poEnd });
    else if (expected <= Math.ceil(size * 0.75)) out.push({ kind: 'meio', text: `Diretoria: terminar até o ${Math.ceil(size / 2) + 2}º lugar`, main: true, target: Math.ceil(size / 2) + 2 });
    else out.push({ kind: 'nao_cair', text: tier === 8 ? 'Diretoria: sair da lanterna (até o 15º)' : 'Diretoria: não cair', main: true, target: tier === 8 ? 15 : size - r.down });
  }
  const bonus: Objective[] = [
    { kind: 'copa', text: 'Torcida: passar de duas fases na Copa Nacional', main: false, target: 3 },
    { kind: 'base', text: 'Torcida: ter 2 crias da base no time titular', main: false, target: 2 },
    { kind: 'casa', text: 'Torcida: estádio com 90% de ocupação média', main: false, target: 90 },
  ];
  if (rivalSameTier) bonus.push({ kind: 'classico', text: 'Torcida: não perder o clássico na temporada', main: false, target: 0 });
  out.push(rng.pick(bonus));
  return out;
}

export function homegrownInXI(squad: readonly Footballer[], xi: Set<number>): number {
  return squad.filter((f) => f.homegrown && xi.has(f.id)).length;
}

import { TIERS } from '../data/pyramid';
import { FIRST_NAMES, LAST_NAMES } from '../data/names';
import { clamp } from './util';
import type { Rng } from './rng';
import type { Footballer, Position, Tier } from './types';

/** Pontos (overall, salário anual em mil £) — interpolação em escala log. */
const WAGE_CURVE: [number, number][] = [
  [30, 0.5], [35, 0.8], [40, 1.5], [45, 3], [50, 5.5], [54, 10], [58, 22], [62, 50],
  [66, 130], [70, 320], [74, 950], [78, 5500], [82, 11000], [86, 20000], [90, 32000], [99, 50000],
];

export function marketWage(ovr: number): number {
  const o = clamp(ovr, WAGE_CURVE[0][0], WAGE_CURVE[WAGE_CURVE.length - 1][0]);
  for (let i = 1; i < WAGE_CURVE.length; i++) {
    const [x1, y1] = WAGE_CURVE[i];
    if (o <= x1) {
      const [x0, y0] = WAGE_CURVE[i - 1];
      const t = (o - x0) / (x1 - x0);
      return round1(Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0))));
    }
  }
  return WAGE_CURVE[WAGE_CURVE.length - 1][1];
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function ageFactor(age: number): number {
  if (age <= 21) return 1.7;
  if (age <= 25) return 1.35;
  if (age <= 29) return 1;
  if (age <= 32) return 0.55;
  return 0.25;
}

/** Valor de mercado (mil £). */
export function marketValue(p: Footballer): number {
  const upside = Math.max(0, p.pot - p.ovr) / 15;
  return Math.max(1, Math.round(marketWage(p.ovr) * 2.5 * ageFactor(p.age) * (1 + upside)));
}

/** Faixa de potencial vista pelo olheiro: nível 0 = ±12, nível 4 = exato. */
export function scoutRange(rng: Rng, pot: number, scout: number): [number, number] {
  const width = [12, 8, 5, 3, 0][clamp(scout, 0, 4)];
  if (width === 0) return [pot, pot];
  const offset = rng.int(-width, width);
  const center = pot + Math.round(offset / 2);
  return [clamp(center - width, 30, 99), clamp(center + width, 30, 99)];
}

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

const POS_WEIGHTS: [Position, number][] = [['GOL', 2], ['DEF', 7], ['MEI', 7], ['ATA', 4]];

export interface NewPlayerOpts {
  id: number;
  ovr: number;
  age: number;
  pos?: Position;
  /** potencial mínimo acima do overall */
  potBoost?: number;
  scout: number;
  season: number;
  contract?: number;
  homegrown?: boolean;
  wageMult?: number;
}

export function makeFootballer(rng: Rng, o: NewPlayerOpts): Footballer {
  const pos = o.pos ?? rng.weighted(POS_WEIGHTS, (x) => x[1])[0];
  const ovr = Math.round(clamp(o.ovr, 25, 95));
  // margem de crescimento depende da idade
  const room = o.age <= 18 ? rng.int(8, 26) : o.age <= 21 ? rng.int(4, 16) : o.age <= 25 ? rng.int(0, 8) : rng.int(0, 2);
  const pot = clamp(ovr + room + (o.potBoost ?? 0), ovr, 95);
  const [potLo, potHi] = scoutRange(rng, pot, o.scout);
  return {
    id: o.id,
    name: personName(rng),
    pos,
    age: o.age,
    ovr,
    pot,
    potLo,
    potHi,
    wage: round1(marketWage(ovr) * (o.wageMult ?? 1)),
    contract: o.contract ?? 3,
    goals: 0,
    apps: 0,
    joined: o.season,
    homegrown: o.homegrown ?? false,
  };
}

/** Elenco inicial de um clube de várzea. */
export function foundingSquad(rng: Rng, mean: number, firstId: number): Footballer[] {
  const plan: Position[] = ['GOL', 'GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA', 'ATA'];
  return plan.map((pos, i) =>
    makeFootballer(rng, {
      id: firstId + i,
      pos,
      ovr: mean + rng.normal(2.5),
      age: rng.int(18, 33),
      scout: 0,
      season: 1,
      contract: rng.int(1, 3),
    }),
  );
}

/* ------------------------------ Time titular ------------------------------ */

const FORMATION: Record<Position, number> = { GOL: 1, DEF: 4, MEI: 4, ATA: 2 };
/** Penalidade de jogar fora de posição. */
const OUT_OF_POSITION = 8;

/** Melhor XI no 4-4-2. Retorna ids e o overall efetivo de cada vaga. */
export function bestEleven(squad: readonly Footballer[]): { ids: Set<number>; ratings: number[] } {
  const sorted = squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
  const used = new Set<number>();
  const ratings: number[] = [];
  for (const pos of ['GOL', 'DEF', 'MEI', 'ATA'] as Position[]) {
    let need = FORMATION[pos];
    for (const p of sorted) {
      if (need === 0) break;
      if (p.pos === pos && !used.has(p.id)) {
        used.add(p.id);
        ratings.push(p.ovr);
        need--;
      }
    }
    // faltou gente na posição: improvisa
    for (const p of sorted) {
      if (need === 0) break;
      if (!used.has(p.id)) {
        used.add(p.id);
        ratings.push(p.ovr - OUT_OF_POSITION);
        need--;
      }
    }
    while (need-- > 0) ratings.push(30); // nem improviso dá: completa com amador
  }
  return { ids: used, ratings };
}

/** Força do time = média do XI + profundidade do banco (até ±1). */
export function squadStrength(squad: readonly Footballer[]): number {
  if (squad.length === 0) return 30;
  const { ids, ratings } = bestEleven(squad);
  const xi = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  const bench = squad.filter((p) => !ids.has(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 7);
  const benchAvg = bench.length > 0 ? bench.reduce((s, p) => s + p.ovr, 0) / bench.length : xi - 15;
  const depth = clamp((benchAvg - (xi - 6)) / 6, -1, 0.5);
  return round1(xi + depth);
}

/* ------------------------------ Evolução anual ------------------------------ */

export interface GrowthContext {
  ct: number; // 0–5
  fitness: number; // staff 0–4
  inEleven: boolean;
  youth?: boolean;
  academy?: number;
}

export function develop(rng: Rng, p: Footballer, ctx: GrowthContext): void {
  const a = p.age;
  let delta: number;
  if (a <= 20) delta = 3.5;
  else if (a <= 23) delta = 2.5;
  else if (a <= 26) delta = 1.2;
  else if (a <= 29) delta = 0.2;
  else if (a <= 31) delta = -1;
  else if (a <= 33) delta = -2.2;
  else delta = -3.8;
  if (a <= 26) delta += ctx.ct * 0.35 + (ctx.inEleven ? 0.6 : 0);
  if (ctx.youth) delta += 1 + (ctx.academy ?? 0) * 0.4;
  if (delta < 0) delta += ctx.fitness * 0.3;
  delta += rng.normal(1.2);
  let next = p.ovr + delta;
  // jovens não passam do potencial; veteranos podem cair abaixo dele
  if (next > p.pot) next = p.pot + Math.min(0, delta);
  p.ovr = Math.round(clamp(next, 25, 95));
  p.age += 1;
}

export function retires(rng: Rng, p: Footballer): boolean {
  if (p.age < 34) return false;
  return rng.chance(0.35 + (p.age - 34) * 0.25);
}

/** Garotos que aparecem na base a cada temporada. */
export function youthIntake(rng: Rng, academy: number, scout: number, tier: Tier, nextId: () => number, season: number): Footballer[] {
  const count = 1 + Math.floor(academy / 2) + (rng.chance(0.5) ? 1 : 0);
  const out: Footballer[] = [];
  for (let i = 0; i < count; i++) {
    const age = rng.int(15, 17);
    const base = 34 + academy * 2.5 + (8 - tier) * 0.6;
    const p = makeFootballer(rng, {
      id: nextId(),
      ovr: base + rng.normal(4),
      age,
      potBoost: academy * 3 + (rng.chance(0.08) ? 10 : 0),
      scout,
      season,
      contract: 3,
      homegrown: true,
      wageMult: 0,
    });
    p.wage = youthWage(tier);
    out.push(p);
  }
  return out;
}

/** Bolsa anual de um garoto da base. */
export function youthWage(tier: Tier): number {
  return round1(0.6 * Math.sqrt(TIERS[tier].moneyScale));
}

/** Candidatos da peneira. Sem base forte, mais loteria; olheiro melhora a leitura. */
export function tryoutCandidates(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number): Footballer[] {
  const out: Footballer[] = [];
  const mean = TIERS[tier].meanStrength;
  for (let i = 0; i < 5; i++) {
    const age = rng.int(16, 21);
    const p = makeFootballer(rng, {
      id: nextId(),
      ovr: mean - 14 + (age - 16) * 1.5 + rng.normal(4),
      age,
      potBoost: rng.chance(0.12) ? rng.int(6, 14) : 0,
      scout,
      season,
      contract: 3,
      homegrown: true,
      wageMult: 0,
    });
    p.wage = youthWage(tier);
    out.push(p);
  }
  return out;
}

export function tryoutCost(tier: Tier): number {
  return Math.round(8 * Math.sqrt(TIERS[tier].moneyScale));
}

/** Mercado da temporada: 8 jogadores em torno do nível da divisão. */
export function marketListings(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number, clubNames: string[]) {
  const mean = TIERS[tier].meanStrength;
  const out = [];
  for (let i = 0; i < 8; i++) {
    const free = i === 7; // sempre um jogador sem clube (sem taxa, salário alto, veterano)
    const age = free ? rng.int(29, 34) : rng.int(18, 32);
    const ovr = mean + (free ? rng.int(-2, 3) : rng.int(-4, 7)) + (scout >= 3 ? 1 : 0);
    const p = makeFootballer(rng, { id: nextId(), ovr, age, scout, season, contract: free ? 1 : 3, wageMult: free ? 1.4 : rng.float(1, 1.25) });
    const fee = free ? 0 : Math.round(marketValue(p) * rng.float(1.05, 1.35));
    out.push({ player: p, fee, from: free ? 'Sem clube' : rng.pick(clubNames) });
  }
  return out;
}

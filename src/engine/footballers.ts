import { TIERS } from '../data/pyramid';
import { personName as brName } from './names';
import { clamp } from './util';
import type { Rng } from './rng';
import type { Footballer, Formation, Listing, ListingProfile, Offer, Position, Tier } from './types';

/**
 * Pontos (overall, salário anual em R$ mil) — interpolação em escala log.
 * Várzea ~R$ 1 mil/mês; Série A média ~R$ 330 mil/mês; craque 86 ~R$ 2,5 mi/mês.
 */
const WAGE_CURVE: [number, number][] = [
  [30, 2], [35, 4], [40, 8], [45, 15], [50, 30], [54, 55], [58, 110], [62, 240],
  [66, 520], [70, 1300], [74, 4000], [78, 9000], [82, 18000], [86, 30000], [90, 45000], [99, 70000],
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

export function personName(rng: Rng, taken?: Set<string>): string {
  return brName(rng, taken);
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
  /** nomes já usados (evita repetição) */
  names?: Set<string>;
}

export function makeFootballer(rng: Rng, o: NewPlayerOpts): Footballer {
  const pos = o.pos ?? rng.weighted(POS_WEIGHTS, (x) => x[1])[0];
  const ovr = Math.round(clamp(o.ovr, 25, 95));
  // margem de crescimento depende da idade
  const room = o.age <= 18 ? rng.int(6, 22) : o.age <= 21 ? rng.int(3, 14) : o.age <= 25 ? rng.int(0, 7) : rng.int(0, 2);
  const pot = clamp(ovr + room + (o.potBoost ?? 0), ovr, 95);
  const [potLo, potHi] = scoutRange(rng, pot, o.scout);
  return {
    id: o.id,
    name: personName(rng, o.names),
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
export function foundingSquad(rng: Rng, mean: number, firstId: number, names?: Set<string>): Footballer[] {
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
      names,
    }),
  );
}

/* ------------------------------ Time titular ------------------------------ */

/** Vagas por posição em cada esquema. */
export const FORMATIONS: Record<Formation, Record<Position, number>> = {
  '4-4-2': { GOL: 1, DEF: 4, MEI: 4, ATA: 2 },
  '4-3-3': { GOL: 1, DEF: 4, MEI: 3, ATA: 3 },
  '3-5-2': { GOL: 1, DEF: 3, MEI: 5, ATA: 2 },
  '4-5-1': { GOL: 1, DEF: 4, MEI: 5, ATA: 1 },
};
/** Penalidade de jogar fora de posição. */
const OUT_OF_POSITION = 8;

/** Melhor XI no 4-4-2. Retorna ids e o overall efetivo de cada vaga. */
export function bestEleven(squad: readonly Footballer[], formation: Formation = '4-4-2'): { ids: Set<number>; ratings: number[] } {
  const FORMATION = FORMATIONS[formation];
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

/** Vagas de um esquema, na ordem do goleiro ao ataque (a mesma do campinho). */
export function formationSlots(formation: Formation): Position[] {
  const f = FORMATIONS[formation];
  return (['GOL', 'DEF', 'MEI', 'ATA'] as Position[]).flatMap((pos) => Array(f[pos]).fill(pos) as Position[]);
}

/** Quanto um jogador perde jogando fora da posição de origem. */
export function positionPenalty(slot: Position, pos: Position): number {
  if (slot === pos) return 0;
  if (slot === 'GOL' || pos === 'GOL') return 20;
  if ((slot === 'DEF' && pos === 'ATA') || (slot === 'ATA' && pos === 'DEF')) return 8;
  return 4;
}

/**
 * Força de uma escalação com cada um na vaga escolhida (ids na ordem das vagas do esquema).
 * Quem joga fora de posição rende menos. Devolve null se a escalação não tiver os 11.
 */
export function lineupStrength(squad: readonly Footballer[], formation: Formation, ids: readonly number[]): number | null {
  const slots = formationSlots(formation);
  if (ids.length !== slots.length) return null;
  const byId = new Map(squad.map((f) => [f.id, f]));
  const xi = ids.map((id) => byId.get(id));
  if (xi.some((f) => !f)) return null;
  const ratings = xi.map((f, i) => f!.ovr - positionPenalty(slots[i], f!.pos));
  const mean = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  const used = new Set(ids);
  const bench = squad.filter((f) => !used.has(f.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 7);
  const benchAvg = bench.length > 0 ? bench.reduce((s, f) => s + f.ovr, 0) / bench.length : mean - 15;
  const depth = clamp((benchAvg - (mean - 6)) / 6, -1, 0.5);
  return round1(mean + depth);
}

/** Força do time = média do XI + profundidade do banco (até ±1). */
export function squadStrength(squad: readonly Footballer[], formation: Formation = '4-4-2'): number {
  if (squad.length === 0) return 30;
  const { ids, ratings } = bestEleven(squad, formation);
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
  if (a <= 20) delta = 2.6;
  else if (a <= 23) delta = 1.7;
  else if (a <= 26) delta = 0.7;
  else if (a <= 29) delta = 0.2;
  else if (a <= 31) delta = -1;
  else if (a <= 33) delta = -2.2;
  else delta = -3.8;
  if (a <= 26) delta += ctx.ct * 0.3 + (ctx.inEleven ? 0.4 : 0);
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
export function youthIntake(rng: Rng, academy: number, scout: number, tier: Tier, nextId: () => number, season: number, names?: Set<string>): Footballer[] {
  const count = 1 + Math.floor(academy / 2) + (rng.chance(0.5) ? 1 : 0);
  const out: Footballer[] = [];
  for (let i = 0; i < count; i++) {
    const age = rng.int(15, 17);
    const base = 34 + academy * 2.5 + (7 - tier) * 0.6;
    const p = makeFootballer(rng, {
      id: nextId(),
      ovr: base + rng.normal(4),
      age,
      potBoost: academy * 2 + (rng.chance(0.06) ? 8 : 0),
      scout,
      season,
      contract: 3,
      homegrown: true,
      wageMult: 0,
      names,
    });
    p.wage = youthWage(tier);
    out.push(p);
  }
  return out;
}

/** Bolsa anual de um garoto da base. */
export function youthWage(tier: Tier): number {
  return round1(1.2 * Math.sqrt(TIERS[tier].moneyScale));
}

/** Candidatos da peneira. Sem base forte, mais loteria; olheiro melhora a leitura. */
export function tryoutCandidates(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number, names?: Set<string>): Footballer[] {
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
      names,
    });
    p.wage = youthWage(tier);
    out.push(p);
  }
  return out;
}

export function tryoutCost(tier: Tier): number {
  return Math.round(8 * Math.sqrt(TIERS[tier].moneyScale));
}

interface ProfileSpec {
  profile: ListingProfile;
  count: number;
  age: [number, number];
  rel: [number, number];
  potBoost: number;
  wage: [number, number];
  fee: [number, number];
  contract: [number, number];
}

/** Composição do mercado: 12 jogadores por janela. */
const MARKET_MIX: ProfileSpec[] = [
  { profile: 'promessa', count: 3, age: [17, 21], rel: [-7, -1], potBoost: 4, wage: [1, 1.15], fee: [1.1, 1.5], contract: [3, 4] },
  { profile: 'pronto', count: 5, age: [23, 29], rel: [-3, 4], potBoost: 0, wage: [1.05, 1.3], fee: [1.1, 1.4], contract: [2, 3] },
  { profile: 'veterano', count: 2, age: [30, 33], rel: [-1, 4], potBoost: 0, wage: [1.3, 1.6], fee: [1, 1.3], contract: [1, 2] },
  { profile: 'livre', count: 2, age: [28, 34], rel: [-4, 2], potBoost: 0, wage: [1.4, 1.7], fee: [0, 0], contract: [1, 1] },
];

export function marketListings(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number, clubNames: string[], names?: Set<string>): Listing[] {
  const mean = TIERS[tier].meanStrength;
  const out: Listing[] = [];
  for (const spec of MARKET_MIX) {
    for (let i = 0; i < spec.count; i++) {
      const age = rng.int(spec.age[0], spec.age[1]);
      const ovr = mean + rng.int(spec.rel[0], spec.rel[1]) + (scout >= 3 ? 1 : 0);
      const p = makeFootballer(rng, {
        id: nextId(),
        ovr,
        age,
        potBoost: spec.potBoost,
        scout,
        season,
        contract: rng.int(spec.contract[0], spec.contract[1]),
        wageMult: rng.float(spec.wage[0], spec.wage[1]),
        names,
      });
      const fee = spec.fee[1] === 0 ? 0 : Math.round(marketValue(p) * rng.float(spec.fee[0], spec.fee[1]));
      out.push({ player: p, fee, from: spec.profile === 'livre' ? 'Sem clube' : rng.pick(clubNames), profile: spec.profile });
    }
  }
  return out;
}

/**
 * Propostas dos clubes da IA pelos seus jogadores. Destaques e jovens promissores atraem mais interesse;
 * clubes de divisões acima pagam acima do valor de mercado.
 */
export function incomingOffers(rng: Rng, squad: readonly Footballer[], tier: Tier, buyers: { name: string; tier: Tier }[]): Offer[] {
  const mean = TIERS[tier].meanStrength;
  const offers: Offer[] = [];
  const candidates = squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
  for (const f of candidates) {
    if (offers.length >= 3 || buyers.length === 0) break;
    const star = Math.max(0, f.ovr - mean) * 0.03;
    const prospect = f.age <= 23 && f.potHi >= mean + 5 ? 0.12 : 0;
    const leaving = f.intent === 'sai' || f.intent === 'clube_maior' ? 0.3 : 0;
    if (!rng.chance(Math.min(0.6, 0.03 + star + prospect + leaving))) continue;
    const buyer = rng.pick(buyers);
    const premium = 1 + (tier - buyer.tier) * 0.08;
    const fee = Math.round(marketValue(f) * rng.float(0.75, 1.15) * premium);
    offers.push({ playerId: f.id, fee, club: buyer.name, clubTier: buyer.tier, max: Math.round(fee * rng.float(1.05, 1.35)) });
  }
  return offers;
}

export interface Importance {
  /** está no time titular do esquema? */
  starter: boolean;
  /** posição no elenco por overall (1 = melhor) */
  rank: number;
  /** posição entre os da mesma posição e quantos há */
  posRank: number;
  posCount: number;
  /** quanto a força do time cai sem ele */
  delta: number;
  /** quem entra no time titular no lugar dele */
  replacement: Footballer | null;
  label: 'Peça-chave' | 'Titular importante' | 'Titular' | 'Reserva' | 'Pouco usado';
}

/** O quanto um jogador pesa no time: titular ou não, quanto a força cai sem ele e quem entra no lugar. */
export function playerImportance(squad: readonly Footballer[], formation: Formation, id: number): Importance {
  const f = squad.find((x) => x.id === id)!;
  const with_ = bestEleven(squad, formation).ids;
  const without = squad.filter((x) => x.id !== id);
  const withoutIds = bestEleven(without, formation).ids;
  const delta = Math.max(0, round1(squadStrength(squad, formation) - squadStrength(without, formation)));
  const sorted = squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
  const samePos = sorted.filter((x) => x.pos === f.pos);
  const replacement = with_.has(id) ? without.find((x) => withoutIds.has(x.id) && !with_.has(x.id)) ?? null : null;
  const starter = with_.has(id);
  const rank = sorted.findIndex((x) => x.id === id) + 1;
  const label: Importance['label'] = delta >= 1 ? 'Peça-chave' : starter && delta >= 0.4 ? 'Titular importante' : starter ? 'Titular' : rank > squad.length * 0.66 ? 'Pouco usado' : 'Reserva';
  return { starter, rank, posRank: samePos.findIndex((x) => x.id === id) + 1, posCount: samePos.length, delta, replacement, label };
}

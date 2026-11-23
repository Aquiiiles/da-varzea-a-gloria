import { ALL_TIERS, BOTTOM_TIER, SQUAD_MIN, START_YEAR, TIERS, YOUTH_AGE_LIMIT } from '../data/pyramid';
import { driftClub, makeClub } from './clubs';
import { nextId } from './effects';
import { TICKET_POLICY, seasonFinance } from './finance';
import { bestEleven, develop, makeFootballer, marketValue, retires, squadStrength } from './footballers';
import { simulateLeague, simulatePlayoff, type LeagueContext } from './league';
import { BASE_HOME_ADVANTAGE } from './match';
import { deriveRng, type Rng } from './rng';
import { clamp } from './util';
import type { Club, Footballer, GameState, MatchResult, Outcome, SeasonResult, Tier } from './types';

export const PLAYER_ID = 'player';
export const DEDUCTION_POINTS = 10;

export function playerHomeAdv(state: GameState): number {
  const p = state.player;
  const full = Math.min(p.capacity, p.fans) / Math.max(1, TIERS[p.tier].typicalFans);
  return BASE_HOME_ADVANTAGE + Math.min(1, full);
}

/** Força esperada do time (sem a sorte da temporada): XI + técnico + eventos. */
export function teamStrength(state: GameState): number {
  const p = state.player;
  return Math.round((squadStrength(p.squad) + p.staff.coach * 0.5 + p.formMod) * 10) / 10;
}

/** O clube pode jogar na divisão `tier` com esse estádio? */
export function stadiumAllows(capacity: number, tier: Tier): boolean {
  return capacity >= TIERS[tier].minStadium;
}

interface Movement {
  promoted: string[];
  relegated: string[];
}

/**
 * Simula UMA temporada completa (todas as divisões), aplica acesso/queda,
 * finanças e evolução do elenco. Muta `state` e devolve o resumo do clube do jogador.
 */
export function simulateSeason(state: GameState): SeasonResult {
  const p = state.player;
  const seed = state.seed;
  const season = state.season;
  const tier = p.tier;

  // sorte da temporada: lesões, fase, vestiário. Time de YouTuber oscila muito.
  const formRng = deriveRng(seed, season, 'form');
  const sd = (p.origin === 'youtuber' ? 2 : 0.9) * (1 - p.facilities.medical * 0.1);
  const form = formRng.normal(sd);
  const pStrength = teamStrength(state) + form;
  const pHome = playerHomeAdv(state);
  const rivalBonus = p.rivalHatred / 50;

  const byId = new Map<string, Club>();
  for (const t of ALL_TIERS) for (const c of state.world[t]) byId.set(c.id, c);

  const ctx: LeagueContext = {
    strength(id, opp) {
      if (id === PLAYER_ID) return pStrength;
      let s = byId.get(id)!.strength;
      if (opp === PLAYER_ID) {
        if (p.origin === 'youtuber') s += 1; // todo mundo quer ganhar do time do YouTuber
        if (id === p.rivalId) s += rivalBonus;
      }
      return s;
    },
    homeAdv(id) {
      return id === PLAYER_ID ? pHome : BASE_HOME_ADVANTAGE;
    },
  };

  // obras em andamento ficam prontas no fim da temporada: contam para a vistoria do acesso
  const capacityAtInspection = p.capacity + p.capacityBuilding;

  const moves = {} as Record<Tier, Movement>;
  let playerTable: SeasonResult['table'] = [];
  let playerMatches: MatchResult[] = [];
  let playerPlayoff: SeasonResult['playoff'];
  let barred = false;
  const deduction = p.pendingDeduction;

  for (const t of ALL_TIERS) {
    const rules = TIERS[t];
    const ids = state.world[t].map((c) => c.id);
    if (t === tier) ids.push(PLAYER_ID);
    const run = simulateLeague(deriveRng(seed, season, 'league', t), ids, ctx, t === tier ? { [PLAYER_ID]: deduction } : {});
    const order = run.table.map((r) => r.clubId);

    const promoted: string[] = [];
    if (t > 1) {
      const target = (t - 1) as Tier;
      const eligible = (id: string) => id !== PLAYER_ID || stadiumAllows(capacityAtInspection, target);
      for (let i = 0; i < order.length && promoted.length < rules.autoUp; i++) {
        if (eligible(order[i])) promoted.push(order[i]);
        else barred = true;
      }
      if (rules.playoff) {
        // o jogador barrado nas vagas diretas não entra; quem já está na zona de playoff joga e é barrado se vencer
        const group = order.filter((id) => !promoted.includes(id) && !(id === PLAYER_ID && barred)).slice(0, 4);
        const po = simulatePlayoff(deriveRng(seed, season, 'playoff', t), group, ctx);
        let winner = po.winner;
        if (!eligible(winner)) {
          barred = true;
          winner = po.final.home === winner ? po.final.away : po.final.home;
        }
        promoted.push(winner);
        if (group.includes(PLAYER_ID)) playerPlayoff = po;
      }
    }

    const relegated: string[] = [];
    for (let i = order.length - 1; i >= 0 && relegated.length < rules.down; i--) {
      const id = order[i];
      if (t === BOTTOM_TIER && id === PLAYER_ID) continue; // o clube do jogador não sai da pirâmide
      if (!promoted.includes(id)) relegated.push(id);
    }
    moves[t] = { promoted, relegated };

    if (t === tier) {
      playerTable = run.table;
      playerMatches = run.rounds.map((r) => r.find((m) => m.home === PLAYER_ID || m.away === PLAYER_ID)).filter((m): m is MatchResult => !!m);
    }
  }

  // ---------------------- resultado ----------------------
  const position = playerTable.findIndex((r) => r.clubId === PLAYER_ID) + 1;
  const row = playerTable[position - 1];
  const mv = moves[tier];
  let outcome: Outcome;
  let nextTier: Tier = tier;
  if (mv.promoted.includes(PLAYER_ID)) {
    nextTier = (tier - 1) as Tier;
    outcome = position === 1 ? 'campeao' : playerPlayoff?.winner === PLAYER_ID ? 'acesso_playoff' : 'acesso';
  } else if (mv.relegated.includes(PLAYER_ID)) {
    nextTier = (tier + 1) as Tier;
    outcome = 'queda';
  } else if (barred) {
    outcome = 'barrado_estadio';
  } else if (tier === 1 && position === 1) {
    outcome = 'campeao';
  } else {
    outcome = 'fica';
  }

  const topScorer = distributeGoals(deriveRng(seed, season, 'scorers'), p.squad, row.gf, row.played);

  // ---------------------- finanças ----------------------
  const finance = seasonFinance(p, tier, playerTable.length - 1, position, playerTable.length);
  p.cash = finance.cashEnd;
  for (const s of p.sponsors) if (s.seasonsLeft !== null) s.seasonsLeft--;
  p.sponsors = p.sponsors.filter((s) => s.seasonsLeft === null || s.seasonsLeft > 0);

  const name = p.name;
  const headlines: string[] = [];
  const departures: string[] = [];

  if (deduction > 0) headlines.push(`${name} começou a temporada com -${deduction} pontos por dívidas`);
  p.pendingDeduction = 0;

  // venda forçada: o clube se desfaz dos jogadores mais valiosos para tapar o buraco
  if (p.cash < 0) {
    const sellable = p.squad.slice().sort((a, b) => marketValue(b) - marketValue(a) || a.id - b.id);
    let sold = 0;
    while (p.cash < 0 && sold < 3 && p.squad.length > SQUAD_MIN && sellable.length > 0) {
      const f = sellable.shift()!;
      const fee = Math.round(marketValue(f) * 0.7);
      p.cash += fee;
      p.squad = p.squad.filter((x) => x.id !== f.id);
      p.alumni.push(f);
      departures.push(`${f.name} (${f.ovr}) vendido às pressas por £ ${fee} mil`);
      sold++;
    }
    if (sold > 0) headlines.push(`${name} faz venda forçada de ${sold} jogador(es) para pagar salários`);
  }

  // regra do caixa: 2 temporadas no vermelho = -10 pontos; se a dívida piorar depois disso, falência
  let bankrupt = false;
  const cashBefore = finance.cashEnd - finance.net;
  if (p.cash < 0) {
    p.negativeSeasons++;
    if (p.negativeSeasons >= 3 && p.cash < cashBefore) {
      bankrupt = true;
      headlines.push(`FALÊNCIA: ${name} fecha as portas afogado em dívidas`);
    } else if (p.negativeSeasons >= 2) {
      p.pendingDeduction = DEDUCTION_POINTS;
      headlines.push(`${name} perderá ${DEDUCTION_POINTS} pontos: ${p.negativeSeasons}º ano seguido no vermelho`);
    } else {
      headlines.push(`Caixa do ${name} fecha no vermelho`);
    }
  } else {
    p.negativeSeasons = 0;
  }

  const tierName = TIERS[tier].name;
  const nextName = TIERS[nextTier].name;
  switch (outcome) {
    case 'campeao':
      headlines.unshift(tier === 1 ? `${name} É CAMPEÃO DA PREMIER!` : `${name} campeão da ${tierName}! Rumo à ${nextName}`);
      break;
    case 'acesso':
      headlines.unshift(`${name} garante o acesso à ${nextName}`);
      break;
    case 'acesso_playoff':
      headlines.unshift(`${name} vence o playoff e sobe para a ${nextName}`);
      break;
    case 'barrado_estadio':
      headlines.unshift(`ESTÁDIO PEQUENO: ${name} ganha em campo mas é barrado da ${TIERS[(tier - 1) as Tier].name}`);
      break;
    case 'queda':
      headlines.unshift(`${name} é rebaixado para a ${nextName}`);
      break;
    default:
      headlines.unshift(`${name} termina a ${tierName} em ${position}º`);
  }
  if (topScorer && topScorer.goals > 0) headlines.push(`${topScorer.name} anota ${topScorer.goals} gols na temporada`);

  const result: SeasonResult = {
    season,
    year: START_YEAR + season - 1,
    tier,
    position,
    points: row.points,
    deduction,
    outcome: bankrupt ? 'falencia' : outcome,
    nextTier,
    stadiumRequired: outcome === 'barrado_estadio' ? TIERS[(tier - 1) as Tier].minStadium : undefined,
    playoff: playerPlayoff,
    table: playerTable,
    clubNames: Object.fromEntries(playerTable.map((r) => [r.clubId, r.clubId === PLAYER_ID ? p.name : byId.get(r.clubId)!.name])),
    playerMatches,
    topScorer,
    finance,
    strength: Math.round(pStrength * 10) / 10,
    headlines,
    departures,
  };

  // ---------------------- evolução para a próxima temporada ----------------------
  p.capacity += p.capacityBuilding;
  p.capacityBuilding = 0;
  evolveClub(state, result);
  moveClubs(state, moves);
  const driftRng = deriveRng(seed, season, 'drift');
  for (const t of ALL_TIERS) for (const c of state.world[t]) driftClub(driftRng, c);
  if (bankrupt) state.over = 'falencia';
  return result;
}

const GOAL_WEIGHT = { GOL: 0, DEF: 0.5, MEI: 2, ATA: 5 };

/** Distribui os gols do time entre o elenco (titulares marcam mais). */
function distributeGoals(rng: Rng, squad: Footballer[], goals: number, games: number) {
  if (squad.length === 0) return null;
  const { ids } = bestEleven(squad);
  for (const f of squad) f.apps += ids.has(f.id) ? games : Math.round(games * 0.25);
  const weight = (f: Footballer) => GOAL_WEIGHT[f.pos] * (ids.has(f.id) ? 1 : 0.2) * Math.pow(1.06, f.ovr - 50);
  const seasonGoals = new Map<number, number>();
  for (let g = 0; g < goals; g++) {
    const f = rng.weighted(squad, weight);
    seasonGoals.set(f.id, (seasonGoals.get(f.id) ?? 0) + 1);
  }
  let top: { name: string; goals: number } | null = null;
  for (const f of squad) {
    const g = seasonGoals.get(f.id) ?? 0;
    f.goals += g;
    if (!top || g > top.goals) top = { name: f.name, goals: g };
  }
  return top;
}

function evolveClub(state: GameState, result: SeasonResult): void {
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'evolve');
  const deps = result.departures;

  // elenco profissional
  const { ids } = bestEleven(p.squad);
  const stay: Footballer[] = [];
  for (const f of p.squad) {
    develop(rng, f, { ct: p.facilities.ct, fitness: p.staff.fitness, inEleven: ids.has(f.id) });
    f.contract--;
    if (retires(rng, f)) {
      deps.push(`${f.name} (${f.age} anos) pendura as chuteiras`);
      p.alumni.push(f);
    } else if (f.contract <= 0) {
      deps.push(`${f.name} sai de graça: contrato encerrado`);
      p.alumni.push(f);
    } else {
      stay.push(f);
    }
  }
  p.squad = stay;

  // base
  const youthStay: Footballer[] = [];
  for (const y of p.youth) {
    develop(rng, y, { ct: p.facilities.ct, fitness: p.staff.fitness, inEleven: false, youth: true, academy: p.facilities.academy });
    if (y.age > YOUTH_AGE_LIMIT) deps.push(`${y.name} deixa a base sem ser aproveitado`);
    else youthStay.push(y);
  }
  p.youth = youthStay;

  // elenco mínimo: completa com amadores da várzea
  while (p.squad.length < SQUAD_MIN) {
    const f = makeFootballer(rng, {
      id: nextId(state),
      ovr: TIERS[result.nextTier].meanStrength - 10 + rng.normal(2),
      age: rng.int(19, 30),
      scout: p.staff.scout,
      season: state.season + 1,
      contract: 1,
    });
    p.squad.push(f);
  }

  // torcida, hype, alma
  const fanGrowth = { campeao: 0.4, acesso: 0.3, acesso_playoff: 0.3, barrado_estadio: 0.05, fica: 0, queda: -0.2, falencia: -0.5 }[result.outcome];
  const size = result.table.length;
  const posFactor = (size / 2 - result.position) / size; // -0.5 .. +0.5
  const policy = TICKET_POLICY[p.ticket];
  p.fans = Math.max(20, Math.round(p.fans * (1 + fanGrowth + posFactor * 0.15 + policy.fanGrowth + p.hype / 1500)));
  p.soul = clamp(p.soul + policy.soul, 0, 100);
  p.hype = clamp(Math.round(p.hype * 0.85), 0, 100);
  p.rivalHatred = clamp(Math.round(p.rivalHatred * 0.9), 0, 100);
  p.formMod = 0;
  p.tier = result.nextTier;
}

function moveClubs(state: GameState, moves: Record<Tier, Movement>): void {
  const p = state.player;
  const byId = new Map<string, Club>();
  for (const t of ALL_TIERS) for (const c of state.world[t]) byId.set(c.id, c);

  const next = {} as Record<Tier, Club[]>;
  for (const t of ALL_TIERS) {
    const { promoted, relegated } = moves[t];
    next[t] = state.world[t].filter((c) => !promoted.includes(c.id) && !relegated.includes(c.id));
  }
  for (const t of ALL_TIERS) {
    const { promoted, relegated } = moves[t];
    for (const id of promoted) {
      if (id === PLAYER_ID) continue;
      const c = byId.get(id)!;
      c.tier = (t - 1) as Tier;
      next[c.tier].push(c);
    }
    for (const id of relegated) {
      if (id === PLAYER_ID || t === BOTTOM_TIER) continue; // os do fundo saem da pirâmide
      const c = byId.get(id)!;
      c.tier = (t + 1) as Tier;
      next[c.tier].push(c);
    }
  }
  const taken = new Set<string>([p.name]);
  for (const t of ALL_TIERS) for (const c of next[t]) taken.add(c.name);
  const rng = deriveRng(state.seed, state.season, 'newclubs');
  const bottomTarget = TIERS[BOTTOM_TIER].size - (p.tier === BOTTOM_TIER ? 1 : 0);
  while (next[BOTTOM_TIER].length < bottomTarget) {
    next[BOTTOM_TIER].push(makeClub(rng, `c${state.serial++}`, BOTTOM_TIER, taken));
  }
  for (const t of ALL_TIERS) {
    const target = TIERS[t].size - (p.tier === t ? 1 : 0);
    if (next[t].length !== target) throw new Error(`pirâmide desbalanceada no nível ${t}: ${next[t].length} != ${target}`);
  }
  state.world = next;
}

import { ALL_TIERS, BOTTOM_TIER, START_YEAR, TIERS } from '../data/pyramid';
import { clamp, driftClub, makeClub } from './clubs';
import { newSquadman } from './effects';
import { attendance, seasonFinance } from './finance';
import { simulateLeague, simulatePlayoff, type LeagueContext } from './league';
import { BASE_HOME_ADVANTAGE } from './match';
import { deriveRng } from './rng';
import type { Club, GameState, MatchResult, Outcome, SeasonResult, Tier } from './types';

export const PLAYER_ID = 'player';
export const DEDUCTION_POINTS = 10;

/** Força efetiva do jogador num jogo (técnico + forma da temporada). */
export function playerMatchStrength(state: GameState, form: number): number {
  return state.player.strength + state.player.staff.coach * 1.5 + form;
}

export function playerHomeAdv(state: GameState): number {
  const p = state.player;
  return BASE_HOME_ADVANTAGE + 2 * Math.min(1, attendance(p) / TIERS[p.tier].typicalFans);
}

/** O clube pode jogar na divisão `tier` com o estádio atual? */
export function stadiumAllows(capacity: number, tier: Tier): boolean {
  return capacity >= TIERS[tier].minStadium;
}

interface Movement {
  promoted: string[];
  relegated: string[];
}

/**
 * Simula UMA temporada completa (todas as divisões), aplica acesso/queda,
 * finanças e evolução. Muta `state` e devolve o resumo do clube do jogador.
 */
export function simulateSeason(state: GameState): SeasonResult {
  const p = state.player;
  const seed = state.seed;
  const season = state.season;
  const tier = p.tier;

  // forma da temporada: time de YouTuber oscila muito
  const formRng = deriveRng(seed, season, 'form');
  const form = p.origin === 'youtuber' ? formRng.normal(4) : formRng.normal(1.5);
  const pStrength = playerMatchStrength(state, form);
  const pHome = playerHomeAdv(state);
  const rivalBonus = p.rivalHatred / 25;

  const byId = new Map<string, Club>();
  for (const t of ALL_TIERS) for (const c of state.world[t]) byId.set(c.id, c);

  const ctx: LeagueContext = {
    strength(id, opp) {
      if (id === PLAYER_ID) return pStrength;
      const c = byId.get(id)!;
      let s = c.strength;
      if (opp === PLAYER_ID) {
        if (p.origin === 'youtuber') s += 2; // todo mundo quer ganhar do time do YouTuber
        if (id === p.rivalId) s += rivalBonus;
      }
      return s;
    },
    homeAdv(id) {
      return id === PLAYER_ID ? pHome : BASE_HOME_ADVANTAGE;
    },
  };

  // ---------------------- ligas de todas as divisões ----------------------
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
    const rng = deriveRng(seed, season, 'league', t);
    const run = simulateLeague(rng, ids, ctx, t === tier ? { [PLAYER_ID]: deduction } : {});
    const order = run.table.map((r) => r.clubId);

    const promoted: string[] = [];
    let playoffResult: SeasonResult['playoff'];
    if (t > 1) {
      const target = (t - 1) as Tier;
      const eligible = (id: string) => id !== PLAYER_ID || stadiumAllows(p.capacity, target);
      // vagas diretas: os primeiros colocados elegíveis
      let cursor = 0;
      while (promoted.length < rules.autoUp && cursor < order.length) {
        const id = order[cursor];
        if (eligible(id)) promoted.push(id);
        else if (id === PLAYER_ID) barred = true;
        cursor++;
      }
      // playoff: os 4 seguintes na tabela (o jogador barrado nas vagas diretas não entra;
      // o jogador que já está na zona de playoff joga mesmo sem estádio — e é barrado se vencer)
      if (rules.playoff) {
        const group = order.filter((id) => !promoted.includes(id) && !(id === PLAYER_ID && barred)).slice(0, 4);
        const prng = deriveRng(seed, season, 'playoff', t);
        playoffResult = simulatePlayoff(prng, group, ctx);
        let winner = playoffResult.winner;
        if (!eligible(winner)) {
          barred = true;
          const f = playoffResult.final;
          winner = f.home === winner ? f.away : f.home;
        }
        promoted.push(winner);
        if (group.includes(PLAYER_ID)) playerPlayoff = playoffResult;
      }
    }

    const relegated: string[] = [];
    const downCount = rules.down;
    for (let i = order.length - 1; i >= 0 && relegated.length < downCount; i--) {
      const id = order[i];
      if (t === BOTTOM_TIER && id === PLAYER_ID) continue; // o clube do jogador não sai da pirâmide
      if (promoted.includes(id)) continue;
      relegated.push(id);
    }
    moves[t] = { promoted, relegated };

    if (t === tier) {
      playerTable = run.table;
      playerMatches = run.rounds.map((r) => r.find((m) => m.home === PLAYER_ID || m.away === PLAYER_ID)!).filter(Boolean);
    }
  }

  // ---------------------- resultado do jogador ----------------------
  const position = playerTable.findIndex((r) => r.clubId === PLAYER_ID) + 1;
  const row = playerTable[position - 1];
  const mv = moves[tier];
  let outcome: Outcome;
  let nextTier: Tier = tier;
  if (mv.promoted.includes(PLAYER_ID)) {
    nextTier = (tier - 1) as Tier;
    outcome = position === 1 ? 'campeao' : playerPlayoff && playerPlayoff.winner === PLAYER_ID ? 'acesso_playoff' : 'acesso';
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

  // ---------------------- artilharia ----------------------
  const goals = row.gf;
  const scorerRng = deriveRng(seed, season, 'scorers');
  const active = p.squad.filter((s) => s.active);
  const seasonGoals = new Map<string, number>();
  if (active.length > 0) {
    // ~60% dos gols do clube vão para os jogadores nomeados
    for (let g = 0; g < Math.round(goals * 0.6); g++) {
      const s = scorerRng.weighted(active, (x) => x.finishing);
      seasonGoals.set(s.id, (seasonGoals.get(s.id) ?? 0) + 1);
    }
  }
  let topScorer: SeasonResult['topScorer'] = null;
  for (const s of active) {
    const g = seasonGoals.get(s.id) ?? 0;
    s.goals += g;
    s.seasons++;
    if (!topScorer || g > topScorer.goals) topScorer = { name: s.name, goals: g };
  }

  // ---------------------- finanças ----------------------
  // turno e returno: cada clube faz (n - 1) jogos em casa
  const finance = seasonFinance(p, playerTable.length - 1);
  p.cash = finance.cashEnd;
  for (const s of p.sponsors) if (s.seasonsLeft !== null) s.seasonsLeft--;
  p.sponsors = p.sponsors.filter((s) => s.seasonsLeft === null || s.seasonsLeft > 0);

  const headlines: string[] = [];
  const name = p.name;
  const tierName = TIERS[tier].name;
  const nextName = TIERS[nextTier].name;

  if (deduction > 0) headlines.push(`${name} começou a temporada com -${deduction} pontos por dívidas`);
  p.pendingDeduction = 0;
  // Regra do caixa: 2 temporadas seguidas no vermelho = perde pontos na próxima.
  // A partir daí, se a dívida PIORAR, o clube decreta falência.
  let bankrupt = false;
  const cashBefore = finance.cashEnd - finance.net;
  if (p.cash < 0) {
    // venda forçada: o clube se desfaz de jogadores para tapar o buraco
    const relief = Math.round(Math.min(-p.cash, 12 * TIERS[tier].moneyScale));
    p.cash += relief;
    p.strength = clamp(p.strength - 3, 1, 99);
    headlines.push(`${name} faz venda forçada de jogadores para pagar salários`);
  }
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
    strength: Math.round(p.strength * 10) / 10,
    headlines,
  };

  // ---------------------- evolução (para a próxima temporada) ----------------------
  evolvePlayer(state, result);
  moveClubs(state, moves);
  const driftRng = deriveRng(seed, season, 'drift');
  for (const t of ALL_TIERS) for (const c of state.world[t]) driftClub(driftRng, c);
  if (bankrupt) state.over = 'falencia';

  return result;
}

function evolvePlayer(state: GameState, result: SeasonResult): void {
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'evolve');
  const growth = p.staff.scout * 0.8 + p.staff.academy * 0.6;
  const decay = 2 - p.staff.fitness * 0.5;
  let delta = growth - decay;
  const fanGrowth = { campeao: 0.45, acesso: 0.35, acesso_playoff: 0.35, barrado_estadio: 0.05, fica: 0, queda: -0.2, falencia: -0.5 }[result.outcome];
  if (result.outcome === 'campeao' || result.outcome === 'acesso' || result.outcome === 'acesso_playoff') delta += 2;
  if (result.outcome === 'queda') delta -= 3;
  p.strength = clamp(Math.round((p.strength + delta) * 10) / 10, 1, 99);

  const size = result.table.length;
  const posFactor = (size / 2 - result.position) / size; // -0.5 .. +0.5
  p.fans = Math.max(20, Math.round(p.fans * (1 + fanGrowth + posFactor * 0.2 + p.hype / 1000)));
  p.hype = clamp(Math.round(p.hype * 0.85), 0, 100);
  p.rivalHatred = clamp(Math.round(p.rivalHatred * 0.9), 0, 100);
  p.tier = result.nextTier;

  // elenco nomeado: veteranos se aposentam, base repõe
  for (const s of p.squad) if (s.active && s.seasons >= 9) s.active = false;
  while (p.squad.filter((s) => s.active).length < 3) {
    p.squad.push(newSquadman(state, rng, 2 + p.staff.academy * 0.5));
  }
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
      if (id === PLAYER_ID) continue;
      if (t === BOTTOM_TIER) continue; // sai da pirâmide
      const c = byId.get(id)!;
      c.tier = (t + 1) as Tier;
      next[c.tier].push(c);
    }
  }
  // novos clubes filiados no fundo da pirâmide
  const taken = new Set<string>([p.name]);
  for (const t of ALL_TIERS) for (const c of next[t]) taken.add(c.name);
  const rng = deriveRng(state.seed, state.season, 'newclubs');
  const bottomTarget = TIERS[BOTTOM_TIER].size - (p.tier === BOTTOM_TIER ? 1 : 0);
  while (next[BOTTOM_TIER].length < bottomTarget) {
    next[BOTTOM_TIER].push(makeClub(rng, `c${state.serial++}`, BOTTOM_TIER, taken));
  }
  // garante tamanhos (considerando a vaga do jogador)
  for (const t of ALL_TIERS) {
    const target = TIERS[t].size - (p.tier === t ? 1 : 0);
    if (next[t].length !== target) {
      throw new Error(`pirâmide desbalanceada no nível ${t}: ${next[t].length} != ${target}`);
    }
  }
  state.world = next;
}

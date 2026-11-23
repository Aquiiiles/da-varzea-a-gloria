import { ALL_TIERS, BOTTOM_TIER, SQUAD_MAX, SQUAD_MIN, START_YEAR, TIERS, YOUTH_AGE_LIMIT, YOUTH_MAX } from '../data/pyramid';
import { driftClub, makeClub } from './clubs';
import { nextId } from './effects';
import { TICKET_POLICY, attendance, seasonFinance } from './finance';
import { bestEleven, develop, makeFootballer, marketValue, marketWage, retires, round1, squadStrength } from './footballers';
import { renewWage } from './office';
import { continentalCup, foreignClubs, nationalCup, worldCup } from './cups';
import { homegrownInXI } from './clubops';
import { moment } from './live';
import { applyResult, emptyRow, simulateLeague, simulatePlayoff, sortTable, type LeagueContext } from './league';
import { BASE_HOME_ADVANTAGE, type GoalMult } from './match';
import { deriveRng, type Rng } from './rng';
import { clamp } from './util';
import type { Club, CoachStyle, CompetitionId, CupMatch, CupRun, Footballer, GameState, LiveMoment, MatchResult, Outcome, SeasonResult, TableRow, Tier } from './types';

export const PLAYER_ID = 'player';

/** Multiplicadores de gol [a favor, contra] por estilo de técnico. */
const STYLE_GOALS: Record<CoachStyle, GoalMult> = {
  ofensivo: [1.15, 1.1],
  retranqueiro: [0.9, 0.82],
  formador: [1, 1],
  motivador: [1, 1],
  estrategista: [1, 1],
};

/**
 * A última rodada vale algo? Olha a tabela antes dela: se o jogador está a até 3 pontos
 * da zona de acesso/título ou da zona de queda (dos dois lados da linha), é decisiva.
 */
function lastRoundStake(rounds: MatchResult[][], ids: string[], deduction: number, rules: (typeof TIERS)[Tier], tier: Tier): { stake: string; match: MatchResult } | null {
  if (rounds.length === 0) return null;
  const table = new Map<string, TableRow>();
  for (const id of ids) table.set(id, emptyRow(id, id === PLAYER_ID ? deduction : 0));
  for (const r of rounds.slice(0, -1)) for (const m of r) applyResult(table, m);
  const before = sortTable([...table.values()]);
  const pos = before.findIndex((r) => r.clubId === PLAYER_ID) + 1;
  const pts = before[pos - 1].points;
  const match = rounds[rounds.length - 1].find((m) => m.home === PLAYER_ID || m.away === PLAYER_ID);
  if (!match) return null;
  const at = (n: number) => before[Math.min(before.length, Math.max(1, n)) - 1].points;
  const topLine = tier === 1 ? 1 : rules.autoUp;
  if (topLine > 0 && Math.abs(pts - at(pos <= topLine ? topLine + 1 : topLine)) <= 3) {
    return { stake: tier === 1 ? 'Última rodada valendo o título da Premier!' : pos <= topLine ? 'Última rodada: segurar a vaga de acesso!' : 'Última rodada: dá para roubar a vaga de acesso!', match };
  }
  const dropLine = before.length - rules.down; // última posição salva
  if (rules.down > 0 && tier !== 8 && Math.abs(pts - at(pos <= dropLine ? dropLine + 1 : dropLine)) <= 3) {
    return { stake: pos <= dropLine ? 'Última rodada: não pode perder para não cair!' : 'Última rodada: só a vitória salva do rebaixamento!', match };
  }
  return null;
}
export const DEDUCTION_POINTS = 10;
/** Bônus de força por nível do técnico, relativo ao técnico típico da divisão. */
export const COACH_BONUS = 0.4;

/** Nível de técnico típico de cada divisão (0 na várzea, 3,5 na Premier). */
export function coachNorm(tier: Tier): number {
  return (8 - tier) / 2;
}

/** Vantagem do seu técnico sobre o típico da divisão (pode ser negativa). */
export function coachEdge(rating: number, tier: Tier): number {
  return Math.round((rating - coachNorm(tier)) * COACH_BONUS * 100) / 100;
}

export function playerHomeAdv(state: GameState): number {
  const p = state.player;
  const full = Math.min(p.capacity, p.fans) / Math.max(1, TIERS[p.tier].typicalFans);
  return BASE_HOME_ADVANTAGE + Math.min(1, full);
}

/** Força esperada do time (sem a sorte da temporada): XI + técnico + eventos. */
export function teamStrength(state: GameState): number {
  const p = state.player;
  return Math.round((squadStrength(p.squad) + coachEdge(p.coach.rating, p.tier) + p.formMod) * 10) / 10;
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
  const sd = (p.origin === 'youtuber' ? 2 : 0.9) * (1 - p.facilities.medical * 0.1) * (p.coach.style === 'motivador' ? 0.7 : 1);
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
        if (p.origin === 'youtuber') s += 0.5; // todo mundo quer ganhar do time do YouTuber
        if (id === p.rivalId) s += rivalBonus;
      }
      return s;
    },
    homeAdv(id) {
      return id === PLAYER_ID ? pHome : BASE_HOME_ADVANTAGE;
    },
    goalMult(h, a) {
      if (h !== PLAYER_ID && a !== PLAYER_ID) return [1, 1];
      const [forMe, againstMe] = STYLE_GOALS[p.coach.style];
      return h === PLAYER_ID ? [forMe, againstMe] : [againstMe, forMe];
    },
    knockoutBonus(id) {
      return id === PLAYER_ID && p.coach.style === 'estrategista' ? 0.4 : 0;
    },
  };
  // clubes estrangeiros (copas internacionais) entram no mesmo contexto
  const foreign = new Map<string, { name: string; strength: number }>();
  const baseStrength = ctx.strength;
  ctx.strength = (id, opp) => foreign.get(id)?.strength ?? baseStrength(id, opp);

  // obras em andamento ficam prontas no fim da temporada: contam para a vistoria do acesso
  const capacityAtInspection = p.capacity + p.capacityBuilding;

  const moves = {} as Record<Tier, Movement>;
  let playerTable: SeasonResult['table'] = [];
  let playerMatches: MatchResult[] = [];
  let playerPlayoff: SeasonResult['playoff'];
  let barred = false;
  let lastRound: { stake: string; match: MatchResult } | null = null;
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
      lastRound = lastRoundStake(run.rounds, ids, deduction, rules, t);
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

  // ---------------------- copas ----------------------
  const nameOf = (id: string) => (id === PLAYER_ID ? p.name : foreign.get(id)?.name ?? byId.get(id)?.name ?? id);
  const tierOf = (id: string): Tier | null => (id === PLAYER_ID ? tier : byId.get(id)?.tier ?? null);
  const env = (label: string) => ({ rng: deriveRng(seed, season, label), ctx, name: nameOf, tierOf, playerTier: tier });
  const byTier = {} as Record<Tier, string[]>;
  for (const t of ALL_TIERS) byTier[t] = [...state.world[t].map((c) => c.id), ...(t === tier ? [PLAYER_ID] : [])];

  const cupRuns: CupRun[] = [];
  const cupMatches: CupMatch[] = [];
  const national = nationalCup(env('copa'), byTier);
  if (national.run) cupRuns.push(national.run);
  cupMatches.push(...national.playerMatches);

  let ccChampion = false;
  if (p.continental) {
    const frng = deriveRng(seed, season, 'foreign', p.continental);
    const domestic = state.world[1].slice().sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1)).slice(0, p.continental === 'cc' ? 3 : 2).map((c) => c.id);
    const others = foreignClubs(frng, 32 - 1 - domestic.length, p.continental === 'cc' ? 81 : 76, 3.5, `f${p.continental}`);
    for (const f of others) foreign.set(f.id, f);
    const res = continentalCup(env(p.continental), p.continental, [PLAYER_ID, ...domestic, ...others.map((f) => f.id)]);
    if (res.run) cupRuns.push(res.run);
    cupMatches.push(...res.playerMatches);
    ccChampion = p.continental === 'cc' && res.championId === PLAYER_ID;
  }
  if (p.worldCup) {
    const others = foreignClubs(deriveRng(seed, season, 'foreign', 'mundial'), 7, 77, 4, 'fwc');
    for (const f of others) foreign.set(f.id, f);
    const res = worldCup(env('mundial'), [PLAYER_ID, ...others.map((f) => f.id)]);
    if (res.run) cupRuns.push(res.run);
    cupMatches.push(...res.playerMatches);
  }
  const cupPrizes = cupRuns.reduce((sum, c) => sum + c.prize, 0);

  // ---------------------- clássico ----------------------
  const derbyGames = [...playerMatches, ...cupMatches.map((m) => m.result)].filter((m) => m.home === p.rivalId || m.away === p.rivalId);
  let derby: SeasonResult['derby'] = null;
  if (derbyGames.length > 0) {
    derby = { w: 0, d: 0, l: 0 };
    for (const m of derbyGames) {
      const mine = m.home === PLAYER_ID ? m.hg : m.ag;
      const theirs = m.home === PLAYER_ID ? m.ag : m.hg;
      const won = m.winner ? m.winner === PLAYER_ID : mine > theirs;
      const lost = m.winner ? m.winner !== PLAYER_ID : mine < theirs;
      if (won) derby.w++;
      else if (lost) derby.l++;
      else derby.d++;
    }
    p.derby.w += derby.w;
    p.derby.d += derby.d;
    p.derby.l += derby.l;
  }

  // ---------------------- objetivos ----------------------
  const xiIds = bestEleven(p.squad).ids;
  const homegrownXI = homegrownInXI(p.squad, xiIds);
  const nationalWins = national.playerMatches.filter((m) => m.won).length;
  const occupancy = (Math.min(p.capacity, attendance(p)) / Math.max(1, p.capacity)) * 100;
  const objectives = state.office.objectives.map((o) => {
    let met: boolean;
    switch (o.kind) {
      case 'subir': met = nextTier < tier; break;
      case 'titulo': met = position === 1; break;
      case 'top4': case 'brigar': case 'meio': case 'nao_cair': met = position <= o.target && nextTier <= tier; break;
      case 'classico': met = derby !== null && derby.l === 0; break;
      case 'copa': met = nationalWins >= o.target - 1; break;
      case 'base': met = homegrownXI >= o.target; break;
      case 'casa': met = occupancy >= o.target; break;
    }
    return { ...o, met };
  });
  const ms = TIERS[tier].moneyScale;
  const objectiveBonus = objectives.reduce((sum, o) => sum + (o.met ? Math.round((o.main ? 6 : 2) * ms) : 0), 0);

  const topScorer = distributeGoals(deriveRng(seed, season, 'scorers'), p.squad, row.gf, row.played);
  const idolGoals = Math.max(0, ...p.squad.map((f) => f.goals));

  // ---------------------- momentos ao vivo ----------------------
  const moments = buildMoments(deriveRng(seed, season, 'live'), {
    p,
    nameOf,
    playoff: playerPlayoff,
    lastRound,
    cupRuns,
    leagueMatches: playerMatches,
    tier,
  });

  // ---------------------- finanças ----------------------
  const finance = seasonFinance(p, tier, playerTable.length - 1, position, playerTable.length, cupPrizes + objectiveBonus, idolGoals);
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
  for (const c of cupRuns) {
    if (c.champion) headlines.splice(1, 0, `${name} É CAMPEÃO DA ${c.name.toUpperCase()}!`);
    else headlines.push(`${c.name}: ${c.reached.toLowerCase()}`);
    for (const m of c.matches) if (m.giantKill) headlines.splice(1, 0, `ZEBRA! ${name} elimina o ${m.opponent} na ${c.name}`);
  }
  if (derby && derby.w > 0 && derby.l === 0) headlines.push(`Clássico é nosso: ${name} invicto contra o rival`);

  // ---------------------- torcedômetro ----------------------
  const moodBefore = p.mood;
  let dm = 0;
  for (const o of objectives) dm += o.met ? (o.main ? 12 : 5) : o.main ? -14 : -2;
  dm += { campeao: 10, acesso: 12, acesso_playoff: 12, barrado_estadio: -10, fica: 0, queda: -18, falencia: -30 }[outcome];
  if (derby) dm += (derby.w - derby.l) * 3;
  dm += cupMatches.filter((m) => m.giantKill).length * 6;
  dm += cupRuns.filter((c) => c.champion).length * 10;
  dm += p.ticket === 0 ? 3 : p.ticket === 2 ? -4 : 0;
  dm -= state.office.soldHomegrown * 4;
  if (p.coach.style === 'motivador') dm += 3;
  p.mood = clamp(Math.round(p.mood + dm + (55 - p.mood) * 0.1), 0, 100);
  if (p.mood < 25) {
    p.soul = clamp(p.soul - 2, 0, 100);
    headlines.push(`Protesto na porta do estádio: torcida do ${name} pede mudanças`);
  } else if (p.mood >= 85) {
    p.hype = clamp(p.hype + 5, 0, 100);
    headlines.push(`Torcida do ${name} em festa: estádio vira caldeirão`);
  }

  // vagas para a próxima temporada
  const copaChampion = national.championId === PLAYER_ID;
  const nextContinental: PlayerClubContinental = !bankrupt && nextTier === 1 && tier === 1 ? (position <= 4 ? 'cc' : position === 5 || copaChampion ? 'le' : null) : copaChampion && nextTier <= 2 ? 'le' : null;
  if (nextContinental === 'cc') headlines.push(`${name} garante vaga na Copa dos Campeões`);
  else if (nextContinental === 'le') headlines.push(`${name} vai disputar a Liga Europa`);
  if (ccChampion) headlines.push(`${name} vai ao Mundial de Clubes!`);
  p.continental = nextContinental;
  p.worldCup = ccChampion;

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
    renewals: [],
    cups: cupRuns,
    objectives,
    moments,
    derby,
    mood: p.mood,
    moodDelta: p.mood - moodBefore,
    signings: state.office.signings,
    homegrownXI,
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

type PlayerClubContinental = GameState['player']['continental'];

const GOAL_WEIGHT = { GOL: 0, DEF: 0.5, MEI: 2, ATA: 5 };

interface MomentInput {
  p: GameState['player'];
  nameOf: (id: string) => string;
  playoff: SeasonResult['playoff'];
  lastRound: { stake: string; match: MatchResult } | null;
  cupRuns: CupRun[];
  leagueMatches: MatchResult[];
  tier: Tier;
}

/** Escolhe até 3 jogos da temporada para mostrar ao vivo (os mais importantes primeiro). */
function buildMoments(rng: Rng, m: MomentInput): LiveMoment[] {
  const out: LiveMoment[] = [];
  const add = (kind: LiveMoment['kind'], title: string, stake: string, r: MatchResult) =>
    out.push(moment(rng, kind, title, stake, r, PLAYER_ID, m.nameOf, m.p.squad));
  const finals: Record<CompetitionId, LiveMoment['kind']> = { copa: 'final_copa', cc: 'final_cc', le: 'final_le', mundial: 'mundial' };
  for (const c of m.cupRuns.slice().sort((a, b) => CUP_PRIORITY[a.id] - CUP_PRIORITY[b.id])) {
    const final = c.matches.find((x) => x.round === 'Final');
    if (final) add(finals[c.id], `Final da ${c.name}`, c.id === 'mundial' ? 'O mundo inteiro está assistindo.' : 'Uma taça em jogo.', final.result);
  }
  if (m.playoff && (m.playoff.final.home === PLAYER_ID || m.playoff.final.away === PLAYER_ID)) {
    add('playoff', `Final do playoff da ${TIERS[m.tier].name}`, 'Quem vencer sobe de divisão.', m.playoff.final);
  }
  if (m.lastRound) add('ultima_rodada', 'Última rodada', m.lastRound.stake, m.lastRound.match);
  const copa = m.cupRuns.find((c) => c.id === 'copa');
  const zebra = copa?.matches.filter((x) => x.opponentTier !== null && x.opponentTier <= m.tier - 3 && x.round !== 'Final').pop();
  if (zebra) add('zebra', `${copa!.name} · ${zebra.round}`, `Cheiro de zebra: o adversário joga ${m.tier - zebra.opponentTier!} divisões acima.`, zebra.result);
  if (out.length < 3) {
    const derby = m.leagueMatches.find((x) => x.home === m.p.rivalId || x.away === m.p.rivalId);
    if (derby) add('classico', 'Clássico', 'O jogo que a cidade espera o ano inteiro.', derby);
  }
  return out.slice(0, 3);
}

const CUP_PRIORITY: Record<CompetitionId, number> = { mundial: 0, cc: 1, le: 2, copa: 3 };

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

/** Chance de o jogador recusar a renovação automática. */
export function refusalChance(f: Footballer, starter: boolean): number {
  let c = starter ? 0.1 : f.age >= 27 ? 0.4 : 0.2;
  if (f.homegrown) c -= 0.08;
  return Math.max(0, c);
}

/** Teto salarial que o clube topa numa renovação automática. */
export function renewalCap(tier: Tier, currentWage: number): number {
  return Math.max(marketWage(TIERS[tier].meanStrength + 6), currentWage * 1.5);
}

function evolveClub(state: GameState, result: SeasonResult): void {
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'evolve');
  const deps = result.departures;

  // elenco profissional
  const { ids } = bestEleven(p.squad);
  const stay: Footballer[] = [];
  for (const f of p.squad) {
    develop(rng, f, { ct: p.facilities.ct + (p.coach.style === 'formador' && f.age <= 23 ? 2 : 0), fitness: p.staff.fitness, inEleven: ids.has(f.id) });
    f.contract--;
    if (retires(rng, f)) {
      deps.push(`${f.name} (${f.age} anos) pendura as chuteiras`);
      p.alumni.push(f);
    } else if (f.contract <= 0 && f.leaving) {
      deps.push(`${f.name} sai de graça: contrato encerrado`);
      p.alumni.push(f);
    } else if (f.contract <= 0 && renewWage(f.ovr, f.wage, f.homegrown) > renewalCap(result.nextTier, f.wage)) {
      // cresceu demais para o clube: pede salário de divisão de cima e é vendido a um gigante
      const fee = Math.round(marketValue(f) * 0.1); // fim de contrato: só a compensação por formação
      p.cash += fee;
      p.alumni.push(f);
      deps.push(`${f.name} (${f.ovr}) recusa renovar e sai para um clube maior (compensação de £ ${fee} mil)`);
    } else if (f.contract <= 0 && rng.chance(refusalChance(f, ids.has(f.id)))) {
      deps.push(`${f.name} não aceita renovar: ${ids.has(f.id) ? 'quer novos ares' : 'quer mais minutos em outro clube'}`);
      p.alumni.push(f);
    } else if (f.contract <= 0) {
      // renovação automática: salário de mercado (com o overall novo), veteranos por 1 ano
      const old = f.wage;
      f.wage = renewWage(f.ovr, f.wage, f.homegrown);
      f.contract = f.age >= 32 ? 1 : 3;
      result.renewals.push(`${f.name} renova por ${f.contract} ano(s)${f.wage > old ? ` com aumento de £ ${Math.round(f.wage - old)} mil/temp.` : ''}`);
      stay.push(f);
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

  // emprestados voltam: jogaram muito, evoluem mais
  for (const f of p.onLoan) {
    develop(rng, f, { ct: 0, fitness: 0, inEleven: true, youth: f.age < YOUTH_AGE_LIMIT, academy: 1 });
    if (f.contract > 0) f.contract--;
    const wasYouth = !!f.loanFromYouth;
    delete f.loanFromYouth;
    if (wasYouth && f.age <= YOUTH_AGE_LIMIT && p.youth.length < YOUTH_MAX) {
      p.youth.push(f);
    } else if (p.squad.length < SQUAD_MAX) {
      if (wasYouth) f.wage = round1(marketWage(f.ovr) * 0.8);
      if (f.contract <= 0) f.contract = 3;
      p.squad.push(f);
    } else {
      deps.push(`${f.name} volta de empréstimo e é liberado: elenco cheio`);
      p.alumni.push(f);
      continue;
    }
    deps.push(`${f.name} volta de empréstimo com ${f.ovr} de overall`);
  }
  p.onLoan = [];

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

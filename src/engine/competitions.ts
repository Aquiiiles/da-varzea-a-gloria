import { knockout, roundRobin, sortTable, applyResult, emptyRow, type LeagueContext } from './league';
import { playMatch } from './match';
import type { Rng } from './rng';
import type { CompId, CompResult, CupMatch, MatchResult, TableRow, Tier } from './types';

export const PLAYER = 'player';

export interface CompEnv {
  /** sorteios da competição (grupos, chaves) */
  rng: Rng;
  /**
   * Sorteio próprio de cada jogo, na ordem em que os jogos aparecem na competição.
   * Assim o resultado de um jogo não depende de quanto aleatório os jogos anteriores consumiram.
   */
  matchRng: () => Rng;
  /** data (dia do ano) da `k`-ésima rodada de `total` */
  dayOf: (k: number, total: number) => number;
  /** registra as fases e os jogos das competições do jogador (tabelas parciais no calendário) */
  track?: CompTracker;
  ctx: LeagueContext;
  name: (id: string) => string;
  tierOf: (id: string) => Tier | null;
  /** o clube pode subir (estádio)? */
  eligible: (id: string) => boolean;
}

export interface CompTracker {
  /** abre uma fase de pontos e devolve o índice dela */
  stage(name: string, ids: string[], deductions: Record<string, number>): number;
  match(stage: number, m: MatchResult): void;
}

export interface LeagueOutcome {
  comp: CompResult | null;
  /** ordem final (campeão primeiro) */
  ranking: string[];
  champion: string;
  promoted: string[];
  relegated: string[];
  /** o jogador foi barrado pelo estádio */
  barred: boolean;
  /** todos os jogos do jogador nesta competição */
  playerMatches: MatchResult[];
  /** rodadas da fase de pontos corridos (para "última rodada decisiva") */
  rounds?: MatchResult[][];
  /** tabelas de pontos (para distribuir os gols da IA) */
  tables?: TableRow[][];
  roundIds?: string[];
}

/* ------------------------------ mata-mata ------------------------------ */

/** Disputa de pênaltis (quase moeda, leve viés para o mais forte). */
function shootout(rng: Rng, hs: number, as: number): [number, number] {
  const edge = Math.max(-0.1, Math.min(0.1, (hs - as) / 90)) / 2;
  let ph = 0;
  let pa = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(0.75 + edge)) ph++;
    if (rng.chance(0.75 - edge)) pa++;
  }
  while (ph === pa) {
    if (rng.chance(0.75)) ph++;
    if (rng.chance(0.75)) pa++;
  }
  return [ph, pa];
}

/**
 * Confronto de ida e volta; o de melhor campanha (`better`) decide em casa.
 * Com `advantage`, empate no agregado classifica o de melhor campanha (sem pênaltis), como nos mata-matas regionais.
 * `rng` pode ser um só (testes) ou um por jogo.
 */
export function twoLegs(rng: Rng | [Rng, Rng], ctx: LeagueContext, better: string, other: string, advantage = false): [MatchResult, MatchResult] {
  const [r1, r2] = Array.isArray(rng) ? rng : [rng, rng];
  const bonus = (id: string) => ctx.knockoutBonus?.(id) ?? 0;
  const s = (a: string, b: string) => ctx.strength(a, b) + bonus(a);
  const m1 = playMatch(r1, other, better, s(other, better), s(better, other), ctx.homeAdv(other), ctx.goalMult?.(other, better));
  const m2 = playMatch(r2, better, other, s(better, other), s(other, better), ctx.homeAdv(better), ctx.goalMult?.(better, other));
  const aggBetter = m1.ag + m2.hg;
  const aggOther = m1.hg + m2.ag;
  if (aggBetter > aggOther) m2.winner = better;
  else if (aggOther > aggBetter) m2.winner = other;
  else if (advantage) {
    m2.winner = better;
    m2.advantage = true;
  } else {
    m2.pens = shootout(r2, s(better, other), s(other, better));
    m2.winner = m2.pens[0] > m2.pens[1] ? better : other;
  }
  m1.winner = undefined;
  return [m1, m2];
}

/** Põe a data no jogo. */
export function stamp<T extends MatchResult>(m: T, day: number): T {
  m.day = day;
  return m;
}

/** Ida e volta com sorteio próprio de cada jogo e datas (rodadas `k1` e `k2` de `total`). */
export function tie(env: CompEnv, better: string, other: string, advantage: boolean, k1: number, k2: number, total: number): [MatchResult, MatchResult] {
  const legs = twoLegs([env.matchRng(), env.matchRng()], env.ctx, better, other, advantage);
  stamp(legs[0], env.dayOf(k1, total));
  stamp(legs[1], env.dayOf(k2, total));
  return legs;
}

/** Jogo eliminatório único (prorrogação e pênaltis) com data. */
export function single(env: CompEnv, h: string, a: string, neutral: boolean, k: number, total: number): MatchResult {
  return stamp(knockout(env.matchRng(), env.ctx, h, a, neutral), env.dayOf(k, total));
}

function cupMatch(env: CompEnv, round: string, r: MatchResult, playerTier: Tier, advanced: boolean | null): CupMatch {
  const home = r.home === PLAYER;
  const opp = home ? r.away : r.home;
  const mine = home ? r.hg : r.ag;
  const theirs = home ? r.ag : r.hg;
  const oppTier = env.tierOf(opp);
  const won = advanced === null ? mine > theirs : advanced;
  return {
    round,
    opponent: env.name(opp),
    opponentTier: oppTier,
    home,
    result: r,
    won,
    advanced,
    giantKill: advanced === true && oppTier !== null && oppTier <= playerTier - 3,
  };
}

/** Registra os jogos do jogador num confronto (jogo único ou ida e volta). */
function logTie(env: CompEnv, log: CupMatch[], round: string, legs: MatchResult[], playerTier: Tier): void {
  if (!legs.some((m) => m.home === PLAYER || m.away === PLAYER)) return;
  const winner = legs[legs.length - 1].winner;
  legs.forEach((m, i) => {
    const last = i === legs.length - 1;
    const label = legs.length === 2 ? `${round} (${i === 0 ? 'ida' : 'volta'})` : round;
    log.push(cupMatch(env, label, m, playerTier, last ? winner === PLAYER : null));
  });
}

/* ------------------------------ helpers de fase ------------------------------ */

/** "nas quartas de final", "na semifinal", "na 2ª fase". */
export function roundPrep(round: string): string {
  const r = round.toLowerCase();
  return /^(oitavas|quartas)/.test(r) ? `nas ${r}` : `na ${r}`;
}

/**
 * Pontos corridos (turno único ou turno e returno). A rodada `r` acontece na rodada `k0 + r` do calendário.
 * `trackName`: se a competição é do jogador, registra a fase para as tabelas parciais.
 */
export function leagueRun(env: CompEnv, ids: string[], double: boolean, deductions: Record<string, number>, k0: number, total: number, trackName?: string) {
  const table = new Map<string, TableRow>();
  for (const id of ids) table.set(id, emptyRow(id, deductions[id] ?? 0));
  const full = roundRobin(ids);
  const schedule = double ? full : full.slice(0, ids.length % 2 === 0 ? ids.length - 1 : ids.length);
  const stage = env.track && trackName ? env.track.stage(trackName, ids, deductions) : -1;
  const rounds: MatchResult[][] = [];
  schedule.forEach((round, r) => {
    const day = env.dayOf(k0 + r, total);
    const res: MatchResult[] = [];
    for (const [h, a] of round) {
      const m = stamp(playMatch(env.matchRng(), h, a, env.ctx.strength(h, a), env.ctx.strength(a, h), env.ctx.homeAdv(h), env.ctx.goalMult?.(h, a)), day);
      applyResult(table, m);
      if (stage >= 0) env.track!.match(stage, m);
      res.push(m);
    }
    rounds.push(res);
  });
  return { table: sortTable([...table.values()]), rounds };
}

/** Rodadas de uma fase de pontos (para o calendário). */
export function roundsOf(n: number, double: boolean): number {
  const r = n % 2 === 0 ? n - 1 : n;
  return double ? r * 2 : r;
}

function playerLeagueMatches(rounds: MatchResult[][]): MatchResult[] {
  return rounds.flatMap((r) => r.filter((m) => m.home === PLAYER || m.away === PLAYER));
}

/** Escolhe os `n` primeiros elegíveis da ordem; marca se o jogador foi pulado. */
function takeEligible(order: string[], n: number, env: CompEnv): { picked: string[]; barred: boolean } {
  const picked: string[] = [];
  let barred = false;
  for (const id of order) {
    if (picked.length >= n) break;
    if (env.eligible(id)) picked.push(id);
    else if (id === PLAYER) barred = true;
  }
  return { picked, barred };
}

function rankAfterKnockout(phaseOrder: string[], champion: string, vice: string, eliminatedByRound: string[][]): string[] {
  const out = [champion, vice];
  for (const group of eliminatedByRound) {
    const sorted = group.slice().sort((a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b));
    for (const id of sorted) if (!out.includes(id)) out.push(id);
  }
  for (const id of phaseOrder) if (!out.includes(id)) out.push(id);
  return out;
}

function finishText(ranking: string[], champion: string, vice: string, koRounds: { name: string; losers: string[] }[], phaseOrder: string[], phaseName: string): string {
  if (champion === PLAYER) return 'Campeão';
  if (vice === PLAYER) return 'Vice-campeão';
  for (const r of koRounds) if (r.losers.includes(PLAYER)) return `Caiu ${roundPrep(r.name)}`;
  const pos = phaseOrder.indexOf(PLAYER) + 1;
  return pos > 0 ? `${pos}º na ${phaseName}` : `${ranking.indexOf(PLAYER) + 1}º`;
}

function compResult(env: CompEnv, id: CompId, name: string, tier: Tier, ids: string[], tables: CompResult['tables'], ties: CupMatch[], champion: string, finish: string): CompResult {
  const names: Record<string, string> = {};
  for (const x of ids) names[x] = env.name(x);
  return { id, name, tier, tables, ties, champion: env.name(champion), finish, won: champion === PLAYER, clubNames: names };
}

/* ------------------------------ formatos ------------------------------ */

/** Séries A e B: pontos corridos, turno e returno. */
export function pointsLeague(env: CompEnv, id: CompId, name: string, tier: Tier, ids: string[], up: number, down: number, deductions: Record<string, number>): LeagueOutcome {
  const total = roundsOf(ids.length, true);
  const run = leagueRun(env, ids, true, deductions, 0, total, 'Classificação');
  const order = run.table.map((r) => r.clubId);
  const { picked, barred } = takeEligible(order, up, env);
  const relegated = order.slice(-down);
  const has = ids.includes(PLAYER);
  const pos = order.indexOf(PLAYER) + 1;
  return {
    comp: has ? compResult(env, id, name, tier, ids, [{ name: 'Classificação', rows: run.table }], [], order[0], pos === 1 ? 'Campeão' : `${pos}º lugar`) : null,
    ranking: order,
    champion: order[0],
    promoted: up > 0 ? picked : [],
    relegated,
    barred: up > 0 && barred,
    playerMatches: playerLeagueMatches(run.rounds),
    rounds: run.rounds,
    roundIds: ids,
    tables: [run.table],
  };
}

/**
 * Série C: 1ª fase em turno único → 8 melhores em 2 quadrangulares (turno e returno) →
 * 2 de cada grupo sobem; final em ida e volta entre os líderes. Os 4 últimos da 1ª fase caem.
 */
export function serieC(env: CompEnv, ids: string[], deductions: Record<string, number>): LeagueOutcome {
  const tier: Tier = 3;
  const r1 = roundsOf(ids.length, false);
  const total = r1 + 6 + 2;
  const first = leagueRun(env, ids, false, deductions, 0, total, '1ª fase');
  const order = first.table.map((r) => r.clubId);
  const top8 = order.slice(0, 8);
  const groups = [
    [top8[0], top8[3], top8[4], top8[7]],
    [top8[1], top8[2], top8[5], top8[6]],
  ];
  const groupTables = groups.map((g, gi) => leagueRun(env, g, true, {}, r1, total, `Quadrangular ${gi === 0 ? 'A' : 'B'}`));
  const promoted: string[] = [];
  let barred = false;
  for (const gt of groupTables) {
    const { picked, barred: b } = takeEligible(gt.table.map((r) => r.clubId), 2, env);
    promoted.push(...picked);
    barred = barred || b;
  }
  const leaders = groupTables.map((g) => g.table[0].clubId);
  const ties: CupMatch[] = [];
  const better = order.indexOf(leaders[0]) < order.indexOf(leaders[1]) ? leaders[0] : leaders[1];
  const other = better === leaders[0] ? leaders[1] : leaders[0];
  const final = tie(env, better, other, false, r1 + 6, r1 + 7, total);
  logTie(env, ties, 'Final', final, tier);
  const champion = final[1].winner!;
  const vice = champion === better ? other : better;
  const relegated = order.slice(-4);
  const has = ids.includes(PLAYER);
  const groupLosers = groupTables.flatMap((g) => g.table.slice(2).map((r) => r.clubId));
  const ranking = rankAfterKnockout(order, champion, vice, [groupTables.flatMap((g) => g.table.slice(1, 2).map((r) => r.clubId)), groupLosers]);
  let finish = finishText(ranking, champion, vice, [], order, '1ª fase');
  for (let gi = 0; gi < 2; gi++) {
    const pos = groupTables[gi].table.findIndex((r) => r.clubId === PLAYER);
    if (pos >= 0 && champion !== PLAYER && vice !== PLAYER) finish = `${pos + 1}º no quadrangular ${gi === 0 ? 'A' : 'B'}`;
  }
  return {
    comp: has
      ? compResult(env, 'serie_c', 'Série C', tier, ids, [
          { name: '1ª fase', rows: first.table },
          { name: 'Quadrangular A', rows: groupTables[0].table },
          { name: 'Quadrangular B', rows: groupTables[1].table },
        ], ties, champion, finish)
      : null,
    ranking,
    champion,
    promoted,
    relegated,
    barred,
    playerMatches: [...playerLeagueMatches(first.rounds), ...groupTables.flatMap((g) => playerLeagueMatches(g.rounds)), ...final.filter((m) => m.home === PLAYER || m.away === PLAYER)],
    rounds: first.rounds,
    roundIds: ids,
    tables: [first.table, ...groupTables.map((g) => g.table)],
  };
}

/** Divide em grupos pelo método da serpentina (potes por força). */
function snakeGroups(ids: string[], count: number, strength: (id: string) => number): string[][] {
  const sorted = ids.slice().sort((a, b) => strength(b) - strength(a) || (a < b ? -1 : 1));
  const groups: string[][] = Array.from({ length: count }, () => []);
  sorted.forEach((id, i) => {
    const round = Math.floor(i / count);
    const pos = i % count;
    groups[round % 2 === 0 ? pos : count - 1 - pos].push(id);
  });
  return groups;
}

const GROUP_LETTERS = 'ABCDEFGH';

/**
 * Série D: 32 clubes em 8 grupos de 4 (turno e returno) → 16 avançam →
 * oitavas e quartas em ida e volta (quem passa das quartas sobe) → semi e final em ida e volta.
 */
export function serieD(env: CompEnv, ids: string[]): LeagueOutcome {
  const tier: Tier = 4;
  const groups = snakeGroups(ids, 8, (id) => env.ctx.strength(id, id));
  const total = 6 + 8;
  const tables = groups.map((g, gi) => leagueRun(env, g, true, {}, 0, total, g.includes(PLAYER) ? `Grupo ${GROUP_LETTERS[gi]}` : undefined));
  const ties: CupMatch[] = [];
  // oitavas: 1º do grupo X x 2º do grupo vizinho
  let alive: string[] = [];
  const pairs: [string, string][] = [];
  for (let i = 0; i < 8; i += 2) {
    pairs.push([tables[i].table[0].clubId, tables[i + 1].table[1].clubId]);
    pairs.push([tables[i + 1].table[0].clubId, tables[i].table[1].clubId]);
  }
  const groupOrder = tables.flatMap((t) => t.table.map((r) => r.clubId));
  const seedRank = (id: string) => {
    for (const t of tables) {
      const i = t.table.findIndex((r) => r.clubId === id);
      if (i >= 0) return i * 100 - t.table[i].points;
    }
    return 999;
  };
  const playRound = (ps: [string, string][], name: string, losers: string[], k: number) => {
    const winners: string[] = [];
    for (const [a, b] of ps) {
      const better = seedRank(a) <= seedRank(b) ? a : b;
      const other = better === a ? b : a;
      const legs = tie(env, better, other, true, k, k + 1, total);
      logTie(env, ties, name, legs, tier);
      const w = legs[1].winner!;
      winners.push(w);
      losers.push(w === better ? other : better);
    }
    return winners;
  };
  const koRounds: { name: string; losers: string[] }[] = [
    { name: 'Oitavas de final', losers: [] },
    { name: 'Quartas de final', losers: [] },
    { name: 'Semifinal', losers: [] },
  ];
  alive = playRound(pairs, 'Oitavas de final', koRounds[0].losers, 6);
  const qfPairs: [string, string][] = [[alive[0], alive[1]], [alive[2], alive[3]], [alive[4], alive[5]], [alive[6], alive[7]]];
  alive = playRound(qfPairs, 'Quartas de final', koRounds[1].losers, 8);
  // quem passa das quartas sobe (se tiver estádio; senão, o eliminado daquele confronto herda a vaga)
  const promoted: string[] = [];
  let barred = false;
  alive.forEach((w, i) => {
    if (env.eligible(w)) promoted.push(w);
    else {
      if (w === PLAYER) barred = true;
      const loser = koRounds[1].losers[i];
      if (env.eligible(loser)) promoted.push(loser);
    }
  });
  const sfWinners = playRound([[alive[0], alive[1]], [alive[2], alive[3]]], 'Semifinal', koRounds[2].losers, 10);
  const better = seedRank(sfWinners[0]) <= seedRank(sfWinners[1]) ? sfWinners[0] : sfWinners[1];
  const other = better === sfWinners[0] ? sfWinners[1] : sfWinners[0];
  const final = tie(env, better, other, false, 12, 13, total);
  logTie(env, ties, 'Final', final, tier);
  const champion = final[1].winner!;
  const vice = champion === better ? other : better;
  const groupLosers = tables.flatMap((t) => t.table.slice(2).map((r) => r.clubId));
  const ranking = rankAfterKnockout(groupOrder, champion, vice, [koRounds[2].losers, koRounds[1].losers, koRounds[0].losers, groupLosers]);
  const has = ids.includes(PLAYER);
  let finish = finishText(ranking, champion, vice, [...koRounds].reverse(), groupOrder, 'fase de grupos');
  const gi = tables.findIndex((t) => t.table.some((r) => r.clubId === PLAYER));
  if (gi >= 0 && groupLosers.includes(PLAYER)) {
    finish = `${tables[gi].table.findIndex((r) => r.clubId === PLAYER) + 1}º no grupo ${GROUP_LETTERS[gi]}`;
  }
  return {
    comp: has ? compResult(env, 'serie_d', 'Série D', tier, ids, gi >= 0 ? [{ name: `Grupo ${GROUP_LETTERS[gi]}`, rows: tables[gi].table }] : [], ties, champion, finish) : null,
    ranking,
    champion,
    promoted,
    relegated: [],
    barred,
    playerMatches: [...tables.flatMap((t) => playerLeagueMatches(t.rounds)), ...ties.map((t) => t.result)],
    tables: tables.map((t) => t.table),
  };
}

export interface EstadualSpec {
  id: CompId;
  name: string;
  tier: Tier;
  /** quantos vão ao mata-mata (8 ou 4) */
  knockout: 8 | 4;
  /** final em ida e volta? */
  twoLegFinal: boolean;
  up: number;
  down: number;
  /** o clube do jogador nunca cai deste (fundo da pirâmide) */
  floor?: boolean;
}

/**
 * Estaduais e Várzea: 1ª fase em turno único → mata-mata (jogo único na casa do mais bem colocado) →
 * final (ida e volta nos estaduais). Os finalistas sobem; os últimos da 1ª fase caem.
 */
/** Jogo único na casa do de melhor campanha; empate classifica quem fez a melhor 1ª fase. */
function singleWithAdvantage(env: CompEnv, better: string, other: string, day: number): MatchResult {
  const { ctx } = env;
  const bonus = (id: string) => ctx.knockoutBonus?.(id) ?? 0;
  const m = stamp(playMatch(env.matchRng(), better, other, ctx.strength(better, other) + bonus(better), ctx.strength(other, better) + bonus(other), ctx.homeAdv(better), ctx.goalMult?.(better, other)), day);
  if (m.hg > m.ag) m.winner = better;
  else if (m.ag > m.hg) m.winner = other;
  else {
    m.winner = better;
    m.advantage = true;
  }
  return m;
}

export function estadual(env: CompEnv, spec: EstadualSpec, ids: string[], deductions: Record<string, number>): LeagueOutcome {
  const r1 = roundsOf(ids.length, false);
  const names = spec.knockout === 8 ? ['Quartas de final', 'Semifinal'] : ['Semifinal'];
  const legsPer = spec.twoLegFinal ? 2 : 1;
  const total = r1 + (names.length + 1) * legsPer;
  const first = leagueRun(env, ids, false, deductions, 0, total, '1ª fase');
  const order = first.table.map((r) => r.clubId);
  const ties: CupMatch[] = [];
  let alive = order.slice(0, spec.knockout);
  const koRounds: { name: string; losers: string[] }[] = [];
  let k = r1;
  for (const roundName of names) {
    const losers: string[] = [];
    const next: string[] = [];
    const n = alive.length;
    for (let i = 0; i < n / 2; i++) {
      const better = alive[i];
      const other = alive[n - 1 - i];
      const legs = spec.twoLegFinal ? tie(env, better, other, true, k, k + 1, total) : [singleWithAdvantage(env, better, other, env.dayOf(k, total))];
      logTie(env, ties, roundName, legs, spec.tier);
      const w = legs[legs.length - 1].winner!;
      next.push(w);
      losers.push(w === better ? other : better);
    }
    koRounds.push({ name: roundName, losers });
    alive = next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    k += legsPer;
  }
  const [better, other] = alive;
  const finalLegs = spec.twoLegFinal ? tie(env, better, other, false, k, k + 1, total) : [single(env, better, other, true, k, total)];
  logTie(env, ties, 'Final', finalLegs, spec.tier);
  const champion = finalLegs[finalLegs.length - 1].winner!;
  const vice = champion === better ? other : better;
  const ranking = rankAfterKnockout(order, champion, vice, [...koRounds].reverse().map((r) => r.losers));
  const { picked, barred } = spec.up > 0 ? takeEligible(ranking, spec.up, env) : { picked: [], barred: false };
  const relegated: string[] = [];
  for (let i = order.length - 1; i >= 0 && relegated.length < spec.down; i--) {
    if (spec.floor && order[i] === PLAYER) continue;
    if (!picked.includes(order[i])) relegated.push(order[i]);
  }
  const has = ids.includes(PLAYER);
  return {
    comp: has
      ? compResult(env, spec.id, spec.name, spec.tier, ids, [{ name: '1ª fase', rows: first.table }], ties, champion, finishText(ranking, champion, vice, [...koRounds].reverse(), order, '1ª fase'))
      : null,
    ranking,
    champion,
    promoted: picked,
    relegated,
    barred,
    playerMatches: [...playerLeagueMatches(first.rounds), ...ties.map((t) => t.result)],
    rounds: first.rounds,
    roundIds: ids,
    tables: [first.table],
  };
}

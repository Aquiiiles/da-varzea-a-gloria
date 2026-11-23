import { FOREIGN_CITY, FOREIGN_PREFIX, WORLD_REGIONS } from '../data/names';
import { knockout, type LeagueContext } from './league';
import type { Rng } from './rng';
import type { CompetitionId, CupMatch, CupRun, MatchResult, Tier } from './types';

export const PLAYER = 'player';

export interface CupResult {
  run: CupRun | null;
  championId: string;
  /** todos os jogos do jogador (para momentos ao vivo) */
  playerMatches: CupMatch[];
}

interface CupEnv {
  rng: Rng;
  ctx: LeagueContext;
  name: (id: string) => string;
  tierOf: (id: string) => Tier | null;
  playerTier: Tier;
}

/** Sorteia confrontos e joga uma fase. `byes` clubes passam direto (os de divisão mais alta). */
function playRound(env: CupEnv, pool: string[], roundName: string, neutral: boolean, byes: number, log: CupMatch[]): string[] {
  const { rng, ctx } = env;
  let entrants = pool.slice();
  const passed: string[] = [];
  if (byes > 0) {
    const ranked = entrants.slice().sort((a, b) => (env.tierOf(a) ?? 0) - (env.tierOf(b) ?? 0) || ctx.strength(b, a) - ctx.strength(a, b) || (a < b ? -1 : 1));
    const lucky = ranked.slice(0, byes);
    passed.push(...lucky);
    entrants = entrants.filter((id) => !lucky.includes(id));
  }
  const drawn = rng.shuffle(entrants);
  for (let i = 0; i + 1 < drawn.length; i += 2) {
    const h = drawn[i];
    const a = drawn[i + 1];
    const r = knockout(rng, ctx, h, a, neutral);
    passed.push(r.winner!);
    if (h === PLAYER || a === PLAYER) log.push(toCupMatch(env, roundName, r));
  }
  if (drawn.length % 2 === 1) passed.push(drawn[drawn.length - 1]);
  return passed;
}

function toCupMatch(env: CupEnv, round: string, r: MatchResult): CupMatch {
  const home = r.home === PLAYER;
  const opp = home ? r.away : r.home;
  const oppTier = env.tierOf(opp);
  const won = r.winner === PLAYER;
  return {
    round,
    opponent: env.name(opp),
    opponentTier: oppTier,
    home,
    result: r,
    won,
    giantKill: won && oppTier !== null && oppTier <= env.playerTier - 3,
  };
}

/** Prêmio por vitória em cada fase (mil £); cresce a cada fase. */
function prizeFor(id: CompetitionId, roundIdx: number): number {
  switch (id) {
    case 'copa': return Math.round(4 * Math.pow(1.55, roundIdx));
    case 'cc': return Math.round(4000 * Math.pow(1.4, roundIdx));
    case 'le': return Math.round(1500 * Math.pow(1.4, roundIdx));
    case 'mundial': return 3000;
  }
}
const CHAMPION_BONUS: Record<CompetitionId, number> = { copa: 600, cc: 20000, le: 6000, mundial: 15000 };
const COMP_NAME: Record<CompetitionId, string> = { copa: 'Copa Nacional', cc: 'Copa dos Campeões', le: 'Liga Europa', mundial: 'Mundial de Clubes' };

function finishRun(id: CompetitionId, rounds: string[], log: CupMatch[], championId: string): CupRun | null {
  if (log.length === 0) return null;
  const champion = championId === PLAYER;
  let prize = 0;
  log.forEach((m) => {
    if (m.won) prize += prizeFor(id, rounds.indexOf(m.round));
  });
  if (champion) prize += CHAMPION_BONUS[id];
  const last = log[log.length - 1];
  const reached = champion ? 'Campeão' : last.round === 'Final' ? 'Vice-campeão' : `Caiu na ${last.round.toLowerCase()}`;
  return { id, name: COMP_NAME[id], matches: log, champion, reached, prize };
}

/* ------------------------------ Copa Nacional ------------------------------ */

export const NATIONAL_ROUNDS = [
  'Preliminar', '1ª fase', '2ª fase', '3ª fase', 'Fase de 64', 'Fase de 32', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final',
];

/**
 * Copa Nacional estilo mata-mata aberto: os pequenos entram cedo e podem cruzar com gigantes.
 * Preliminar: níveis 6–8 (64 clubes) · 1ª fase: +nível 5 · 2ª fase: +níveis 3–4 · 3ª fase: classifica 20 ·
 * Fase de 64: +níveis 1–2 (44 clubes) · ... · Final em campo neutro.
 */
export function nationalCup(env: CupEnv, byTier: Record<Tier, string[]>): CupResult {
  const log: CupMatch[] = [];
  const R = NATIONAL_ROUNDS;
  let pool = [...byTier[6], ...byTier[7], ...byTier[8]];
  pool = playRound(env, pool, R[0], false, 0, log);
  pool = playRound(env, [...pool, ...byTier[5]], R[1], false, 0, log);
  pool = playRound(env, [...pool, ...byTier[3], ...byTier[4]], R[2], false, 0, log);
  // 3ª fase: ajusta para sobrarem exatamente 20 classificados
  const byes = Math.max(0, 40 - pool.length);
  pool = playRound(env, pool, R[3], false, byes, log).slice(0, 20);
  pool = [...pool, ...byTier[1], ...byTier[2]];
  for (let i = 4; i < R.length; i++) pool = playRound(env, pool, R[i], R[i] === 'Final', 0, log);
  const championId = pool[0];
  return { run: finishRun('copa', R, log, championId), championId, playerMatches: log };
}

/* ------------------------------ Copas internacionais ------------------------------ */

export interface ForeignClub {
  id: string;
  name: string;
  strength: number;
}

export function foreignClubs(rng: Rng, count: number, mean: number, spread: number, prefix: string): ForeignClub[] {
  const taken = new Set<string>();
  const out: ForeignClub[] = [];
  for (let i = 0; out.length < count && i < count * 10; i++) {
    const name = `${rng.pick(FOREIGN_PREFIX)} ${rng.pick(FOREIGN_CITY)}`;
    if (taken.has(name)) continue;
    taken.add(name);
    out.push({ id: `${prefix}${out.length}`, name, strength: Math.round((mean + rng.normal(spread)) * 10) / 10 });
  }
  return out;
}

export const CONTINENTAL_ROUNDS = ['Fase de 32', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

/** Copa dos Campeões / Liga Europa: 32 clubes em mata-mata, final em campo neutro. */
export function continentalCup(env: CupEnv, id: 'cc' | 'le', entrants: string[]): CupResult {
  const log: CupMatch[] = [];
  let pool = entrants.slice(0, 32);
  for (const round of CONTINENTAL_ROUNDS) pool = playRound(env, pool, round, round === 'Final', 0, log);
  const championId = pool[0];
  return { run: finishRun(id, CONTINENTAL_ROUNDS, log, championId), championId, playerMatches: log };
}

export const WORLD_ROUNDS = ['Quartas de final', 'Semifinal', 'Final'];

/** Mundial de Clubes: 8 campeões continentais, tudo em campo neutro. */
export function worldCup(env: CupEnv, entrants: string[]): CupResult {
  const log: CupMatch[] = [];
  let pool = entrants.slice(0, 8);
  for (const round of WORLD_ROUNDS) pool = playRound(env, pool, round, true, 0, log);
  return { run: finishRun('mundial', WORLD_ROUNDS, log, pool[0]), championId: pool[0], playerMatches: log };
}

export function worldRegionName(rng: Rng): string {
  return rng.pick(WORLD_REGIONS);
}

import { REAL_SA, REAL_WORLD } from '../data/names';
import { PLAYER, leagueRun, roundPrep, single, tie, type CompEnv } from './competitions';
import type { Rng } from './rng';
import type { CompetitionId, CupMatch, CupRun, MatchResult, Tier } from './types';

export { PLAYER };

export interface CupResult {
  run: CupRun | null;
  championId: string;
  playerMatches: CupMatch[];
}

export interface CupEnv extends CompEnv {
  playerTier: Tier;
}

const COMP_NAME: Record<CompetitionId, string> = {
  estado: 'Copa do Estado',
  copa: 'Copa do Brasil',
  cc: 'Libertadores',
  le: 'Sul-Americana',
  mundial: 'Mundial de Clubes',
};

/** Prêmio por fase vencida (R$ mil); cresce a cada fase. */
function prizeFor(id: CompetitionId, roundIdx: number): number {
  switch (id) {
    case 'estado': return Math.round(10 * Math.pow(1.5, roundIdx));
    case 'copa': return Math.round(400 * Math.pow(1.7, roundIdx));
    case 'cc': return Math.round(6000 * Math.pow(1.35, roundIdx));
    case 'le': return Math.round(2000 * Math.pow(1.35, roundIdx));
    case 'mundial': return 15000;
  }
}
const CHAMPION_BONUS: Record<CompetitionId, number> = { estado: 150, copa: 30000, cc: 60000, le: 20000, mundial: 60000 };

function toMatch(env: CupEnv, round: string, r: MatchResult, advanced: boolean | null): CupMatch {
  const home = r.home === PLAYER;
  const opp = home ? r.away : r.home;
  const oppTier = env.tierOf(opp);
  const mine = home ? r.hg : r.ag;
  const theirs = home ? r.ag : r.hg;
  return {
    round,
    opponent: env.name(opp),
    opponentTier: oppTier,
    home,
    result: r,
    won: advanced === null ? mine > theirs : advanced,
    advanced,
    giantKill: advanced === true && oppTier !== null && oppTier <= env.playerTier - 3,
  };
}

/**
 * Uma fase eliminatória. `twoLeg`: ida e volta; senão jogo único na casa do clube de nível mais baixo (o "pequeno").
 * `k`/`total`: rodada do calendário da copa (a volta é a rodada `k + 1`).
 */
function playKoRound(env: CupEnv, pool: string[], round: string, opts: { twoLeg?: boolean; neutral?: boolean; byes?: number }, log: CupMatch[], k: number, total: number): string[] {
  const { rng, ctx } = env;
  let entrants = pool.slice();
  const passed: string[] = [];
  if (opts.byes && opts.byes > 0) {
    const ranked = entrants.slice().sort((a, b) => (env.tierOf(a) ?? 0) - (env.tierOf(b) ?? 0) || ctx.strength(b, a) - ctx.strength(a, b) || (a < b ? -1 : 1));
    const lucky = ranked.slice(0, opts.byes);
    passed.push(...lucky);
    entrants = entrants.filter((id) => !lucky.includes(id));
  }
  const drawn = rng.shuffle(entrants);
  for (let i = 0; i + 1 < drawn.length; i += 2) {
    let a = drawn[i];
    let b = drawn[i + 1];
    // o de nível mais alto (número menor) é o "grande": decide em casa na volta, ou visita no jogo único
    const ta = env.tierOf(a) ?? 0;
    const tb = env.tierOf(b) ?? 0;
    if (ta > tb) [a, b] = [b, a]; // a = grande, b = pequeno
    if (opts.twoLeg) {
      const legs = tie(env, a, b, false, k, k + 1, total);
      if (a === PLAYER || b === PLAYER) {
        log.push(toMatch(env, `${round} (ida)`, legs[0], null));
        log.push(toMatch(env, `${round} (volta)`, legs[1], legs[1].winner === PLAYER));
      }
      passed.push(legs[1].winner!);
    } else {
      const r = opts.neutral ? single(env, a, b, true, k, total) : single(env, b, a, false, k, total);
      if (a === PLAYER || b === PLAYER) log.push(toMatch(env, round, r, r.winner === PLAYER));
      passed.push(r.winner!);
    }
  }
  if (drawn.length % 2 === 1) passed.push(drawn[drawn.length - 1]);
  return passed;
}

function finishRun(id: CompetitionId, rounds: string[], log: CupMatch[], championId: string): CupRun | null {
  if (log.length === 0) return null;
  const champion = championId === PLAYER;
  let prize = 0;
  for (const m of log) {
    if (m.advanced === true) {
      const base = m.round.replace(/ \((ida|volta)\)$/, '');
      prize += prizeFor(id, Math.max(0, rounds.indexOf(base)));
    }
  }
  if (champion) prize += CHAMPION_BONUS[id];
  const last = log[log.length - 1];
  const lastRound = last.round.replace(/ \((ida|volta)\)$/, '');
  const reached = champion
    ? 'Campeão'
    : lastRound === 'Final'
      ? 'Vice-campeão'
      : lastRound.startsWith('Grupo')
        ? 'Caiu na fase de grupos'
        : `Caiu ${roundPrep(lastRound)}`;
  return { id, name: COMP_NAME[id], matches: log, champion, reached, prize };
}

/* ------------------------------ Copa do Estado ------------------------------ */

export const STATE_CUP_ROUNDS = ['1ª fase', '2ª fase', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

/** Todos os clubes do estado (Estadual, Série B estadual e Várzea). Os maiores entram na 2ª fase. */
export function stateCup(env: CupEnv, clubs: string[]): CupResult {
  const log: CupMatch[] = [];
  const R = STATE_CUP_ROUNDS;
  const byes = Math.max(0, 64 - clubs.length);
  let pool = playKoRound(env, clubs, R[0], { byes }, log, 0, R.length).slice(0, 32);
  for (let i = 1; i < R.length; i++) pool = playKoRound(env, pool, R[i], { neutral: R[i] === 'Final' }, log, i, R.length);
  return { run: finishRun('estado', R, log, pool[0]), championId: pool[0], playerMatches: log };
}

/* ------------------------------ Copa do Brasil ------------------------------ */

export const NATIONAL_ROUNDS = ['1ª fase', '2ª fase', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

/** 64 clubes: 1ª e 2ª fase em jogo único na casa do pequeno; da 3ª fase em diante, ida e volta. */
export function nationalCup(env: CupEnv, entrants: string[]): CupResult {
  const log: CupMatch[] = [];
  const R = NATIONAL_ROUNDS;
  // 64 → 32 → 16 (jogo único) → 8 → 4 → 2 → 1 (ida e volta)
  const total = 2 + (R.length - 2) * 2;
  let pool = entrants.slice(0, 64);
  pool = playKoRound(env, pool, R[0], {}, log, 0, total);
  pool = playKoRound(env, pool, R[1], {}, log, 1, total);
  for (let i = 2; i < R.length; i++) pool = playKoRound(env, pool, R[i], { twoLeg: true }, log, 2 + (i - 2) * 2, total);
  return { run: finishRun('copa', R, log, pool[0]), championId: pool[0], playerMatches: log };
}

/* ------------------------------ continentais ------------------------------ */

export interface ForeignClub {
  id: string;
  name: string;
  strength: number;
}

/** Adversários estrangeiros: clubes reais sorteados; os mais tradicionais ficam com as maiores forças. */
export function foreignClubs(rng: Rng, count: number, mean: number, spread: number, prefix: string, southAmerica: boolean): ForeignClub[] {
  const list = southAmerica ? REAL_SA : REAL_WORLD;
  const picked = rng.shuffle(list).slice(0, count).sort((a, b) => list.indexOf(a) - list.indexOf(b));
  const strengths = picked.map(() => Math.round((mean + rng.normal(spread)) * 10) / 10).sort((a, b) => b - a);
  return picked.map((name, i) => ({ id: `${prefix}${i}`, name, strength: strengths[i] }));
}

export const CONTINENTAL_ROUNDS = ['Fase de grupos', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'];

/** Libertadores: 8 grupos de 4 (turno e returno) → mata-mata em ida e volta → final em jogo único (campo neutro). */
export function continentalCup(env: CupEnv, id: 'cc' | 'le', entrants: string[]): CupResult {
  const log: CupMatch[] = [];
  const pool = env.rng.shuffle(entrants.slice(0, 32));
  const groups = Array.from({ length: 8 }, (_, i) => pool.slice(i * 4, i * 4 + 4));
  const qualified: string[] = [];
  const total = 6 + 3 * 2 + 1;
  groups.forEach((g, gi) => {
    const run = leagueRun(env, g, true, {}, 0, total);
    const order = run.table.map((r) => r.clubId);
    qualified.push(order[0], order[1]);
    if (g.includes(PLAYER)) {
      for (const round of run.rounds) {
        for (const m of round) if (m.home === PLAYER || m.away === PLAYER) log.push(toMatch(env, `Grupo ${'ABCDEFGH'[gi]}`, m, null));
      }
      if (order.indexOf(PLAYER) <= 1) log[log.length - 1] = { ...log[log.length - 1], advanced: true };
      else log[log.length - 1] = { ...log[log.length - 1], advanced: false };
    }
  });
  // oitavas: 1º de um grupo x 2º de outro
  let alive: string[] = [];
  for (let i = 0; i < 8; i += 2) alive.push(qualified[i * 2], qualified[(i + 1) * 2 + 1], qualified[(i + 1) * 2], qualified[i * 2 + 1]);
  CONTINENTAL_ROUNDS.slice(1).forEach((round, i) => {
    alive = playKoRoundOrdered(env, alive, round, round === 'Final', log, 6 + i * 2, total);
  });
  return { run: finishRun(id, CONTINENTAL_ROUNDS, log, alive[0]), championId: alive[0], playerMatches: log };
}

/** Mata-mata com chaveamento já definido (pares em ordem). */
function playKoRoundOrdered(env: CupEnv, pool: string[], round: string, final: boolean, log: CupMatch[], k: number, total: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const a = pool[i];
    const b = pool[i + 1];
    if (final) {
      const r = single(env, a, b, true, k, total);
      if (a === PLAYER || b === PLAYER) log.push(toMatch(env, round, r, r.winner === PLAYER));
      out.push(r.winner!);
    } else {
      const legs = tie(env, a, b, false, k, k + 1, total);
      if (a === PLAYER || b === PLAYER) {
        log.push(toMatch(env, `${round} (ida)`, legs[0], null));
        log.push(toMatch(env, `${round} (volta)`, legs[1], legs[1].winner === PLAYER));
      }
      out.push(legs[1].winner!);
    }
  }
  return out;
}

export const WORLD_ROUNDS = ['Quartas de final', 'Semifinal', 'Final'];

/** Mundial de Clubes: 8 campeões continentais, jogo único em campo neutro. */
export function worldCup(env: CupEnv, entrants: string[]): CupResult {
  const log: CupMatch[] = [];
  let pool = env.rng.shuffle(entrants.slice(0, 8));
  WORLD_ROUNDS.forEach((round, i) => {
    pool = playKoRoundOrdered(env, pool, round, true, log, i, WORLD_ROUNDS.length);
  });
  return { run: finishRun('mundial', WORLD_ROUNDS, log, pool[0]), championId: pool[0], playerMatches: log };
}

import type { Rng } from './rng';
import type { MatchResult } from './types';

/** Vantagem padrão de jogar em casa, em pontos de força. */
export const BASE_HOME_ADVANTAGE = 1.5;

/** Escala da saturação da diferença de força no placar. */
export const GOAL_SATURATION = 10;

/** Médias de gols (Poisson) a partir da diferença de força (escala de overall: ~4 pontos por divisão). */
export function goalRates(homeStrength: number, awayStrength: number, homeAdv: number): [number, number] {
  // a diferença satura: até ~4 pontos quase linear; diferenças enormes não viram goleadas absurdas
  const raw = homeStrength - awayStrength + homeAdv;
  const d = GOAL_SATURATION * Math.tanh(raw / GOAL_SATURATION);
  const lh = 1.25 * Math.exp(0.12 * d);
  const la = 1.25 * Math.exp(-0.12 * d);
  return [Math.min(6, Math.max(0.12, lh)), Math.min(6, Math.max(0.12, la))];
}

/** Multiplicadores de gol [mandante, visitante] (estilo de jogo). */
export type GoalMult = [number, number];

/**
 * Jogo em dois tempos (modo técnico): o 2º tempo usa outra força e outra estratégia (mudanças no intervalo).
 * Os gols do 1º tempo são sorteados antes, com o mesmo sorteio, então mexer no intervalo não muda o 1º tempo.
 */
export interface SecondHalf {
  /** variação de força no 2º tempo [mandante, visitante] */
  delta: [number, number];
  mult: GoalMult;
}

/** Quem joga em dois tempos (o simulador da temporada liga durante a simulação; null = todos em um bloco). */
let halfHook: ((home: string, away: string) => SecondHalf | null) | null = null;

export function withHalves<T>(hook: (home: string, away: string) => SecondHalf | null, fn: () => T): T {
  const prev = halfHook;
  halfHook = hook;
  try {
    return fn();
  } finally {
    halfHook = prev;
  }
}

/** Tempo normal: um bloco (padrão) ou dois tempos. Devolve também as médias valendo no fim (para a prorrogação). */
function regulation(rng: Rng, home: string, away: string, hs: number, as: number, homeAdv: number, mult: GoalMult): { r: MatchResult; lh: number; la: number } {
  const [lh0, la0] = goalRates(hs, as, homeAdv);
  const lh = lh0 * mult[0];
  const la = la0 * mult[1];
  const second = halfHook?.(home, away);
  if (!second) return { r: { home, away, hg: rng.poisson(lh), ag: rng.poisson(la) }, lh, la };
  const h1 = rng.poisson(lh / 2);
  const a1 = rng.poisson(la / 2);
  const [lh2b, la2b] = goalRates(hs + second.delta[0], as + second.delta[1], homeAdv);
  const lh2 = lh2b * second.mult[0];
  const la2 = la2b * second.mult[1];
  return { r: { home, away, hg: h1 + rng.poisson(lh2 / 2), ag: a1 + rng.poisson(la2 / 2), half: [h1, a1] }, lh: lh2, la: la2 };
}

export function playMatch(
  rng: Rng,
  home: string,
  away: string,
  hs: number,
  as: number,
  homeAdv = BASE_HOME_ADVANTAGE,
  mult: GoalMult = [1, 1],
): MatchResult {
  return regulation(rng, home, away, hs, as, homeAdv, mult).r;
}

/**
 * Mata-mata em jogo único: se empatar, prorrogação (1/3 da média) e pênaltis.
 * `homeAdv` = 0 para campo neutro (finais).
 */
export function playKnockout(
  rng: Rng,
  home: string,
  away: string,
  hs: number,
  as: number,
  homeAdv = BASE_HOME_ADVANTAGE,
  mult: GoalMult = [1, 1],
): MatchResult {
  const { r, lh, la } = regulation(rng, home, away, hs, as, homeAdv, mult);
  if (r.hg === r.ag) {
    r.extraTime = true;
    r.reg = [r.hg, r.ag];
    r.hg += rng.poisson(lh / 3);
    r.ag += rng.poisson(la / 3);
  }
  if (r.hg === r.ag) {
    // pênaltis: quase moeda, com leve viés para o mais forte
    const pHome = 0.5 + Math.max(-0.1, Math.min(0.1, (hs - as) / 90));
    let ph = 0;
    let pa = 0;
    for (let i = 0; i < 5; i++) {
      if (rng.chance(0.75 + (pHome - 0.5) / 2)) ph++;
      if (rng.chance(0.75 - (pHome - 0.5) / 2)) pa++;
    }
    while (ph === pa) {
      if (rng.chance(0.75)) ph++;
      if (rng.chance(0.75)) pa++;
    }
    r.pens = [ph, pa];
  }
  r.winner = winnerOf(r);
  return r;
}

export function winnerOf(r: MatchResult): string | undefined {
  if (r.hg > r.ag) return r.home;
  if (r.ag > r.hg) return r.away;
  if (r.pens) return r.pens[0] > r.pens[1] ? r.home : r.away;
  return undefined;
}

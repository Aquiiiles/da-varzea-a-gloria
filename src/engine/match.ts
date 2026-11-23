import type { Rng } from './rng';
import type { MatchResult } from './types';

/** Vantagem padrão de jogar em casa, em pontos de força. */
export const BASE_HOME_ADVANTAGE = 1.5;

/** Médias de gols (Poisson) a partir da diferença de força (escala de overall: ~4 pontos por divisão). */
export function goalRates(homeStrength: number, awayStrength: number, homeAdv: number): [number, number] {
  const d = homeStrength - awayStrength + homeAdv;
  const lh = 1.25 * Math.exp(0.12 * d);
  const la = 1.25 * Math.exp(-0.12 * d);
  return [Math.min(6, Math.max(0.12, lh)), Math.min(6, Math.max(0.12, la))];
}

/** Multiplicadores de gol [mandante, visitante] (estilo de jogo). */
export type GoalMult = [number, number];

export function playMatch(
  rng: Rng,
  home: string,
  away: string,
  hs: number,
  as: number,
  homeAdv = BASE_HOME_ADVANTAGE,
  mult: GoalMult = [1, 1],
): MatchResult {
  const [lh, la] = goalRates(hs, as, homeAdv);
  return { home, away, hg: rng.poisson(lh * mult[0]), ag: rng.poisson(la * mult[1]) };
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
  const [lh0, la0] = goalRates(hs, as, homeAdv);
  const lh = lh0 * mult[0];
  const la = la0 * mult[1];
  const r: MatchResult = { home, away, hg: rng.poisson(lh), ag: rng.poisson(la) };
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

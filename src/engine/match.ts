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
 * Jogo em blocos (modo técnico): 18 blocos de 5 minutos, cada um com a força e a estratégia daquele momento
 * (substituições, expulsão, lesão). Os blocos são sorteados em ordem, então mexer no minuto 60 não muda nada antes.
 */
export const BLOCKS = 18;
export const BLOCK_MINUTES = 5;

export interface BlockState {
  /** variação de força [mandante, visitante] naquele bloco */
  delta: [number, number];
  mult: GoalMult;
}

/** Plano de um jogo em blocos: o estado de cada bloco (com o placar até ali) e o bônus nos pênaltis [mandante, visitante]. */
export type BlockFn = ((block: number, score: [number, number]) => BlockState) & { pens?: [number, number] };
type BlockHook = (home: string, away: string) => BlockFn | null;

/** Quem joga em blocos (o simulador da temporada liga durante a simulação; null = um bloco só). */
let blockHook: BlockHook | null = null;

export function withBlocks<T>(hook: BlockHook, fn: () => T): T {
  const prev = blockHook;
  blockHook = hook;
  try {
    return fn();
  } finally {
    blockHook = prev;
  }
}

/** Tempo normal: um bloco (padrão) ou 18 blocos de 5 minutos. Devolve também as médias do fim (para a prorrogação). */
function regulation(rng: Rng, home: string, away: string, hs: number, as: number, homeAdv: number, mult: GoalMult): { r: MatchResult; lh: number; la: number; pens?: [number, number] } {
  const [lh0, la0] = goalRates(hs, as, homeAdv);
  const lh = lh0 * mult[0];
  const la = la0 * mult[1];
  const plan = blockHook?.(home, away);
  if (!plan) return { r: { home, away, hg: rng.poisson(lh), ag: rng.poisson(la) }, lh, la };
  const blocks: [number, number][] = [];
  const rates: [number, number][] = [];
  let hg = 0;
  let ag = 0;
  let endH = lh;
  let endA = la;
  for (let b = 0; b < BLOCKS; b++) {
    const st = plan(b, [hg, ag]);
    const [x, y] = goalRates(hs + st.delta[0], as + st.delta[1], homeAdv);
    endH = x * st.mult[0];
    endA = y * st.mult[1];
    rates.push([Math.round(endH * 1000) / 1000, Math.round(endA * 1000) / 1000]);
    const h = rng.poisson(endH / BLOCKS);
    const a = rng.poisson(endA / BLOCKS);
    blocks.push([h, a]);
    hg += h;
    ag += a;
  }
  const half: [number, number] = [0, 0];
  for (let b = 0; b < BLOCKS / 2; b++) {
    half[0] += blocks[b][0];
    half[1] += blocks[b][1];
  }
  return { r: { home, away, hg, ag, half, blocks, rates }, lh: endH, la: endA, pens: plan.pens };
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
  const { r, lh, la, pens: edge } = regulation(rng, home, away, hs, as, homeAdv, mult);
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
      if (rng.chance(0.75 + (pHome - 0.5) / 2 + (edge?.[0] ?? 0))) ph++;
      if (rng.chance(0.75 - (pHome - 0.5) / 2 + (edge?.[1] ?? 0))) pa++;
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

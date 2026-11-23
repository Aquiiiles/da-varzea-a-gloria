import { PALETTE } from '../data/names';
import { OUR_STATE_NATIONAL, SIZES, TIERS } from '../data/pyramid';
import { proClubName, uniqueName, varzeaClubName } from './names';
import type { Rng } from './rng';
import { clamp } from './util';
import type { Club, NationalDiv, StateDiv, Tier } from './types';

export { clamp };

const STOP = /^(fc|de|da|do|das|dos|e|y|the|clube|esporte|futebol|sport|club|associação|atlética|atlético|sociedade|esportiva|grêmio|união|unidos|juventude)$/i;

export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0);
  const strong = words.filter((w) => !STOP.test(w));
  const use = strong.length > 0 ? strong : words;
  if (use.length === 0) return 'FC';
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase();
  return use
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function randomColors(rng: Rng): [string, string] {
  const a = rng.pick(PALETTE);
  let b = rng.pick(PALETTE);
  while (b === a) b = rng.pick(PALETTE);
  return [a, b];
}

/** Nível do clube: divisão nacional se tiver; senão, a estadual. Clube de outro estado sem nacional fica no nível 5. */
export function levelOf(national: NationalDiv | null, stateDiv: StateDiv | null): Tier {
  if (national) return national;
  if (stateDiv === 'B') return 6;
  if (stateDiv === 'V') return 7;
  return 5;
}

export function syncTier(c: Club): void {
  c.tier = levelOf(c.national, c.stateDiv);
}

export function makeClub(rng: Rng, id: string, national: NationalDiv | null, stateDiv: StateDiv | null, taken: Set<string>): Club {
  const tier = levelOf(national, stateDiv);
  const rules = TIERS[tier];
  const name = uniqueName(() => (stateDiv === 'V' ? varzeaClubName(rng) : proClubName(rng)), taken);
  return {
    id,
    name,
    short: initials(name),
    colors: randomColors(rng),
    strength: Math.round(clamp(rules.meanStrength + rng.normal(rules.spread), 30, 95) * 10) / 10,
    tier,
    national,
    stateDiv,
  };
}

/**
 * Mundo inicial:
 * - Séries A, B, C (20 cada) e D (32): alguns clubes são do nosso estado (também jogam o Estadual);
 * - Estadual: 16 clubes do estado (os nacionais do estado + os sem divisão nacional);
 * - Estadual Série B: 16 · Várzea: 19 (+ o clube do jogador);
 * - Outros estados sem divisão nacional: fonte das vagas da Série D e da Copa Nacional.
 */
export function generateWorld(rng: Rng, taken: Set<string>): { clubs: Club[]; serial: number } {
  const clubs: Club[] = [];
  let serial = 0;
  const add = (national: NationalDiv | null, stateDiv: StateDiv | null) => clubs.push(makeClub(rng, `c${serial++}`, national, stateDiv, taken));

  const sizes: Record<NationalDiv, number> = { 1: SIZES.serieA, 2: SIZES.serieB, 3: SIZES.serieC, 4: SIZES.serieD };
  let oursNational = 0;
  for (const d of [1, 2, 3, 4] as NationalDiv[]) {
    const ours = OUR_STATE_NATIONAL[d];
    oursNational += ours;
    for (let i = 0; i < sizes[d]; i++) add(d, i < ours ? 'A' : null);
  }
  for (let i = 0; i < SIZES.estadualA - oursNational; i++) add(null, 'A');
  for (let i = 0; i < SIZES.estadualB; i++) add(null, 'B');
  for (let i = 0; i < SIZES.varzea - 1; i++) add(null, 'V');
  for (let i = 0; i < SIZES.pool; i++) add(null, null);

  // gigantes da Série A: força e prestígio extras
  const serieA = clubs.filter((c) => c.national === 1).sort((a, b) => b.strength - a.strength);
  const prestige = [12, 10, 9, 8, 6, 5, 4, 3, 2];
  prestige.forEach((p, i) => {
    serieA[i].prestige = p;
    serieA[i].strength = Math.min(90, serieA[i].strength + p);
  });
  return { clubs, serial };
}

/** Variação anual da IA: puxa para a média do nível atual + ruído. */
export function driftClub(rng: Rng, club: Club): void {
  const rules = TIERS[club.tier];
  const target = rules.meanStrength + (club.prestige ?? 0);
  const pull = 0.3 * (target - club.strength);
  club.strength = Math.round(clamp(club.strength + pull + rng.normal(1.1), 30, 95) * 10) / 10;
}

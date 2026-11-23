import { CLUB_TYPE, FIRST_NAMES, LAST_NAMES, PALETTE, TOWN_PREFIX, TOWN_SUFFIX } from '../data/names';
import { ALL_TIERS, TIERS } from '../data/pyramid';
import type { Rng } from './rng';
import type { Club, Tier } from './types';

import { clamp } from './util';
export { clamp };

export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(fc|de|da|do|the)$/i.test(w));
  if (words.length === 0) return 'FC';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function randomTown(rng: Rng): string {
  return rng.pick(TOWN_PREFIX) + rng.pick(TOWN_SUFFIX);
}

export function randomClubName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = `${randomTown(rng)} ${rng.pick(CLUB_TYPE)}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  // fallback garantido único
  const name = `${randomTown(rng)} ${rng.pick(CLUB_TYPE)} ${taken.size}`;
  taken.add(name);
  return name;
}

export function randomPersonName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

export function randomColors(rng: Rng): [string, string] {
  const a = rng.pick(PALETTE);
  let b = rng.pick(PALETTE);
  while (b === a) b = rng.pick(PALETTE);
  return [a, b];
}

export function makeClub(rng: Rng, id: string, tier: Tier, taken: Set<string>): Club {
  const rules = TIERS[tier];
  const name = randomClubName(rng, taken);
  return {
    id,
    name,
    short: initials(name),
    colors: randomColors(rng),
    strength: Math.round(clamp(rules.meanStrength + rng.normal(rules.spread), 30, 95) * 10) / 10,
    tier,
  };
}

/**
 * Gera o mundo inicial: todas as divisões cheias de clubes fictícios.
 * O nível 8 recebe uma vaga a menos (é a vaga do clube do jogador).
 */
export function generateWorld(rng: Rng, taken: Set<string>): { world: Record<Tier, Club[]>; serial: number } {
  const world = {} as Record<Tier, Club[]>;
  let serial = 0;
  for (const tier of ALL_TIERS) {
    const size = TIERS[tier].size - (tier === 8 ? 1 : 0);
    const clubs: Club[] = [];
    for (let i = 0; i < size; i++) clubs.push(makeClub(rng, `c${serial++}`, tier, taken));
    // na Premier existe uma elite: os 4 mais fortes ganham um empurrão
    if (tier === 1) {
      clubs.sort((a, b) => b.strength - a.strength);
      const prestige = [7, 5, 4, 3, 2, 1];
      for (let i = 0; i < prestige.length; i++) {
        clubs[i].prestige = prestige[i];
        clubs[i].strength = Math.min(92, clubs[i].strength + prestige[i]);
      }
    }
    world[tier] = clubs;
  }
  return { world, serial };
}

/** Variação anual da IA: puxa para a média da divisão atual + ruído. */
export function driftClub(rng: Rng, club: Club): void {
  const rules = TIERS[club.tier];
  const target = rules.meanStrength + (club.prestige ?? 0);
  const pull = 0.3 * (target - club.strength);
  club.strength = Math.round(clamp(club.strength + pull + rng.normal(1.1), 30, 95) * 10) / 10;
}

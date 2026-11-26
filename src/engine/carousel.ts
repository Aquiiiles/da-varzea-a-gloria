import type { LeagueInfo } from './awards';
import { personName } from './names';
import { coachKey } from './ranking';
import type { Rng } from './rng';
import { aiCoachName } from './stats';
import type { Club, GameState } from './types';

/**
 * Dança dos técnicos (fim de temporada): clubes da IA que foram mal demitem o técnico; quem foi bem
 * pode ser levado por um clube maior. Os demitidos ficam livres e podem voltar em outro clube.
 * Os pontos do ranking acompanham o técnico.
 */

const MAX_FREE = 40;

/** Chance de demissão pela campanha na liga principal (posição de 0 a 1, 1 = lanterna). */
function fireChance(rel: number, relegated: boolean, tier: number): number {
  if (relegated) return 0.7;
  const base = rel >= 0.8 ? 0.45 : rel >= 0.6 ? 0.18 : rel >= 0.4 ? 0.06 : 0.02;
  // clube grande cobra mais
  return Math.min(0.9, base * (tier <= 2 ? 1.3 : tier >= 6 ? 0.6 : 1));
}

export function coachCarousel(state: GameState, leagues: LeagueInfo[], playerId: string, rng: Rng): string[] {
  const byId = new Map(state.clubs.map((c) => [c.id, c]));
  const free = (state.freeCoaches ??= []);
  const points = state.coachPoints ?? {};
  const score = (name: string) => (points[coachKey(name)] ?? []).reduce((s, v) => s + v, 0);
  const taken = new Set<string>([...state.clubs.map((c) => c.coachName).filter((n): n is string => !!n), ...free, ...(state.career ? [state.career.name] : [])]);
  // clubes novos (várzea) ainda sem técnico: nome único
  for (const c of state.clubs) {
    if (c.coachName) continue;
    const gen = aiCoachName(state.seed, c.id);
    c.coachName = taken.has(gen) ? personName(rng, taken) : gen;
    taken.add(c.coachName);
  }
  const nameOf = (c: Club) => c.coachName!;
  const out: string[] = [];

  // campanha de cada clube na liga mais alta que disputou
  const seen = new Set<string>();
  const fired: Club[] = [];
  const stars: { club: Club; tier: number }[] = [];
  for (const L of leagues.slice().sort((a, b) => a.tier - b.tier)) {
    const n = L.ranking.length;
    L.ranking.forEach((id, i) => {
      if (seen.has(id) || id === playerId) return;
      seen.add(id);
      const club = byId.get(id);
      if (!club) return;
      const rel = n > 1 ? i / (n - 1) : 0;
      const relegated = i >= n - Math.max(1, Math.round(n * 0.2)) && L.tier <= 4;
      if (rng.chance(fireChance(rel, relegated, L.tier))) fired.push(club);
      else if (i < 3) stars.push({ club, tier: L.tier });
    });
  }

  // clubes maiores contratam primeiro
  fired.sort((a, b) => a.tier - b.tier || b.strength - a.strength);
  for (const club of fired) {
    const old = nameOf(club);
    let next: string | null = null;
    // 1) um técnico que se destacou um nível abaixo
    const poach = stars.filter((s) => s.tier === club.tier + 1 && s.club.id !== club.id);
    if (poach.length > 0 && rng.chance(0.4)) {
      const pick = poach.splice(rng.int(0, poach.length - 1), 1)[0];
      next = nameOf(pick.club);
      stars.splice(stars.indexOf(pick), 1);
      // o clube que perdeu o técnico contrata um livre ou um novo
      const replacement = free.length > 0 && rng.chance(0.5) ? free.splice(rng.int(0, free.length - 1), 1)[0] : personName(rng, taken);
      taken.add(replacement);
      pick.club.coachName = replacement;
      out.push(`${pick.club.name} perde ${next} e contrata ${replacement}`);
    }
    // 2) o melhor técnico livre (pelo ranking)
    if (!next && free.length > 0 && rng.chance(0.55)) {
      const best = free.slice().sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
      free.splice(free.indexOf(best), 1);
      next = best;
    }
    // 3) um nome novo
    if (!next) {
      next = personName(rng, taken);
      taken.add(next);
    }
    club.coachName = next;
    free.push(old);
    out.push(`${old} é demitido do ${club.name}; ${next} assume`);
  }
  // a fila de livres não cresce sem fim: saem os de menos pontos
  if (free.length > MAX_FREE) {
    free.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
    free.length = MAX_FREE;
  }
  const moves = (state.coachMoves ??= []);
  for (const text of out) moves.push({ season: state.season, text });
  state.coachMoves = moves.slice(-40);
  return out;
}

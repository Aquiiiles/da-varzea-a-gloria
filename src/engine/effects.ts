import { TIERS } from '../data/pyramid';
import { randomColors } from './clubs';
import { makeFootballer, marketValue } from './footballers';
import type { Rng } from './rng';
import { clamp } from './util';
import type { Club, Effect, GameState } from './types';

export function findClub(state: GameState, id: string): Club | undefined {
  for (const tier of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const c = state.world[tier].find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

export function nextId(state: GameState): number {
  return state.serial++;
}

/** Valor efetivo de um efeito com `scale` (dinheiro proporcional à divisão). */
export function scaled(state: GameState, value: number, scale?: boolean): number {
  return scale ? Math.round(value * TIERS[state.player.tier].moneyScale) : value;
}

/** Aplica efeitos e devolve manchetes extras geradas (ex.: nome de quem chegou/saiu). */
export function applyEffects(state: GameState, effects: readonly Effect[], rng: Rng): string[] {
  const p = state.player;
  const notes: string[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'add': {
        const v = scaled(state, e.value, e.scale);
        switch (e.stat) {
          case 'cash': p.cash += v; break;
          case 'fans': p.fans = Math.max(20, Math.round(p.fans + v)); break;
          case 'soul': p.soul = clamp(p.soul + v, 0, 100); break;
          case 'capacity': p.capacity = Math.round(p.capacity + v); break;
          case 'hype': p.hype = clamp(p.hype + v, 0, 100); break;
          case 'form': p.formMod += v; break;
          case 'rivalHatred': p.rivalHatred = clamp(p.rivalHatred + v, 0, 100); break;
          case 'rivalStrength': {
            const rival = findClub(state, p.rivalId);
            if (rival) rival.strength = clamp(rival.strength + v, 30, 95);
            break;
          }
        }
        break;
      }
      case 'mul':
        if (e.stat === 'fans') p.fans = Math.max(20, Math.round(p.fans * e.value));
        else p.capacity = Math.round(p.capacity * e.value);
        break;
      case 'sponsor':
        p.sponsors.push({ name: e.name, perSeason: scaled(state, e.perSeason, e.scale), seasonsLeft: e.seasons });
        break;
      case 'sign': {
        const mean = TIERS[p.tier].meanStrength;
        const f = makeFootballer(rng, {
          id: nextId(state),
          ovr: mean + e.rel + rng.normal(1),
          age: rng.int(e.age[0], e.age[1]),
          pos: e.pos,
          scout: p.staff.scout,
          season: state.season,
          contract: e.age[0] >= 33 ? 1 : 2,
        });
        p.squad.push(f);
        notes.push(`${f.name} (${f.pos}, ${f.ovr}) chega ao clube`);
        break;
      }
      case 'sellStar': {
        const star = p.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0];
        if (star) {
          const fee = Math.round(marketValue(star) * e.mult);
          p.squad = p.squad.filter((x) => x.id !== star.id);
          p.alumni.push(star);
          p.cash += fee;
          notes.push(`${star.name} é vendido por £ ${fee} mil`);
        }
        break;
      }
      case 'recolor':
        p.colors = randomColors(rng);
        break;
    }
  }
  return notes;
}

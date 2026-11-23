import { TIERS } from '../data/pyramid';
import { clamp, randomColors, randomPersonName } from './clubs';
import type { Rng } from './rng';
import type { Club, Effect, GameState, Squadman } from './types';

export function findClub(state: GameState, id: string): Club | undefined {
  for (const tier of Object.keys(state.world)) {
    const c = state.world[Number(tier) as keyof GameState['world']].find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

export function newSquadman(state: GameState, rng: Rng, finishing: number): Squadman {
  return {
    id: `p${state.serial++}`,
    name: randomPersonName(rng),
    finishing,
    goals: 0,
    seasons: 0,
    joined: state.season,
    active: true,
  };
}

/** Valor efetivo de um efeito com `scale` (dinheiro proporcional à divisão). */
export function scaled(state: GameState, value: number, scale?: boolean): number {
  return scale ? Math.round(value * TIERS[state.player.tier].moneyScale) : value;
}

export function applyEffects(state: GameState, effects: readonly Effect[], rng: Rng): void {
  const p = state.player;
  for (const e of effects) {
    switch (e.type) {
      case 'add': {
        const v = scaled(state, e.value, e.scale);
        switch (e.stat) {
          case 'strength': p.strength = clamp(p.strength + v, 1, 99); break;
          case 'cash': p.cash += v; break;
          case 'fans': p.fans = Math.max(20, Math.round(p.fans + v)); break;
          case 'soul': p.soul = clamp(p.soul + v, 0, 100); break;
          case 'capacity': p.capacity = Math.round(p.capacity + v); break;
          case 'hype': p.hype = clamp(p.hype + v, 0, 100); break;
          case 'rivalHatred': p.rivalHatred = clamp(p.rivalHatred + v, 0, 100); break;
          case 'rivalStrength': {
            const rival = findClub(state, p.rivalId);
            if (rival) rival.strength = clamp(rival.strength + v, 1, 99);
            break;
          }
          case 'coach':
          case 'scout':
          case 'fitness':
          case 'academy':
            p.staff[e.stat] = clamp(p.staff[e.stat] + v, 0, 3);
            break;
        }
        break;
      }
      case 'mul':
        if (e.stat === 'fans') p.fans = Math.max(20, Math.round(p.fans * e.value));
        else if (e.stat === 'capacity') p.capacity = Math.round(p.capacity * e.value);
        else p.cash = Math.round(p.cash * e.value);
        break;
      case 'sponsor':
        p.sponsors.push({ name: e.name, perSeason: scaled(state, e.perSeason, e.scale), seasonsLeft: e.seasons });
        break;
      case 'signing': {
        p.squad.push(newSquadman(state, rng, e.finishing));
        // elenco nomeado limitado a 6 ativos: o de menor finalização se aposenta
        const active = p.squad.filter((s) => s.active);
        if (active.length > 6) {
          active.sort((a, b) => a.finishing - b.finishing || a.joined - b.joined);
          active[0].active = false;
        }
        break;
      }
      case 'loseStar': {
        const active = p.squad.filter((s) => s.active).sort((a, b) => b.finishing - a.finishing);
        if (active.length > 0) active[0].active = false;
        break;
      }
      case 'recolor':
        p.colors = randomColors(rng);
        break;
    }
  }
}

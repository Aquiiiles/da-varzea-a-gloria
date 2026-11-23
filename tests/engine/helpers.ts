import { advance, choose, newGame } from '../../src/engine/game';
import type { Foundation, GameState } from '../../src/engine/types';

export const FOUNDATION: Foundation = { name: 'Unidos da Várzea', colors: ['#c8102e', '#ffffff'], origin: 'pub' };

/** Joga uma run inteira com uma função de escolha; devolve o estado final. */
export function playRun(seed: number, pick: (s: GameState, i: number) => number, foundation = FOUNDATION): GameState {
  let s = newGame(seed, foundation);
  let i = 0;
  while (s.phase !== 'over') {
    if (s.phase === 'summary') s = advance(s);
    else s = choose(s, pick(s, i++));
  }
  return s;
}

/** Escolhas pseudo-aleatórias mas fixas (não usam Math.random). */
export const patterned = (s: GameState, i: number) => (i * 7 + 3) % (s.phase === 'event' ? 2 : s.offer.length);

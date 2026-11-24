import { applyMut, newGame } from '../../src/engine/game';
import type { Action, Foundation, GameState } from '../../src/engine/types';

export const FOUNDATION: Foundation = { name: 'Unidos da Várzea', colors: ['#c8102e', '#ffffff'], origin: 'pub' };

/** Joga uma run inteira: em cada temporada roda `manage` (ações do escritório) e depois joga. */
export function playRun(seed: number, manage: (s: GameState) => Action[] = () => [{ t: 'auto' }], foundation = FOUNDATION): GameState {
  const s = newGame(seed, foundation);
  const run = (a: Action) => {
    applyMut(s, a);
    s.actions.push(a);
  };
  while (s.phase !== 'over') {
    if (s.phase === 'season') {
      run({ t: 'advance', to: 3 });
      continue;
    }
    if (s.phase === 'summary') {
      run({ t: 'next' });
      continue;
    }
    for (const a of manage(s)) {
      try {
        run(a);
      } catch {
        /* ação inválida no contexto: ignora (não entra no log) */
      }
    }
    if (s.office.event && s.office.eventChoice === null) run({ t: 'event', choice: 0 });
    run({ t: 'play' });
  }
  return s;
}

/** Joga a temporada e já fecha o calendário (o resultado de verdade sai no fim). */
export const PLAY: Action[] = [{ t: 'play' }, { t: 'advance', to: 3 }];

/** Mistura de ações manuais + assistente (cobre bastante o motor). */
export const mixed = (s: GameState): Action[] => [
  { t: 'ticket', level: (s.season % 3) as 0 | 1 | 2 },
  { t: 'tryout' },
  { t: 'sign', idx: 0 },
  { t: 'buy', idx: s.season % 8 },
  { t: 'opp', idx: 0 },
  { t: 'auto' },
];

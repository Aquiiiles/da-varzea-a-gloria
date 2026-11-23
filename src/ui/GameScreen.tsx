import { useEffect, useState } from 'react';
import type { GameState, SeasonResult } from '../engine';
import type { Dispatch } from './App';
import { Office } from './office/Office';
import { ResultScreen } from './ResultScreen';
import { SeasonSummary } from './SeasonSummary';

/** Resultados que interrompem o modo rápido. */
export function isDecisive(r: SeasonResult): boolean {
  return r.outcome !== 'fica';
}

interface Props {
  state: GameState;
  dispatch: Dispatch;
  onRestart: () => void;
  fromLink: boolean;
}

export function GameScreen({ state, dispatch, onRestart, fromLink }: Props) {
  /** null = desligado; número = tamanho do histórico quando o modo rápido começou */
  const [fastFrom, setFastFrom] = useState<number | null>(null);
  const fast = fastFrom !== null;
  const setFast = (on: boolean) => setFastFrom(on ? state.history.length : null);
  const last = state.history[state.history.length - 1];

  // modo rápido: o assistente gere e joga até algo decisivo (novo) acontecer
  useEffect(() => {
    if (fastFrom === null) return;
    if (state.phase === 'over') {
      setFastFrom(null);
      return;
    }
    if (state.phase === 'summary' && last && state.history.length > fastFrom && isDecisive(last)) {
      setFastFrom(null);
      return;
    }
    const t = setTimeout(() => {
      const ok = state.phase === 'summary' ? dispatch({ t: 'next' }) : dispatch({ t: 'auto' }, { t: 'play' });
      if (!ok) setFastFrom(null);
    }, 150);
    return () => clearTimeout(t);
  }, [fastFrom, state, last, dispatch]);

  if (state.phase === 'over') return <ResultScreen state={state} onRestart={onRestart} fromLink={fromLink} />;

  if (state.phase === 'summary' && last) {
    return (
      <SeasonSummary
        result={last}
        state={state}
        onNext={() => dispatch({ t: 'next' })}
        fast={fast}
        onFast={() => setFast(true)}
      />
    );
  }

  return <Office state={state} dispatch={dispatch} onFast={() => setFast(true)} />;
}

import { useEffect, useState } from 'react';
import type { GameState, SeasonResult } from '../engine';
import type { Dispatch } from './App';
import { Office } from './office/Office';
import { ResultScreen } from './ResultScreen';
import { SeasonSummary } from './SeasonSummary';
import { LiveMatch } from './LiveMatch';
import { SeasonView } from './SeasonView';

/** Resultados que interrompem o modo rápido. */
export function isDecisive(r: SeasonResult): boolean {
  return r.outcome !== 'fica' || r.moments.length > 0;
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
  /** transmissão ao vivo: jogos já assistidos da temporada (índices em `moments`) */
  // ao abrir um save/link, os jogos até o dia já mostrado contam como assistidos
  const [live, setLive] = useState<{ season: number; seen: number[] }>(() => {
    const r = state.history.at(-1);
    if (!r) return { season: 0, seen: [] };
    const upTo = state.reveal ?? Infinity;
    return { season: r.season, seen: r.moments.map((m, i) => ((m.day ?? Infinity) <= upTo || state.reveal == null ? i : -1)).filter((i) => i >= 0) };
  });

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
      const ok =
        state.phase === 'summary'
          ? state.reveal != null
            ? dispatch({ t: 'advance', to: 3 }, { t: 'next' })
            : dispatch({ t: 'next' })
          : dispatch({ t: 'auto' }, { t: 'play' });
      if (!ok) setFastFrom(null);
    }, 150);
    return () => clearTimeout(t);
  }, [fastFrom, state, last, dispatch]);

  // jogo ao vivo: o próximo (por data) que a temporada já alcançou e ainda não foi assistido
  if (last && (state.phase === 'summary' || state.phase === 'over')) {
    const seen = live.season === last.season ? live.seen : [];
    const upTo = state.reveal ?? Infinity;
    const pending = last.moments
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => !seen.includes(i) && (m.day ?? Infinity) <= upTo)
      .sort((a, b) => (a.m.day ?? 999) - (b.m.day ?? 999));
    if (pending.length > 0) {
      const { m, i } = pending[0];
      return (
        <LiveMatch
          key={`${last.season}-${i}`}
          moment={m}
          index={seen.length}
          total={last.moments.length}
          onDone={() => setLive({ season: last.season, seen: [...seen, i] })}
        />
      );
    }
  }

  // temporada em andamento: acompanhar jogo a jogo
  if (state.reveal != null && state.calendar && (state.phase === 'summary' || state.phase === 'over')) {
    return <SeasonView state={state} dispatch={dispatch} />;
  }

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

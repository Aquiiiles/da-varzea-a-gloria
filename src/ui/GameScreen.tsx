import { useEffect, useState } from 'react';
import type { GameState, LiveMoment, SeasonResult } from '../engine';
import type { Dispatch } from './App';
import { Office } from './office/Office';
import { ResultScreen } from './ResultScreen';
import { SeasonSummary } from './SeasonSummary';
import { LiveMatch } from './LiveMatch';
import { SeasonView } from './SeasonView';
import { AwardsCeremony } from './AwardsCeremony';

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
  const running = state.phase === 'season' && !!state.live && state.reveal != null && !!state.calendar;
  /** jogos ao vivo já assistidos (temporada:tipo:dia); ao abrir um save, o que já passou conta como assistido */
  const keyOf = (season: number, m: LiveMoment) => `${season}:${m.kind}:${m.day ?? 0}`;
  const [seen, setSeen] = useState<Set<string>>(() => {
    const out = new Set<string>();
    if (state.phase === 'season' && state.live) {
      for (const m of state.live.moments) if ((m.day ?? Infinity) <= (state.reveal ?? -1)) out.add(keyOf(state.season, m));
    } else if (last) {
      for (const m of last.moments) out.add(keyOf(last.season, m));
    }
    return out;
  });
  /** escritório aberto durante a temporada (janela do meio do ano) */
  const [officeOpen, setOfficeOpen] = useState(false);

  /** temporada cuja cerimônia de prêmios já foi vista (ao abrir um save já terminado, conta como vista) */
  const [awardsSeen, setAwardsSeen] = useState<number>(() => (state.phase === 'season' ? 0 : state.history.at(-1)?.season ?? 0));

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
        state.phase === 'season'
          ? dispatch({ t: 'advance', to: 3 })
          : state.phase === 'summary'
            ? dispatch({ t: 'next' })
            : dispatch({ t: 'auto' }, { t: 'play' });
      if (!ok) setFastFrom(null);
    }, 150);
    return () => clearTimeout(t);
  }, [fastFrom, state, last, dispatch]);

  // jogo ao vivo: o próximo (por data) que a temporada já alcançou e ainda não foi assistido
  if (!fast && (running || state.phase === 'summary' || state.phase === 'over')) {
    const season = running ? state.season : last?.season ?? 0;
    const moments = running ? state.live!.moments : last?.moments ?? [];
    const upTo = running ? state.reveal! : Infinity;
    const pending = moments.filter((m) => !seen.has(keyOf(season, m)) && (m.day ?? Infinity) <= upTo).sort((a, b) => (a.day ?? 999) - (b.day ?? 999));
    if (pending.length > 0) {
      const m = pending[0];
      return (
        <LiveMatch
          key={keyOf(season, m)}
          moment={m}
          index={moments.filter((x) => seen.has(keyOf(season, x))).length}
          total={moments.length}
          onDone={() => setSeen(new Set([...seen, keyOf(season, m)]))}
        />
      );
    }
  }

  // temporada em andamento: acompanhar jogo a jogo (e o escritório na janela de julho)
  if (running) {
    if (officeOpen) return <Office state={state} dispatch={dispatch} onFast={() => setFast(true)} onBack={() => setOfficeOpen(false)} />;
    return <SeasonView state={state} dispatch={dispatch} onOpenOffice={() => setOfficeOpen(true)} />;
  }

  // cerimônia de prêmios (uma vez por temporada, antes do balanço; o modo rápido pula)
  if (last?.awards && awardsSeen < last.season && !fast && (state.phase === 'summary' || state.phase === 'over')) {
    return <AwardsCeremony result={last} onDone={() => setAwardsSeen(last.season)} />;
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

import { useCallback, useEffect, useState } from 'react';
import { advance, choose, decodeRun, encodeRun, newGame, replay, seedFromEntropy, type Foundation, type GameState } from '../engine';
import { FoundationScreen } from './FoundationScreen';
import { GameScreen } from './GameScreen';
import { Ticker } from './Ticker';

/** Seed nova vem da UI (o motor nunca gera entropia). */
function freshSeed(): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  } catch {
    return seedFromEntropy(Math.random());
  }
}

function loadFromUrl(): GameState | null {
  const code = decodeRun(window.location.search);
  if (!code) return null;
  try {
    return replay(code.seed, code.foundation, code.choices);
  } catch {
    return null;
  }
}

function writeUrl(state: GameState | null): void {
  const url = state ? `${window.location.pathname}?${encodeRun(state)}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export function App() {
  const [state, setState] = useState<GameState | null>(() => loadFromUrl());
  /** veio de um link compartilhado (replay)? */
  const [fromLink] = useState(() => state !== null);

  useEffect(() => writeUrl(state), [state]);

  const start = useCallback((f: Foundation) => setState(newGame(freshSeed(), f)), []);
  const onChoose = useCallback((i: number) => setState((s) => (s ? choose(s, i) : s)), []);
  const onAdvance = useCallback(() => setState((s) => (s && s.phase === 'summary' ? advance(s) : s)), []);
  const restart = useCallback(() => setState(null), []);

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-live">AO VIVO</span>
          <span className="brand-name">DA VÁRZEA À GLÓRIA</span>
        </div>
        <Ticker items={state ? state.news.slice(-8).reverse() : DEFAULT_NEWS} />
      </header>
      <main className="stage">
        {state ? (
          <GameScreen state={state} onChoose={onChoose} onAdvance={onAdvance} onRestart={restart} fromLink={fromLink} />
        ) : (
          <FoundationScreen onStart={start} />
        )}
      </main>
    </div>
  );
}

const DEFAULT_NEWS = [
  'Federação abre inscrições para novos clubes na Liga Regional',
  'Bilionários de olho no futebol de base',
  'Estádios pequenos barram acessos: "regulamento é regulamento"',
];

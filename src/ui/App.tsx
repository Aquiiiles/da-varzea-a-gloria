import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionError, apply, decodeRun, encodeRun, negotiationFor, newGame, replay, seedFromEntropy, type Action, type Foundation, type GameState } from '../engine';
import { FoundationScreen } from './FoundationScreen';
import { GameScreen } from './GameScreen';
import { Ticker, tickerItems } from './Ticker';
import { loadNamePack, saveCareer, saveSnapshot } from '../storage';

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
    return replay(code.seed, code.foundation, code.actions, { pack: loadNamePack() });
  } catch {
    return null;
  }
}

function writeUrl(state: GameState | null): void {
  const url = state ? `${window.location.pathname}?${encodeRun(state)}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

export type Dispatch = (...actions: Action[]) => boolean;

export function App() {
  const [state, setState] = useState<GameState | null>(() => loadFromUrl());
  const [fromLink] = useState(() => state !== null);
  const [toast, setToast] = useState<{ text: string; ok?: boolean } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** save aberto (cópias continuam salvando no próprio lugar) */
  const slotRef = useRef<string | null>(null);

  useEffect(() => writeUrl(state), [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const start = useCallback((f: Foundation, seed?: number) => {
    const s = newGame(seed ?? freshSeed(), f, { pack: loadNamePack() });
    slotRef.current = null;
    saveCareer(s);
    setState(s);
  }, []);

  /** Continua uma carreira salva (reconstrói pelo log de ações). */
  const resume = useCallback((query: string, slot?: string) => {
    const code = decodeRun(query);
    if (!code) return setToast({ text: 'Save inválido.' });
    slotRef.current = slot ?? null;
    try {
      setState(replay(code.seed, code.foundation, code.actions, { pack: loadNamePack() }));
    } catch {
      setToast({ text: 'Não foi possível carregar este save.' });
    }
  }, []);

  /** Aplica uma ou mais ações em sequência; para na primeira inválida e mostra o motivo. */
  const dispatch: Dispatch = useCallback((...actions: Action[]) => {
    let s = stateRef.current;
    if (!s) return false;
    for (const a of actions) {
      try {
        s = apply(s, a);
      } catch (e) {
        if (e instanceof ActionError) {
          setToast({ text: e.message });
          stateRef.current = s;
          setState(s);
          saveCareer(s, slotRef.current);
          return false;
        }
        throw e;
      }
    }
    stateRef.current = s;
    setState(s);
    saveCareer(s, slotRef.current);
    // acerto fechado numa negociação: o jogador sai da lista do outro clube, então avisamos aqui
    const last = actions[actions.length - 1];
    if (last?.t === 'bid') {
      const n = negotiationFor(s, last.club, last.player);
      if (n?.status === 'aceita') setToast({ text: n.message, ok: true });
    }
    return true;
  }, []);

  const restart = useCallback(() => setState(null), []);
  /** cópia do ponto atual (um save à parte) */
  const snapshot = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    setToast(saveSnapshot(s) ? { text: 'Cópia salva. Ela aparece em "Continuar carreira".', ok: true } : { text: 'Limite de saves atingido: apague um no menu.' });
  }, []);

  return (
    <div className="app">
      {/* modo técnico: o cabeçalho do clube ocupa o topo (com o letreiro dentro) */}
      {!(state?.career && !state.career.unemployed && (state.phase === 'office' || state.phase === 'season')) && (
        <header className="masthead">
          <div className="brand">
            <span className="brand-live">AO VIVO</span>
            <span className="brand-name">DA VÁRZEA À GLÓRIA</span>
          </div>
          <Ticker items={state ? tickerItems(state) : DEFAULT_NEWS} />
        </header>
      )}
      <main className="stage">
        {state ? (
          <GameScreen key={state.seed} state={state} dispatch={dispatch} onRestart={restart} onSnapshot={snapshot} onResume={resume} fromLink={fromLink} />
        ) : (
          <FoundationScreen onStart={start} onResume={resume} />
        )}
      </main>
      {toast && (
        <div className={`toast${toast.ok ? ' toast-ok' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}


const DEFAULT_NEWS = [
  'Federação abre inscrições para novos times na Várzea',
  'Bilionários de olho no futebol de base',
  'Estádios pequenos barram acessos: "regulamento é regulamento"',
];

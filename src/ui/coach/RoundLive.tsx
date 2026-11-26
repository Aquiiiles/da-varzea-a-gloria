import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SUBS, PLAYER_ID, STYLE_TACTIC, injuredAt, suspendedOn, tableAfter, type GameState, type RoundGame, type RoundView, type Tactic } from '../../engine';
import type { Dispatch } from '../App';
import { LineupEditor } from '../LineupEditor';
import { StandingsTable } from './TableTab';

/** ms por minuto de jogo em cada velocidade */
const SPEEDS = [{ label: '1x', ms: 110 }, { label: '2x', ms: 55 }, { label: '4x', ms: 25 }];

function scoreAt(g: RoundGame, minute: number): [number, number] {
  let h = 0;
  let a = 0;
  for (const x of g.goals) if (x.minute <= minute) x.side === 'h' ? h++ : a++;
  return [h, a];
}

/**
 * A rodada ao vivo: todos os jogos ao mesmo tempo, com o seu em destaque e a narração.
 * Os placares já existem no motor; aqui o relógio só revela. No fim, a tabela com quem subiu e quem caiu.
 */
export function RoundLive({ state, round, dispatch, onDone }: { state: GameState; round: RoundView; dispatch: Dispatch; onDone: () => void }) {
  const m = round.moment;
  const live = state.live;
  // intervalo: o jogo para nos 45 e o técnico pode mexer (uma vez por jogo)
  const canHalftime = !!state.career && !!m.result.half && !!live && state.reveal === round.day;
  const decided = (live?.halftimes ?? []).some((h) => h.day === round.day);
  const [htClosed, setHtClosed] = useState(false);
  const end = m.events.at(-1)?.minute ?? 90;
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState(() => {
    try {
      return Number(localStorage.getItem('dvg:vel') ?? '1') || 0;
    } catch {
      return 1;
    }
  });
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<'live' | 'table'>('live');
  const finished = minute >= end;
  const atHalftime = canHalftime && !decided && !htClosed && minute === 45;
  const feedRef = useRef<HTMLOListElement>(null);
  const reduced = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (reduced) setMinute(end);
  }, [reduced, end]);

  useEffect(() => {
    if (finished || paused || reduced || atHalftime) return;
    const t = setTimeout(() => setMinute((x) => Math.min(end, x + 1)), SPEEDS[speed]?.ms ?? 55);
    return () => clearTimeout(t);
  }, [minute, finished, paused, speed, end, reduced, atHalftime]);

  const changeSpeed = (i: number) => {
    setSpeed(i);
    try {
      localStorage.setItem('dvg:vel', String(i));
    } catch {
      /* sem armazenamento */
    }
  };

  const endingCount = m.result.pens ? 2 : 1;
  const shown = m.events.filter((e, i) => (i >= m.events.length - endingCount ? finished : e.minute <= minute));
  const score = shown.at(-1)?.score ?? [0, 0];
  const lastGoal = [...shown].reverse().find((e) => e.kind === 'gol');
  const flash = !!lastGoal && minute - lastGoal.minute <= 3 && !finished;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [shown.length, reduced]);

  const myGoals = m.playerHome ? m.result.hg : m.result.ag;
  const theirGoals = m.playerHome ? m.result.ag : m.result.hg;
  const won = m.result.winner ? (m.playerHome ? m.result.winner === m.result.home : m.result.winner === m.result.away) : null;
  const verdict = !finished ? null : won === true || (won === null && myGoals > theirGoals) ? 'win' : won === false || myGoals < theirGoals ? 'loss' : 'draw';
  const others = round.games.filter((g) => !g.mine);

  if (view === 'table' && round.stage) {
    const rows = tableAfter(round.stage, round.day);
    const name = (id: string) => (id === PLAYER_ID ? state.player.name : state.calendar?.clubNames[id] ?? id);
    const me = rows.find((r) => r.clubId === PLAYER_ID);
    return (
      <div className="tab-stack round-live">
        <section className="panel">
          <p className="kicker">
            {round.comp} · {round.round}
          </p>
          {me && (
            <p className="round-pos">
              <b>{me.pos}º lugar</b>
              {me.delta !== 0 && <span className={me.delta > 0 ? 'good' : 'bad'}> {me.delta > 0 ? `subiu ${me.delta}` : `caiu ${-me.delta}`}</span>}
              <span className="muted"> · {me.points} pontos</span>
            </p>
          )}
          <StandingsTable rows={rows} name={name} zones={round.stage.compName.startsWith('Série') && rows.length >= 16} />
        </section>
        <div className="playbar coach-playbar">
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-stack round-live">
      <section className={`panel live${flash ? ' is-goal' : ''}`} aria-live="polite">
        <div className="live-top">
          <span className="brand-live">AO VIVO</span>
          <span className="live-count">
            {round.comp} · {round.round}
          </span>
        </div>
        {m.kind !== 'jogo' && <p className="live-stake">{m.title}. {m.stake}</p>}
        <div className="scoreboard">
          <div className={`sb-team${m.playerHome ? ' sb-me' : ''}`}>{m.homeName}</div>
          <div className="sb-score">
            <span>{score[0]}</span>
            <span className="sb-x">x</span>
            <span>{score[1]}</span>
          </div>
          <div className={`sb-team${!m.playerHome ? ' sb-me' : ''}`}>{m.awayName}</div>
          <div className="sb-clock">{finished ? 'FIM' : paused ? 'PAUSA' : `${minute}'`}</div>
        </div>
        {flash && <div className="goal-flash">{lastGoal!.mine ? 'GOOOOL!' : 'Gol deles...'}</div>}
        <ol className={`feed feed-short${atHalftime ? ' is-hidden' : ''}`} ref={feedRef}>
          {[...shown].reverse().map((e, i) => (
            <li key={`${e.minute}-${i}-${e.kind}`} className={`ev ev-${e.kind}${e.mine ? ' ev-mine' : ''}`}>
              <span className="ev-min">{e.minute}'</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
        {finished && verdict && <p className={`live-verdict v-${verdict}`}>{verdict === 'win' ? 'VITÓRIA!' : verdict === 'loss' ? 'Derrota.' : 'Empate.'}</p>}
      </section>

      {atHalftime && <HalftimePanel state={state} day={round.day} dispatch={dispatch} onClose={() => setHtClosed(true)} />}

      {others.length > 0 && (
        <section className="panel">
          <p className="kicker">Outros jogos da rodada</p>
          <ul className="round-games">
            {others.map((g, i) => {
              const [h, a] = scoreAt(g, Math.min(minute, 90));
              const recent = g.goals.some((x) => x.minute <= minute && minute - x.minute <= 3) && !finished;
              return (
                <li key={i} className={`rg${recent ? ' rg-goal' : ''}`}>
                  <span className="rg-home">{g.homeName}</span>
                  <b className="rg-score">
                    {h} x {a}
                  </b>
                  <span className="rg-away">{g.awayName}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="playbar coach-playbar">
        {atHalftime ? (
          <button type="button" className="btn" onClick={() => setHtClosed(true)}>
            Voltar sem mudar
          </button>
        ) : !finished ? (
          <>
            <div className="speed" role="group" aria-label="Velocidade">
              {SPEEDS.map((s, i) => (
                <button key={s.label} type="button" className={`speed-btn${speed === i ? ' is-on' : ''}`} onClick={() => changeSpeed(i)}>
                  {s.label}
                </button>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => setPaused(!paused)}>
              {paused ? 'Continuar' : 'Pausar'}
            </button>
            <button type="button" className="btn" onClick={() => setMinute(end)}>
              Fim
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => (round.stage ? setView('table') : onDone())}>
            {round.stage ? 'Ver a tabela' : 'Continuar'}
          </button>
        )}
      </div>
    </div>
  );
}

/** Vestiário no intervalo: o mesmo campinho da escalação, com até 5 substituições e a estratégia do 2º tempo. */
function HalftimePanel({ state, day, dispatch, onClose }: { state: GameState; day: number; dispatch: Dispatch; onClose: () => void }) {
  const p = state.player;
  const live = state.live!;
  const firstIds = live.elevens.find((e) => e.day === day)?.ids ?? [];
  const out = new Set([...injuredAt(live, day).filter((i) => i.from < day).map((i) => i.id), ...suspendedOn(live, day).map((s) => s.id)]);
  const current: Tactic = (live.lineups.filter((l) => l.day < day).at(-1)?.tactic ?? p.tactic ?? STYLE_TACTIC[p.coach.style]) as Tactic;
  const confirm = (ids: number[] | null, tactic: Tactic) => {
    const ok = dispatch({ t: 'halftime', day, ids, ...(tactic !== current ? { tactic } : {}) });
    if (ok) onClose();
  };
  return (
    <section className="panel halftime">
      <p className="kicker">Intervalo · vestiário</p>
      <LineupEditor state={state} dispatch={dispatch} halftime={{ firstIds, out, maxSubs: MAX_SUBS, tactic: current, onConfirm: confirm }} />
    </section>
  );
}

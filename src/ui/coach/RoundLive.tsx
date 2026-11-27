import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_STOPS, MAX_SUBS, PERSONALITY_INFO, TIRED_AT, matchStamina, penaltyOrder, personalityOf, liveRatings, staminaAt, type LiveRating, PLAYER_ID, subbedOut, isDecisive, rivalName, STYLE_TACTIC, injuredAt, suspendedOn, tableAfter, type GameState, type LiveEvent, type RoundGame, type RoundView, type Tactic } from '../../engine';
import type { Dispatch } from '../App';
import { LineupEditor } from '../LineupEditor';
import { StandingsTable } from './TableTab';
import { LiveStats, changeEffect, changeText } from './LiveStats';

/** ms por minuto de jogo em cada velocidade */
const SPEEDS = [{ label: '1x', ms: 110 }, { label: '2x', ms: 55 }, { label: '4x', ms: 25 }, { label: 'Rápido', ms: 6 }];

/** Quando o jogo para sozinho: tudo (intervalo, expulsão, lesão), só o grave (expulsão, lesão, pênaltis) ou nunca. */
type Stops = 'todas' | 'graves' | 'nenhuma';
const STOPS_LABEL: Record<Stops, string> = { todas: 'Paradas: todas', graves: 'Paradas: graves', nenhuma: 'Sem paradas' };
const NEXT_STOPS: Record<Stops, Stops> = { todas: 'graves', graves: 'nenhuma', nenhuma: 'todas' };
function loadStops(): Stops {
  try {
    const v = localStorage.getItem('dvg:paradas');
    return v === 'graves' || v === 'nenhuma' ? v : 'todas';
  } catch {
    return 'todas';
  }
}

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
export function RoundLive({ state, round, dispatch, onDone, onNext, nextBlocked }: { state: GameState; round: RoundView; dispatch: Dispatch; onDone: () => void; onNext?: () => void; nextBlocked?: string | null }) {
  const m = round.moment;
  const calMatch = state.calendar?.matches.find((x) => x.day === round.day);
  const derby = !!calMatch && calMatch.opponent === rivalName(state);
  const final = !!calMatch && isDecisive(calMatch);
  const live = state.live;
  // técnico: dá para parar o jogo e mexer (o jogo para sozinho no intervalo e em expulsão ou lesão do seu time)
  const canChange = !!state.career && !!m.result.blocks && !!live && state.reveal === round.day;
  const changes = (live?.halftimes ?? []).filter((h) => h.day === round.day);
  const lastChange = changes.reduce((x, c) => Math.max(x, c.minute ?? 45), 0);
  /** paradas já tratadas (intervalo e alertas), para não parar de novo no mesmo lance */
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [stop, setStop] = useState<{ minute: number; reason: string } | null>(null);
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
  const [stops, setStops] = useState<Stops>(loadStops);
  const cycleStops = () => {
    const v = NEXT_STOPS[stops];
    setStops(v);
    try {
      localStorage.setItem('dvg:paradas', v);
    } catch {
      /* sem armazenamento */
    }
  };
  const [view, setView] = useState<'live' | 'table'>('live');
  // pênaltis: as cobranças aparecem uma a uma depois do apito
  const totalKicks = m.events.filter((e) => e.kick !== undefined).length;
  const [kicksShown, setKicksShown] = useState(0);
  const atEnd = minute >= end;
  const finished = atEnd && kicksShown >= totalKicks;
  const penPending = canChange && !!m.result.pens && !!calMatch?.kicks && !(live?.penOrders ?? []).some((x) => x.day === round.day);
  const atHalftime = !!stop;
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

  // paradas automáticas: intervalo (se ainda não mexeu ali) e expulsão ou lesão do seu time
  useEffect(() => {
    if (!canChange || stop || finished) return;
    const alert = m.events.find((e) => e.alert && e.mine && e.minute === minute && !handled.has(`a${e.minute}${e.text}`));
    if (alert && minute < 85 && lastChange < 85 && stops !== 'nenhuma') {
      setHandled(new Set([...handled, `a${alert.minute}${alert.text}`]));
      setStop({ minute, reason: alert.text });
      return;
    }
    if (minute === 45 && !handled.has('ht') && lastChange < 45 && stops === 'todas') {
      setHandled(new Set([...handled, 'ht']));
      setStop({ minute: 45, reason: 'Intervalo' });
    }
  }, [minute, canChange, stop, finished, m.events, handled, lastChange, stops]);

  // pênaltis: antes da primeira cobrança, o técnico escolhe a ordem
  useEffect(() => {
    if (!atEnd || stop || !penPending || handled.has('pens') || stops === 'nenhuma') return;
    setHandled(new Set([...handled, 'pens']));
    setStop({ minute: end, reason: 'Pênaltis' });
  }, [atEnd, stop, penPending, handled, end]);
  useEffect(() => {
    if (!atEnd || stop || kicksShown >= totalKicks) return;
    if (penPending && !handled.has('pens') && stops !== 'nenhuma') return;
    const t = setTimeout(() => setKicksShown((k) => k + 1), reduced ? 0 : 900);
    return () => clearTimeout(t);
  }, [atEnd, stop, kicksShown, totalKicks, reduced, penPending, handled]);

  useEffect(() => {
    if (atEnd || paused || reduced || atHalftime) return;
    const t = setTimeout(() => setMinute((x) => Math.min(end, x + 1)), SPEEDS[speed]?.ms ?? 55);
    return () => clearTimeout(t);
  }, [minute, atEnd, paused, speed, end, reduced, atHalftime]);

  /** a mudança vale a partir do próximo bloco de 5 minutos (no intervalo, do 2º tempo) */
  const changeAt = (at: number) => (at === 45 ? 45 : Math.min(85, Math.max(5, Math.ceil((at + 1) / 5) * 5)));
  const canStopNow = canChange && !finished && changeAt(minute) > lastChange && changeAt(minute) <= 85 && changes.length < MAX_STOPS;

  const changeSpeed = (i: number) => {
    setSpeed(i);
    try {
      localStorage.setItem('dvg:vel', String(i));
    } catch {
      /* sem armazenamento */
    }
  };

  // o fim: apito final (ou o anúncio dos pênaltis, as cobranças e o resultado)
  const endStart = m.result.pens ? Math.max(0, m.events.findIndex((e) => e.kind === 'apito' && e.text.includes('pênaltis'))) : m.events.length - 1;
  const shown = m.events.filter((e, i) => (i < endStart ? e.minute <= minute : e.kick !== undefined ? atEnd && e.kick < kicksShown : i === endStart ? atEnd : finished));
  const score = shown.at(-1)?.score ?? [0, 0];
  // suas mexidas entram na narração, com o efeito no jogo
  const feed: LiveEvent[] = [...shown];
  for (const c of round.changes) {
    if (c.minute > minute && !finished) continue;
    const at = feed.findIndex((e) => e.minute > c.minute || (e.minute === c.minute && e.kind === 'apito' && c.minute !== 45));
    const ev: LiveEvent = { minute: c.minute, kind: 'troca', mine: true, text: `${changeText(c)} ${changeEffect(round.stats, c.minute)}`.trim(), score: [0, 0] };
    feed.splice(at < 0 ? feed.length : at, 0, ev);
  }
  const lastGoal = [...shown].reverse().find((e) => e.kind === 'gol');
  const flash = !!lastGoal && minute - lastGoal.minute <= 3 && !finished;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [shown.length, reduced]);

  const ratingMinute = finished ? 90 : stop ? Math.max(1, minute) : minute;
  const ratings = useMemo(() => (round.stats ? liveRatings(state, round, Math.max(1, ratingMinute)) : []), [state, round, ratingMinute]);
  const stamina = useMemo(() => (round.stats ? staminaAt(state, round.day, Math.min(90, minute)) : new Map<number, number>()), [state, round.day, minute, round.stats]);

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
          <button type="button" className="btn" onClick={onDone}>
            Voltar
          </button>
          {onNext && !nextBlocked ? (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              Próxima rodada
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onDone}>
              {nextBlocked ?? 'Continuar'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tab-stack round-live">
      <section className={`panel live${flash ? ' is-goal' : ''}${derby ? ' is-derby' : final ? ' is-final' : ''}`} aria-live="polite">
        {(derby || final) && <p className="pm-badge">{derby ? 'Clássico · casa cheia' : `Decisão · ${calMatch!.round.split(' · ')[0]}`}</p>}
        <div className="live-top">
          <span className="brand-live">AO VIVO</span>
          <span className="live-count">
            {round.comp} · {round.round}
          </span>
          {canChange && (
            <button type="button" className="stops-btn" onClick={cycleStops} title="Quando o jogo para sozinho">
              {STOPS_LABEL[stops]}
            </button>
          )}
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
          {[...feed].reverse().map((e, i) => (
            <li key={`${e.minute}-${i}-${e.kind}`} className={`ev ev-${e.kind}${e.mine ? ' ev-mine' : ''}`}>
              <span className="ev-min">{e.minute}'</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
        {finished && verdict && <p className={`live-verdict v-${verdict}`}>{verdict === 'win' ? 'VITÓRIA!' : verdict === 'loss' ? 'Derrota.' : 'Empate.'}</p>}
        {finished && round.stage && <MiniTable state={state} round={round} />}
        {finished && ratings[0] && (
          <p className="mvp">
            Melhor do seu time: {ratings[0].name} ({ratings[0].rating.toFixed(1)})
          </p>
        )}
      </section>

      {round.stats && (
        <LiveStats
          stats={round.stats}
          minute={minute}
          finished={finished}
          myName={m.playerHome ? m.homeName : m.awayName}
          oppName={m.playerHome ? m.awayName : m.homeName}
          changes={round.changes}
        />
      )}

      {round.stats && !stop && <Ratings ratings={ratings} stamina={stamina} finished={finished} />}

      {stop && stop.reason === 'Pênaltis' && <PenaltyPanel state={state} day={round.day} dispatch={dispatch} onClose={() => setStop(null)} />}

      {stop && stop.reason !== 'Pênaltis' && (
        <HalftimePanel
          state={state}
          day={round.day}
          minute={changeAt(stop.minute)}
          reason={stop.reason}
          dispatch={dispatch}
          onClose={() => setStop(null)}
          stamina={staminaAt(state, round.day, changeAt(stop.minute))}
          ratings={new Map(ratings.map((r) => [r.id, r.rating]))}
        />
      )}

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
          <button type="button" className="btn" onClick={() => setStop(null)}>
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
            {canChange ? (
              <button type="button" className="btn btn-primary" disabled={!canStopNow} onClick={() => setStop({ minute, reason: 'Parada técnica' })}>
                Mexer no time
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setPaused(!paused)}>
                {paused ? 'Continuar' : 'Pausar'}
              </button>
            )}
            <button type="button" className="btn" onClick={() => setMinute(end)}>
              Fim
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onDone}>
              Voltar
            </button>
            {round.stage && (
              <button type="button" className="btn" onClick={() => setView('table')}>
                Tabela
              </button>
            )}
            {onNext && !nextBlocked ? (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                Próxima rodada
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onDone}>
                {nextBlocked ?? 'Continuar'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Vestiário no intervalo: o mesmo campinho da escalação, com até 5 substituições e a estratégia do 2º tempo. */
/** Notas ao vivo: quem está em campo, com fôlego; os que já saíram ficam apagados. */
function Ratings({ ratings, stamina, finished }: { ratings: LiveRating[]; stamina: Map<number, number>; finished: boolean }) {
  if (ratings.length === 0) return null;
  const list = finished ? ratings : ratings.filter((r) => r.onField).concat(ratings.filter((r) => !r.onField));
  return (
    <section className="panel notas">
      <p className="kicker">Notas{finished ? ' do jogo' : ' ao vivo'}</p>
      <ul>
        {list.map((r) => {
          const f = stamina.get(r.id) ?? 100;
          return (
            <li key={r.id}>
              <span className="n-pos">{r.pos}</span>
              <span className={`n-name${r.onField || finished ? '' : ' n-off'}`}>
                {r.name}
                {r.goals > 0 ? ` · ${r.goals} gol${r.goals > 1 ? 's' : ''}` : ''}
              </span>
              {!finished && r.onField ? <span className={`n-fol${f < 55 ? ' bad' : ''}`}>fôlego {f}</span> : <span className="n-fol">{r.onField ? '' : 'saiu'}</span>}
              <b className={r.rating >= 7.5 ? 'good' : r.rating < 5.8 ? 'bad' : ''}>{r.rating.toFixed(1)}</b>
            </li>
          );
        })}
      </ul>
      {!finished && [...stamina.values()].some((v) => v < TIRED_AT) && <p className="muted">Fôlego abaixo de {TIRED_AT} já pesa no rendimento. Sem mexer, o auxiliar troca aos 60' e 75'; se você mexer, as trocas são suas.</p>}
    </section>
  );
}

function HalftimePanel({ state, day, minute, reason, dispatch, onClose, stamina, ratings }: { state: GameState; day: number; minute: number; reason: string; dispatch: Dispatch; onClose: () => void; stamina: Map<number, number>; ratings: Map<number, number> }) {
  const p = state.player;
  const live = state.live!;
  const original = live.elevens.find((e) => e.day === day)?.ids ?? [];
  const before = (live.halftimes ?? []).filter((h) => h.day === day && (h.minute ?? 45) < minute);
  const lastIds = before.reduce<number[] | null>((ids, h) => h.ids ?? ids, null);
  // fora: lesão de antes, suspensos e quem se machucou ou foi expulso neste jogo antes do minuto
  const gone = [
    ...live.injuries.filter((i) => i.from === day && (i.minute ?? 60) < minute).map((i) => i.id),
    ...(live.cards ?? []).filter((c) => c.day === day && c.kind === 'vermelho' && (c.minute ?? 60) < minute).map((c) => c.id),
  ];
  const reds = (live.cards ?? []).filter((c) => c.day === day && c.kind === 'vermelho' && (c.minute ?? 60) < minute).length;
  const left = subbedOut(live, day, minute);
  const reasons = new Map<number, string>();
  for (const i of injuredAt(live, day).filter((x) => x.from < day)) reasons.set(i.id, 'lesionado');
  for (const s of suspendedOn(live, day)) reasons.set(s.id, 'suspenso');
  for (const id of left) reasons.set(id, 'saiu');
  for (const i of live.injuries.filter((x) => x.from === day && (x.minute ?? 60) < minute)) reasons.set(i.id, 'machucou');
  for (const c of (live.cards ?? []).filter((x) => x.day === day && x.kind === 'vermelho' && (x.minute ?? 60) < minute)) reasons.set(c.id, 'expulso');
  const out = new Set([...injuredAt(live, day).filter((i) => i.from < day).map((i) => i.id), ...suspendedOn(live, day).map((s) => s.id), ...gone, ...left]);
  const field = (lastIds ?? original).filter((id) => !out.has(id));
  const used = field.filter((id) => !original.includes(id)).length;
  const lastTactic = before.reduce<Tactic | null>((t, h) => h.tactic ?? t, null);
  const current: Tactic = (lastTactic ?? live.lineups.filter((l) => l.day < day).at(-1)?.tactic ?? p.tactic ?? STYLE_TACTIC[p.coach.style]) as Tactic;
  const confirm = (ids: number[] | null, tactic: Tactic) => {
    const ok = dispatch({ t: 'halftime', day, minute, ids, ...(tactic !== current ? { tactic } : {}) });
    if (ok) onClose();
  };
  const halftime = minute === 45;
  return (
    <section className="panel halftime">
      <p className="kicker">{halftime ? 'Intervalo · vestiário' : `Parada técnica · vale a partir dos ${minute}'`}</p>
      {reason !== 'Intervalo' && reason !== 'Parada técnica' && <p className="window-alert">{reason}</p>}
      <LineupEditor
        key={`${minute}-${field.join(',')}`}
        state={state}
        dispatch={dispatch}
        halftime={{ firstIds: field, out, reasons, maxSubs: MAX_SUBS - used, tactic: current, size: 11 - reds, onConfirm: confirm, stamina, ratings }}
      />
    </section>
  );
}

/** Disputa de pênaltis: o técnico escolhe a ordem dos batedores entre quem terminou em campo. */
function PenaltyPanel({ state, day, dispatch, onClose }: { state: GameState; day: number; dispatch: Dispatch; onClose: () => void }) {
  const tl = matchStamina(state, day);
  const fieldIds = tl ? [...tl[tl.length - 1].keys()] : [];
  const field = state.player.squad.filter((f) => fieldIds.includes(f.id));
  const auto = penaltyOrder(field, state.player.roles, null);
  const [order, setOrder] = useState<number[]>([]);
  const need = Math.min(5, field.length);
  const toggle = (id: number) => setOrder(order.includes(id) ? order.filter((x) => x !== id) : order.length < need ? [...order, id] : order);
  const confirm = (ids: number[]) => {
    if (dispatch({ t: 'penorder', day, ids })) onClose();
  };
  return (
    <section className="panel halftime pens">
      <p className="kicker">Disputa de pênaltis</p>
      <p className="muted">Toque nos {need} batedores na ordem da cobrança. Quem é frio (profissional) e tem qualidade bate melhor; goleiro e temperamental tremem mais.</p>
      <ul className="pen-list">
        {field
          .slice()
          .sort((a, b) => b.ovr - a.ovr)
          .map((f) => {
            const n = order.indexOf(f.id);
            return (
              <li key={f.id}>
                <button type="button" className={`pen-pick${n >= 0 ? ' is-on' : ''}`} onClick={() => toggle(f.id)}>
                  <span className="pen-n">{n >= 0 ? n + 1 : ''}</span>
                  <span className={`pc-pos pos-${f.pos}`}>{f.pos}</span>
                  <span className="pen-name">
                    {f.name}
                    <small>{PERSONALITY_INFO[personalityOf(f)].label}</small>
                  </span>
                  <b>{f.ovr}</b>
                </button>
              </li>
            );
          })}
      </ul>
      <div className="decision-actions">
        <button type="button" className="btn" onClick={() => confirm(auto.slice(0, need).map((f) => f.id))}>
          Auxiliar escolhe
        </button>
        <button type="button" className="btn btn-primary" disabled={order.length < need} onClick={() => confirm(order)}>
          Confirmar ordem
        </button>
      </div>
    </section>
  );
}

/** Fim da rodada: a sua posição e os vizinhos de tabela, sem sair da tela. */
function MiniTable({ state, round }: { state: GameState; round: RoundView }) {
  const rows = tableAfter(round.stage!, round.day);
  const i = rows.findIndex((r) => r.clubId === PLAYER_ID);
  if (i < 0) return null;
  const from = Math.max(0, Math.min(rows.length - 5, i - 2));
  const name = (id: string) => (id === PLAYER_ID ? state.player.name : state.calendar?.clubNames[id] ?? id);
  return (
    <ol className="mini-table" start={from + 1}>
      {rows.slice(from, from + 5).map((r) => (
        <li key={r.clubId} className={r.clubId === PLAYER_ID ? 'is-me' : ''}>
          <span className="mt-pos">{r.pos}º</span>
          <span className="mt-name">{name(r.clubId)}</span>
          {r.delta !== 0 ? <span className={r.delta > 0 ? 'good' : 'bad'}>{r.delta > 0 ? `▲${r.delta}` : `▼${-r.delta}`}</span> : <span />}
          <b>{r.points}</b>
        </li>
      ))}
    </ol>
  );
}

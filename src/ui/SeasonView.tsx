import { useState } from 'react';
import {
  FATIGUE_FREE, FATIGUE_REST, PLAYER_ID, TIERS, dayToDate, fatigueAt, injuredAt, julyWindow, outcomeOf, partialTable, playedMatches, stageStarted,
  upcomingMatches, weekdayOf, type AdvanceTo, type CalendarMatch, type GameState, type SeasonCalendar,
} from '../engine';
import type { Dispatch } from './App';
import { LineupEditor } from './LineupEditor';
import { InterviewCard } from './InterviewCard';

const WEEKDAY = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function shortDate(year: number, day: number): string {
  const { d, m } = dayToDate(year, day);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function longDate(year: number, day: number): string {
  const { d, m } = dayToDate(year, day);
  return `${WEEKDAY[weekdayOf(year, day)]}, ${d} de ${MONTH[m - 1]}`;
}

/** "2 x 1", com pênaltis/prorrogação/vantagem. */
export function scoreLine(m: CalendarMatch): string {
  const extra = m.pens ? ` (${m.pens[0]}-${m.pens[1]} pên.)` : m.extraTime ? ' (prorr.)' : m.advantage ? ' (vantagem)' : '';
  return `${m.gf} x ${m.ga}${extra}`;
}

/** Notícias do dia a dia para o letreiro, sem revelar o que ainda não aconteceu. */
export function calendarTicker(state: GameState): string[] {
  const cal = state.calendar;
  if (!cal || state.reveal == null) return [];
  const name = state.player.name;
  return playedMatches(cal, state.reveal)
    .slice(-8)
    .reverse()
    .map((m) => {
      const r = outcomeOf(m);
      const verb = r === 'V' ? 'vence' : r === 'D' ? 'perde para' : 'empata com';
      return `${m.comp} · ${m.round}: ${name} ${verb} o ${m.opponent}, ${scoreLine(m)}`;
    });
}

function MatchRow({ m, year, played }: { m: CalendarMatch; year: number; played: boolean }) {
  const r = played ? outcomeOf(m) : null;
  return (
    <li className={`cal-match${r ? ` res-${r}` : ''}`}>
      <span className="cal-date">{shortDate(year, m.day)}</span>
      <span className="cal-what">
        <small>
          {m.comp} · {m.round}
        </small>
        <span>
          {m.home ? 'x' : '@'} {m.opponent}
          {m.opponentTier ? <small> ({TIERS[m.opponentTier].short})</small> : null}
        </span>
      </span>
      {played ? <b className="cal-score">{scoreLine(m)}</b> : <span className="muted">{m.home ? 'casa' : 'fora'}</span>}
      {r && <i className={`res-badge res-${r}`}>{r}</i>}
    </li>
  );
}

function Tables({ cal, day, clubName }: { cal: SeasonCalendar; day: number; clubName: string }) {
  const started = cal.stages.filter((s) => stageStarted(s, day));
  const list = started.length > 0 ? started : cal.stages.slice(0, 1);
  const [pick, setPick] = useState<number | null>(null);
  const idx = pick !== null && pick < list.length ? pick : list.length - 1;
  const stage = list[idx];
  if (!stage) return null;
  const rows = partialTable(stage, day);
  const name = (id: string) => (id === PLAYER_ID ? clubName : cal.clubNames[id] ?? id);
  return (
    <section className="panel">
      <p className="kicker">Classificação</p>
      {list.length > 1 && (
        <div className="seg seg-compact comp-tabs">
          {list.map((s, i) => (
            <button key={`${s.compName}-${s.name}`} type="button" className={`seg-btn${i === idx ? ' is-on' : ''}`} onClick={() => setPick(i)}>
              {s.compName === s.name || s.name === 'Classificação' || s.name === '1ª fase' ? s.compName : `${s.compName} · ${s.name}`}
            </button>
          ))}
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>
              {stage.compName}
              {stage.name !== 'Classificação' ? ` · ${stage.name}` : ''}
            </th>
            <th>J</th>
            <th>SG</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.clubId} className={r.clubId === PLAYER_ID ? 'me' : ''}>
              <td>{i + 1}</td>
              <td>{name(r.clubId)}</td>
              <td>{r.played}</td>
              <td>{r.gf - r.ga}</td>
              <td>
                {r.points}
                {r.deduction > 0 ? '*' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const ADVANCE: { to: AdvanceTo; label: string }[] = [
  { to: 0, label: 'Próximo jogo' },
  { to: 1, label: 'Semana' },
  { to: 2, label: 'Mês' },
  { to: 3, label: 'Fim da temporada' },
];

/** Temporada em andamento: o motor já simulou tudo; aqui o presidente acompanha jogo a jogo, semana, mês ou até o fim. */
/** Departamento médico e cansaço do elenco no dia de hoje. */
function SquadStatus({ state, day }: { state: GameState; day: number }) {
  const live = state.live;
  if (!live) return null;
  const cal = state.calendar!;
  const injured = injuredAt(live, day);
  const fatigue = fatigueAt(live, day);
  const byId = new Map(state.player.squad.map((f) => [f.id, f]));
  const tired = Object.entries(fatigue)
    .map(([id, v]) => ({ f: byId.get(Number(id)), v }))
    .filter((x) => x.f && x.v > FATIGUE_FREE)
    .sort((a, b) => b.v - a.v)
    .slice(0, 5);
  if (injured.length === 0 && tired.length === 0) return null;
  return (
    <section className="panel">
      {injured.length > 0 && (
        <>
          <p className="kicker kicker-alert">Departamento médico</p>
          <ul className="med-list">
            {injured.map((i) => (
              <li key={`${i.id}-${i.from}`}>
                <span>{i.name}</span>
                <span className="muted">volta em {shortDate(cal.year, i.to)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {tired.length > 0 && (
        <>
          <p className="kicker" style={{ marginTop: injured.length > 0 ? 14 : 0 }}>
            Cansaço
          </p>
          <ul className="tired-list">
            {tired.map(({ f, v }) => (
              <li key={f!.id}>
                <span>
                  {f!.name} <small className="muted">{f!.pos}</small>
                </span>
                <span className="tired-bar" aria-label={`cansaço ${v}`}>
                  <span style={{ width: `${v}%`, background: v >= FATIGUE_REST ? 'var(--bad)' : 'var(--warn)' }} />
                </span>
              </li>
            ))}
          </ul>
          <p className="muted">Cansado rende menos. {state.career ? 'Com o rodízio ligado, quem passa do limite descansa.' : 'O técnico faz o rodízio.'}</p>
        </>
      )}
    </section>
  );
}

export function SeasonView({
  state,
  dispatch,
  onOpenOffice,
  onNextMatch,
  narration,
  onToggleNarration,
}: {
  state: GameState;
  dispatch: Dispatch;
  onOpenOffice: () => void;
  onNextMatch: () => void;
  narration: boolean;
  onToggleNarration: () => void;
}) {
  const cal = state.calendar!;
  const day = state.reveal ?? cal.end;
  const played = playedMatches(cal, day);
  const next = upcomingMatches(cal, day);
  const last = played[played.length - 1];
  const form = played.slice(-5).map(outcomeOf);
  const progress = Math.min(100, Math.max(0, ((day - cal.start) / (cal.end - cal.start)) * 100));
  const [showAll, setShowAll] = useState(false);
  const [showLineup, setShowLineup] = useState(false);
  const [open, close] = julyWindow(cal.year);
  const windowOpen = day >= open && day <= close;

  return (
    <div className="tab-stack season-view">
      <section className="panel">
        <div className="season-top">
          <p className="kicker">Temporada {cal.year}</p>
          <button type="button" className="btn btn-small" onClick={onOpenOffice}>
            Ver o clube
          </button>
        </div>
        <h2 className="headline cal-today">{longDate(cal.year, day)}</h2>
        <div className="meter" aria-label={`${Math.round(progress)}% da temporada`}>
          <span className="meter-fill" style={{ width: `${progress}%` }} />
        </div>
        <label className="narr-toggle">
          <input type="checkbox" checked={narration} onChange={onToggleNarration} />
          Narrar cada jogo ao avançar jogo a jogo
        </label>
        {form.length > 0 && (
          <p className="cal-form">
            Últimos jogos:{' '}
            {form.map((r, i) => (
              <i key={i} className={`res-badge res-${r}`}>
                {r}
              </i>
            ))}
          </p>
        )}
      </section>

      {windowOpen ? (
        <section className="panel window-banner">
          <p className="kicker">Janela do meio do ano · até {shortDate(cal.year, close)}</p>
          <p className="lede">Dá para contratar, vender e emprestar. Quem chegar joga a partir do próximo jogo.</p>
          <button type="button" className="btn btn-primary" onClick={onOpenOffice}>
            Abrir transferências
          </button>
        </section>
      ) : (
        day < open && <p className="muted">A janela do meio do ano abre em {shortDate(cal.year, open)}.</p>
      )}

      {last && (
        <section className="panel">
          <p className="kicker">Último jogo</p>
          <ul className="cal-list">
            <MatchRow m={last} year={cal.year} played />
          </ul>
        </section>
      )}

      <section className="panel">
        <p className="kicker">Próximos jogos</p>
        {next.length > 0 ? (
          <ul className="cal-list">
            {next.map((m) => (
              <MatchRow key={`${m.comp}-${m.round}-${m.day}`} m={m} year={cal.year} played={false} />
            ))}
          </ul>
        ) : (
          <p className="muted">Sem jogos marcados. Avance até o fim da temporada para ver o balanço.</p>
        )}
      </section>

      <InterviewCard state={state} dispatch={dispatch} />

      <SquadStatus state={state} day={day} />

      {state.career && (
        <section className="panel">
          <button type="button" className="link" onClick={() => setShowLineup(!showLineup)}>
            {showLineup ? 'Fechar escalação' : `Escalação (${state.player.lineup?.ids ? 'escolhida por você' : 'automática'})`}
          </button>
          {showLineup && <LineupEditor key={`${day}-${JSON.stringify(state.player.lineup)}-${state.player.coach.formation}`} state={state} dispatch={dispatch} />}
        </section>
      )}

      <Tables cal={cal} day={day} clubName={state.player.name} />

      {played.length > 1 && (
        <section className="panel">
          <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Esconder' : 'Ver'} todos os resultados ({played.length})
          </button>
          {showAll && (
            <ul className="cal-list">
              {played
                .slice()
                .reverse()
                .map((m) => (
                  <MatchRow key={`${m.comp}-${m.round}-${m.day}`} m={m} year={cal.year} played />
                ))}
            </ul>
          )}
        </section>
      )}

      <div className="playbar cal-bar">
        {ADVANCE.map((a) => (
          <button key={a.to} type="button" className={`btn${a.to === 0 ? ' btn-primary' : ''}`} onClick={() => (a.to === 0 ? onNextMatch() : dispatch({ t: 'advance', to: a.to }))}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

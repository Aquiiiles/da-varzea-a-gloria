import { useState } from 'react';
import {
  PLAYER_ID, TIERS, dayToDate, outcomeOf, partialTable, playedMatches, stageStarted, upcomingMatches, weekdayOf,
  type AdvanceTo, type CalendarMatch, type GameState, type SeasonCalendar,
} from '../engine';
import type { Dispatch } from './App';

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
export function SeasonView({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const cal = state.calendar!;
  const day = state.reveal ?? cal.end;
  const played = playedMatches(cal, day);
  const next = upcomingMatches(cal, day);
  const last = played[played.length - 1];
  const form = played.slice(-5).map(outcomeOf);
  const progress = Math.min(100, Math.max(0, ((day - cal.start) / (cal.end - cal.start)) * 100));
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="tab-stack season-view">
      <section className="panel">
        <p className="kicker">Temporada {cal.year}</p>
        <h2 className="headline cal-today">{longDate(cal.year, day)}</h2>
        <div className="meter" aria-label={`${Math.round(progress)}% da temporada`}>
          <span className="meter-fill" style={{ width: `${progress}%` }} />
        </div>
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
          <button key={a.to} type="button" className={`btn${a.to === 0 ? ' btn-primary' : ''}`} onClick={() => dispatch({ t: 'advance', to: a.to })}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

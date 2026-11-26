import { useState } from 'react';
import { PLAYER_ID, playedMatches, stageStarted, tableAfter, type GameState } from '../../engine';
import { MatchRow } from '../SeasonView';

/** Aba Tabela: classificação de cada competição de pontos (com setas da última rodada) e os seus resultados. */
export function TableTab({ state }: { state: GameState }) {
  const cal = state.calendar;
  const day = state.reveal ?? -1;
  const [pick, setPick] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!cal || state.reveal == null) {
    return (
      <section className="panel">
        <p className="kicker">Tabela</p>
        <p className="muted">A temporada ainda não começou. As tabelas aparecem quando a bola rolar.</p>
      </section>
    );
  }
  const stages = cal.stages.filter((s) => s.ids.includes(PLAYER_ID) && stageStarted(s, day));
  const list = stages.length > 0 ? stages : cal.stages.filter((s) => s.ids.includes(PLAYER_ID)).slice(0, 1);
  const idx = pick !== null && pick < list.length ? pick : list.length - 1;
  const stage = list[idx];
  const played = playedMatches(cal, day);
  // dia da última rodada da fase (para as setas)
  const lastDay = stage ? Math.max(-1, ...stage.matches.filter(([d]) => d <= day).map(([d]) => d)) : -1;
  const rows = stage ? tableAfter(stage, lastDay >= 0 ? lastDay : day) : [];
  const name = (id: string) => (id === PLAYER_ID ? state.player.name : cal.clubNames[id] ?? id);
  const n = rows.length;

  return (
    <div className="tab-stack">
      {stage && (
        <section className="panel">
          {list.length > 1 && (
            <div className="seg seg-compact comp-tabs">
              {list.map((s, i) => (
                <button key={`${s.compName}-${s.name}`} type="button" className={`seg-btn${i === idx ? ' is-on' : ''}`} onClick={() => setPick(i)}>
                  {s.compName === s.name || s.name === 'Classificação' || s.name === '1ª fase' ? s.compName : `${s.compName} · ${s.name}`}
                </button>
              ))}
            </div>
          )}
          <p className="kicker">
            {stage.compName}
            {stage.name !== 'Classificação' && stage.name !== stage.compName ? ` · ${stage.name}` : ''}
          </p>
          <StandingsTable rows={rows} name={name} zones={n >= 16} />
        </section>
      )}
      {played.length > 0 && (
        <section className="panel">
          <p className="kicker">Seus jogos</p>
          <ul className="cal-list">
            {(showAll ? played.slice().reverse() : played.slice(-5).reverse()).map((m) => (
              <MatchRow key={`${m.comp}-${m.round}-${m.day}`} m={m} year={cal.year} played />
            ))}
          </ul>
          {played.length > 5 && (
            <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Mostrar menos' : `Ver todos (${played.length})`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/** Tabela com posição, setas da rodada, jogos, saldo e pontos. */
export function StandingsTable({ rows, name, zones, highlight }: { rows: ReturnType<typeof tableAfter>; name: (id: string) => string; zones?: boolean; highlight?: Set<string> }) {
  const n = rows.length;
  return (
    <table className="table standings">
      <thead>
        <tr>
          <th>#</th>
          <th />
          <th>Clube</th>
          <th>J</th>
          <th>V</th>
          <th>SG</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.clubId} className={`${r.clubId === PLAYER_ID ? 'me' : ''}${highlight?.has(r.clubId) ? ' hl' : ''}${zones && r.pos <= 4 ? ' z-top' : ''}${zones && r.pos > n - 4 ? ' z-down' : ''}`}>
            <td>{r.pos}</td>
            <td className={`mv ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}`}>{r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : ''}</td>
            <td>{name(r.clubId)}</td>
            <td>{r.played}</td>
            <td>{r.won}</td>
            <td>{r.gf - r.ga}</td>
            <td>
              <b>{r.points}</b>
              {r.deduction > 0 ? '*' : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

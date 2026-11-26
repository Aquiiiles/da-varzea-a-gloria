import { useState } from 'react';
import { COMP_STATS_KEY, PLAYER_ID, outcomeOf, playedMatches, stageStarted, statsUpTo, tableAfter, type CalendarMatch, type GameState, type StatLine } from '../../engine';
import { MatchRow } from '../SeasonView';

/** Aba Tabela: classificação de cada competição de pontos (com setas da última rodada) e os seus resultados. */
export function TableTab({ state }: { state: GameState }) {
  const cal = state.calendar;
  const day = state.reveal ?? -1;
  const [pick, setPick] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<'tabela' | 'artilharia' | 'time' | 'copas'>('tabela');
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

  const live = state.live;
  const views = [
    ['tabela', 'Classificação'],
    ['artilharia', 'Artilharia'],
    ['time', 'Seu time'],
    ['copas', 'Copas'],
  ] as const;
  const nav = (
    <div className="subtabs">
      {views.map(([id, label]) => (
        <button key={id} type="button" className={`subtab${view === id ? ' is-on' : ''}`} onClick={() => setView(id)}>
          {label}
        </button>
      ))}
    </div>
  );
  if (view === 'artilharia' && live && stage) {
    const key = COMP_STATS_KEY[stage.comp];
    const lines = statsUpTo(live, day, key);
    return (
      <div className="tab-stack">
        {nav}
        <Leaders title={`Artilharia · ${stage.compName}`} lines={lines} by="goals" me={state.player.name} />
        <Leaders title={`Assistências · ${stage.compName}`} lines={lines} by="assists" me={state.player.name} />
      </div>
    );
  }
  if (view === 'time' && live) {
    const mine = statsUpTo(live, day).filter((l) => l.club === state.player.name);
    return (
      <div className="tab-stack">
        {nav}
        <MyTeamStats lines={mine} />
      </div>
    );
  }
  if (view === 'copas') {
    return (
      <div className="tab-stack">
        {nav}
        <CupPaths matches={played} stageComps={new Set(cal.stages.map((s) => s.compName))} />
      </div>
    );
  }

  return (
    <div className="tab-stack">
      {nav}
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

/** Os 10 primeiros de gols ou assistências (o seu time destacado). */
function Leaders({ title, lines, by, me }: { title: string; lines: StatLine[]; by: 'goals' | 'assists'; me: string }) {
  const top = lines.filter((l) => l[by] > 0).sort((a, b) => b[by] - a[by] || a.name.localeCompare(b.name)).slice(0, 10);
  return (
    <section className="panel">
      <p className="kicker">{title}</p>
      {top.length === 0 ? (
        <p className="muted">Ninguém ainda.</p>
      ) : (
        <table className="table leaders">
          <tbody>
            {top.map((l, i) => (
              <tr key={l.id} className={l.club === me ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>
                  {l.name}
                  <small className="muted"> · {l.club}</small>
                </td>
                <td>
                  <b>{l[by]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Números do seu elenco na temporada (todas as competições). */
function MyTeamStats({ lines }: { lines: StatLine[] }) {
  const [sort, setSort] = useState<'rating' | 'goals' | 'assists' | 'apps'>('rating');
  const rows = lines.slice().sort((a, b) => (sort === 'rating' ? b.rating - a.rating : b[sort] - a[sort]) || b.apps - a.apps);
  const head = (k: typeof sort, label: string) => (
    <th>
      <button type="button" className={`th-sort${sort === k ? ' is-on' : ''}`} onClick={() => setSort(k)}>
        {label}
      </button>
    </th>
  );
  return (
    <section className="panel">
      <p className="kicker">Seu time na temporada</p>
      {rows.length === 0 ? (
        <p className="muted">A bola ainda não rolou.</p>
      ) : (
        <table className="table leaders my-stats">
          <thead>
            <tr>
              <th>Jogador</th>
              {head('apps', 'J')}
              {head('goals', 'G')}
              {head('assists', 'A')}
              {head('rating', 'Nota')}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.apps}</td>
                <td>{l.goals}</td>
                <td>{l.assists}</td>
                <td>
                  <b className={l.rating >= 7 ? 'good' : l.rating < 6 ? 'bad' : ''}>{l.rating.toFixed(1)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Caminho em cada copa: fase a fase, até onde chegou. */
function CupPaths({ matches, stageComps }: { matches: CalendarMatch[]; stageComps: Set<string> }) {
  const cups = new Map<string, CalendarMatch[]>();
  for (const m of matches) {
    if (stageComps.has(m.comp) && m.advanced === null) continue;
    if (!cups.has(m.comp)) cups.set(m.comp, []);
    cups.get(m.comp)!.push(m);
  }
  if (cups.size === 0) {
    return (
      <section className="panel">
        <p className="kicker">Copas</p>
        <p className="muted">Nenhum jogo de copa ainda nesta temporada.</p>
      </section>
    );
  }
  return (
    <>
      {[...cups.entries()].map(([comp, ms]) => {
        const last = ms[ms.length - 1];
        const out = ms.some((m) => m.advanced === false);
        const champion = !out && /final/i.test(last.round) && last.advanced === true;
        return (
          <section key={comp} className="panel">
            <p className="kicker">{comp}</p>
            <ol className="cup-path">
              {ms.map((m) => {
                const r = outcomeOf(m);
                return (
                  <li key={`${m.day}-${m.round}`} className={`cp-step${m.advanced === true ? ' cp-up' : m.advanced === false ? ' cp-out' : ''}`}>
                    <span className="cp-round">{m.round}</span>
                    <span className="cp-opp">
                      {m.home ? 'x' : '@'} {m.opponent}
                    </span>
                    <b className="cp-score">
                      {m.gf} x {m.ga}
                      {m.pens ? ` (${m.pens[0]}-${m.pens[1]} pên.)` : ''}
                    </b>
                    <i className={`res-badge res-${r}`}>{r}</i>
                  </li>
                );
              })}
            </ol>
            <p className={`cp-status ${out ? 'bad' : champion ? 'good' : ''}`}>{out ? `Eliminado: ${last.round.split(' · ')[0]}` : champion ? 'Campeão!' : 'Vivo na competição'}</p>
          </section>
        );
      })}
    </>
  );
}

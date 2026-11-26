import { useState } from 'react';
import { PLAYER_ID, START_YEAR, outcomeOf, playedMatches, roundOn, tableAfter, type GameState } from '../../engine';
import { CAT_LABEL, allNews, type NewsCat, type NewsItem } from '../news';
import type { TabProps } from './Office';

type Filter = 'tudo' | NewsCat;
const FILTERS: Filter[] = ['tudo', 'clube', 'competicoes', 'mercado', 'tecnicos', 'premios', 'mundo'];

/** Notícias em formato de jornal: manchete, a rodada, filtros por assunto e o arquivo por temporada. */
export function NewsTab({ state }: TabProps) {
  const [filter, setFilter] = useState<Filter>('tudo');
  const [limit, setLimit] = useState(25);
  const news = allNews(state);
  const current = news.length > 0 ? news[0].season : state.season;
  const headline = news.find((n) => n.season === current && n.hot && n.mine) ?? news.find((n) => n.season === current && n.hot) ?? news.find((n) => n.mine) ?? news[0];
  const list = news.filter((n) => n !== headline && (filter === 'tudo' || n.cat === filter || (filter === 'clube' && n.mine)));
  const shown = list.slice(0, limit);
  // agrupa por temporada; notícias seguidas com a mesma etiqueta (ex.: dança dos técnicos) viram um cartão só
  const groups: { season: number; items: (NewsItem | NewsItem[])[] }[] = [];
  for (const n of shown) {
    let g = groups.at(-1);
    if (!g || g.season !== n.season) groups.push((g = { season: n.season, items: [] }));
    const prev = g.items.at(-1);
    const prevTag = Array.isArray(prev) ? prev[0].tag : prev?.tag;
    if (n.tag && prevTag === n.tag && !n.hot) {
      if (Array.isArray(prev)) prev.push(n);
      else g.items[g.items.length - 1] = [prev as NewsItem, n];
    } else g.items.push(n);
  }
  const year = (s: number) => (s > 0 ? START_YEAR + s - 1 : null);

  return (
    <div className="tab-stack newspaper">
      <header className="np-mast">
        <span className="np-name">Gazeta da Bola</span>
        <span className="np-date">
          {state.calendar && state.reveal != null ? `Temporada ${state.calendar.year}` : `Pré-temporada ${START_YEAR + state.season - 1}`}
        </span>
      </header>

      {headline ? (
        <article className={`np-lead cat-${headline.cat}`}>
          <p className="np-kicker">
            {headline.tag ?? CAT_LABEL[headline.cat]}
            {year(headline.season) ? ` · ${year(headline.season)}` : ''}
          </p>
          <h2 className="np-headline">{headline.title}</h2>
          {headline.body && <p className="np-deck">{headline.body}</p>}
        </article>
      ) : (
        <p className="empty">Nenhuma notícia ainda. Comece a temporada.</p>
      )}

      <Matchday state={state} />

      <div className="subtabs np-filters">
        {FILTERS.map((f) => (
          <button key={f} type="button" className={`subtab${filter === f ? ' is-on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'tudo' ? 'Tudo' : CAT_LABEL[f]}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="empty">Nada por aqui.</p>}
      {groups.map((g) => (
        <section key={`${g.season}-${g.items.length}`} className="np-section">
          <h3 className="np-season">{year(g.season) ? `Temporada ${year(g.season)}` : 'Antes'}</h3>
          <ul className="np-list">
            {g.items.map((n, i) =>
              Array.isArray(n) ? (
                <NewsGroup key={i} items={n} />
              ) : (
                <li key={i} className={`np-item cat-${n.cat}${n.mine ? ' is-mine' : ''}${n.hot ? ' is-hot' : ''}`}>
                  <span className="np-tag">{n.tag ?? CAT_LABEL[n.cat]}</span>
                  <p className="np-title">{n.title}</p>
                  {n.body && <p className="np-body">{n.body}</p>}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
      {list.length > limit && (
        <button type="button" className="btn" onClick={() => setLimit(limit + 30)}>
          Mais notícias ({list.length - limit})
        </button>
      )}
    </div>
  );
}

/** Durante a temporada: o seu último jogo, os resultados da rodada e o topo da tabela. */
function Matchday({ state }: { state: GameState }) {
  const cal = state.calendar;
  if (!cal || state.reveal == null) return null;
  const played = playedMatches(cal, state.reveal);
  const last = played.at(-1);
  if (!last) return null;
  const round = roundOn(state, last.day);
  const r = outcomeOf(last);
  const others = round?.games.filter((g) => !g.mine) ?? [];
  const table = round?.stage ? tableAfter(round.stage, last.day) : [];
  const me = table.find((t) => t.clubId === PLAYER_ID);
  const top = table.slice(0, 4);
  const name = (id: string) => (id === PLAYER_ID ? state.player.name : cal.clubNames[id] ?? id);
  return (
    <section className="np-round">
      <p className="np-kicker">
        {last.comp} · {last.round}
      </p>
      <p className={`np-score res-${r}`}>
        <span>{last.home ? state.player.name : last.opponent}</span>
        <b>
          {last.home ? last.gf : last.ga} x {last.home ? last.ga : last.gf}
        </b>
        <span>{last.home ? last.opponent : state.player.name}</span>
      </p>
      {others.length > 0 && (
        <ul className="np-results">
          {others.map((g, i) => (
            <li key={i}>
              <span>{g.homeName}</span>
              <b>
                {g.hg} x {g.ag}
              </b>
              <span>{g.awayName}</span>
            </li>
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <p className="np-table">
          {top.map((t) => `${t.pos}º ${name(t.clubId)} (${t.points})`).join(' · ')}
          {me && me.pos > 4 ? ` · ... ${me.pos}º ${state.player.name} (${me.points})` : ''}
        </p>
      )}
    </section>
  );
}

/** Várias notícias do mesmo assunto seguidas: um cartão com as 3 primeiras e o resto a um toque. */
function NewsGroup({ items }: { items: NewsItem[] }) {
  const [open, setOpen] = useState(false);
  const mine = items.filter((n) => n.mine);
  const first = [...mine, ...items.filter((n) => !n.mine)].slice(0, open ? items.length : 3);
  return (
    <li className={`np-item np-group cat-${items[0].cat}${mine.length > 0 ? ' is-mine' : ''}`}>
      <span className="np-tag">
        {items[0].tag} · {items.length}
      </span>
      <ul>
        {first.map((n, i) => (
          <li key={i} className={n.mine ? 'is-mine' : ''}>
            {n.title}
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? 'Mostrar menos' : `Ver todas (${items.length})`}
        </button>
      )}
    </li>
  );
}

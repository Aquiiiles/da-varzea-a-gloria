import type { TabProps } from './Office';
import { Section } from './common';

export function NewsTab({ state }: TabProps) {
  const seasons = state.history.slice().reverse();
  const clubNews = state.news.slice(-30).reverse();
  return (
    <div className="tab-stack">
      {seasons.length === 0 ? (
        <Section title="Mundo da bola">
          <p className="empty">A bola ainda não rolou. As notícias da temporada aparecem aqui depois do primeiro jogo.</p>
        </Section>
      ) : (
        <Section title={`Mundo da bola · ${seasons[0].year}`} note="Campeões, acessos, quedas, artilharia e bastidores de todas as divisões.">
          <ul className="news">
            {seasons[0].worldNews.map((n, i) => (
              <li key={i} className={/^(TERREMOTO|ZEBRA)/.test(n) ? 'news-hot' : ''}>
                {n}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Notícias do ${state.player.name}`}>
        <ul className="news">
          {clubNews.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Section>

      {seasons.length > 1 && (
        <Section title="Arquivo">
          {seasons.slice(1).map((r) => (
            <details key={r.season} className="news-archive">
              <summary>{r.year}</summary>
              <ul className="news">
                {r.worldNews.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          ))}
        </Section>
      )}
    </div>
  );
}

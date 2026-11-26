import type { GameState } from '../engine';
import { calendarTicker } from './SeasonView';

/** Notícias do letreiro: durante a temporada só o que já aconteceu (as manchetes do fim ficam para o resumo). */
export function tickerItems(state: GameState): string[] {
  if (state.reveal == null) return state.news.slice(-8).reverse();
  const items = calendarTicker(state);
  return items.length > 0 ? items : [`Começa a temporada ${state.calendar?.year ?? ''}: ${state.player.name} estreia em breve`];
}

export function Ticker({ items }: { items: string[] }) {
  const text = items.join('   •   ');
  return (
    <div className="ticker" aria-label="Últimas notícias">
      <span className="ticker-label">ÚLTIMAS</span>
      <div className="ticker-track">
        {/* duas cópias para o loop contínuo */}
        <div className="ticker-move" key={text}>
          <span>{text}</span>
          <span aria-hidden="true">{text}</span>
        </div>
      </div>
    </div>
  );
}

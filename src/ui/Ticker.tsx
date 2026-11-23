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

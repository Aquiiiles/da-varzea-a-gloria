import { TIERS, clubRecords, trophies, type GameState, type Tier } from '../engine';
import { num } from './format';

/** Taça desenhada em SVG; o tamanho cresce com a importância. */
function Cup({ size, tier }: { size: 1 | 2 | 3; tier?: Tier }) {
  const h = [0, 44, 58, 74][size];
  const gold = tier === 1 ? '#ffd23f' : tier !== undefined && tier <= 3 ? '#f4c76b' : '#c9a86a';
  return (
    <svg className="cup" width={h * 0.8} height={h} viewBox="0 0 40 50" aria-hidden="true">
      <path d="M10 4h20v10c0 7-4.5 12-10 12S10 21 10 14V4z" fill={gold} />
      <path d="M10 7H4c0 6 3 9 7 9M30 7h6c0 6-3 9-7 9" fill="none" stroke={gold} strokeWidth="2.5" />
      <rect x="17.5" y="25" width="5" height="9" fill={gold} />
      <rect x="11" y="34" width="18" height="5" rx="1" fill={gold} />
      <rect x="8" y="39" width="24" height="7" rx="1.5" fill="#5b3a1e" />
      <path d="M14 8c0 6 1.5 10 4 12" stroke="#fff8" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function TrophyRoom({ state }: { state: GameState }) {
  const list = trophies(state);
  const rec = clubRecords(state);

  return (
    <div className="tab-stack">
      <section className="panel section trophy-room">
        <h2 className="section-title">Sala de troféus</h2>
        {list.length === 0 ? (
          <p className="empty">A estante ainda está vazia. O primeiro título a gente nunca esquece.</p>
        ) : (
          <ul className="shelf">
            {list.map((t) => (
              <li key={t.id} className={`trophy trophy-${t.size}`}>
                <Cup size={t.size} tier={t.tier} />
                {t.years.length > 1 && <span className="trophy-count">{t.years.length}x</span>}
                <strong>{t.name}</strong>
                <small>{t.years.join(', ')}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="section-note shelf-note">Copa Nacional, Copa dos Campeões e Mundial chegam com os jogos ao vivo.</p>
      </section>

      <section className="panel section">
        <h2 className="section-title">Recordes do clube</h2>
        <dl className="records">
          <Rec label="Maior artilheiro" value={rec.topScorer ? `${rec.topScorer.name} · ${rec.topScorer.goals} gols` : '—'} />
          <Rec label="Mais jogos" value={rec.mostApps ? `${rec.mostApps.name} · ${rec.mostApps.apps} jogos` : '—'} />
          <Rec
            label="Artilharia numa temporada"
            value={rec.bestSeasonScorer ? `${rec.bestSeasonScorer.name} · ${rec.bestSeasonScorer.goals} gols (${rec.bestSeasonScorer.year})` : '—'}
          />
          <Rec label="Maior goleada" value={rec.biggestWin ? `${rec.biggestWin.score} no ${rec.biggestWin.opponent} (${rec.biggestWin.year})` : '—'} />
          <Rec label="Pior derrota" value={rec.worstDefeat ? `${rec.worstDefeat.score} para o ${rec.worstDefeat.opponent} (${rec.worstDefeat.year})` : '—'} />
          <Rec
            label="Melhor campanha"
            value={rec.bestCampaign ? `${rec.bestCampaign.points} pts, ${rec.bestCampaign.position}º na ${TIERS[rec.bestCampaign.tier].name} (${rec.bestCampaign.year})` : '—'}
          />
          <Rec label="Maior público médio" value={rec.bestAttendance ? `${num(rec.bestAttendance.value)} (${rec.bestAttendance.year})` : '—'} />
        </dl>
        {Object.keys(rec.seasonsByTier).length > 0 && (
          <>
            <h3>Temporadas por divisão</h3>
            <ul className="tier-years">
              {([1, 2, 3, 4, 5, 6, 7, 8] as Tier[])
                .filter((t) => rec.seasonsByTier[t])
                .map((t) => (
                  <li key={t}>
                    <span>{TIERS[t].name}</span>
                    <b>{rec.seasonsByTier[t]}</b>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Rec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

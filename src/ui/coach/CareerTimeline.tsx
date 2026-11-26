import { START_YEAR, TIERS, type GameState } from '../../engine';
import { Crest } from '../Crest';

const EXIT: Record<string, string> = { demitido: 'demitido', proposta: 'saiu por proposta', contrato: 'fim de contrato' };
const OUTCOME: Record<string, string> = { campeao: 'campeão', acesso: 'acesso', acesso_playoff: 'acesso', queda: 'rebaixado', fica: '', barrado_estadio: 'barrado pelo estádio', falencia: 'falência' };

/** Linha do tempo da carreira: clubes, campanhas, títulos, acessos e quedas, temporada a temporada. */
export function CareerTimeline({ state }: { state: GameState }) {
  const c = state.career!;
  const seasons = state.history.slice().reverse();
  const rec = c.record;
  return (
    <div className="tab-stack">
      <section className="panel">
        <p className="kicker">Carreira de {c.name}</p>
        <p className="lede">
          {c.age} anos · {c.stints.length} clube{c.stints.length === 1 ? '' : 's'}
          {rec ? ` · ${rec.games} jogos · ${rec.titles.length} título${rec.titles.length === 1 ? '' : 's'}` : ''}
        </p>
        <ol className="stints">
          {c.stints
            .slice()
            .reverse()
            .map((s, i) => {
              const short = s.club.slice(0, 3).toUpperCase();
              const games = (s.w ?? 0) + (s.d ?? 0) + (s.l ?? 0);
              return (
                <li key={i} className={s.to === null ? 'is-now' : ''}>
                  <Crest name={s.club} short={short} colors={s.colors} size={34} />
                  <div>
                    <strong>{s.club}</strong>
                    <small>
                      {START_YEAR + s.from - 1}
                      {s.to === null ? ' – hoje' : s.to !== s.from ? ` – ${START_YEAR + s.to - 1}` : ''} · {TIERS[s.tier].name}
                      {games > 0 ? ` · ${s.w ?? 0}V ${s.d ?? 0}E ${s.l ?? 0}D` : ''}
                      {s.exit ? ` · ${EXIT[s.exit]}` : ''}
                    </small>
                  </div>
                </li>
              );
            })}
        </ol>
      </section>

      {seasons.length > 0 && (
        <section className="panel">
          <p className="kicker">Ano a ano</p>
          <ol className="timeline">
            {seasons.map((r) => {
              const titles = [...r.comps.filter((x) => x.won).map((x) => x.name), ...r.cups.filter((x) => x.champion).map((x) => x.name)];
              const main = r.comps[r.comps.length - 1];
              const tone = titles.length > 0 || r.outcome === 'acesso' || r.outcome === 'acesso_playoff' ? 'good' : r.outcome === 'queda' ? 'bad' : '';
              return (
                <li key={r.season} className={`tl-${tone || 'none'}`}>
                  <span className="tl-year">{r.year}</span>
                  <div>
                    <strong>{r.club?.name ?? '—'}</strong>
                    <small>
                      {main ? `${main.name}: ${main.finish}` : TIERS[r.tier].name}
                      {OUTCOME[r.outcome] && !(main && main.finish.toLowerCase().startsWith(OUTCOME[r.outcome])) ? ` · ${OUTCOME[r.outcome]}` : ''}
                    </small>
                    {titles.length > 0 && <em className="tl-titles">{titles.join(' · ')}</em>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

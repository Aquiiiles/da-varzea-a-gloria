import { useState } from 'react';
import { BOARD_INFO, TIERS, type GameState, type SeasonResult } from '../../engine';
import { Crest } from '../Crest';
import { SeasonSummary } from '../SeasonSummary';

/** O grande momento da temporada (o mais importante primeiro). */
export interface BigMoment {
  tone: 'good' | 'bad';
  title: string;
  lines: string[];
}

export function bigMoment(state: GameState, r: SeasonResult): BigMoment | null {
  const c = state.career;
  const stint = c?.stints.find((s) => s.to === r.season && s.exit === 'demitido');
  const titles = [...r.comps.filter((x) => x.won).map((x) => x.name), ...r.cups.filter((x) => x.champion).map((x) => x.name)];
  const lines: string[] = [];
  if (titles.length > 1) lines.push(`Títulos: ${titles.join(', ')}`);
  if (r.outcome === 'acesso' || r.outcome === 'acesso_playoff') lines.push(`Acesso à ${TIERS[r.nextTier].name}`);
  if (stint) return { tone: 'bad', title: 'Demitido', lines: [`A diretoria do ${stint.club} mandou você embora.`, ...lines] };
  if (titles.length > 0) return { tone: 'good', title: `Campeão ${/^(Série|Copa|Várzea|Libertadores|Sul-Americana|Taça|Liga|Copinha)/.test(titles[0]) ? 'da' : 'do'} ${titles[0]}!`, lines };
  if (r.outcome === 'acesso' || r.outcome === 'acesso_playoff') return { tone: 'good', title: 'Acesso!', lines: [`${r.club?.name ?? state.player.name} na ${TIERS[r.nextTier].name}.`] };
  if (r.outcome === 'queda') return { tone: 'bad', title: 'Rebaixado', lines: [`${r.club?.name ?? state.player.name} cai para a ${TIERS[r.nextTier].name}.`] };
  return null;
}

/** Tela cheia: título, acesso, rebaixamento ou demissão. */
export function SeasonMoment({ state, result, moment, onDone }: { state: GameState; result: SeasonResult; moment: BigMoment; onDone: () => void }) {
  const club = result.club ?? { name: state.player.name, colors: state.player.colors };
  return (
    <section className={`moment moment-${moment.tone}`} style={{ ['--m1' as string]: club.colors[0], ['--m2' as string]: club.colors[1] }}>
      {moment.tone === 'good' && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.18}s`, background: i % 3 === 0 ? club.colors[0] : i % 3 === 1 ? club.colors[1] : 'var(--accent)' }} />
          ))}
        </div>
      )}
      <p className="kicker">Temporada {result.year}</p>
      <Crest name={club.name} short={state.player.short} colors={club.colors} size={96} />
      <h1 className="moment-title">{moment.title}</h1>
      {moment.lines.map((l) => (
        <p key={l} className="lede">
          {l}
        </p>
      ))}
      <button type="button" className="btn btn-primary moment-btn" onClick={onDone}>
        Continuar
      </button>
    </section>
  );
}

/** Balanço curto do técnico: campanha, destaques, carreira e o que vem no ano que vem. */
export function CoachSummary({ state, result: r, onNext }: { state: GameState; result: SeasonResult; onNext: () => void }) {
  const [full, setFull] = useState(false);
  const c = state.career!;
  if (full) return <SeasonSummary result={r} state={state} onNext={onNext} fast={false} onFast={() => {}} />;
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of r.playerMatches) {
    const home = m.home === 'player';
    const f = home ? m.hg : m.ag;
    const a = home ? m.ag : m.hg;
    gf += f;
    ga += a;
    if (f > a || (m.winner === 'player' && f === a)) w++;
    else if (f < a || (m.winner && m.winner !== 'player' && f === a)) l++;
    else d++;
  }
  const main = r.comps[r.comps.length - 1];
  const club = r.club ?? { name: state.player.name, colors: state.player.colors };
  const rec = c.record;
  const nextName = TIERS[r.nextTier].name;
  const leaving = r.departures.slice(0, 4);
  return (
    <div className="tab-stack coach-summary">
      <section className="panel cs-head">
        <Crest name={club.name} short={state.player.short} colors={club.colors} size={52} />
        <div>
          <p className="kicker">Fim da temporada {r.year}</p>
          <h2 className="headline">{club.name}</h2>
          {main && (
            <p className="muted">
              {main.name}: {main.finish}
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <dl className="cs-numbers">
          <div>
            <dt>Campanha</dt>
            <dd>
              {w}V {d}E {l}D
            </dd>
          </div>
          <div>
            <dt>Gols</dt>
            <dd>
              {gf} : {ga}
            </dd>
          </div>
          <div>
            <dt>Artilheiro</dt>
            <dd>{r.topScorer ? `${r.topScorer.name.split(' ').slice(-1)[0]} (${r.topScorer.goals})` : '—'}</dd>
          </div>
        </dl>
        {r.cups.length > 0 && (
          <p className="muted">
            Copas: {r.cups.map((cu) => `${cu.name}: ${cu.reached}`).join(' · ')}
          </p>
        )}
      </section>

      {(r.coachNews ?? []).length > 0 && (
        <section className="panel">
          <p className="kicker">Sua carreira</p>
          <ul className="moves">
            {r.coachNews!.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel next-year">
        <p className="kicker">Ano que vem</p>
        {c.unemployed ? (
          <p className="lede">
            Você está sem clube. {c.offers.length > 0 ? `${c.offers.length} proposta${c.offers.length > 1 ? 's' : ''} esperando.` : 'Espere as propostas na próxima janela.'}
          </p>
        ) : (
          <>
            <p className="lede">
              {state.player.name} na <b>{nextName}</b>. Contrato: {c.contract} temporada{c.contract > 1 ? 's' : ''}. Diretoria {BOARD_INFO[c.board.personality].label.toLowerCase()}, confiança{' '}
              <b className={c.board.confidence <= 35 ? 'bad' : c.board.confidence >= 70 ? 'good' : ''}>{c.board.confidence}</b>.
            </p>
            {leaving.length > 0 && <p className="muted">Saídas: {leaving.join(' · ')}</p>}
          </>
        )}
      </section>

      {rec && rec.games > 0 && (
        <section className="panel">
          <p className="kicker">Seus números de carreira</p>
          <dl className="cs-numbers">
            <div>
              <dt>Jogos</dt>
              <dd>{rec.games}</dd>
            </div>
            <div>
              <dt>Aproveitamento</dt>
              <dd>{Math.round(((rec.w * 3 + rec.d) / (rec.games * 3)) * 100)}%</dd>
            </div>
            <div>
              <dt>Títulos</dt>
              <dd>{rec.titles.length}</dd>
            </div>
            <div>
              <dt>Invencibilidade</dt>
              <dd>{rec.bestUnbeaten} jogos</dd>
            </div>
            {rec.bestWin && (
              <div>
                <dt>Maior vitória</dt>
                <dd>
                  {rec.bestWin.gf} x {rec.bestWin.ga} <small>no {rec.bestWin.opp} ({rec.bestWin.year})</small>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <div className="playbar">
        <button type="button" className="btn" onClick={() => setFull(true)}>
          Balanço completo
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Próxima temporada
        </button>
      </div>
    </div>
  );
}

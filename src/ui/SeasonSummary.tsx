import { useState } from 'react';
import { PLAYER_ID, TIERS, moodLabel, type CompResult, type CupMatch, type GameState, type SeasonResult, type Tier } from '../engine';
import { money, OUTCOME_LABEL } from './format';

interface Props {
  result: SeasonResult;
  state: GameState;
  onNext: () => void;
  onFast: () => void;
  fast: boolean;
}

function score(m: CupMatch): string {
  const mine = m.home ? m.result.hg : m.result.ag;
  const theirs = m.home ? m.result.ag : m.result.hg;
  const pens = m.result.pens ? (m.home ? m.result.pens : [m.result.pens[1], m.result.pens[0]]) : null;
  return `${mine}-${theirs}${pens ? ` (${pens[0]}-${pens[1]} pên.)` : m.result.extraTime ? ' (prorr.)' : ''}`;
}

export function TieList({ matches }: { matches: CupMatch[] }) {
  return (
    <ul className="tie-list">
      {matches.map((m, i) => (
        <li key={i} className={m.advanced === null ? (m.won ? 'good' : 'muted') : m.advanced ? 'good' : 'bad'}>
          <span className="cup-round">{m.round}</span>
          <span>
            {m.home ? 'x' : '@'} {m.opponent}
            {m.opponentTier ? ` (${TIERS[m.opponentTier].short})` : ''}
          </span>
          <b>{score(m)}</b>
          {m.giantKill && <em className="tag-offer">zebra</em>}
        </li>
      ))}
    </ul>
  );
}

/** Uma competição de liga do jogador: tabela(s) + mata-mata. */
export function CompView({ comp, clubName, open: openDefault }: { comp: CompResult; clubName: string; open?: boolean }) {
  const [tab, setTab] = useState(0);
  const table = comp.tables[tab];
  const name = (id: string) => (id === PLAYER_ID ? clubName : comp.clubNames[id] ?? id);
  return (
    <details className="comp" open={openDefault}>
      <summary>
        <span className="comp-name">{comp.name}</span>
        <span className={`comp-finish${comp.won ? ' good' : ''}`}>{comp.finish}</span>
      </summary>
      {comp.tables.length > 1 && (
        <div className="seg seg-compact comp-tabs">
          {comp.tables.map((t, i) => (
            <button key={t.name} type="button" className={`seg-btn${tab === i ? ' is-on' : ''}`} onClick={() => setTab(i)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      {table && (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{table.name}</th>
              <th>J</th>
              <th>SG</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={row.clubId} className={row.clubId === PLAYER_ID ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{name(row.clubId)}</td>
                <td>{row.played}</td>
                <td>{row.gf - row.ga}</td>
                <td>
                  {row.points}
                  {row.deduction > 0 ? '*' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {comp.ties.length > 0 && (
        <>
          <h4>Mata-mata</h4>
          <TieList matches={comp.ties} />
        </>
      )}
      {!comp.won && <p className="muted">Campeão: {comp.champion}</p>}
    </details>
  );
}

export function SeasonSummary({ result: r, state, onNext, onFast, fast }: Props) {
  const clubName = state.player.name;
  const tone = r.outcome === 'queda' || r.outcome === 'falencia' || r.outcome === 'barrado_estadio' ? 'bad' : r.outcome === 'fica' ? 'neutral' : 'good';
  const f = r.finance;
  const main = r.comps[r.comps.length - 1];
  return (
    <section className="panel summary">
      <p className="kicker">Fim da temporada {r.year}</p>
      <div className={`banner banner-${tone}`}>
        <span className="banner-label">{OUTCOME_LABEL[r.outcome]}</span>
        <span className="banner-pos">
          {main?.name}: {main?.finish}
        </span>
      </div>
      {r.outcome !== 'fica' && r.nextTier !== r.tier && (
        <p className="next-tier">
          Próxima temporada: <strong>{TIERS[r.nextTier].name}</strong>
          {r.nextTier <= 4 ? ' (e o Estadual no 1º semestre)' : ''}
        </p>
      )}
      {r.outcome === 'barrado_estadio' && (
        <p className="alert">
          Ganhou em campo, perdeu no regulamento: a {TIERS[(r.tier - 1) as Tier].name} exige estádio para {r.stadiumRequired?.toLocaleString('pt-BR')} pessoas. A
          vaga foi para outro clube.
        </p>
      )}
      <ul className="headlines">
        {r.headlines.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>

      <div className="comps">
        {r.comps.map((c, i) => (
          <CompView key={c.id} comp={c} clubName={clubName} open={i === r.comps.length - 1} />
        ))}
      </div>

      {r.cups.map((c) => (
        <div key={c.id} className={`cup-run${c.champion ? ' is-champ' : ''}`}>
          <h3>
            {c.name} · <span>{c.reached}</span>
            {c.prize > 0 && <small> · prêmio {money(c.prize)}</small>}
          </h3>
          <TieList matches={c.matches} />
        </div>
      ))}

      <div className="summary-grid">
        <div className="box">
          <h3>Metas</h3>
          <ul className="objectives">
            {r.objectives.map((o, i) => (
              <li key={i} className={o.met ? 'good' : 'bad'}>
                {o.met ? '✔' : '✘'} {o.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="box">
          <h3>Torcedômetro</h3>
          <p>
            {r.mood} · {moodLabel(r.mood)}{' '}
            <span className={r.moodDelta >= 0 ? 'good' : 'bad'}>
              ({r.moodDelta >= 0 ? '+' : ''}
              {r.moodDelta})
            </span>
          </p>
          {r.derby && (
            <p className="muted">
              Clássico: {r.derby.w}V {r.derby.d}E {r.derby.l}D
            </p>
          )}
        </div>
        <div className="box">
          <h3>Técnico</h3>
          <p>
            {r.coachReport.name} · moral {r.coachReport.morale}{' '}
            <span className={r.coachReport.moraleDelta >= 0 ? 'good' : 'bad'}>
              ({r.coachReport.moraleDelta >= 0 ? '+' : ''}
              {r.coachReport.moraleDelta})
            </span>
          </p>
          {r.coachReport.request && (
            <p className={r.coachReport.met ? 'good' : 'bad'}>
              {r.coachReport.met ? '✔' : '✘'} Pedido: {r.coachReport.request.text}
            </p>
          )}
          {r.coachReport.left && <p className="bad">{r.coachReport.left}</p>}
        </div>
        <div className="box">
          <h3>Artilheiro</h3>
          <p>{r.topScorer && r.topScorer.goals > 0 ? `${r.topScorer.name} — ${r.topScorer.goals} gols` : '—'}</p>
          <p className="muted">Força do time: {r.strength.toFixed(1)} (média do nível {TIERS[r.tier].meanStrength})</p>
        </div>
        <div className="box">
          <h3>Finanças</h3>
          <p>
            Receita {money(f.tickets + f.tv + f.sponsors + f.commerce + f.prizes)} · Custos {money(f.wages + f.staff + f.upkeep)}
          </p>
          <p className="muted">
            Público médio {f.attendance.toLocaleString('pt-BR')}
            {f.commerce > 0 ? ` · comércio ${money(f.commerce)}` : ''}
            {f.prizes > 0 ? ` · prêmios e cotas ${money(f.prizes)}` : ''}
          </p>
          <p className={f.net < 0 ? 'bad' : 'good'}>
            Saldo {money(f.net)} → caixa {money(f.cashEnd)}
          </p>
        </div>
      </div>

      {r.renewals.length > 0 && (
        <div className="box departures">
          <h3>Renovações automáticas</h3>
          <ul>
            {r.renewals.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {r.departures.length > 0 && (
        <div className="box departures">
          <h3>Movimentação do elenco</h3>
          <ul>
            {r.departures.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Abrir a janela de {r.year + 1}
        </button>
        <button type="button" className="btn" onClick={onFast} disabled={fast}>
          Rápido ⏩
        </button>
      </div>
    </section>
  );
}

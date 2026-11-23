import { PLAYER_ID, TIERS, type GameState, type SeasonResult, type Tier } from '../engine';
import { money, OUTCOME_LABEL } from './format';
import { moodLabel } from '../engine';

function zone(tier: Tier, pos: number, size: number): string {
  const r = TIERS[tier];
  if (tier > 1 && pos <= r.autoUp) return 'up';
  if (r.playoff && pos >= r.playoff[0] && pos <= r.playoff[1]) return 'po';
  if (tier === 1 && pos <= 4) return 'up';
  if (pos > size - r.down) return 'down';
  return '';
}

interface Props {
  result: SeasonResult;
  state: GameState;
  onNext: () => void;
  onFast: () => void;
  fast: boolean;
}

export function SeasonSummary({ result: r, state, onNext, onFast, fast }: Props) {
  const clubName = state.player.name;
  const tone = r.outcome === 'queda' || r.outcome === 'falencia' || r.outcome === 'barrado_estadio' ? 'bad' : r.outcome === 'fica' ? 'neutral' : 'good';
  const f = r.finance;
  const po = r.playoff;
  const name = (id: string) => (id === PLAYER_ID ? clubName : r.clubNames[id] ?? id);
  return (
    <section className="panel summary">
      <p className="kicker">Fim da temporada {r.year}</p>
      <div className={`banner banner-${tone}`}>
        <span className="banner-label">{OUTCOME_LABEL[r.outcome]}</span>
        <span className="banner-pos">
          {r.position}º · {r.points} pts
        </span>
      </div>
      {r.outcome === 'barrado_estadio' && (
        <p className="alert">
          Ganhou em campo, perdeu no regulamento: a {TIERS[(r.tier - 1) as Tier].name} exige estádio para{' '}
          {r.stadiumRequired?.toLocaleString('pt-BR')} pessoas. A vaga foi para outro clube.
        </p>
      )}
      <ul className="headlines">
        {r.headlines.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>

      {r.cups.map((c) => (
        <div key={c.id} className={`cup-run${c.champion ? ' is-champ' : ''}`}>
          <h3>
            {c.name} · <span>{c.reached}</span>
            {c.prize > 0 && <small> · prêmio {money(c.prize)}</small>}
          </h3>
          <ul>
            {c.matches.map((m, i) => {
              const mine = m.home ? m.result.hg : m.result.ag;
              const theirs = m.home ? m.result.ag : m.result.hg;
              const pens = m.result.pens ? (m.home ? m.result.pens : ([m.result.pens[1], m.result.pens[0]] as const)) : null;
              return (
                <li key={i} className={m.won ? 'good' : 'bad'}>
                  <span className="cup-round">{m.round}</span>
                  <span>
                    {m.home ? 'x' : '@'} {m.opponent}
                    {m.opponentTier ? ` (${m.opponentTier}ª div.)` : ' (estrangeiro)'}
                  </span>
                  <b>
                    {mine}-{theirs}
                    {pens ? ` (${pens[0]}-${pens[1]} pên.)` : m.result.extraTime ? ' (prorr.)' : ''}
                  </b>
                  {m.giantKill && <em className="tag-offer">zebra</em>}
                </li>
              );
            })}
          </ul>
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
      </div>

      {po && (
        <div className="playoff">
          <h3>Playoff de acesso</h3>
          {[...po.semis, po.final].map((m, i) => (
            <p key={i} className={m.home === PLAYER_ID || m.away === PLAYER_ID ? 'me' : ''}>
              {i === 2 ? 'Final: ' : 'Semi: '}
              {name(m.home)} {m.hg} x {m.ag} {name(m.away)}
              {m.pens ? ` (pên. ${m.pens[0]}-${m.pens[1]})` : m.extraTime ? ' (prorr.)' : ''}
            </p>
          ))}
        </div>
      )}

      <div className="summary-grid">
        <div className="box">
          <h3>Artilheiro</h3>
          <p>{r.topScorer && r.topScorer.goals > 0 ? `${r.topScorer.name} — ${r.topScorer.goals} gols` : '—'}</p>
        </div>
        <div className="box">
          <h3>Força do time</h3>
          <p>{r.strength.toFixed(1)} (média da divisão {TIERS[r.tier].meanStrength})</p>
        </div>
        <div className="box">
          <h3>Finanças</h3>
          <p>
            Receita {money(f.tickets + f.tv + f.sponsors + f.commerce + f.prizes)} · Custos {money(f.wages + f.staff + f.upkeep)}
          </p>
          <p className="muted">
            Público médio {f.attendance.toLocaleString('pt-BR')}
            {f.commerce > 0 ? ` · comércio ${money(f.commerce)}` : ''}
            {f.prizes > 0 ? ` · prêmios ${money(f.prizes)}` : ''}
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

      <details className="table-wrap" open>
        <summary>Classificação — {TIERS[r.tier].name}</summary>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Clube</th>
              <th>J</th>
              <th>SG</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {r.table.map((row, i) => (
              <tr key={row.clubId} className={`${zone(r.tier, i + 1, r.table.length)}${row.clubId === PLAYER_ID ? ' me' : ''}`}>
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
      </details>

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

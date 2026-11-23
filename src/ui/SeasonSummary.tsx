import { PLAYER_ID, TIERS, type SeasonResult, type Tier } from '../engine';
import { money, OUTCOME_LABEL } from './format';

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
  clubName: string;
  onNext: () => void;
  onFast: () => void;
  fast: boolean;
}

export function SeasonSummary({ result: r, clubName, onNext, onFast, fast }: Props) {
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
          <h3>Finanças</h3>
          <p>
            Receita {money(f.tickets + f.tv + f.sponsors)} · Salários {money(f.wages)}
          </p>
          <p className={f.net < 0 ? 'bad' : 'good'}>
            Saldo {money(f.net)} → caixa {money(f.cashEnd)}
          </p>
        </div>
      </div>

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
          Próxima temporada
        </button>
        <button type="button" className="btn" onClick={onFast} disabled={fast}>
          Rápido ⏩
        </button>
      </div>
    </section>
  );
}

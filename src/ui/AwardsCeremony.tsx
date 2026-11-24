import type { AwardEntry, AwardItem, AwardSet, SeasonResult } from '../engine';

const POS_ORDER = ['GOL', 'DEF', 'MEI', 'ATA'] as const;
const ICON: Record<AwardItem['id'], string> = {
  bola: '⚽',
  chuteira: '👟',
  tecnico_ano: '📋',
  revelacao_ano: '🌱',
  craque: '⭐',
  artilheiro: '🎯',
  tecnico: '📋',
  revelacao: '🌱',
};

function Who({ e }: { e: AwardEntry }) {
  return (
    <>
      {e.name}
      {e.mine && <span className="award-mine"> ★ seu clube</span>}
    </>
  );
}

function Award({ it, big }: { it: AwardItem; big?: boolean }) {
  return (
    <article className={`award${big ? ' award-big' : ''}${it.winner.mine ? ' is-mine' : ''}`}>
      <p className="award-title">
        <span aria-hidden="true">{ICON[it.id]}</span> {it.title}
      </p>
      <p className="award-winner">
        <Who e={it.winner} />
      </p>
      <p className="award-club">
        {it.winner.club} · {it.winner.detail}
      </p>
      {it.finalists.length > 1 && (
        <ol className="award-finalists" start={2}>
          {it.finalists.slice(1).map((f, i) => (
            <li key={i} className={f.mine ? 'is-mine' : ''}>
              <Who e={f} /> <small>({f.club})</small>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function Team({ team, title }: { team: AwardEntry[]; title: string }) {
  return (
    <div className="award-team">
      <p className="award-title">{title}</p>
      {POS_ORDER.map((pos) => {
        const line = team.filter((e) => e.pos === pos);
        if (line.length === 0) return null;
        return (
          <div key={pos} className="team-line">
            <span className="team-pos">{pos}</span>
            <span>
              {line.map((e, i) => (
                <span key={i} className={e.mine ? 'is-mine' : ''}>
                  {i > 0 ? ' · ' : ''}
                  {e.name} <small>({e.club})</small>
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LeagueAwards({ set, open }: { set: AwardSet; open?: boolean }) {
  return (
    <details className="panel award-league" open={open}>
      <summary>
        <span className="kicker">{set.scope}</span>
        {set.items.some((i) => i.winner.mine) && <span className="award-mine">★</span>}
      </summary>
      <div className="award-grid">
        {set.items.map((it) => (
          <Award key={it.id} it={it} />
        ))}
      </div>
      {set.team && <Team team={set.team} title="Seleção do campeonato" />}
    </details>
  );
}

/** Cerimônia de premiação no fim da temporada (antes do balanço). */
export function AwardsCeremony({ result, onDone }: { result: SeasonResult; onDone: () => void }) {
  const a = result.awards!;
  const mine = a.leagues.filter((l) => l.team);
  const others = a.leagues.filter((l) => !l.team);
  return (
    <div className="tab-stack ceremony">
      <section className="panel">
        <p className="kicker">Prêmios da temporada {result.year}</p>
        <h2 className="headline">A noite dos craques</h2>
        <div className="award-grid">
          {a.general.items.map((it) => (
            <Award key={it.id} it={it} big={it.id === 'bola'} />
          ))}
        </div>
        {a.general.team && <Team team={a.general.team} title="Time da temporada" />}
      </section>

      {mine.map((set) => (
        <LeagueAwards key={set.scope} set={set} open />
      ))}

      {others.length > 0 && (
        <details className="panel award-league">
          <summary>
            <span className="kicker">Outras ligas</span>
          </summary>
          <ul className="award-others">
            {others.map((set) => (
              <li key={set.scope}>
                <strong>{set.scope}</strong>
                {set.items
                  .filter((i) => i.id === 'craque' || i.id === 'artilheiro')
                  .map((i) => (
                    <span key={i.id}>
                      {i.title}: {i.winner.name} ({i.winner.club})
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="playbar">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Ver o balanço da temporada
        </button>
      </div>
    </div>
  );
}

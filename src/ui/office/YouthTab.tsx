import { Fragment, useState, type ReactNode } from 'react';
import { MAX_LOANS, SQUAD_MAX, YOUTH_AGE_LIMIT, YOUTH_MAX, marketWage, tryoutCost } from '../../engine';
import { money, monthly, spendable } from '../format';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

const ACADEMY_LABEL = ['Campinho de terra', 'Escolinha', 'Categorias organizadas', 'Centro de formação', 'Academia de elite', 'Fábrica de craques'];

export function YouthTab({ state, dispatch, goTo, compact }: TabProps & { compact?: boolean }) {
  const p = state.player;
  const loaned = p.onLoan.filter((f) => !f.recovering);
  const hurt = p.onLoan.filter((f) => f.recovering);
  const o = state.office;
  const [open, setOpen] = useState<number | null>(null);
  const cost = tryoutCost(p.tier);
  const youth = p.youth.slice().sort((a, b) => b.potHi - a.potHi);
  // técnico: quem já briga por vaga (overall perto do 16º do elenco) e as maiores promessas
  const bar = p.squad.slice().sort((a, b) => b.ovr - a.ovr)[15]?.ovr ?? 0;
  const ready = youth.filter((y) => y.ovr >= bar - 2);
  const gems = youth.filter((y) => !ready.includes(y)).slice(0, 3);

  return (
    <div className="tab-stack">
      {compact && <YouthTable state={state} dispatch={dispatch} />}
      {!compact && state.career && youth.length > 0 && (
        <Section title="Promessas" note="Como técnico, você pode subir um garoto a qualquer momento da temporada. Ele entra no elenco e joga a partir do próximo jogo.">
          <ul className="todos">
            {ready.map((y) => (
              <li key={y.id} className="todo todo-good">
                <div>
                  <strong>
                    {y.name} · {y.pos} {y.ovr}
                  </strong>
                  <small>
                    {y.age} anos · POT {y.potLo}–{y.potHi} · pronto para brigar por vaga
                  </small>
                </div>
                <button type="button" className="btn btn-small btn-primary" disabled={p.squad.length >= SQUAD_MAX} onClick={() => dispatch({ t: 'promote', id: y.id })}>
                  Subir
                </button>
              </li>
            ))}
            {gems.map((y) => (
              <li key={y.id} className="todo">
                <div>
                  <strong>
                    {y.name} · {y.pos} {y.ovr}
                  </strong>
                  <small>
                    {y.age} anos · POT {y.potLo}–{y.potHi} · ainda precisa de tempo
                  </small>
                </div>
                <button type="button" className="btn btn-small" disabled={p.squad.length >= SQUAD_MAX} onClick={() => dispatch({ t: 'promote', id: y.id })}>
                  Subir
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {!compact && (
      <Section
        title={`Categorias de base (${p.youth.length}/${YOUTH_MAX})`}
        note={
          <>
            Nível da base: <strong>{p.facilities.academy} · {ACADEMY_LABEL[p.facilities.academy]}</strong>. Quanto melhor a base, mais garotos e mais
            potencial a cada temporada. Eles evoluem rápido, mas com {YOUTH_AGE_LIMIT} anos precisam subir ou vão embora.{' '}
            {!state.career && (
              <button type="button" className="link" onClick={() => goTo('estadio')}>
                Investir na base →
              </button>
            )}
          </>
        }
      >
        {youth.length === 0 ? (
          <p className="empty">Nenhum garoto na base. Invista na estrutura ou faça uma peneira.</p>
        ) : (
          <ul className="pl-list">
            {youth.map((y) => (
              <PlayerLine
                key={y.id}
                f={y}
                tier={p.tier}
                meta={
                  <>
                    {y.age >= YOUTH_AGE_LIMIT ? <span className="bad">última temporada na base</span> : `bolsa ${monthly(y.wage)}`}
                    {y.askUp !== undefined && <span className="bad"> · quer subir para o profissional</span>}
                    {y.highlight && <span className="youth-badge">★ {y.highlight}</span>}
                  </>
                }
                open={open === y.id}
                onToggle={() => setOpen(open === y.id ? null : y.id)}
              >
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  disabled={p.squad.length >= SQUAD_MAX}
                  onClick={() => dispatch({ t: 'promote', id: y.id }) && setOpen(null)}
                >
                  Promover ao profissional ({monthly(marketWage(y.ovr) * 0.8)}, 4 anos)
                </button>
                <button type="button" className="btn btn-small" disabled={p.onLoan.length >= MAX_LOANS} onClick={() => dispatch({ t: 'lend', id: y.id }) && setOpen(null)}>
                  Emprestar por 1 temporada (joga mais, evolui mais)
                </button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => dispatch({ t: 'cut', id: y.id }) && setOpen(null)}>
                  Dispensar
                </button>
              </PlayerLine>
            ))}
          </ul>
        )}
      </Section>

      )}

      <Wrap on={!!compact}>
      <YouthCompetitions state={state} />

      {loaned.length > 0 && (
        <Section title={`Emprestados (${loaned.length}/${MAX_LOANS})`} note="Voltam no fim da temporada, com mais rodagem. O clube que pegou emprestado paga o salário.">
          <ul className="pl-list">
            {loaned.map((f) => (
              <PlayerLine key={f.id} f={f} tier={p.tier} meta="emprestado" />
            ))}
          </ul>
        </Section>
      )}
      {hurt.length > 0 && (
        <Section title="Em recuperação" note="Lesão grave: fora a temporada inteira. O clube segue pagando o salário e ele volta no fim da temporada.">
          <ul className="pl-list">
            {hurt.map((f) => (
              <PlayerLine key={f.id} f={f} tier={p.tier} meta="em recuperação" />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Peneira"
        note={
          <>
            Abra o campo para garotos de 16 a 21 anos. A leitura do potencial depende do seu olheiro (nível {p.staff.scout}): quanto melhor, mais estreita a
            faixa. Custa {money(cost)} e só dá para fazer uma por temporada.
          </>
        }
      >
        {!o.tryout ? (
          <button type="button" className="btn btn-primary" disabled={spendable(state) < cost} onClick={() => dispatch({ t: 'tryout' })}>
            Fazer peneira ({money(cost)})
          </button>
        ) : (
          <ul className="pl-list">
            {o.tryout.map((c, idx) =>
              c ? (
                <PlayerLine
                  key={c.id}
                  f={c}
                  tier={p.tier}
                  meta={c.age <= 19 ? 'vai para a base' : 'vai direto ao profissional'}
                  open={open === c.id}
                  onToggle={() => setOpen(open === c.id ? null : c.id)}
                >
                  <button type="button" className="btn btn-small btn-primary" onClick={() => dispatch({ t: 'sign', idx }) && setOpen(null)}>
                    Contratar
                  </button>
                </PlayerLine>
              ) : (
                <li key={idx} className="pl pl-gone">
                  Contratado
                </li>
              ),
            )}
          </ul>
        )}
      </Section>
      </Wrap>
    </div>
  );
}

/** Campeonatos da base da última temporada (simulados; o técnico só acompanha). */
function YouthCompetitions({ state }: { state: TabProps['state'] }) {
  const last = state.history[state.history.length - 1];
  const comps = last?.youth ?? [];
  return (
    <Section
      title="Campeonatos da base"
      note="Copinha (Sub-20) em janeiro, Estadual Sub-17 e, para clubes das Séries A e B, o Brasileiro Sub-20. Quem se destaca ganha potencial e pode pedir para subir: se não subir, pode ir embora."
    >
      {comps.length === 0 ? (
        <p className="empty">Os resultados aparecem no fim da temporada.</p>
      ) : (
        <ul className="youth-comps">
          {comps.map((c) => (
            <li key={c.key}>
              <div className="yc-head">
                <strong>
                  {c.name} {last!.year}
                </strong>
                <span className={c.won ? 'good' : 'muted'}>{c.finish}</span>
              </div>
              <small className="muted">
                {c.won ? '' : `Campeão: ${c.champion} · `}
                {c.games.length} jogos · {c.games.filter((g) => g.gf > g.ga || (g.pens && g.pens[0] > g.pens[1])).length} vitórias
                {c.scorers.length > 0 ? ` · artilheiro: ${c.scorers[0].name} (${c.scorers[0].goals})` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** No modo compacto, o que é menos usado fica recolhido. */
function Wrap({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <details className="panel more">
      <summary>Peneira, emprestados e campeonatos da base</summary>
      <div className="tab-stack">{children}</div>
    </details>
  );
}

/** Base em tabela (técnico): uma linha por garoto; toque para subir, emprestar ou dispensar. */
function YouthTable({ state, dispatch }: Pick<TabProps, 'state' | 'dispatch'>) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const youth = p.youth.slice().sort((a, b) => b.ovr - a.ovr);
  const bar = p.squad.slice().sort((a, b) => b.ovr - a.ovr)[15]?.ovr ?? 0;
  if (youth.length === 0) {
    return (
      <section className="panel">
        <p className="kicker">Base</p>
        <p className="muted">Nenhum garoto agora. A cada temporada chegam novos.</p>
      </section>
    );
  }
  return (
    <section className="panel squad-table">
      <div className="st-head">
        <h2 className="section-title">
          Base <small>{p.youth.length}/{YOUTH_MAX}</small>
        </h2>
        <span className="muted">sobe a qualquer momento</span>
      </div>
      <table className="table sq">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Garoto</th>
            <th>Id</th>
            <th>Ovr</th>
            <th>Pot</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {youth.map((y) => (
            <Fragment key={y.id}>
              <tr className={open === y.id ? 'is-open' : ''} onClick={() => setOpen(open === y.id ? null : y.id)}>
                <td>
                  <span className={`pl-pos pos-${y.pos}`}>{y.pos}</span>
                </td>
                <td className="sq-name">{y.name}</td>
                <td>{y.age}</td>
                <td>
                  <b className="sq-ovr">{y.ovr}</b>
                </td>
                <td>
                  {y.potLo}–{y.potHi}
                </td>
                <td>
                  {y.age >= YOUTH_AGE_LIMIT ? (
                    <span className="st st-bad" title="última temporada na base">FIM</span>
                  ) : y.ovr >= bar - 2 ? (
                    <span className="st st-offer" title="já briga por vaga">PRONTO</span>
                  ) : y.highlight ? (
                    <span className="st st-warn" title={y.highlight}>DESTAQUE</span>
                  ) : null}
                </td>
              </tr>
              {open === y.id && (
                <tr className="sq-detail">
                  <td colSpan={6}>
                    {y.highlight && <p className="muted">{y.highlight}</p>}
                    <div className="pl-actions">
                      <button type="button" className="btn btn-small btn-primary" disabled={p.squad.length >= SQUAD_MAX} onClick={() => dispatch({ t: 'promote', id: y.id }) && setOpen(null)}>
                        Subir ({monthly(marketWage(y.ovr) * 0.8)})
                      </button>
                      <button type="button" className="btn btn-small" disabled={p.onLoan.length >= MAX_LOANS} onClick={() => dispatch({ t: 'lend', id: y.id }) && setOpen(null)}>
                        Emprestar
                      </button>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => dispatch({ t: 'cut', id: y.id }) && setOpen(null)}>
                        Dispensar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}

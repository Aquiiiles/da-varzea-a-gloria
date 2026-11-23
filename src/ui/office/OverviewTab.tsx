import {
  SQUAD_MAX, SQUAD_MIN, TIERS, YOUTH_AGE_LIMIT, effectsCashCost, marketValue, moodLabel, projectFinance, renewWage, stadiumAllows, type Tier,
} from '../../engine';
import { money } from '../format';
import type { TabProps } from './Office';
import { Chips, Section } from './common';

export function OverviewTab({ state, dispatch, goTo }: TabProps) {
  const p = state.player;
  const o = state.office;
  const proj = projectFinance(state);
  const alerts: { text: string; tab: Parameters<TabProps['goTo']>[0] }[] = [];

  const renewing = p.squad.filter((f) => f.contract === 1 && !f.leaving);
  const raise = renewing.reduce((s, f) => s + Math.max(0, renewWage(f.ovr, f.wage, f.homegrown) - f.wage), 0);
  if (renewing.length > 0 && raise > proj.wages * 0.08) {
    alerts.push({ text: `${renewing.length} contrato(s) renovam sozinhos no fim da temporada, somando +${money(raise)} na folha. Libere quem você não quer manter.`, tab: 'elenco' });
  }
  const aging = p.youth.filter((y) => y.age >= YOUTH_AGE_LIMIT);
  if (aging.length > 0) alerts.push({ text: `${aging.length} garoto(s) da base com ${YOUTH_AGE_LIMIT} anos: promova ou eles vão embora.`, tab: 'base' });
  if (p.tier > 1 && !stadiumAllows(p.capacity + p.capacityBuilding, (p.tier - 1) as Tier)) {
    alerts.push({ text: `O estádio não comporta a ${TIERS[(p.tier - 1) as Tier].name} (${TIERS[(p.tier - 1) as Tier].minStadium.toLocaleString('pt-BR')} lugares). Se for campeão, não sobe.`, tab: 'estadio' });
  }
  if (p.cash + proj.net < 0) alerts.push({ text: `Pela projeção, o caixa fecha a temporada em ${money(p.cash + proj.net)}.`, tab: 'clube' });
  if (p.squad.length >= SQUAD_MAX) alerts.push({ text: 'Elenco cheio: venda ou dispense antes de contratar.', tab: 'elenco' });
  if (p.fans > p.capacity * 1.2) alerts.push({ text: 'A torcida não cabe no estádio: você está perdendo bilheteria.', tab: 'estadio' });

  return (
    <div className="tab-stack">
      {o.event && (
        <section className={`panel event${o.eventChoice === null ? '' : ' is-done'}`}>
          <p className="kicker kicker-alert">Plantão</p>
          <h2 className="headline">{o.event.title}</h2>
          <p className="lede">{o.event.text}</p>
          {o.eventChoice === null ? (
            <div className="event-options">
              {o.event.options.map((opt, i) => (
                <button key={opt.label} type="button" className="option" onClick={() => dispatch({ t: 'event', choice: i as 0 | 1 })}>
                  <strong>{opt.label}</strong>
                  <Chips state={state} effects={opt.effects} />
                </button>
              ))}
            </div>
          ) : (
            <p className="done">Decisão: {o.event.options[o.eventChoice].label}</p>
          )}
        </section>
      )}

      <Section title="Metas da temporada" note="Cumprir metas anima a torcida e rende bônus em dinheiro; falhar a da diretoria pesa no torcedômetro.">
        <ul className="objectives">
          {o.objectives.map((ob, i) => (
            <li key={i} className={ob.main ? 'obj-main' : 'obj-bonus'}>
              {ob.text}
            </li>
          ))}
        </ul>
        <div className="moodbar" aria-label={`Torcedômetro ${p.mood} de 100`}>
          <div className="moodbar-head">
            <span>Torcedômetro</span>
            <b>
              {p.mood} · {moodLabel(p.mood)}
            </b>
          </div>
          <div className="meter mood-meter">
            <span className="meter-fill" style={{ width: `${p.mood}%`, background: p.mood < 25 ? 'var(--bad)' : p.mood < 45 ? 'var(--warn)' : 'var(--good)' }} />
          </div>
          <small className="muted">Mexe no público (até ±15%) e no patrocínio. Sobe com vitórias, metas cumpridas, clássico, zebras e ingresso popular; cai com fracassos, ingresso caro e venda de crias da base.</small>
        </div>
        {(p.continental || p.worldCup) && (
          <p className="competitions">
            Nesta temporada: Copa Nacional{p.continental === 'cc' ? ' · Copa dos Campeões' : p.continental === 'le' ? ' · Liga Europa' : ''}
            {p.worldCup ? ' · Mundial de Clubes' : ''}
          </p>
        )}
      </Section>

      {o.offers.some(Boolean) && (
        <Section title="Propostas recebidas" note="Clubes interessados nos seus jogadores. Ignorar é recusar; elas expiram no fim da janela.">
          <div className="opps">
            {o.offers.map((of, idx) => {
              if (!of) return null;
              const f = p.squad.find((x) => x.id === of.playerId);
              if (!f) return null;
              const value = marketValue(f);
              return (
                <article key={idx} className="opp">
                  <div>
                    <strong>
                      {of.club} quer {f.name} ({f.pos}, {f.ovr})
                    </strong>
                    <p>
                      Oferta de {money(of.fee)} · valor de mercado {money(value)}
                      {of.fee >= value * 1.2 ? ' · acima do valor!' : of.fee < value * 0.9 ? ' · abaixo do valor' : ''}
                    </p>
                  </div>
                  <button type="button" className="btn btn-small btn-primary" disabled={p.squad.length <= SQUAD_MIN} onClick={() => dispatch({ t: 'offer', idx })}>
                    Vender
                  </button>
                </article>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Oportunidades" note="Propostas desta janela. Aceitar é opcional; o que você ignorar some no fim da temporada.">
        <div className="opps">
          {o.opportunities.map(({ opp, taken }, idx) => {
            const cost = effectsCashCost(state, opp.effects);
            return (
              <article key={opp.id} className={`opp${taken ? ' is-done' : ''}`}>
                <div>
                  <strong>{opp.title}</strong>
                  <p>{opp.text}</p>
                  <Chips state={state} effects={opp.effects} />
                </div>
                {taken ? (
                  <span className="done">Feito</span>
                ) : (
                  <button type="button" className="btn btn-small" disabled={cost > 0 && p.cash < cost} onClick={() => dispatch({ t: 'opp', idx })}>
                    {opp.accept}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      {alerts.length > 0 && (
        <Section title="Atenção, presidente">
          <ul className="alerts">
            {alerts.map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => goTo(a.tab)}>
                  {a.text} <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Orçamento da temporada" note="Projeção para uma campanha de meio de tabela. A premiação muda com a posição final.">
        <dl className="budget">
          <div><dt>Bilheteria</dt><dd className="good">{money(proj.tickets)}</dd></div>
          <div><dt>TV e premiação</dt><dd className="good">{money(proj.tv)}</dd></div>
          <div><dt>Patrocínios</dt><dd className={proj.sponsors >= 0 ? 'good' : 'bad'}>{money(proj.sponsors)}</dd></div>
          <div><dt>Comércio local</dt><dd className="good">{money(proj.commerce)}</dd></div>
          <div><dt>Salários</dt><dd className="bad">-{money(proj.wages)}</dd></div>
          <div><dt>Staff</dt><dd className="bad">-{money(proj.staff)}</dd></div>
          <div><dt>Manutenção</dt><dd className="bad">-{money(proj.upkeep)}</dd></div>
          <div className="budget-total"><dt>Saldo</dt><dd className={proj.net >= 0 ? 'good' : 'bad'}>{money(proj.net)}</dd></div>
        </dl>
      </Section>
    </div>
  );
}

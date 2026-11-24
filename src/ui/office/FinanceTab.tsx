import { LOAN_NAME, TICKET_POLICY, loanFor, masterSponsor, projectFinance } from '../../engine';
import { money } from '../format';
import type { TabProps } from './Office';
import { Section } from './common';

export function FinanceTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const o = state.office;
  const proj = projectFinance(state);
  const loans = p.sponsors.filter((s) => s.name === LOAN_NAME).length;
  return (
    <div className="tab-stack">
      <Section title="Caixa">
        <p className="cash-big {p.cash < 0 ? 'bad' : 'good'}">{money(p.cash)}</p>
        {p.negativeSeasons > 0 && <p className="warn">Caixa no vermelho há {p.negativeSeasons} temporada(s): na 2ª o clube perde pontos; se piorar depois, é falência.</p>}
      </Section>
      <Section title="Orçamento da temporada" note="Projeção para uma campanha de meio de tabela. A premiação muda com a posição final.">
        <dl className="budget">
          <div><dt>Bilheteria</dt><dd className="good">{money(proj.tickets)}</dd></div>
          <div><dt>TV e premiação</dt><dd className="good">{money(proj.tv)}</dd></div>
          <div><dt>Patrocínios</dt><dd className={proj.sponsors >= 0 ? 'good' : 'bad'}>{money(proj.sponsors)}</dd></div>
          <div><dt>Comércio local</dt><dd className="good">{money(proj.commerce)}</dd></div>
          <div><dt>Sócio-torcedor ({proj.socios.toLocaleString('pt-BR')} sócios)</dt><dd className="good">{money(proj.members)}</dd></div>
          {proj.events > 0 && <div><dt>Shows e eventos na arena</dt><dd className="good">{money(proj.events)}</dd></div>}
          <div><dt>Salários</dt><dd className="bad">-{money(proj.wages)}</dd></div>
          <div><dt>Staff</dt><dd className="bad">-{money(proj.staff)}</dd></div>
          <div><dt>Manutenção</dt><dd className="bad">-{money(proj.upkeep)}</dd></div>
          <div className="budget-total"><dt>Saldo</dt><dd className={proj.net >= 0 ? 'good' : 'bad'}>{money(proj.net)}</dd></div>
        </dl>
      </Section>
      <Section title="Preço do ingresso" note="Mais caro rende mais por torcedor, mas enche menos o estádio e esfria a torcida. Mais barato faz a torcida crescer e aquece a alma.">
        <div className="seg">
          {TICKET_POLICY.map((t, i) => (
            <button key={t.label} type="button" className={`seg-btn${p.ticket === i ? ' is-on' : ''}`} onClick={() => dispatch({ t: 'ticket', level: i as 0 | 1 | 2 })}>
              <strong>{t.label}</strong>
              <small>
                preço x{t.price} · público x{t.demand}
              </small>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Patrocínios e dívidas">
        <ul className="ledger">
          <li>
            <span>Patrocínio master (divisão, torcida, hype e humor da torcida)</span>
            <b className="good">{money(masterSponsor(p, p.tier))}/temp.</b>
          </li>
          {p.sponsors.map((s, i) => (
            <li key={i}>
              <span>
                {s.name} {s.seasonsLeft === null ? '(permanente)' : `(${s.seasonsLeft} temp.)`}
              </span>
              <b className={s.perSeason >= 0 ? 'good' : 'bad'}>{money(s.perSeason)}/temp.</b>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Banco" note="Empréstimo com 30% de juros, pago em 3 parcelas. No máximo dois ativos e um por temporada.">
        <div className="build-grid">
          {([0, 1] as const).map((size) => {
            const l = loanFor(p.tier, size);
            return (
              <button key={size} type="button" className="build" disabled={o.built.loan || loans >= 2} onClick={() => dispatch({ t: 'loan', size })}>
                <strong>{size === 0 ? 'Empréstimo pequeno' : 'Empréstimo grande'}</strong>
                <span className="good">+{money(l.amount)} agora</span>
                <b className="bad">{money(l.perSeason)}/temp. x3</b>
              </button>
            );
          })}
        </div>
      </Section>

    </div>
  );
}

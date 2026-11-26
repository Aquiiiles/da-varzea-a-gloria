import { useState } from 'react';
import {
  offerOpen,
  LOAN_AGE_LIMIT, MAX_LOANS, SQUAD_MAX, SQUAD_MIN, bestEleven, marketValue, payroll, releaseCost, renewalOffer, sellPrice, squadStrength,
  type ContractIntent, type Footballer, type Position,
} from '../../engine';
import { money, POS_LABEL, monthly, spendable } from '../format';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

const ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

export const INTENT_LABEL: Record<ContractIntent, { text: string; tone: 'good' | 'warnc' | 'bad' }> = {
  renova: { text: 'renova no fim do contrato', tone: 'good' },
  aumento: { text: 'renova, mas pede aumento', tone: 'warnc' },
  sai: { text: 'não quer renovar', tone: 'bad' },
  clube_maior: { text: 'vai para um clube maior', tone: 'bad' },
  aposenta: { text: 'vai se aposentar no fim da temporada', tone: 'bad' },
};

export function SquadTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const xi = bestEleven(p.squad).ids;
  const offerFor = new Map(state.office.offers.flatMap((of, idx) => (of && offerOpen(state, of) ? [[of.playerId, { ...of, idx }] as const] : [])));

  return (
    <div className="tab-stack">
      <Section
        title={`Elenco profissional (${p.squad.length}/${SQUAD_MAX})`}
        note={
          <>
            Força do XI: <strong>{squadStrength(p.squad).toFixed(1)}</strong> · Folha: <strong>{money(payroll(p))}/temporada</strong>. O time
            joga no 4-4-2 com os melhores de cada posição (★). Contratos renovam sozinhos no fim; toque num jogador para negociar ou
            liberar.
          </>
        }
      >
        {ORDER.map((pos) => {
          const group = p.squad.filter((f) => f.pos === pos).sort((a, b) => b.ovr - a.ovr);
          return (
            <div key={pos} className="pos-group">
              <h3>
                {POS_LABEL[pos]}s <span>({group.length})</span>
              </h3>
              <ul className="pl-list">
                {group.map((f) => (
                  <PlayerLine
                    key={f.id}
                    f={f}
                    tier={p.tier}
                    badge={xi.has(f.id) ? '★' : undefined}
                    meta={
                      <>
                        {f.leaving ? (
                          <span className="bad">liberado: sai no fim da temporada</span>
                        ) : f.intent ? (
                          <span className={INTENT_LABEL[f.intent].tone}>{f.contract === 1 && f.intent !== 'aposenta' ? 'último ano · ' : ''}{INTENT_LABEL[f.intent].text}</span>
                        ) : f.contract === 1 ? (
                          <span className="warnc">último ano · renova sozinho</span>
                        ) : (
                          `${f.contract} anos de contrato`
                        )}{' '}
                        · {f.goals} gols
                        {offerFor.has(f.id) && <span className="tag-offer">proposta</span>}
                      </>
                    }
                    aside={
                      <>
                        <b>{monthly(f.wage)}</b>
                        <small>valor {money(marketValue(f))}</small>
                      </>
                    }
                    open={open === f.id}
                    onToggle={() => setOpen(open === f.id ? null : f.id)}
                  >
                    <PlayerActions state={state} dispatch={dispatch} f={f} close={() => setOpen(null)} />
                  </PlayerLine>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>
      {p.onLoan.some((f) => f.recovering) && (
        <Section title="Em recuperação" note="Lesão grave: fora a temporada inteira. O clube segue pagando o salário e ele volta no fim da temporada.">
          <ul className="pl-list">
            {p.onLoan.filter((f) => f.recovering).map((f) => (
              <PlayerLine key={f.id} f={f} tier={p.tier} meta="em recuperação" />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** Ações de um jogador do elenco: proposta recebida, renovar, liberar, emprestar, vender, dispensar. */
export function PlayerActions({ state, dispatch, f, close }: Pick<TabProps, 'state' | 'dispatch'> & { f: Footballer; close: () => void }) {
  const p = state.player;
  const canLose = p.squad.length > SQUAD_MIN;
  const offerFor = new Map(state.office.offers.flatMap((of, idx) => (of && offerOpen(state, of) ? [[of.playerId, { ...of, idx }] as const] : [])));
  const setOpen = (_: null) => close();
  return (
    <>
    {offerFor.has(f.id) && (
      <button
        type="button"
        className="btn btn-small btn-primary"
        disabled={!canLose}
        onClick={() => dispatch({ t: 'offer', idx: offerFor.get(f.id)!.idx }) && setOpen(null)}
      >
        Aceitar proposta do {offerFor.get(f.id)!.club}: {money(offerFor.get(f.id)!.fee)}
      </button>
    )}
    {f.contract === 1 && renewalOffer(f) && (
      <button type="button" className="btn btn-small btn-primary" onClick={() => dispatch({ t: 'renew', id: f.id })}>
        {renewalOffer(f)!.label}: {monthly(renewalOffer(f)!.wage)} por {f.age >= 32 ? '1 ano' : '3 anos'}
      </button>
    )}
    {f.contract === 1 && f.intent !== 'aposenta' && (
      <button type="button" className="btn btn-small" onClick={() => dispatch({ t: 'leave', id: f.id })}>
        {f.leaving ? 'Manter: deixar renovar no fim do contrato' : 'Liberar no fim do contrato'}
      </button>
    )}
    {f.age <= LOAN_AGE_LIMIT && (
      <button
        type="button"
        className="btn btn-small"
        disabled={!canLose || p.onLoan.filter((x) => !x.recovering).length >= MAX_LOANS}
        onClick={() => dispatch({ t: 'lend', id: f.id }) && setOpen(null)}
      >
        Emprestar por 1 temporada
      </button>
    )}
    <button type="button" className="btn btn-small" disabled={!canLose} onClick={() => dispatch({ t: 'sell', id: f.id }) && setOpen(null)}>
      Vender por {money(sellPrice(state, f.id))}
    </button>
    <button
      type="button"
      className="btn btn-small btn-danger"
      disabled={!canLose || spendable(state) < releaseCost(state, f.id)}
      onClick={() => dispatch({ t: 'release', id: f.id }) && setOpen(null)}
    >
      Dispensar (multa {money(releaseCost(state, f.id))})
    </button>
    {!canLose && <small className="muted">O elenco precisa de pelo menos {SQUAD_MIN} jogadores.</small>}
    </>
  );
}

import { useState } from 'react';
import {
  LOAN_AGE_LIMIT, MAX_LOANS, SQUAD_MAX, SQUAD_MIN, bestEleven, marketValue, payroll, releaseCost, renewWage, renewalCap, sellPrice, squadStrength,
  type Position,
} from '../../engine';
import { money, POS_LABEL, monthly } from '../format';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

const ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

export function SquadTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const xi = bestEleven(p.squad).ids;
  const canLose = p.squad.length > SQUAD_MIN;
  const offerFor = new Map(state.office.offers.flatMap((of, idx) => (of ? [[of.playerId, { ...of, idx }] as const] : [])));

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
                        {f.contract === 1 ? (
                          f.leaving ? <span className="bad">sai no fim da temporada</span> : <span className="warnc">último ano · renova sozinho</span>
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
                    {f.contract === 1 && (
                      <button type="button" className="btn btn-small" onClick={() => dispatch({ t: 'leave', id: f.id })}>
                        {f.leaving
                          ? 'Manter: renovar no fim do contrato'
                          : renewWage(f.ovr, f.wage, f.homegrown) > renewalCap(p.tier, f.wage)
                            ? 'Liberar (ele vai pedir salário alto demais)'
                            : `Não renovar (renovaria por ${monthly(renewWage(f.ovr, f.wage, f.homegrown))})`}
                      </button>
                    )}
                    {f.age <= LOAN_AGE_LIMIT && (
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={!canLose || p.onLoan.length >= MAX_LOANS}
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
                      disabled={!canLose || p.cash < releaseCost(state, f.id)}
                      onClick={() => dispatch({ t: 'release', id: f.id }) && setOpen(null)}
                    >
                      Dispensar (multa {money(releaseCost(state, f.id))})
                    </button>
                    {!canLose && <small className="muted">O elenco precisa de pelo menos {SQUAD_MIN} jogadores.</small>}
                  </PlayerLine>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

import { useState } from 'react';
import {
  SQUAD_MAX, SQUAD_MIN, bestEleven, marketValue, payroll, releaseCost, renewWage, sellPrice, squadStrength, type Position,
} from '../../engine';
import { money, POS_LABEL, weekly } from '../format';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

const ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

export function SquadTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const xi = bestEleven(p.squad).ids;
  const canLose = p.squad.length > SQUAD_MIN;

  return (
    <div className="tab-stack">
      <Section
        title={`Elenco profissional (${p.squad.length}/${SQUAD_MAX})`}
        note={
          <>
            Força do XI: <strong>{squadStrength(p.squad).toFixed(1)}</strong> · Folha: <strong>{money(payroll(p))}/temporada</strong>. O time
            joga no 4-4-2 com os melhores de cada posição (★). Toque num jogador para negociar.
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
                        {f.contract === 1 ? <span className="bad">último ano</span> : `${f.contract} anos de contrato`} · {f.goals} gols
                      </>
                    }
                    aside={
                      <>
                        <b>{weekly(f.wage)}</b>
                        <small>valor {money(marketValue(f))}</small>
                      </>
                    }
                    open={open === f.id}
                    onToggle={() => setOpen(open === f.id ? null : f.id)}
                  >
                    {f.contract === 1 && (
                      <button type="button" className="btn btn-small btn-primary" onClick={() => dispatch({ t: 'renew', id: f.id })}>
                        Renovar por 3 anos ({weekly(renewWage(f.ovr, f.wage, f.homegrown))})
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

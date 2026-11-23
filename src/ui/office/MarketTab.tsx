import { useState } from 'react';
import { SQUAD_MAX, squadStrength } from '../../engine';
import { money, weekly } from '../format';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

export function MarketTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const base = squadStrength(p.squad);
  const full = p.squad.length >= SQUAD_MAX;

  return (
    <div className="tab-stack">
      <Section
        title="Mercado de transferências"
        note={
          <>
            Jogadores disponíveis nesta janela. Você paga a taxa à vista e o salário pesa na folha todo ano. Caixa disponível:{' '}
            <strong>{money(p.cash)}</strong>.
          </>
        }
      >
        <ul className="pl-list">
          {state.office.market.map((l, idx) => {
            if (!l) {
              return (
                <li key={idx} className="pl pl-gone">
                  Contratado
                </li>
              );
            }
            const gain = squadStrength([...p.squad, l.player]) - base;
            const afford = p.cash >= l.fee;
            return (
              <PlayerLine
                key={l.player.id}
                f={l.player}
                tier={p.tier}
                meta={
                  <>
                    {l.from} · força {gain > 0.05 ? <span className="good">+{gain.toFixed(1)}</span> : <span className="muted">+0</span>}
                  </>
                }
                aside={
                  <>
                    <b className={afford ? '' : 'bad'}>{l.fee === 0 ? 'Livre' : money(l.fee)}</b>
                    <small>{weekly(l.player.wage)}</small>
                  </>
                }
                open={open === l.player.id}
                onToggle={() => setOpen(open === l.player.id ? null : l.player.id)}
              >
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  disabled={!afford || full}
                  onClick={() => dispatch({ t: 'buy', idx }) && setOpen(null)}
                >
                  Contratar ({l.fee === 0 ? 'sem taxa' : money(l.fee)} + {weekly(l.player.wage)}, {l.player.contract} ano{l.player.contract > 1 ? 's' : ''})
                </button>
                {!afford && <small className="bad">Caixa insuficiente.</small>}
                {full && <small className="bad">Elenco cheio.</small>}
              </PlayerLine>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

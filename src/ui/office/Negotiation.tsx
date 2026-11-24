import { useEffect, useState } from 'react';
import { MAX_ROUNDS, SQUAD_MAX, TIERS, marketValue, marketWage, negotiationFor, type Club, type Footballer, type GameState } from '../../engine';
import type { Dispatch } from '../App';
import { money, monthly, spendable } from '../format';

/** Arredonda o salário anual para 1 casa (exigência do motor para o replay ser exato). */
const r1 = (v: number) => Math.max(0.1, Math.round(v * 10) / 10);

/**
 * Painel de proposta por um jogador de outro clube: taxa, salário mensal e anos.
 * O clube pode aceitar, recusar ou pedir mais; o jogador decide o salário.
 */
export function NegotiationPanel({ state, dispatch, club, f }: { state: GameState; dispatch: Dispatch; club: Club; f: Footballer }) {
  const p = state.player;
  const n = negotiationFor(state, club.id, f.id);
  const value = marketValue(f);
  const [fee, setFee] = useState(() => n?.askFee ?? n?.fee ?? value);
  const [wage, setWage] = useState(() => n?.askWage ?? n?.wage ?? r1(Math.max(f.wage * 1.1, marketWage(f.ovr))));
  const [years, setYears] = useState(n?.years ?? 3);

  // contraproposta chegou: preenche os campos com o que foi pedido
  useEffect(() => {
    if (n?.askFee) setFee(n.askFee);
    if (n?.askWage) setWage(n.askWage);
  }, [n?.askFee, n?.askWage, n?.rounds]);

  const closed = !!n && (n.status === 'aceita' || n.status === 'encerrada' || n.rounds >= MAX_ROUNDS);
  const drop = p.tier - club.tier;
  const send = () => dispatch({ t: 'bid', club: club.id, player: f.id, fee: Math.max(0, Math.round(fee)), wage: r1(wage), years });

  return (
    <div className="nego">
      <div className="nego-facts">
        <span>
          Clube: <b>{club.name}</b> ({TIERS[club.tier].name})
        </span>
        <span>
          Valor de mercado: <b>{money(value)}</b> · salário atual: <b>{monthly(f.wage)}</b>
        </span>
        {drop >= 2 && <span className="warnc">Ele teria que descer {drop} níveis: vai pedir mais salário{drop >= 3 ? ' (e muito mais para aceitar)' : ''}.</span>}
      </div>

      {n && (
        <p className={`nego-msg nego-${n.status}`}>
          {n.message} <small>(rodada {n.rounds}/{MAX_ROUNDS})</small>
        </p>
      )}

      {!closed && (
        <>
          <div className="nego-fields">
            <label>
              <span>Taxa ao clube</span>
              <div className="stepper-input">
                <button type="button" onClick={() => setFee((x) => Math.max(0, Math.round(x * 0.9)))}>−</button>
                <b>{money(Math.round(fee))}</b>
                <button type="button" onClick={() => setFee((x) => Math.round(Math.max(1, x) * 1.1))}>+</button>
              </div>
            </label>
            <label>
              <span>Salário</span>
              <div className="stepper-input">
                <button type="button" onClick={() => setWage((x) => r1(x * 0.92))}>−</button>
                <b>{monthly(r1(wage))}</b>
                <button type="button" onClick={() => setWage((x) => r1(x * 1.08))}>+</button>
              </div>
            </label>
            <label>
              <span>Contrato</span>
              <div className="stepper-input">
                <button type="button" onClick={() => setYears((y) => Math.max(1, y - 1))}>−</button>
                <b>
                  {years} ano{years > 1 ? 's' : ''}
                </b>
                <button type="button" onClick={() => setYears((y) => Math.min(5, y + 1))}>+</button>
              </div>
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={spendable(state) < Math.round(fee) || p.squad.length >= SQUAD_MAX} onClick={send}>
            {n?.status === 'contra_clube' || n?.status === 'contra_jogador' ? 'Enviar nova proposta' : 'Enviar proposta'}
          </button>
          {spendable(state) < Math.round(fee) && <small className="bad"> {state.career ? 'A verba da diretoria não cobre essa taxa.' : 'Caixa insuficiente para essa taxa.'}</small>}
          {p.squad.length >= SQUAD_MAX && <small className="bad"> Elenco cheio.</small>}
        </>
      )}
    </div>
  );
}

import { Fragment, useState } from 'react';
import {
  FATIGUE_FREE, FATIGUE_REST, TALK_COOLDOWN, MORALE_HIGH, MORALE_LOW, MORALE_START, SQUAD_MAX, statusAt, bestEleven, personalityOf, PERSONALITY_INFO, fatigueAt, injuredAt, marketValue, offerOpen, payroll, suspendedOn,
  type Footballer, type GameState, type Position,
} from '../../engine';
import type { Dispatch } from '../App';
import { money, monthly, ovrTone, potLabel } from '../format';
import { INTENT_LABEL, PlayerActions } from '../office/SquadTab';
import { shortDate } from '../SeasonView';

const ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];
type Sort = 'pos' | 'ovr' | 'idade' | 'gols' | 'forma';

/** Amarelos acumulados (o 3º suspende). */
function yellowsNow(state: GameState): Map<number, number> {
  const out = new Map<number, number>();
  const day = state.reveal ?? -1;
  for (const c of state.live?.cards ?? []) {
    if (c.day > day || c.kind !== 'amarelo') continue;
    out.set(c.id, ((out.get(c.id) ?? 0) + 1) % 3);
  }
  return out;
}

/**
 * Elenco do técnico em tabela: uma linha por jogador, tudo à vista (titular, cansaço, cartões, lesão, gols, contrato).
 * Toque na linha para os detalhes e as ações (renovar, vender, emprestar).
 */
export function SquadTable({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const p = state.player;
  const live = state.live;
  const day = state.reveal ?? -1;
  const [pos, setPos] = useState<Position | 'todos'>('todos');
  const [sort, setSort] = useState<Sort>('pos');
  const [open, setOpen] = useState<number | null>(null);

  // titulares: os do próximo jogo (temporada) ou os melhores do esquema (pré-temporada)
  const nextDay = state.calendar?.matches.find((m) => m.day > day)?.day;
  const xi = new Set(
    live && nextDay !== undefined ? live.elevens.find((e) => e.day === nextDay)?.ids ?? [] : [...bestEleven(p.squad, p.coach.formation).ids],
  );
  const fatigue = live ? fatigueAt(live, day) : {};
  const injured = new Map(live ? injuredAt(live, day).map((i) => [i.id, i]) : []);
  const suspended = new Set(live && nextDay !== undefined ? suspendedOn(live, nextDay).map((s) => s.id) : []);
  const yellows = yellowsNow(state);
  const st = live ? statusAt(live, day) : { form: {}, morale: {} as Record<number, number> };
  const formOf = (f: Footballer) => st.form[f.id] ?? 0;
  const moraleOf = (f: Footballer) => st.morale[f.id] ?? f.morale ?? MORALE_START;
  const offers = new Set(state.office.offers.filter((o) => o && offerOpen(state, o)).map((o) => o!.playerId));

  const rows = p.squad
    .filter((f) => pos === 'todos' || f.pos === pos)
    .sort((a, b) => {
      if (sort === 'ovr') return b.ovr - a.ovr;
      if (sort === 'idade') return a.age - b.age;
      if (sort === 'gols') return b.goals - a.goals || b.ovr - a.ovr;
      if (sort === 'forma') return formOf(b) - formOf(a) || b.ovr - a.ovr;
      return ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || Number(xi.has(b.id)) - Number(xi.has(a.id)) || b.ovr - a.ovr;
    });

  const status = (f: Footballer) => {
    if (injured.has(f.id)) return <span className="st st-bad" title="lesionado">LES</span>;
    if (suspended.has(f.id)) return <span className="st st-bad" title="suspenso no próximo jogo">SUS</span>;
    if (yellows.get(f.id) === 2) return <span className="st st-warn" title="pendurado: 2 amarelos">2A</span>;
    if (moraleOf(f) < MORALE_LOW) return <span className="st st-bad" title="insatisfeito: quer jogar">INS</span>;
    if (offers.has(f.id)) return <span className="st st-offer" title="proposta recebida">PROP</span>;
    if (f.contract === 1) return <span className="st st-warn" title="último ano de contrato">FIM</span>;
    return null;
  };

  return (
    <section className="panel squad-table">
      <div className="st-head">
        <h2 className="section-title">
          Elenco <small>{p.squad.length}/{SQUAD_MAX}</small>
        </h2>
        <span className="muted">Folha {money(payroll(p))}/ano</span>
      </div>
      <div className="st-filters">
        <div className="subtabs">
          {(['todos', ...ORDER] as const).map((x) => (
            <button key={x} type="button" className={`subtab${pos === x ? ' is-on' : ''}`} onClick={() => setPos(x)}>
              {x === 'todos' ? 'Todos' : x}
            </button>
          ))}
        </div>
        <label className="st-sort">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="pos">posição</option>
            <option value="ovr">overall</option>
            <option value="idade">idade</option>
            <option value="gols">gols</option>
            <option value="forma">forma</option>
          </select>
        </label>
      </div>
      <table className="table sq">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Jogador</th>
            <th title="idade">Id</th>
            <th title="overall">Ovr</th>
            <th title="forma (fase)">Fase</th>
            <th title="cansaço">Cans.</th>
            <th title="gols">G</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const tired = fatigue[f.id] ?? 0;
            return (
              <Fragment key={f.id}>
                <tr className={`${xi.has(f.id) ? 'is-xi' : ''}${open === f.id ? ' is-open' : ''}`} onClick={() => setOpen(open === f.id ? null : f.id)}>
                  <td>
                    <span className={`pl-pos pos-${f.pos}`}>{f.pos}</span>
                  </td>
                  <td className="sq-name">
                    {f.name}
                    {f.homegrown && <em className="sq-tag">base</em>}
                    {f.loan && <em className="sq-tag">emp.</em>}
                  </td>
                  <td>{f.age}</td>
                  <td>
                    <b className={`sq-ovr ${ovrTone(f.ovr, p.tier)}`}>{f.ovr}</b>
                  </td>
                  <td>
                    <FormArrow v={formOf(f)} />
                  </td>
                  <td>
                    <span className="sq-fat" aria-label={`cansaço ${tired}`}>
                      <span style={{ width: `${tired}%`, background: tired >= FATIGUE_REST ? 'var(--bad)' : tired > FATIGUE_FREE ? 'var(--warn)' : 'var(--good)' }} />
                    </span>
                  </td>
                  <td>{f.goals}</td>
                  <td>{status(f)}</td>
                </tr>
                {open === f.id && (
                  <tr className="sq-detail">
                    <td colSpan={8}>
                      <p className="pl-jeito">
                        <b>{PERSONALITY_INFO[personalityOf(f)].label}</b> <span className="muted">{PERSONALITY_INFO[personalityOf(f)].effect}</span>
                      </p>
                      <p className="muted">
                        Moral <b className={moraleOf(f) < MORALE_LOW ? 'bad' : moraleOf(f) > MORALE_HIGH ? 'good' : ''}>{Math.round(moraleOf(f))}</b> · POT {potLabel(f)} · {monthly(f.wage)} · valor {money(marketValue(f))} · {f.contract} ano{f.contract > 1 ? 's' : ''} de contrato · {f.apps} jogos
                        {f.intent ? <> · <span className={INTENT_LABEL[f.intent].tone}>{INTENT_LABEL[f.intent].text}</span></> : null}
                        {injured.has(f.id) && state.calendar ? ` · lesionado, volta em ${shortDate(state.calendar.year, injured.get(f.id)!.to)}` : ''}
                      </p>
                      {live && <TalkButtons state={state} dispatch={dispatch} f={f} />}
                      <div className="pl-actions">
                        <PlayerActions state={state} dispatch={dispatch} f={f} close={() => setOpen(null)} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="muted sq-legend">Linha destacada = titular no próximo jogo. Fase: a forma do momento (até ±3 de overall). LES lesionado · SUS suspenso · 2A pendurado · INS insatisfeito (quer jogar) · FIM último ano · PROP proposta.</p>
    </section>
  );
}

/** Forma do momento: seta para cima ou para baixo (até ±3 de overall). */
export function FormArrow({ v }: { v: number }) {
  if (Math.abs(v) < 0.5) return <span className="form-arrow muted">=</span>;
  return <span className={`form-arrow ${v > 0 ? 'good' : 'bad'}`}>{v > 0 ? '▲' : '▼'}{Math.abs(Math.round(v))}</span>;
}

/** Conversa com o jogador: elogiar, cobrar ou prometer vaga (uma vez a cada duas semanas por jogador). */
function TalkButtons({ state, dispatch, f }: { state: GameState; dispatch: Dispatch; f: Footballer }) {
  const day = state.reveal ?? -1;
  const last = (state.live?.talks ?? []).filter((t) => t.id === f.id).at(-1);
  const wait = last ? TALK_COOLDOWN - (day - last.day) : 0;
  const promise = (state.live?.talks ?? []).some((t) => t.id === f.id && t.kind === 'prometer' && day - t.day < 30);
  return (
    <div className="talk">
      <span className="muted">Conversar:</span>
      <button type="button" className="btn btn-small" disabled={wait > 0} onClick={() => dispatch({ t: 'talk', id: f.id, kind: 'elogiar' })}>
        Elogiar
      </button>
      <button type="button" className="btn btn-small" disabled={wait > 0} onClick={() => dispatch({ t: 'talk', id: f.id, kind: 'cobrar' })}>
        Cobrar
      </button>
      <button type="button" className="btn btn-small" disabled={wait > 0} onClick={() => dispatch({ t: 'talk', id: f.id, kind: 'prometer' })}>
        Prometer vaga
      </button>
      {wait > 0 && <small className="muted">Conversou há pouco ({wait} dias para a próxima).</small>}
      {promise && <small className="warnc">Promessa de vaga: ele precisa jogar nos próximos 3 jogos.</small>}
    </div>
  );
}

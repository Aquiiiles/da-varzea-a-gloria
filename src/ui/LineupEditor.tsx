import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FATIGUE_FREE, FATIGUE_REST, FORMATIONS, TIRED_AT, statusAt, STYLE_TACTIC, TACTICS, bestEleven, fatigueAt, injuredAt, lineupStrength, positionPenalty, squadStrength, suspendedOn,
  type Footballer, type Formation, type GameState, type Position, type Tactic,
} from '../engine';
import type { Dispatch } from './App';

const ORDER: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];
const FORMATION_LIST: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1'];
const POS_SHORT: Record<Position, string> = { GOL: 'GOL', DEF: 'ZAG', MEI: 'MEI', ATA: 'ATA' };
const POS_GROUP: Record<Position, string> = { GOL: 'Goleiros', DEF: 'Defensores', MEI: 'Meio-campo', ATA: 'Ataque' };

/** Vagas do esquema, do goleiro ao ataque. */
function slotsOf(formation: Formation): Position[] {
  return ORDER.flatMap((pos) => Array(FORMATIONS[formation][pos]).fill(pos) as Position[]);
}

/** Distribui os titulares nas vagas, preferindo cada um na sua posição. */
function arrange(squad: readonly Footballer[], ids: number[], formation: Formation): (number | null)[] {
  const slots = slotsOf(formation);
  const chosen = ids.map((id) => squad.find((f) => f.id === id)).filter((f): f is Footballer => !!f);
  const out: (number | null)[] = slots.map(() => null);
  const left = chosen.slice().sort((a, b) => b.ovr - a.ovr);
  slots.forEach((pos, i) => {
    const k = left.findIndex((f) => f.pos === pos);
    if (k >= 0) out[i] = left.splice(k, 1)[0].id;
  });
  slots.forEach((_, i) => {
    if (out[i] === null && left.length > 0) out[i] = left.shift()!.id;
  });
  return out;
}

const notaTone = (r: number) => (r >= 7.5 ? 'good' : r < 5.8 ? 'bad' : '');
const staminaColor = (v: number) => (v >= TIRED_AT ? 'var(--good)' : v >= 55 ? 'var(--warn)' : 'var(--bad)');

type Spot = { kind: 'slot'; i: number } | { kind: 'bench'; id: number };
const same = (a: Spot | null, b: Spot | null) => !!a && !!b && (a.kind === 'slot' && b.kind === 'slot' ? a.i === b.i : a.kind === 'bench' && b.kind === 'bench' && a.id === b.id);

/**
 * Escalação no campinho (modo técnico): arraste um jogador do banco para uma vaga (ou entre vagas),
 * ou toque em dois jogadores para trocar. Lesionado não joga; com o rodízio, quem está muito cansado descansa.
 * Durante a temporada, vale para os jogos depois de hoje.
 */
/** Modo intervalo: o mesmo campinho, valendo só para o 2º tempo do jogo de hoje. */
export interface HalftimeMode {
  firstIds: number[];
  /** lesionados e suspensos: não podem entrar */
  out: Set<number>;
  maxSubs: number;
  tactic: Tactic;
  /** jogadores em campo (11 menos os expulsos) */
  size?: number;
  /** por que cada um de `out` não pode entrar (saiu, expulso, lesionado, suspenso) */
  reasons?: Map<number, string>;
  /** fôlego de cada um no minuto (0 a 100) */
  stamina?: Map<number, number>;
  /** nota no jogo até aqui */
  ratings?: Map<number, number>;
  onConfirm: (ids: number[] | null, tactic: Tactic) => void;
}

export function LineupEditor({ state, dispatch, halftime, bare }: { state: GameState; dispatch: Dispatch; halftime?: HalftimeMode; bare?: boolean }) {
  const p = state.player;
  const live = state.live;
  const day = state.reveal ?? -1;
  const injured = halftime ? halftime.out : new Set(live ? injuredAt(live, day).map((i) => i.id) : []);
  // suspensos no próximo jogo
  const nextDay = state.calendar?.matches.find((m) => m.day > day)?.day;
  const suspended = new Set(!halftime && live && nextDay !== undefined ? suspendedOn(live, nextDay).map((s) => s.id) : []);
  const fatigue = live ? fatigueAt(live, day) : {};
  const form = live ? statusAt(live, day).form : {};
  const formation = p.coach.formation;
  const slotPos = slotsOf(formation);
  const current = p.lineup?.ids ?? null;
  const [slots, setSlots] = useState<(number | null)[]>(() => {
    // escalação salva com os 11 nas vagas: abre exatamente como foi montada
    if (!halftime && current && current.length === slotPos.length && current.every((id) => p.squad.some((f) => f.id === id))) return current.slice();
    return arrange(p.squad, halftime ? halftime.firstIds : current ?? [...bestEleven(p.squad, formation).ids], formation);
  });
  const [htTactic, setHtTactic] = useState<Tactic | null>(halftime?.tactic ?? null);
  const [rotate, setRotate] = useState(p.lineup?.rotate ?? true);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [drag, setDrag] = useState<{ from: Spot; x: number; y: number; id: number } | null>(null);
  const start = useRef<{ x: number; y: number; from: Spot; id: number; moved: boolean } | null>(null);

  const byId = new Map(p.squad.map((f) => [f.id, f]));
  const onPitch = new Set(slots.filter((x): x is number => x !== null));
  const bench = p.squad.filter((f) => !onPitch.has(f.id)).sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || b.ovr - a.ovr);
  const filled = slots.filter((x) => x !== null).length;
  const sameAsSaved = !!current && current.join(',') === slots.join(',') && rotate === (p.lineup?.rotate ?? true);
  // força ao vivo: cada um na vaga em que está (fora de posição rende menos) x o time ideal
  const ids11 = filled === slotPos.length ? slots.map((x) => x!) : null;
  const strength = ids11 ? lineupStrength(p.squad, formation, ids11) : null;
  const ideal = squadStrength(p.squad, formation);

  /** troca o conteúdo de dois lugares (vaga ↔ vaga, vaga ↔ banco) */
  const swap = (a: Spot, b: Spot) => {
    if (same(a, b)) return;
    const next = slots.slice();
    const idAt = (s: Spot) => (s.kind === 'slot' ? next[s.i] : s.id);
    const ia = idAt(a);
    const ib = idAt(b);
    if (a.kind === 'bench' && b.kind === 'bench') return;
    if (a.kind === 'slot') next[a.i] = ib ?? null;
    if (b.kind === 'slot') next[b.i] = ia ?? null;
    if (halftime) {
      // no intervalo: lesionado/suspenso não entra e o limite de substituições vale
      if (next.some((id) => id !== null && halftime.out.has(id))) return;
      if (next.filter((id) => id !== null && !halftime.firstIds.includes(id)).length > halftime.maxSubs) return;
    }
    setSlots(next);
  };

  const tap = (s: Spot) => {
    if (selected && !same(selected, s)) {
      swap(selected, s);
      setSelected(null);
    } else setSelected(same(selected, s) ? null : s);
  };

  const spotFromPoint = (x: number, y: number): Spot | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-spot]') as HTMLElement | null;
    if (!el) return null;
    const [kind, v] = el.dataset.spot!.split(':');
    return kind === 'slot' ? { kind: 'slot', i: Number(v) } : { kind: 'bench', id: Number(v) };
  };

  const down = (e: ReactPointerEvent, from: Spot, id: number | null) => {
    if (id === null) return tap(from);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, from, id, moved: false };
  };
  const move = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
    s.moved = true;
    setDrag({ from: s.from, id: s.id, x: e.clientX, y: e.clientY });
  };
  const up = (e: ReactPointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s) return;
    if (!s.moved) return tap(s.from);
    const to = spotFromPoint(e.clientX, e.clientY);
    if (to) swap(s.from, to);
    setSelected(null);
  };

  const captainId = p.roles?.captain ?? null;
  const Card = ({ f, spot, slot }: { f: Footballer; spot: Spot; slot?: Position }) => {
    const tired = fatigue[f.id] ?? 0;
    const susp = suspended.has(f.id);
    const out = injured.has(f.id) || susp;
    const offPos = slot && slot !== f.pos;
    const penalty = slot ? positionPenalty(slot, f.pos) : 0;
    return (
      <button
        type="button"
        className={`pcard pcard-${f.pos}${same(selected, spot) ? ' is-sel' : ''}${out ? ' is-out' : ''}${drag && same(drag.from, spot) ? ' is-ghost' : ''}${fitClass(spot, f)}`}
        data-spot={spot.kind === 'slot' ? `slot:${spot.i}` : `bench:${f.id}`}
        onPointerDown={(e) => down(e, spot, f.id)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => ((start.current = null), setDrag(null))}
      >
        <span className={`pc-pos pos-${f.pos}${offPos ? ' is-off' : ''}`}>
          {f.pos}
          {penalty > 0 && <em className="pc-pen">-{penalty}</em>}
        </span>
        <span className="pc-name">{f.name.split(' ').slice(-1)[0]}</span>
        {captainId === f.id && <i className="pc-cap" title="Capitão">C</i>}
        <b className="pc-ovr">
          {f.ovr}
          {Math.abs(form[f.id] ?? 0) >= 0.5 && <i className={`pc-form ${(form[f.id] ?? 0) > 0 ? 'good' : 'bad'}`}>{(form[f.id] ?? 0) > 0 ? '▲' : '▼'}</i>}
        </b>
        {halftime?.ratings?.has(f.id) && <i className={`pc-nota ${notaTone(halftime.ratings.get(f.id)!)}`}>{halftime.ratings.get(f.id)!.toFixed(1)}</i>}
        {out ? (
          <i className="pc-flag">{halftime?.reasons?.get(f.id) ?? (susp ? 'suspenso' : 'lesionado')}</i>
        ) : halftime?.stamina?.has(f.id) ? (
          <span className="pc-fat" title={`fôlego ${halftime.stamina.get(f.id)}`}>
            <span className="pc-track">
              <i style={{ width: `${Math.max(4, halftime.stamina.get(f.id)!)}%`, background: staminaColor(halftime.stamina.get(f.id)!) }} />
            </span>
            <small>{halftime.stamina.get(f.id)}</small>
          </span>
        ) : (
          <span className="pc-fat" title={`cansaço ${tired}`}>
            <span className="pc-track">
              <i style={{ width: `${Math.max(4, tired)}%`, background: tired >= FATIGUE_REST ? 'var(--bad)' : tired > FATIGUE_FREE ? 'var(--warn)' : 'var(--good)' }} />
            </span>
            <small>{tired}%</small>
          </span>
        )}
      </button>
    );
  };

  /** vaga escolhida (tocada ou arrastada): o banco destaca quem é da posição dela */
  const wantPos: Position | null = (() => {
    const s = drag?.from ?? selected;
    if (s?.kind === 'slot') return slotPos[s.i];
    return null;
  })();
  function fitClass(spot: Spot, f: Footballer): string {
    if (spot.kind !== 'bench' || !wantPos) return '';
    return f.pos === wantPos ? ' is-fit' : ' is-dim';
  }
  const tactic: Tactic = htTactic ?? p.tactic ?? STYLE_TACTIC[p.coach.style];
  const htSubs = halftime ? slots.filter((id) => id !== null && !halftime.firstIds.includes(id)).length : 0;
  // linhas do campo, do ataque (em cima) ao goleiro (embaixo)
  const rows = [...ORDER].reverse().map((pos) => ({ pos, idx: slotPos.map((x, i) => (x === pos ? i : -1)).filter((i) => i >= 0) }));
  const dragged = drag ? byId.get(drag.id) : undefined;

  return (
    <div className="lineup">
{!bare && (
        <>
      <p className="lineup-pos">Estratégia</p>
      <div className="seg tactic-seg">
        {(Object.keys(TACTICS) as Tactic[]).map((t) => (
          <button key={t} type="button" className={`seg-btn${tactic === t ? ' is-on' : ''}`} onClick={() => tactic !== t && (halftime ? setHtTactic(t) : dispatch({ t: 'tactic', v: t }))}>
            <strong>{TACTICS[t].label}</strong>
          </button>
        ))}
      </div>
      <p className="muted">{TACTICS[tactic].effect}</p>

      {!halftime && <p className="lineup-pos">Esquema</p>}
      <div className="seg formation-mini" hidden={!!halftime} style={halftime ? { display: 'none' } : undefined}>
        {FORMATION_LIST.map((f) => (
          <button key={f} type="button" className={`seg-btn${formation === f ? ' is-on' : ''}`} onClick={() => formation !== f && dispatch({ t: 'formation', f })}>
            <strong>{f}</strong>
          </button>
        ))}
      </div>

        </>
      )}
      {halftime ? (
        <p className="muted">
          Arraste quem entra do banco para a vaga de quem sai (ou toque em dois). {htSubs} de {halftime.maxSubs} substituições.
        </p>
      ) : (
        <p className="muted">Arraste para a vaga ou toque em dois para trocar · {current ? 'escalação sua' : 'automática'}</p>
      )}

      <div className="lineup-strength">
        <span>
          Força do time <b className={strength !== null && strength < ideal - 0.5 ? 'bad' : 'good'}>{strength !== null ? strength.toFixed(1) : '—'}</b>
        </span>
        <small className="muted">
          {strength === null ? `faltam ${slotPos.length - filled}` : strength >= ideal - 0.05 ? 'o melhor time possível' : `ideal: ${ideal.toFixed(1)} (${(strength - ideal).toFixed(1)})`}
        </small>
      </div>

      <div className="pitch">
        {rows.map((r) => (
          <div key={r.pos} className="pitch-row" data-label={POS_SHORT[r.pos]}>
            {r.idx.map((i) => {
              const id = slots[i];
              const f = id !== null ? byId.get(id) : undefined;
              const spot: Spot = { kind: 'slot', i };
              return f ? (
                <Card key={i} f={f} spot={spot} slot={slotPos[i]} />
              ) : (
                <button key={i} type="button" className={`pcard pc-empty${same(selected, spot) ? ' is-sel' : ''}`} data-spot={`slot:${i}`} onClick={() => tap(spot)}>
                  <span className="pc-pos">{slotPos[i]}</span>
                  <span className="pc-name">vaga</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="lineup-pos">Banco</p>
      {ORDER.map((pos) => {
        const group = bench.filter((f) => f.pos === pos);
        if (group.length === 0) return null;
        return (
          <div key={pos} className="bench-group">
            <span className={`bench-label pos-${pos}`}>{POS_GROUP[pos]}</span>
            <div className="bench">
              {group.map((f) => (
                <Card key={f.id} f={f} spot={{ kind: 'bench', id: f.id }} />
              ))}
            </div>
          </div>
        );
      })}

      {drag && dragged && (
        <div className="pcard pc-drag" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <span className="pc-pos">{dragged.pos}</span>
          <span className="pc-name">{dragged.name.split(' ').slice(-1)[0]}</span>
          <b className="pc-ovr">{dragged.ovr}</b>
        </div>
      )}

      {halftime ? (
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={filled !== (halftime.size ?? 11) || (htSubs === 0 && tactic === halftime.tactic && filled === halftime.firstIds.length)}
            onClick={() => halftime.onConfirm(htSubs > 0 ? slots.filter((x): x is number => x !== null) : null, tactic)}
          >
            Confirmar e voltar ao jogo
          </button>
        </div>
      ) : (
        <>
      <label className="lineup-rotate">
        <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
        Rodízio: poupar quem estiver muito cansado (cansaço {FATIGUE_REST}+)
      </label>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={filled !== 11 || sameAsSaved}
          onClick={() => dispatch({ t: 'lineup', ids: slots.filter((x): x is number => x !== null), rotate })}
        >
          Salvar escalação
        </button>
        <button type="button" className="btn" disabled={current === null && rotate === (p.lineup?.rotate ?? true)} onClick={() => dispatch({ t: 'lineup', ids: null, rotate })}>
          Time ideal (automático)
        </button>
      </div>
        </>
      )}
    </div>
  );
}

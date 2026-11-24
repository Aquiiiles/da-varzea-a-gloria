import { useState } from 'react';
import { FATIGUE_FREE, FATIGUE_REST, STYLE_TACTIC, TACTICS, bestEleven, fatigueAt, injuredAt, type GameState, type Position, type Tactic } from '../engine';
import type { Dispatch } from './App';

const POS: { id: Position; label: string }[] = [
  { id: 'GOL', label: 'Goleiros' },
  { id: 'DEF', label: 'Defensores' },
  { id: 'MEI', label: 'Meias' },
  { id: 'ATA', label: 'Atacantes' },
];

/**
 * Escalação (modo técnico): escolha os 11 titulares ou deixe o automático (os melhores).
 * Lesionado não joga; com o rodízio ligado, quem está muito cansado descansa.
 * Durante a temporada, vale para os jogos depois de hoje.
 */
export function LineupEditor({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const p = state.player;
  const live = state.live;
  const day = state.reveal ?? -1;
  const injured = new Set(live ? injuredAt(live, day).map((i) => i.id) : []);
  const fatigue = live ? fatigueAt(live, day) : {};
  const auto = bestEleven(p.squad, p.coach.formation).ids;
  const current = p.lineup?.ids ?? null;
  const [picked, setPicked] = useState<Set<number>>(() => new Set(current ?? [...auto]));
  const [rotate, setRotate] = useState(p.lineup?.rotate ?? true);
  const dirty = current === null || picked.size !== current.length || current.some((id) => !picked.has(id)) || rotate !== (p.lineup?.rotate ?? true);

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else if (next.size < 11) next.add(id);
    setPicked(next);
  };

  const tactic: Tactic = p.tactic ?? STYLE_TACTIC[p.coach.style];
  return (
    <div className="lineup">
      <p className="lineup-pos">Estratégia</p>
      <div className="seg tactic-seg">
        {(Object.keys(TACTICS) as Tactic[]).map((t) => (
          <button key={t} type="button" className={`seg-btn${tactic === t ? ' is-on' : ''}`} onClick={() => tactic !== t && dispatch({ t: 'tactic', v: t })}>
            <strong>{TACTICS[t].label}</strong>
          </button>
        ))}
      </div>
      <p className="muted">{TACTICS[tactic].effect}</p>
      <p className="muted">
        {current ? 'Escalação escolhida por você.' : 'Automático: o time escala os melhores do esquema.'} {picked.size}/11 marcados · esquema{' '}
        {p.coach.formation}
        {live ? ' · vale para os jogos depois de hoje' : ''}
      </p>
      {POS.map((g) => {
        const list = p.squad.filter((f) => f.pos === g.id).sort((a, b) => b.ovr - a.ovr);
        if (list.length === 0) return null;
        return (
          <div key={g.id} className="lineup-group">
            <p className="lineup-pos">{g.label}</p>
            {list.map((f) => {
              const tired = fatigue[f.id] ?? 0;
              const out = injured.has(f.id);
              return (
                <label key={f.id} className={`lineup-row${picked.has(f.id) ? ' is-on' : ''}${out ? ' is-out' : ''}`}>
                  <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)} />
                  <span className="lineup-name">
                    {f.name} <small>{f.age} anos</small>
                  </span>
                  {out && <em className="tag-out">lesionado</em>}
                  {!out && tired > FATIGUE_FREE && <em className={tired >= FATIGUE_REST ? 'tag-out' : 'tag-tired'}>cansaço {tired}</em>}
                  <b>{f.ovr}</b>
                </label>
              );
            })}
          </div>
        );
      })}
      <label className="lineup-rotate">
        <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
        Rodízio: poupar quem estiver muito cansado (cansaço {FATIGUE_REST}+)
      </label>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={picked.size !== 11 || !dirty} onClick={() => dispatch({ t: 'lineup', ids: [...picked], rotate })}>
          Salvar escalação
        </button>
        <button type="button" className="btn" disabled={current === null && rotate === (p.lineup?.rotate ?? true)} onClick={() => dispatch({ t: 'lineup', ids: null, rotate })}>
          Automático (os melhores)
        </button>
      </div>
    </div>
  );
}

import { TRAINING, type TrainingFocus } from '../../engine';

/** Foco do treino da semana (vale a partir de hoje). */
export function TrainingPicker({ value, onPick }: { value: TrainingFocus; onPick: (f: TrainingFocus) => void }) {
  return (
    <div className="pm-tactic">
      <p className="lineup-pos">Treino da semana</p>
      <div className="seg seg-compact tactic-seg">
        {(Object.keys(TRAINING) as TrainingFocus[]).map((t) => (
          <button key={t} type="button" className={`seg-btn${value === t ? ' is-on' : ''}`} onClick={() => value !== t && onPick(t)}>
            {TRAINING[t].label}
          </button>
        ))}
      </div>
      <small className="muted">{TRAINING[value].effect}</small>
    </div>
  );
}

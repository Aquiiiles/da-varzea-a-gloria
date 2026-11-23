import { useState } from 'react';
import { ORIGINS, type Foundation, type Origin } from '../engine';

const SWATCHES = ['#c8102e', '#1d428a', '#fdb913', '#00843d', '#ffffff', '#111111', '#6c1d45', '#ef7d00', '#9bcbeb', '#7a263a'];
const ORIGIN_ICON: Record<Origin, string> = { pub: '🍺', fabrica: '🏭', youtuber: '📱' };

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-picker">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${c === value ? ' is-on' : ''}`}
            style={{ background: c }}
            aria-label={`cor ${c}`}
            onClick={() => onChange(c)}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} personalizada`} />
      </div>
    </div>
  );
}

export function FoundationScreen({ onStart }: { onStart: (f: Foundation) => void }) {
  const [name, setName] = useState('');
  const [c1, setC1] = useState('#c8102e');
  const [c2, setC2] = useState('#ffffff');
  const [origin, setOrigin] = useState<Origin>('pub');

  return (
    <section className="panel foundation">
      <p className="kicker">Fundação</p>
      <h1 className="headline">Todo gigante já foi um time de bairro.</h1>
      <p className="lede">
        Você é o dono. Funde um clube na Liga Regional, a 8ª divisão, e tente chegar à Premier, à Copa dos
        Campeões e ao Mundial em 25 temporadas.
      </p>

      <label className="field">
        <span className="field-label">Nome do clube</span>
        <input
          className="text-input"
          value={name}
          maxLength={28}
          placeholder="Ex.: Unidos da Várzea"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="colors">
        <ColorPicker label="Cor principal" value={c1} onChange={setC1} />
        <ColorPicker label="Cor secundária" value={c2} onChange={setC2} />
        <div className="kit-preview" style={{ background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` }} />
      </div>

      <span className="field-label">Origem</span>
      <div className="origins">
        {(Object.keys(ORIGINS) as Origin[]).map((o) => (
          <button key={o} type="button" className={`origin${o === origin ? ' is-on' : ''}`} onClick={() => setOrigin(o)}>
            <span className="origin-icon">{ORIGIN_ICON[o]}</span>
            <strong>{ORIGINS[o].label}</strong>
            <small>{ORIGINS[o].blurb}</small>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-big"
        onClick={() => onStart({ name: name.trim() || 'Unidos da Várzea', colors: [c1, c2], origin })}
      >
        Fundar o clube
      </button>
    </section>
  );
}

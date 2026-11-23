import { useState } from 'react';
import { ORIGINS, START_YEAR, initials, type Foundation, type Origin } from '../engine';
import { Crest } from './Crest';
import { deleteCareer, listCareers, listHall, type CareerSave } from '../storage';
import { today } from './daily';

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

function SavedRuns({ onResume }: { onResume: (query: string) => void }) {
  const [careers, setCareers] = useState<CareerSave[]>(() => listCareers());
  const hall = listHall();
  if (careers.length === 0 && hall.length === 0) return null;
  return (
    <>
      {careers.length > 0 && (
        <section className="panel saves">
          <p className="kicker">Continuar carreira</p>
          <ul className="save-list">
            {careers.map((c) => (
              <li key={c.id}>
                <button type="button" className="save" onClick={() => onResume(c.query)}>
                  <Crest name={c.name} short={initials(c.name)} colors={c.colors} size={36} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.tierName} · {START_YEAR + c.season - 1} (temporada {c.season})
                    </small>
                  </span>
                  <span className="save-go">Continuar ▶</span>
                </button>
                <button
                  type="button"
                  className="save-del"
                  aria-label={`Apagar save do ${c.name}`}
                  onClick={() => {
                    deleteCareer(c.id);
                    setCareers(listCareers());
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {hall.length > 0 && (
        <section className="panel saves">
          <p className="kicker">Hall da fama</p>
          <ol className="hall">
            {hall.map((h) => (
              <li key={h.id}>
                <button type="button" className="save" onClick={() => onResume(h.query)}>
                  <Crest name={h.name} short={initials(h.name)} colors={h.colors} size={36} />
                  <span>
                    <strong>{h.name}</strong>
                    <small>
                      {h.daily ? `Desafio ${h.daily} · ` : ''}Nível {h.level} · {h.label} · melhor: {h.bestTier}
                    </small>
                  </span>
                  <span className="save-go">{h.score.toLocaleString('pt-BR')} pts</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

export function FoundationScreen({ onStart, onResume }: { onStart: (f: Foundation, seed?: number) => void; onResume: (query: string) => void }) {
  const daily = today();
  const [name, setName] = useState('');
  const [c1, setC1] = useState('#c8102e');
  const [c2, setC2] = useState('#ffffff');
  const [origin, setOrigin] = useState<Origin>('pub');

  return (
    <>
    <SavedRuns onResume={onResume} />
    <section className="panel foundation">
      <p className="kicker">Fundação</p>
      <h1 className="headline">Todo gigante já foi um time de bairro.</h1>
      <p className="lede">
        Você é o dono. Funde um time na Várzea e suba pelo Estadual, pelas Séries D, C e B até a Série A, a Copa Continental e o
        Mundial em 50 temporadas.
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
        <div className="crest-preview">
          <Crest name={name.trim() || 'Unidos da Várzea'} short={initials(name.trim() || 'Unidos da Várzea')} colors={[c1, c2]} size={88} />
          <span>Seu escudo (gerado a partir do nome e das cores)</span>
        </div>
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
    <section className="panel daily">
      <p className="kicker">Desafio do dia · {daily.label}</p>
      <p className="lede">
        Hoje todo mundo joga no mesmo mundo, com a mesma origem: <strong>{ORIGINS[daily.origin].label}</strong>. Compare a trajetória com os amigos pelo link
        da run.
      </p>
      <button
        type="button"
        className="btn btn-big"
        onClick={() => onStart({ name: name.trim() || 'Unidos da Várzea', colors: [c1, c2], origin: daily.origin }, daily.seed)}
      >
        Jogar o desafio de {daily.label}
      </button>
    </section>
    </>
  );
}

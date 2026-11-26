import { useState } from 'react';
import { CAREER_END_AGE, CAREER_START_AGE, COACH_STYLES, ORIGINS, START_YEAR, initials, packSize, parseNamePack, type CoachStyle, type Foundation, type GameMode, type NamePack, type Origin } from '../engine';
import { Crest } from './Crest';
import { deleteCareer, listCareers, listHall, loadNamePack, saveNamePack, type CareerSave } from '../storage';
import { today } from './daily';
import { REAL_PACK } from '../data/realclubs';
import { Juggler } from './Juggler';

const SWATCHES = ['#c8102e', '#1d428a', '#fdb913', '#00843d', '#ffffff', '#111111', '#6c1d45', '#ef7d00', '#9bcbeb', '#7a263a'];

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

function SavedRuns({ onResume }: { onResume: (query: string, slot?: string) => void }) {
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
                <button type="button" className="save" onClick={() => onResume(c.query, c.id)}>
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

/** Pacote de nomes: troca os nomes fictícios dos clubes das Séries A a D por um arquivo seu. */
function NamePackPanel() {
  const [pack, setPack] = useState<NamePack | null>(() => loadNamePack());
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseNamePack(JSON.parse(await file.text()));
      if (typeof parsed === 'string') return setMsg({ text: parsed, ok: false });
      if (!saveNamePack(parsed)) return setMsg({ text: 'Não foi possível salvar neste navegador.', ok: false });
      setPack(parsed);
      setMsg({ text: `"${parsed.title}" ativado: ${packSize(parsed)} clubes. Vale para carreiras novas e para as salvas.`, ok: true });
    } catch {
      setMsg({ text: 'Não consegui ler o arquivo: ele precisa ser um JSON válido.', ok: false });
    }
  };

  const useFictional = () => {
    saveNamePack(null);
    setPack(null);
    setMsg({ text: 'Nomes fictícios: os clubes das Séries A a D ganham nomes inventados.', ok: true });
  };
  const useReal = () => {
    saveNamePack('real');
    setPack(REAL_PACK);
    setMsg({ text: 'Clubes reais de volta.', ok: true });
  };
  const isReal = pack === REAL_PACK || pack?.title === REAL_PACK.title;

  return (
    <details className="panel namepack">
      <summary>
        <span className="kicker">Nomes dos clubes</span>
        <span className="namepack-state">{pack ? (isReal ? 'Clubes reais' : `${pack.title} (${packSize(pack)})`) : 'Fictícios'}</span>
      </summary>
      <p className="muted">
        As Séries A, B, C e D usam os clubes reais do Brasil. Dá para trocar por nomes fictícios ou importar um pacote próprio (.json). Só muda nomes,
        siglas e cores: os resultados da carreira continuam os mesmos.
      </p>
      <div className="namepack-actions">
        {pack ? (
          <button type="button" className="btn btn-small" onClick={useFictional}>
            Usar nomes fictícios
          </button>
        ) : null}
        {!isReal && (
          <button type="button" className="btn btn-small" onClick={useReal}>
            Usar clubes reais
          </button>
        )}
        <label className="btn btn-small">
          Importar pacote
          <input type="file" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {msg && <p className={msg.ok ? 'good' : 'bad'}>{msg.text}</p>}
    </details>
  );
}

export function FoundationScreen({ onStart, onResume }: { onStart: (f: Foundation, seed?: number) => void; onResume: (query: string, slot?: string) => void }) {
  const daily = today();
  const [name, setName] = useState('');
  const [c1, setC1] = useState('#c8102e');
  const [c2, setC2] = useState('#ffffff');
  const [origin, setOrigin] = useState<Origin>('pub');
  const [mode, setMode] = useState<GameMode>('tecnico');
  const [coachName, setCoachName] = useState('');
  const [style, setStyle] = useState<CoachStyle>('motivador');
  const startCoach = (seed?: number) =>
    onStart({ name: coachName.trim() || 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style }, seed);

  return (
    <>
    <section className="hero">
      <div className="hero-field" aria-hidden="true" />
      <Juggler className="hero-juggler" />
      <div className="hero-copy">
        <p className="hero-kicker">Manager de futebol</p>
        <h1 className="hero-title">
          Da Várzea
          <br />à Glória
        </h1>
        <p className="hero-sub">Do campo de terra ao Mundial.</p>
      </div>
    </section>
    <SavedRuns onResume={onResume} />
    <section className="panel modes">
      <p className="kicker">Modo de jogo</p>
      <div className="mode-grid">
        <button type="button" className={`origin mode-card${mode === 'tecnico' ? ' is-on' : ''}`} onClick={() => setMode('tecnico')}>
          <strong>Técnico</strong>
          <small>Comece sem nome, aceite propostas, suba de clube em clube e não deixe a diretoria perder a paciência.</small>
        </button>
        <button type="button" className={`origin mode-card${mode === 'presidente' ? ' is-on' : ''}`} onClick={() => setMode('presidente')}>
          <strong>Presidente</strong>
          <small>Funde um time na Várzea e leve até a glória: elenco, estádio, finanças e o técnico são seus.</small>
        </button>
      </div>
    </section>

    {mode === 'tecnico' ? (
      <>
        <section className="panel foundation">
          <p className="kicker">Carreira de técnico</p>
          <h1 className="headline">Da prancheta de várzea ao Mundial.</h1>
          <p className="lede">
            Você pendurou as chuteiras aos {CAREER_START_AGE} anos. Agora é técnico: ninguém te conhece, só os times pequenos ligam. Escale, contrate dentro da
            verba, cumpra as metas e construa uma reputação até os {CAREER_END_AGE}.
          </p>
          <label className="field">
            <span className="field-label">Seu nome</span>
            <input className="text-input" value={coachName} maxLength={28} placeholder="Ex.: Professor Zeca" onChange={(e) => setCoachName(e.target.value)} />
          </label>
          <span className="field-label">Estilo de jogo</span>
          <div className="origins">
            {(Object.keys(COACH_STYLES) as CoachStyle[]).map((s) => (
              <button key={s} type="button" className={`origin${s === style ? ' is-on' : ''}`} onClick={() => setStyle(s)}>
                <strong>{COACH_STYLES[s].label}</strong>
                <small>{COACH_STYLES[s].effect}</small>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-big" onClick={() => startCoach()}>
            Começar a carreira
          </button>
        </section>
        <section className="panel daily">
          <p className="kicker">Desafio do dia · {daily.label}</p>
          <p className="lede">Hoje todo mundo começa com as mesmas propostas, no mesmo mundo. Compare a carreira com os amigos pelo link.</p>
          <button type="button" className="btn btn-big" onClick={() => startCoach(daily.seed)}>
            Jogar o desafio de {daily.label}
          </button>
        </section>
      </>
    ) : (
    <>
    <section className="panel foundation">
      <p className="kicker">Fundação</p>
      <h1 className="headline">Todo gigante já foi um time de bairro.</h1>
      <p className="lede">
        Você é o dono. Funde um time na Várzea e suba pelo Estadual, pelas Séries D, C e B até a Série A, a Libertadores e o
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
    )}
    <NamePackPanel />
    </>
  );
}

import { useEffect, useState } from 'react';
import { MAX_SEASONS, START_YEAR, TIERS, stadiumAllows, type GameState, type SeasonResult, type Tier } from '../engine';
import { describeEffects, money, num, OUTCOME_LABEL, tierLabel } from './format';
import { ResultScreen } from './ResultScreen';
import { SeasonSummary } from './SeasonSummary';

const KIND_LABEL: Record<string, string> = {
  reforco: 'Reforço',
  staff: 'Staff',
  infra: 'Infraestrutura',
  dinheiro: 'Dinheiro',
  aliciar: 'Aliciar do rival',
};

/** Resultados que interrompem o modo rápido. */
export function isDecisive(r: SeasonResult): boolean {
  return r.outcome !== 'fica';
}

interface Props {
  state: GameState;
  onChoose: (i: number) => void;
  onAdvance: () => void;
  onRestart: () => void;
  fromLink: boolean;
}

export function GameScreen({ state, onChoose, onAdvance, onRestart, fromLink }: Props) {
  const [fast, setFast] = useState(false);
  const last = state.history[state.history.length - 1];

  // modo rápido: pula resumos de temporadas sem nada decisivo
  useEffect(() => {
    if (!fast || state.phase !== 'summary' || !last) return;
    if (isDecisive(last)) {
      setFast(false);
      return;
    }
    const t = setTimeout(onAdvance, 120);
    return () => clearTimeout(t);
  }, [fast, state.phase, last, onAdvance]);

  if (state.phase === 'over') return <ResultScreen state={state} onRestart={onRestart} fromLink={fromLink} />;

  return (
    <div className="game">
      <StatusBar state={state} />
      {state.phase === 'draft' && <Draft state={state} onChoose={onChoose} />}
      {state.phase === 'event' && state.event && (
        <section className="panel event">
          <p className="kicker kicker-alert">Plantão</p>
          <h2 className="headline">{state.event.title}</h2>
          <p className="lede">{state.event.text}</p>
          <div className="event-options">
            {state.event.options.map((o, i) => (
              <button key={o.label} type="button" className="option" onClick={() => onChoose(i)}>
                <strong>{o.label}</strong>
                <Chips state={state} effects={o.effects} />
              </button>
            ))}
          </div>
        </section>
      )}
      {state.phase === 'summary' && last && (
        <SeasonSummary
          result={last}
          clubName={state.player.name}
          onNext={onAdvance}
          fast={fast}
          onFast={() => {
            setFast(true);
            if (!isDecisive(last)) onAdvance();
          }}
        />
      )}
    </div>
  );
}

function StatusBar({ state }: { state: GameState }) {
  const p = state.player;
  const year = START_YEAR + state.season - 1;
  const nextTier = (p.tier > 1 ? p.tier - 1 : 1) as Tier;
  const needs = TIERS[nextTier].minStadium;
  const ok = p.tier === 1 || stadiumAllows(p.capacity, nextTier);
  return (
    <section className="statusbar">
      <div className="status-club">
        <span className="club-dot" style={{ background: `linear-gradient(135deg, ${p.colors[0]} 50%, ${p.colors[1]} 50%)` }} />
        <div>
          <strong>{p.name}</strong>
          <small>
            {tierLabel(p.tier)} · {year} · temporada {state.season}/{MAX_SEASONS}
          </small>
        </div>
      </div>
      <dl className="stats">
        <Stat label="Força" value={p.strength.toFixed(0)} />
        <Stat label="Caixa" value={money(p.cash)} tone={p.cash < 0 ? 'bad' : undefined} />
        <Stat label="Torcida" value={num(p.fans)} />
        <Stat label="Alma" value={`${Math.round(p.soul)}`} tone={p.soul < 30 ? 'bad' : undefined} />
        <Stat
          label={p.tier === 1 ? 'Estádio' : `Estádio (${num(needs)} p/ subir)`}
          value={num(p.capacity)}
          tone={ok ? 'good' : 'bad'}
        />
      </dl>
      {p.pendingDeduction > 0 && <p className="warn">Esta temporada começa com -{p.pendingDeduction} pontos por dívidas.</p>}
      {p.negativeSeasons > 0 && p.pendingDeduction === 0 && <p className="warn">Caixa no vermelho há {p.negativeSeasons} temporada(s).</p>}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Chips({ state, effects }: { state: GameState; effects: Parameters<typeof describeEffects>[1] }) {
  return (
    <span className="chips">
      {describeEffects(state, effects).map((c, i) => (
        <span key={i} className={`chip chip-${c.tone}`}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

function Draft({ state, onChoose }: { state: GameState; onChoose: (i: number) => void }) {
  const last = state.history[state.history.length - 1];
  return (
    <section className="panel draft">
      {last && (
        <p className="last-season">
          {last.year}: {last.position}º na {TIERS[last.tier].name} — {OUTCOME_LABEL[last.outcome]}
        </p>
      )}
      <p className="kicker">Janela da temporada {state.season}</p>
      <h2 className="headline">Escolha uma decisão</h2>
      <div className="cards">
        {state.offer.map((c, i) => (
          <button key={c.id} type="button" className={`card card-${c.kind}`} onClick={() => onChoose(i)}>
            <span className="card-kind">{KIND_LABEL[c.kind]}</span>
            <strong className="card-title">{c.title}</strong>
            <span className="card-text">{c.text}</span>
            <Chips state={state} effects={c.effects} />
          </button>
        ))}
      </div>
    </section>
  );
}

import { useState } from 'react';
import {
  MAX_SEASONS, START_YEAR, TIERS, projectFinance, stadiumAllows, teamStrength, type GameState, type Tier,
} from '../../engine';
import type { Dispatch } from '../App';
import { money, num, tierLabel } from '../format';
import { ClubTab } from './ClubTab';
import { MarketTab } from './MarketTab';
import { OverviewTab } from './OverviewTab';
import { SquadTab } from './SquadTab';
import { StadiumTab } from './StadiumTab';
import { YouthTab } from './YouthTab';

export type TabId = 'painel' | 'elenco' | 'base' | 'mercado' | 'estadio' | 'clube';

const TABS: { id: TabId; label: string }[] = [
  { id: 'painel', label: 'Painel' },
  { id: 'elenco', label: 'Elenco' },
  { id: 'base', label: 'Base' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'estadio', label: 'Estádio' },
  { id: 'clube', label: 'Clube' },
];

export interface TabProps {
  state: GameState;
  dispatch: Dispatch;
  goTo: (t: TabId) => void;
}

export function Office({ state, dispatch, onFast }: { state: GameState; dispatch: Dispatch; onFast: () => void }) {
  const [tab, setTab] = useState<TabId>('painel');
  const p = state.player;
  const o = state.office;
  const eventPending = !!o.event && o.eventChoice === null;
  const props: TabProps = { state, dispatch, goTo: setTab };

  return (
    <div className="office">
      <StatusBar state={state} />

      <nav className="tabs" aria-label="Escritório do presidente">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab${tab === t.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'painel' && eventPending && <span className="dot" aria-label="evento pendente" />}
            {t.id === 'base' && p.youth.length > 0 && <span className="count">{p.youth.length}</span>}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'painel' && <OverviewTab {...props} />}
        {tab === 'elenco' && <SquadTab {...props} />}
        {tab === 'base' && <YouthTab {...props} />}
        {tab === 'mercado' && <MarketTab {...props} />}
        {tab === 'estadio' && <StadiumTab {...props} />}
        {tab === 'clube' && <ClubTab {...props} />}
      </div>

      <div className="playbar">
        <button type="button" className="btn" onClick={() => dispatch({ t: 'auto' })} title="O assistente faz contratações, renovações, obras e responde o evento">
          Assistente decide
        </button>
        <button type="button" className="btn" onClick={onFast} title="O assistente gere e joga até algo decisivo">
          Rápido ⏩
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (eventPending ? setTab('painel') : dispatch({ t: 'play' }))}
        >
          {eventPending ? 'Responda o evento' : `Jogar ${START_YEAR + state.season - 1} ▶`}
        </button>
      </div>
    </div>
  );
}

function StatusBar({ state }: { state: GameState }) {
  const p = state.player;
  const year = START_YEAR + state.season - 1;
  const nextTier = (p.tier > 1 ? p.tier - 1 : 1) as Tier;
  const needs = TIERS[nextTier].minStadium;
  const total = p.capacity + p.capacityBuilding;
  const ok = p.tier === 1 || stadiumAllows(total, nextTier);
  const proj = projectFinance(state);
  const strength = teamStrength(state);
  const diff = strength - TIERS[p.tier].meanStrength;
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
        <Stat label="Força do time" value={strength.toFixed(1)} hint={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} vs média`} tone={diff >= 1 ? 'good' : diff <= -2 ? 'bad' : undefined} />
        <Stat label="Caixa" value={money(p.cash)} tone={p.cash < 0 ? 'bad' : undefined} />
        <Stat label="Saldo previsto" value={money(proj.net)} tone={proj.net < 0 ? 'bad' : 'good'} />
        <Stat label="Torcida" value={num(p.fans)} hint={`alma ${Math.round(p.soul)}`} />
        <Stat
          label="Estádio"
          value={num(p.capacity)}
          hint={p.tier === 1 ? (p.capacityBuilding > 0 ? `+${num(p.capacityBuilding)} em obras` : 'Premier') : `${num(needs)} p/ subir${p.capacityBuilding > 0 ? ` · +${num(p.capacityBuilding)} em obras` : ''}`}
          tone={ok ? 'good' : 'bad'}
        />
      </dl>
      {p.pendingDeduction > 0 && <p className="warn">Esta temporada começa com -{p.pendingDeduction} pontos por dívidas.</p>}
      {p.negativeSeasons > 0 && p.pendingDeduction === 0 && <p className="warn">Caixa no vermelho há {p.negativeSeasons} temporada(s). Mais uma e o clube perde pontos.</p>}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <small>{hint}</small>}
    </div>
  );
}

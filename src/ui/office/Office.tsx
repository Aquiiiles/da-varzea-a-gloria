import { useState } from 'react';
import {
  BOARD_INFO, CAREER_END_AGE, coachRanking, MAX_SEASONS, START_YEAR, TIERS, payroll, projectFinance, stadiumAllows, teamStrength, type GameState, type Tier,
} from '../../engine';
import { BoardTab, CareerTab, Unemployed } from './CareerTab';
import type { Dispatch } from '../App';
import { money, num, tierLabel } from '../format';
import { CoachTab } from './CoachTab';
import { FinanceTab } from './FinanceTab';
import { MarketTab } from './MarketTab';
import { OverviewTab } from './OverviewTab';
import { SquadTab } from './SquadTab';
import { StadiumTab } from './StadiumTab';
import { YouthTab } from './YouthTab';
import { TrophyRoom } from '../TrophyRoom';
import { NewsTab } from './NewsTab';
import { Crest } from '../Crest';

export type TabId = 'painel' | 'elenco' | 'base' | 'mercado' | 'comissao' | 'estadio' | 'financas' | 'diretoria' | 'noticias' | 'trofeus';

const TABS: { id: TabId; label: string }[] = [
  { id: 'painel', label: 'Início' },
  { id: 'elenco', label: 'Elenco' },
  { id: 'base', label: 'Base' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'comissao', label: 'Comissão' },
  { id: 'estadio', label: 'Estrutura' },
  { id: 'financas', label: 'Finanças' },
  { id: 'noticias', label: 'Notícias' },
  { id: 'trofeus', label: 'Troféus' },
];

/** Modo técnico: o técnico não mexe em estádio e finanças (é com a diretoria). */
const COACH_TABS: { id: TabId; label: string }[] = [
  { id: 'painel', label: 'Início' },
  { id: 'elenco', label: 'Elenco' },
  { id: 'base', label: 'Base' },
  { id: 'mercado', label: 'Transferências' },
  { id: 'comissao', label: 'Técnico' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'noticias', label: 'Notícias' },
  { id: 'trofeus', label: 'Troféus' },
];

export interface TabProps {
  state: GameState;
  dispatch: Dispatch;
  goTo: (t: TabId) => void;
}

export function Office({ state, dispatch, onFast, onBack }: { state: GameState; dispatch: Dispatch; onFast: () => void; onBack?: () => void }) {
  const [rawTab, setTab] = useState<TabId>('painel');
  const p = state.player;
  const o = state.office;
  const coach = state.career;
  // no modo técnico, estádio e finanças são da diretoria
  const tab: TabId = coach && (rawTab === 'estadio' || rawTab === 'financas') ? 'diretoria' : rawTab;
  const eventPending = !!o.event && o.eventChoice === null;
  const props: TabProps = { state, dispatch, goTo: setTab };
  const tabs = coach ? COACH_TABS : TABS;

  if (coach?.unemployed) {
    return (
      <div className="office">
        <Unemployed state={state} dispatch={dispatch} />
      </div>
    );
  }

  return (
    <div className="office">
      <StatusBar state={state} />

      <nav className="tabs" aria-label="Escritório do presidente">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`tab${tab === t.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-label">{t.label}</span>
            {t.id === 'painel' && eventPending && <span className="dot" aria-label="evento pendente" />}
            {t.id === 'base' && p.youth.length > 0 && <span className="count">{p.youth.length}</span>}
            {t.id === 'elenco' && o.offers.some(Boolean) && <span className="dot dot-offer" aria-label="propostas recebidas" />}
            {t.id === 'comissao' && o.request && <span className="dot dot-offer" aria-label="pedido do técnico" />}
            {t.id === 'painel' && coach && coach.offers.length > 0 && <span className="dot dot-offer" aria-label="propostas de emprego" />}
          </button>
        ))}
      </nav>

      {onBack && (
        <p className="season-note">
          Temporada em andamento: {state.career ? 'escalação e estratégia valem para os próximos jogos; ' : ''}
          transferências só na janela de julho.
        </p>
      )}

      <div className="tab-body">
        {tab === 'painel' && <OverviewTab {...props} />}
        {tab === 'elenco' && <SquadTab {...props} />}
        {tab === 'base' && <YouthTab {...props} />}
        {tab === 'mercado' && <MarketTab {...props} />}
        {tab === 'estadio' && <StadiumTab {...props} />}
        {tab === 'comissao' && (coach ? <CareerTab {...props} /> : <CoachTab {...props} />)}
        {tab === 'diretoria' && coach && <BoardTab {...props} />}
        {tab === 'financas' && <FinanceTab {...props} />}
        {tab === 'noticias' && <NewsTab {...props} />}
        {tab === 'trofeus' && <TrophyRoom state={state} />}
      </div>

      {onBack ? (
        <div className="playbar">
          <button type="button" className="btn btn-primary" onClick={onBack}>
            Voltar à temporada
          </button>
        </div>
      ) : (
        <div className="playbar">
          <button type="button" className="btn" onClick={() => dispatch({ t: 'auto' })} title={coach ? 'O auxiliar faz contratações, renovações e cuida da base' : 'O assistente faz contratações, renovações, obras e responde o evento'}>
            Assistente decide
          </button>
          <button type="button" className="btn" onClick={onFast} title="O assistente gere e joga até algo decisivo">
            Rápido
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (eventPending ? setTab('painel') : dispatch({ t: 'play' }))}
          >
            {eventPending ? 'Responda o evento' : `Jogar ${START_YEAR + state.season - 1} ▶`}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBar({ state }: { state: GameState }) {
  const c = state.career;
  if (c) return <CoachStatusBar state={state} />;
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
        <Crest name={p.name} short={p.short} colors={p.colors} size={44} />
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
        <Stat label="Torcida" value={num(p.fans)} hint={`humor ${p.mood} · alma ${Math.round(p.soul)}`} tone={p.mood < 25 ? 'bad' : undefined} />
        <Stat
          label="Estádio"
          value={num(p.capacity)}
          hint={p.tier === 1 ? (p.capacityBuilding > 0 ? `+${num(p.capacityBuilding)} em obras` : 'Série A') : `${num(needs)} p/ subir${p.capacityBuilding > 0 ? ` · +${num(p.capacityBuilding)} em obras` : ''}`}
          tone={ok ? 'good' : 'bad'}
        />
      </dl>
      {p.pendingDeduction > 0 && <p className="warn">Esta temporada começa com -{p.pendingDeduction} pontos por dívidas.</p>}
      {p.negativeSeasons > 0 && p.pendingDeduction === 0 && <p className="warn">Caixa no vermelho há {p.negativeSeasons} temporada(s). Mais uma e o clube perde pontos.</p>}
    </section>
  );
}

function CoachStatusBar({ state }: { state: GameState }) {
  const p = state.player;
  const c = state.career!;
  const year = START_YEAR + state.season - 1;
  const strength = teamStrength(state);
  const diff = strength - TIERS[p.tier].meanStrength;
  const pay = payroll(p);
  return (
    <section className="statusbar">
      <div className="status-club">
        <Crest name={p.name} short={p.short} colors={p.colors} size={44} />
        <div>
          <strong>{p.name}</strong>
          <small>
            {tierLabel(p.tier)} · {year} · {c.name}, {c.age} anos (até {CAREER_END_AGE})
          </small>
        </div>
      </div>
      <dl className="stats">
        <Stat label="Força do time" value={strength.toFixed(1)} hint={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} vs média`} tone={diff >= 1 ? 'good' : diff <= -2 ? 'bad' : undefined} />
        <Stat label="Confiança" value={`${c.board.confidence}`} hint={`diretoria ${BOARD_INFO[c.board.personality].label.toLowerCase()}`} tone={c.board.confidence <= 35 ? 'bad' : c.board.confidence >= 70 ? 'good' : undefined} />
        <Stat label="Verba" value={money(c.board.budget)} hint="para contratações" />
        <Stat label="Folha" value={money(pay)} hint={`teto ${money(c.board.wageCap)}`} tone={pay > c.board.wageCap ? 'bad' : undefined} />
        <Stat label="Reputação" value={`${c.reputation}`} hint={`ranking ${coachRanking(state).find((r) => r.me)!.pos}º · contrato ${c.contract} temp.`} />
      </dl>
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

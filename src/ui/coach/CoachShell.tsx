import { useState, type ReactNode } from 'react';
import { BOARD_INFO, START_YEAR, STYLE_TACTIC, TACTICS, TRAINING, julyWindow, myPosition, ultimatumStatus, type Formation, type GameState, type Tactic, type TrainingFocus } from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { Ticker, tickerItems } from '../Ticker';
import { tierLabel } from '../format';
import { CoachStatusBar, type TabId, type TabProps } from '../office/Office';
import { SquadTable } from './SquadTable';
import { YouthTab } from '../office/YouthTab';
import { MarketTab } from '../office/MarketTab';
import { BoardTab, CareerRecordSection, CareerTab, CoachMovesSection, CoachRankingSection } from '../office/CareerTab';
import { TrophyRoom } from '../TrophyRoom';
import { LineupEditor } from '../LineupEditor';
import { MatchCenter } from './MatchCenter';
import { SaveTab } from './SaveTab';
import { CareerTimeline } from './CareerTimeline';
import { TableTab } from './TableTab';
import { shortDate } from '../SeasonView';

export type CoachTab = 'jogar' | 'time' | 'competicoes' | 'mercado' | 'carreira' | 'salvar';

const NAV: { id: CoachTab; label: string }[] = [
  { id: 'jogar', label: 'Jogar' },
  { id: 'time', label: 'Time' },
  { id: 'competicoes', label: 'Competições' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'carreira', label: 'Carreira' },
  { id: 'salvar', label: 'Salvar' },
];

/** Abas antigas do escritório → destino na barra do técnico (atalhos de telas compartilhadas com o presidente). */
const FROM_OFFICE: Record<TabId, [CoachTab, string?]> = {
  painel: ['jogar'], elenco: ['time', 'elenco'], base: ['time', 'base'], mercado: ['mercado'], comissao: ['carreira', 'voce'],
  estadio: ['carreira', 'diretoria'], financas: ['carreira', 'diretoria'], diretoria: ['carreira', 'diretoria'], noticias: ['competicoes', 'jornal'], trofeus: ['carreira', 'historico'],
};

/** Ir para uma aba (e uma sub-aba). */
export type Go = (tab: CoachTab, sub?: string) => void;

interface Props {
  state: GameState;
  dispatch: Dispatch;
  /** jogar a próxima rodada (assistindo) */
  onPlayRound: () => void;
  /** modo rápido (várias temporadas) */
  onFast: () => void;
  /** voltar ao menu inicial (a carreira fica salva) */
  onMenu?: () => void;
  /** salvar uma cópia do ponto atual */
  onSnapshot?: () => void;
  /** abrir outro save */
  onResume?: (query: string, slot: string) => void;
}

/**
 * Modo técnico. Cada aba responde a uma pergunta:
 * Jogar (o que faço agora), Time (quem joga e como), Competições (como estou), Mercado (quem trago ou vendo),
 * Carreira (como vai a carreira) e Salvar.
 */
export function CoachShell({ state, dispatch, onPlayRound, onFast, onMenu, onSnapshot, onResume }: Props) {
  const [tab, setTab] = useState<CoachTab>('jogar');
  const [sub, setSub] = useState<Record<string, string>>({ time: 'preparar', competicoes: 'tabela', mercado: 'janela', carreira: 'voce' });
  const go: Go = (t, s) => {
    setTab(t);
    if (s) setSub((cur) => ({ ...cur, [t]: s }));
    window.scrollTo({ top: 0 });
  };
  const goTo = (t: TabId) => go(...FROM_OFFICE[t]);
  const props: TabProps = { state, dispatch, goTo };
  const running = state.phase === 'season' && !!state.live && state.calendar && state.reveal != null;
  const c = state.career!;
  const badges: Record<CoachTab, boolean> = {
    jogar: !!c.ultimatum || (!!c.midOffer && !c.midOffer.answered),
    time: false,
    competicoes: false,
    mercado: state.office.offers.some(Boolean),
    carreira: c.offers.length > 0,
    salvar: false,
  };

  return (
    <div className="coach" style={{ ['--club1' as string]: state.player.colors[0], ['--club2' as string]: state.player.colors[1] }}>
      <CoachHeader state={state} />
      <div className="coach-body">
        {tab === 'jogar' && <MatchCenter state={state} dispatch={dispatch} go={go} onPlayRound={onPlayRound} onFast={onFast} />}
        {tab === 'time' && (
          <SubTabs
            value={sub.time}
            onChange={(v) => setSub({ ...sub, time: v })}
            items={[
              ['preparar', 'Preparar', <Prepare key="p" state={state} dispatch={dispatch} />],
              ['elenco', 'Elenco', <SquadTable key="e" state={state} dispatch={dispatch} />],
              ['base', 'Base', <YouthTab key="b" {...props} compact />],
            ]}
          />
        )}
        {tab === 'competicoes' && <TableTab state={state} dispatch={dispatch} view={sub.competicoes} onView={(v) => setSub({ ...sub, competicoes: v })} />}
        {tab === 'mercado' && (
          <div className="tab-stack">
            {running && <WindowNote state={state} />}
            <MarketTab {...props} mode={sub.mercado} onMode={(v) => setSub({ ...sub, mercado: v })} />
          </div>
        )}
        {tab === 'carreira' && (
          <SubTabs
            value={sub.carreira}
            onChange={(v) => setSub({ ...sub, carreira: v })}
            items={[
              ['voce', 'Você', <CareerTab key="c" {...props} />],
              ['diretoria', 'Diretoria', <BoardTab key="d" {...props} />],
              [
                'historico',
                'Histórico',
                <div key="h" className="tab-stack">
                  <CareerTimeline state={state} />
                  <CareerRecordSection state={state} />
                  <TrophyRoom state={state} />
                </div>,
              ],
              [
                'ranking',
                'Ranking',
                <div key="r" className="tab-stack">
                  <CoachRankingSection state={state} />
                  <CoachMovesSection state={state} />
                </div>,
              ],
            ]}
          />
        )}
        {tab === 'salvar' && <SaveTab state={state} onSnapshot={onSnapshot} onMenu={onMenu} onResume={onResume} />}
      </div>
      <nav className="bottom-nav bn-6" aria-label="Navegação do técnico">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`bn-item${tab === n.id ? ' is-on' : ''}`} aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
            <NavIcon id={n.id} />
            <span>{n.label}</span>
            {badges[n.id] && <i className="bn-dot" aria-label="novidade" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Time > Preparar: esquema, estratégia e treino em três seletores, e o campinho logo abaixo. */
function Prepare({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const p = state.player;
  const tactic: Tactic = p.tactic ?? STYLE_TACTIC[p.coach.style];
  const training: TrainingFocus = p.training ?? 'equilibrado';
  return (
    <section className="panel prepare">
      <div className="plan-selects">
        <label>
          <span>Esquema</span>
          <select value={p.coach.formation} onChange={(e) => dispatch({ t: 'formation', f: e.target.value as Formation })}>
            {(['4-4-2', '4-3-3', '3-5-2', '4-5-1'] as Formation[]).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Estratégia</span>
          <select value={tactic} onChange={(e) => dispatch({ t: 'tactic', v: e.target.value as Tactic })}>
            {(Object.keys(TACTICS) as Tactic[]).map((t) => (
              <option key={t} value={t}>
                {TACTICS[t].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Treino</span>
          <select value={training} onChange={(e) => dispatch({ t: 'training', focus: e.target.value as TrainingFocus })}>
            {(Object.keys(TRAINING) as TrainingFocus[]).map((t) => (
              <option key={t} value={t}>
                {TRAINING[t].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted plan-effects">
        {TACTICS[tactic].effect} {training !== 'equilibrado' ? TRAINING[training].effect : ''}
      </p>
      <LineupEditor key={`${state.reveal}-${JSON.stringify(p.lineup)}-${p.coach.formation}`} state={state} dispatch={dispatch} bare />
    </section>
  );
}

function SubTabs({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string, ReactNode][] }) {
  const cur = items.find((i) => i[0] === value) ?? items[0];
  return (
    <div className="tab-stack">
      <div className="subtabs" role="tablist">
        {items.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={cur[0] === id} className={`subtab${cur[0] === id ? ' is-on' : ''}`} onClick={() => onChange(id)}>
            {label}
          </button>
        ))}
      </div>
      {cur[2]}
    </div>
  );
}

/** Aviso de janela no mercado durante a temporada. */
function WindowNote({ state }: { state: GameState }) {
  const cal = state.calendar!;
  const day = state.reveal!;
  const [open, close] = julyWindow(cal.year);
  if (day >= open && day <= close) return <p className="window-alert">Janela aberta até {shortDate(cal.year, close)}: dá para contratar e vender.</p>;
  return <p className="muted">Janela fechada. {day < open ? `Abre em ${shortDate(cal.year, open)}.` : 'Reabre na próxima temporada.'} Dá para olhar e planejar.</p>;
}

/** Cabeçalho compacto: escudo, clube, série, posição e confiança. Toque para os detalhes. */
function CoachHeader({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const p = state.player;
  const c = state.career!;
  const pos = state.calendar && state.reveal != null ? myPosition(state, state.reveal) : null;
  const conf = c.board.confidence;
  return (
    <header className="coach-head">
      <button type="button" className="ch-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Crest name={p.name} short={p.short} colors={p.colors} size={34} />
        <span className="ch-club">
          <strong>{p.name}</strong>
          <small>
            {tierLabel(p.tier)} · {START_YEAR + state.season - 1}
            {pos && pos.pos > 0 ? ` · ${pos.pos}º de ${pos.of}` : ''}
          </small>
        </span>
        {ultimatumStatus(state)?.need ? (
          <span className="ch-conf bad ch-ult">
            <small>Ultimato</small>
            <b>{ultimatumStatus(state)!.left} j.</b>
          </span>
        ) : (
          <span className={`ch-conf ${conf <= 35 ? 'bad' : conf >= 70 ? 'good' : ''}`} title={`Diretoria ${BOARD_INFO[c.board.personality].label.toLowerCase()}`}>
            <small>Confiança</small>
            <b>{conf}</b>
          </span>
        )}
      </button>
      <Ticker items={tickerItems(state)} />
      {open && <CoachStatusBar state={state} />}
    </header>
  );
}

/** Ícones simples em SVG (sem emojis). */
function NavIcon({ id }: { id: CoachTab }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (id) {
    case 'jogar':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7l4 3-1.5 5h-5L8 10z" />
        </svg>
      );
    case 'time':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 14c2.8 0 5 2.2 5 5" />
        </svg>
      );
    case 'competicoes':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M3 14h18M9 4v16" />
        </svg>
      );
    case 'mercado':
      return (
        <svg {...common}>
          <path d="M7 7h11l-3-3M17 17H6l3 3" />
        </svg>
      );
    case 'salvar':
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8 4v5h7V4M8 20v-6h8v6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
          <path d="M12 12v4M8 20h8M10 16h4" />
          <path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4" />
        </svg>
      );
  }
}

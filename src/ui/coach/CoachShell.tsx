import { useState, type ReactNode } from 'react';
import { BOARD_INFO, START_YEAR, julyWindow, myPosition, ultimatumStatus, type GameState } from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { tierLabel } from '../format';
import { CoachStatusBar, type TabId, type TabProps } from '../office/Office';
import { SquadTab } from '../office/SquadTab';
import { YouthTab } from '../office/YouthTab';
import { MarketTab } from '../office/MarketTab';
import { BoardTab, CareerTab } from '../office/CareerTab';
import { NewsTab } from '../office/NewsTab';
import { TrophyRoom } from '../TrophyRoom';
import { LineupEditor } from '../LineupEditor';
import { MatchCenter } from './MatchCenter';
import { TableTab } from './TableTab';
import { shortDate } from '../SeasonView';

export type CoachTab = 'jogo' | 'elenco' | 'tabela' | 'mercado' | 'carreira';

const NAV: { id: CoachTab; label: string }[] = [
  { id: 'jogo', label: 'Jogo' },
  { id: 'elenco', label: 'Elenco' },
  { id: 'tabela', label: 'Tabela' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'carreira', label: 'Carreira' },
];

/** Abas antigas do escritório → destino na barra do técnico. */
const FROM_OFFICE: Record<TabId, CoachTab> = {
  painel: 'jogo', elenco: 'elenco', base: 'elenco', mercado: 'mercado', comissao: 'carreira',
  estadio: 'carreira', financas: 'carreira', diretoria: 'carreira', noticias: 'carreira', trofeus: 'carreira',
};

interface Props {
  state: GameState;
  dispatch: Dispatch;
  /** jogar a próxima rodada (assistindo) */
  onPlayRound: () => void;
  /** modo rápido (várias temporadas) */
  onFast: () => void;
}

/**
 * Modo técnico: tudo gira em torno da rodada. Barra inferior com Jogo, Elenco, Tabela, Mercado e Carreira;
 * cabeçalho compacto (toque para ver os detalhes).
 */
export function CoachShell({ state, dispatch, onPlayRound, onFast }: Props) {
  const [tab, setTab] = useState<CoachTab>('jogo');
  const [sub, setSub] = useState<Record<CoachTab, string>>({ jogo: '', elenco: 'elenco', tabela: '', mercado: '', carreira: 'carreira' });
  const goTo = (t: TabId) => {
    const dest = FROM_OFFICE[t];
    setTab(dest);
    if (dest === 'elenco') setSub({ ...sub, elenco: t === 'base' ? 'base' : 'elenco' });
    if (dest === 'carreira') setSub({ ...sub, carreira: t === 'noticias' ? 'noticias' : t === 'trofeus' ? 'trofeus' : t === 'diretoria' ? 'diretoria' : 'carreira' });
  };
  const props: TabProps = { state, dispatch, goTo };
  const running = state.phase === 'season' && !!state.live && state.calendar && state.reveal != null;
  const badges = {
    jogo: state.career!.offers.length > 0 || (!!state.career!.midOffer && !state.career!.midOffer.answered) || !!state.career!.ultimatum,
    elenco: state.office.offers.some(Boolean),
    mercado: false,
    tabela: false,
    carreira: false,
  };

  return (
    <div className="coach" style={{ ['--club1' as string]: state.player.colors[0], ['--club2' as string]: state.player.colors[1] }}>
      <CoachHeader state={state} />
      <div className="coach-body">
        {tab === 'jogo' && <MatchCenter state={state} dispatch={dispatch} goTo={goTo} onPlayRound={onPlayRound} onFast={onFast} />}
        {tab === 'elenco' && (
          <SubTabs
            value={sub.elenco}
            onChange={(v) => setSub({ ...sub, elenco: v })}
            items={[
              ['elenco', 'Elenco', <SquadTab key="e" {...props} />],
              ['escalacao', 'Escalação', <section key="l" className="panel"><LineupEditor key={`${state.reveal}-${JSON.stringify(state.player.lineup)}-${state.player.coach.formation}`} state={state} dispatch={dispatch} /></section>],
              ['base', 'Base', <YouthTab key="b" {...props} />],
            ]}
          />
        )}
        {tab === 'tabela' && <TableTab state={state} />}
        {tab === 'mercado' && (
          <div className="tab-stack">
            {running && <WindowNote state={state} />}
            <MarketTab {...props} />
          </div>
        )}
        {tab === 'carreira' && (
          <SubTabs
            value={sub.carreira}
            onChange={(v) => setSub({ ...sub, carreira: v })}
            items={[
              ['carreira', 'Técnico', <CareerTab key="c" {...props} />],
              ['diretoria', 'Diretoria', <BoardTab key="d" {...props} />],
              ['noticias', 'Notícias', <NewsTab key="n" {...props} />],
              ['trofeus', 'Troféus', <TrophyRoom key="t" state={state} />],
            ]}
          />
        )}
      </div>
      <nav className="bottom-nav" aria-label="Navegação do técnico">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`bn-item${tab === n.id ? ' is-on' : ''}`} aria-current={tab === n.id ? 'page' : undefined} onClick={() => setTab(n.id)}>
            <NavIcon id={n.id} />
            <span>{n.label}</span>
            {badges[n.id] && <i className="bn-dot" aria-label="novidade" />}
          </button>
        ))}
      </nav>
    </div>
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
      {open && <CoachStatusBar state={state} />}
    </header>
  );
}

/** Ícones simples em SVG (sem emojis). */
function NavIcon({ id }: { id: CoachTab }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (id) {
    case 'jogo':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7l4 3-1.5 5h-5L8 10z" />
        </svg>
      );
    case 'elenco':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 14c2.8 0 5 2.2 5 5" />
        </svg>
      );
    case 'tabela':
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

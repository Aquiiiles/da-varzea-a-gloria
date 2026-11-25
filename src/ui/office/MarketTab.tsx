import { useState } from 'react';
import { useMemo } from 'react';
import { SQUAD_MAX, TIERS, agentFee, listingOpen, negotiationFor, squadStrength, type Club, type Footballer, type ListingProfile, type Position, type Tier } from '../../engine';
import { NegotiationPanel } from './Negotiation';
import { money, monthly, spendable } from '../format';
import { marketValue } from '../../engine';
import type { TabProps } from './Office';
import { PlayerLine, Section } from './common';

const PROFILE_LABEL: Record<ListingProfile | 'todos', string> = {
  todos: 'Todos',
  promessa: 'Promessa',
  pronto: 'Pronto',
  veterano: 'Veterano',
  livre: 'Sem clube',
};

type Mode = 'janela' | 'buscar' | 'clubes';

export function MarketTab(props: TabProps) {
  const [mode, setMode] = useState<Mode>('janela');
  return (
    <div className="tab-stack">
      <div className="seg seg-modes" role="tablist" aria-label="Mercado">
        {(
          [
            ['janela', 'Janela'],
            ['buscar', 'Buscar jogadores'],
            ['clubes', 'Clubes'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={`seg-btn${mode === m ? ' is-on' : ''}`} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'janela' && <WindowMarket {...props} />}
      {mode === 'buscar' && <SearchMarket {...props} />}
      {mode === 'clubes' && <ClubsMarket {...props} />}
    </div>
  );
}

/** Linha de jogador de outro clube, que abre a negociação. */
function ForeignPlayer({ state, dispatch, club, f, open, onToggle }: TabProps & { club: Club; f: Footballer; open: boolean; onToggle: () => void }) {
  const p = state.player;
  const n = negotiationFor(state, club.id, f.id);
  const base = squadStrength(p.squad);
  const gain = squadStrength([...p.squad, f]) - base;
  return (
    <PlayerLine
      f={f}
      tier={p.tier}
      meta={
        <>
          {club.name} ({TIERS[club.tier].short}) · força {gain > 0.05 ? <span className="good">+{gain.toFixed(1)}</span> : <span className="muted">+0</span>}
          {n && <span className="tag-offer">{n.status === 'aceita' ? 'contratado' : 'negociando'}</span>}
        </>
      }
      aside={
        <>
          <b>{money(marketValue(f))}</b>
          <small>{monthly(f.wage)}</small>
        </>
      }
      open={open}
      onToggle={onToggle}
    >
      <NegotiationPanel state={state} dispatch={dispatch} club={club} f={f} />
    </PlayerLine>
  );
}

function SearchMarket(props: TabProps) {
  const { state } = props;
  const p = state.player;
  const [pos, setPos] = useState<Position | 'todos'>('todos');
  const [maxAge, setMaxAge] = useState(40);
  const [minOvr, setMinOvr] = useState(Math.round(TIERS[p.tier].meanStrength));
  const [maxLevel, setMaxLevel] = useState<Tier>(Math.max(1, p.tier - 2) as Tier);
  const [open, setOpen] = useState<number | null>(null);
  const results = useMemo(() => {
    const out: { club: Club; f: Footballer }[] = [];
    for (const club of state.clubs) {
      if (club.tier < maxLevel) continue;
      for (const f of club.squad) {
        if ((pos === 'todos' || f.pos === pos) && f.age <= maxAge && f.ovr >= minOvr) out.push({ club, f });
      }
    }
    return out.sort((a, b) => b.f.ovr - a.f.ovr || a.f.age - b.f.age || a.f.id - b.f.id).slice(0, 40);
  }, [state.clubs, pos, maxAge, minOvr, maxLevel]);

  return (
    <Section title="Buscar jogadores" note={<>Qualquer jogador de qualquer clube. Faça uma proposta: o clube decide pela taxa e o jogador pelo salário. {state.career ? 'Verba da diretoria' : 'Caixa disponível'}: <strong>{money(spendable(state))}</strong>.</>}>
      <div className="filters">
        <div className="seg seg-compact" role="group" aria-label="Posição">
          {(['todos', 'GOL', 'DEF', 'MEI', 'ATA'] as const).map((x) => (
            <button key={x} type="button" className={`seg-btn${pos === x ? ' is-on' : ''}`} onClick={() => setPos(x)}>
              {x === 'todos' ? 'Todas' : x}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label>
            Overall mín. <b>{minOvr}</b>
            <input type="range" min={35} max={90} value={minOvr} onChange={(e) => setMinOvr(Number(e.target.value))} />
          </label>
          <label>
            Idade máx. <b>{maxAge}</b>
            <input type="range" min={17} max={40} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} />
          </label>
          <label>
            Até a <b>{TIERS[maxLevel].name}</b>
            <input type="range" min={1} max={7} value={8 - maxLevel} onChange={(e) => setMaxLevel((8 - Number(e.target.value)) as Tier)} />
          </label>
        </div>
      </div>
      {results.length === 0 ? (
        <p className="empty">Nenhum jogador com esses filtros.</p>
      ) : (
        <ul className="pl-list">
          {results.map(({ club, f }) => (
            <ForeignPlayer key={f.id} {...props} club={club} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
          ))}
        </ul>
      )}
    </Section>
  );
}

const COMP_GROUPS: { label: string; filter: (c: Club) => boolean }[] = [
  { label: 'Série A', filter: (c) => c.national === 1 },
  { label: 'Série B', filter: (c) => c.national === 2 },
  { label: 'Série C', filter: (c) => c.national === 3 },
  { label: 'Série D', filter: (c) => c.national === 4 },
  { label: 'Estadual', filter: (c) => c.stateDiv === 'A' },
  { label: 'Estadual Série B', filter: (c) => c.stateDiv === 'B' },
  { label: 'Várzea', filter: (c) => c.stateDiv === 'V' },
];

function ClubsMarket(props: TabProps) {
  const { state } = props;
  const p = state.player;
  const defaultGroup = p.national ? `Série ${'ABCD'[p.national - 1]}` : p.stateDiv === 'A' ? 'Estadual' : p.stateDiv === 'B' ? 'Estadual Série B' : 'Várzea';
  const [group, setGroup] = useState(defaultGroup);
  const [clubId, setClubId] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const g = COMP_GROUPS.find((x) => x.label === group)!;
  const clubs = state.clubs.filter(g.filter).sort((a, b) => b.strength - a.strength);
  const club = clubId ? state.clubs.find((c) => c.id === clubId) : undefined;

  if (club) {
    const squad = club.squad.slice().sort((a, b) => ['GOL', 'DEF', 'MEI', 'ATA'].indexOf(a.pos) - ['GOL', 'DEF', 'MEI', 'ATA'].indexOf(b.pos) || b.ovr - a.ovr);
    return (
      <Section title={club.name} note={`${TIERS[club.tier].name} · força ${club.strength.toFixed(1)} · ${club.squad.length} jogadores`}>
        <button type="button" className="link" onClick={() => setClubId(null)}>
          ← voltar para os clubes
        </button>
        <ul className="pl-list">
          {squad.map((f) => (
            <ForeignPlayer key={f.id} {...props} club={club} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
          ))}
        </ul>
      </Section>
    );
  }
  return (
    <Section title="Clubes" note="Abra o elenco de qualquer clube e tente contratar quem você precisa.">
      <div className="seg seg-compact comp-tabs">
        {COMP_GROUPS.map((x) => (
          <button key={x.label} type="button" className={`seg-btn${group === x.label ? ' is-on' : ''}`} onClick={() => setGroup(x.label)}>
            {x.label}
          </button>
        ))}
      </div>
      <ul className="club-list">
        {clubs.map((c) => (
          <li key={c.id}>
            <button type="button" className="club-row" onClick={() => setClubId(c.id)}>
              <span className="club-dot" style={{ background: `linear-gradient(135deg, ${c.colors[0]} 50%, ${c.colors[1]} 50%)` }} />
              <span className="club-row-name">
                {c.name}
                {c.id === p.rivalId && <em className="tag-offer">rival</em>}
              </span>
              <b>{c.strength.toFixed(1)}</b>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function WindowMarket({ state, dispatch }: TabProps) {
  const p = state.player;
  const [open, setOpen] = useState<number | null>(null);
  const [pos, setPos] = useState<Position | 'todos'>('todos');
  const [profile, setProfile] = useState<ListingProfile | 'todos'>('todos');
  const base = squadStrength(p.squad);
  const full = p.squad.length >= SQUAD_MAX;

  return (
    <div className="tab-stack">
      <Section
        title="Mercado de transferências"
        note={
          <>
            Jogadores disponíveis nesta janela. Você paga a taxa à vista e o salário pesa na folha todo ano. {state.career ? 'Verba da diretoria' : 'Caixa disponível'}:{' '}
            <strong>{money(spendable(state))}</strong>.
          </>
        }
      >
        <div className="filters">
          <div className="seg seg-compact" role="group" aria-label="Posição">
            {(['todos', 'GOL', 'DEF', 'MEI', 'ATA'] as const).map((x) => (
              <button key={x} type="button" className={`seg-btn${pos === x ? ' is-on' : ''}`} onClick={() => setPos(x)}>
                {x === 'todos' ? 'Todas' : x}
              </button>
            ))}
          </div>
          <div className="seg seg-compact" role="group" aria-label="Perfil">
            {(['todos', 'promessa', 'pronto', 'veterano', 'livre'] as const).map((x) => (
              <button key={x} type="button" className={`seg-btn${profile === x ? ' is-on' : ''}`} onClick={() => setProfile(x)}>
                {PROFILE_LABEL[x]}
              </button>
            ))}
          </div>
        </div>
        <ul className="pl-list">
          {state.office.market.map((l, idx) => {
            if (l && ((pos !== 'todos' && l.player.pos !== pos) || (profile !== 'todos' && l.profile !== profile))) return null;
            if (!l) {
              return (
                <li key={idx} className="pl pl-gone">
                  Contratado
                </li>
              );
            }
            const gain = squadStrength([...p.squad, l.player]) - base;
            const agent = agentFee(l.fee, l.player.wage);
            const afford = spendable(state) >= l.fee + agent;
            const avail = listingOpen(state, l);
            const tag = l.kind === 'emprestimo' ? 'Empréstimo' : l.kind === 'estrangeiro' ? 'Estrangeiro' : l.july ? (avail ? 'Chegou em julho' : 'Chega em julho') : null;
            return (
              <PlayerLine
                key={l.player.id}
                f={l.player}
                tier={p.tier}
                meta={
                  <>
                    {tag && <span className={`tag-offer${l.kind === 'estrangeiro' ? ' tag-star' : ''}`}>{tag}</span>} {PROFILE_LABEL[l.profile]} · {l.from} · força {gain > 0.05 ? <span className="good">+{gain.toFixed(1)}</span> : <span className="muted">+0</span>}
                  </>
                }
                aside={
                  <>
                    <b className={afford ? '' : 'bad'}>{l.fee === 0 ? 'Livre' : money(l.fee)}</b>
                    <small>{monthly(l.player.wage)}</small>
                  </>
                }
                open={open === l.player.id}
                onToggle={() => setOpen(open === l.player.id ? null : l.player.id)}
              >
                {l.kind === 'emprestimo' && (
                  <p className="muted">
                    Emprestado pelo {l.from} até o fim da temporada. O {l.from} paga metade do salário ({monthly(l.player.loan?.wage ?? l.player.wage)} no total); ele não pode ser vendido e volta para lá no fim do ano.
                  </p>
                )}
                {l.kind === 'estrangeiro' && <p className="muted">Craque vindo do {l.from}: chega pronto, mas cobra caro e ganha bem.</p>}
                {l.july && !avail && <p className="muted">Só chega na janela do meio do ano (1º a 31 de julho). Volte durante a temporada.</p>}
                <p className="muted">
                  Comissão do empresário: <b>{money(agent)}</b> {l.fee > 0 ? '(6% da taxa)' : '(30% do salário anual, porque vem sem taxa)'}.
                </p>
                <button
                  type="button"
                  className="btn btn-small btn-primary"
                  disabled={!afford || full || !avail}
                  onClick={() => dispatch({ t: 'buy', idx }) && setOpen(null)}
                >
                  {l.kind === 'emprestimo' ? 'Pegar emprestado' : 'Contratar'} ({l.fee === 0 ? 'sem taxa' : money(l.fee)} + {money(agent)} de comissão + {monthly(l.player.wage)}
                  {l.kind === 'emprestimo' ? ', até o fim da temporada' : `, ${l.player.contract} ano${l.player.contract > 1 ? 's' : ''}`})
                </button>
                {!afford && <small className="bad">Caixa insuficiente.</small>}
                {full && <small className="bad">Elenco cheio.</small>}
              </PlayerLine>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

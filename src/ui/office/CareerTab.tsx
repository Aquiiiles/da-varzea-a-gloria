import {
  coachRanking,
  MEETING_INFO, meetingChance,
  socios,
  BOARD_INFO, CAREER_END_AGE, COACH_STYLES, START_YEAR, TIERS, coachEdge, payroll, projectFinance, starsFor, tierForReputation,
  type GameState, type JobOffer, type MeetingKind,
} from '../../engine';
import type { Dispatch } from '../App';
import { money, monthly, num } from '../format';
import { Stars } from './CoachTab';
import type { TabProps } from './Office';
import { Section } from './common';
import { JobOfferCard } from './OfferCards';

function confidenceText(c: number): string {
  if (c >= 80) return 'Prestigiado';
  if (c >= 55) return 'Tranquilo';
  if (c >= 35) return 'Sob pressão';
  if (c > 15) return 'Cadeira balançando';
  return 'Demissão iminente';
}

function reputationText(r: number): string {
  if (r >= 90) return 'Lenda';
  if (r >= 70) return 'Técnico de seleção';
  if (r >= 50) return 'Nome nacional';
  if (r >= 30) return 'Conhecido no estado';
  if (r >= 15) return 'Promessa';
  return 'Desconhecido';
}

function Meter({ value, label, text }: { value: number; label: string; text: string }) {
  return (
    <div className="moodbar">
      <div className="moodbar-head">
        <span>{label}</span>
        <b>
          {value} · {text}
        </b>
      </div>
      <div className="meter">
        <span className="meter-fill" style={{ width: `${value}%`, background: value < 25 ? 'var(--bad)' : value < 45 ? 'var(--warn)' : 'var(--good)' }} />
      </div>
    </div>
  );
}

/** Propostas de emprego (desempregado ou de outros clubes durante a janela). */
export function JobOffers({ state, dispatch, title }: { state: GameState; dispatch: Dispatch; title: string }) {
  const c = state.career!;
  if (c.offers.length === 0) return null;
  return (
    <Section
      title={title}
      note={c.unemployed ? 'Escolha onde começar o trabalho. A personalidade da diretoria muda a verba e a paciência.' : 'Aceitar é sair no meio do contrato: custa um pouco de reputação, mas pode ser o salto da carreira.'}
    >
      <div className="offer-grid">
        {c.offers.map((of: JobOffer, idx) => (
          <JobOfferCard key={of.clubId} state={state} offer={of} primary={c.unemployed} onAccept={() => dispatch({ t: 'job', idx })} onNegotiate={() => dispatch({ t: 'jobwage', idx })} />
        ))}
      </div>
    </Section>
  );
}

/** Tela de quem está sem clube: só as propostas. */
export function Unemployed({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const c = state.career!;
  const first = c.stints.length === 0;
  return (
    <div className="tab-stack">
      <section className="panel">
        <p className="kicker">{first ? 'Começo de carreira' : 'Sem clube'}</p>
        <h2 className="headline">{first ? `${c.name} procura o primeiro emprego` : `${c.name} está no mercado`}</h2>
        <p className="lede">
          {first
            ? 'Ninguém conhece você ainda. Só os times pequenos ligaram: escolha um e comece a escrever a história.'
            : `Reputação ${c.reputation} (${reputationText(c.reputation).toLowerCase()}). Estas diretorias querem conversar.`}
        </p>
      </section>
      <JobOffers state={state} dispatch={dispatch} title="Propostas" />
    </div>
  );
}

/** Aba Técnico (modo técnico): você, seu estilo e o esquema. */
export function CareerTab({ state, dispatch }: TabProps) {
  const c = state.career!;
  const p = state.player;
  const stars = starsFor(c.reputation);
  const edge = coachEdge(stars, p.tier);
  return (
    <div className="tab-stack">
      {c.offers.length > 0 && <JobOffers state={state} dispatch={dispatch} title="Clubes querem você" />}
      <Section title={c.name} note={`${c.age} anos · carreira até os ${CAREER_END_AGE} · contrato: ${c.contract} temporada${c.contract > 1 ? 's' : ''}`}>
        <div className="coach-card">
          <div>
            <Stars n={stars} />
            <span className="coach-style">{COACH_STYLES[p.coach.style].label}</span>
            <span className="coach-style">{p.coach.formation}</span>
            <p>
              {COACH_STYLES[p.coach.style].effect} Força {edge >= 0 ? '+' : ''}
              {edge.toFixed(2)} sobre o técnico típico da {TIERS[p.tier].name}.
            </p>
          </div>
        </div>
        <Meter value={c.reputation} label="Reputação" text={reputationText(c.reputation)} />
        <dl className="cs-numbers">
          <div>
            <dt>Salário</dt>
            <dd>{monthly(c.wage ?? p.coach.wage)}</dd>
          </div>
          <div>
            <dt>Patrimônio</dt>
            <dd>{money(c.earnings ?? 0)}</dd>
          </div>
        </dl>
        <p className="muted">Clubes que costumam te procurar: {TIERS[tierForReputation(c.reputation)].name} e vizinhos.</p>
      </Section>

    </div>
  );
}

/** Aba Diretoria (modo técnico): confiança, verba, folha, metas e o clube por dentro. */
export function BoardTab({ state, dispatch }: TabProps) {
  const c = state.career!;
  const p = state.player;
  const b = c.board;
  const info = BOARD_INFO[b.personality];
  const pay = payroll(p);
  const proj = projectFinance(state);
  const main = state.office.objectives.find((o) => o.main);
  return (
    <div className="tab-stack">
      <section className="panel">
        <p className="kicker">Diretoria {info.label.toLowerCase()}</p>
        <Meter value={b.confidence} label="Confiança no técnico" text={confidenceText(b.confidence)} />
        {main && <p className="goal-main">{main.text}</p>}
        <details className="more">
          <summary>Como funciona</summary>
          <p className="muted">{info.text} Cumprir a meta principal sobe a confiança; falhar, cair ou dar prejuízo derruba. Abaixo de 15, demissão.</p>
        </details>
      </section>

      <section className="panel">
        <p className="kicker">Verba da janela</p>
        <dl className="cs-numbers">
          <div><dt>Contratações</dt><dd className="good">{money(b.budget)}</dd></div>
          <div><dt>Folha</dt><dd className={pay > b.wageCap ? 'bad' : ''}>{money(pay)}</dd></div>
          <div><dt>Teto da folha</dt><dd>{money(b.wageCap)}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <p className="kicker">Reunião (uma por janela)</p>
        {state.office.meeting ? (
          <p className={state.office.meeting.ok ? 'good' : 'bad'}>
            {MEETING_INFO[state.office.meeting.kind].label}: {state.office.meeting.text}
          </p>
        ) : (
          <ul className="meeting-list">
            {MEETING_INFO.map((m, k) => {
              const kind = k as MeetingKind;
              const chance = Math.round(meetingChance(state, kind) * 100);
              const none = kind === 4;
              return (
                <li key={m.label} className={none ? 'meeting-none' : ''}>
                  <div>
                    <strong>{m.label}</strong>
                    <small>{m.gain}</small>
                    {!none && (
                      <small className="meeting-odds">
                        <b className={chance >= 55 ? 'good' : chance < 35 ? 'bad' : 'warnc'}>{chance}% de chance</b> · confiança −{m.cost[0]} se aceitar, −{m.cost[1]} se negar
                      </small>
                    )}
                    {none && <small className="meeting-odds good">confiança +2</small>}
                  </div>
                  <button type="button" className={`btn btn-small${none ? '' : ' btn-primary'}`} onClick={() => dispatch({ t: 'meeting', kind })}>
                    {none ? 'Escolher' : 'Pedir'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="panel more">
        <summary>O clube por dentro</summary>
        <dl className="budget">
          <div><dt>Caixa</dt><dd className={p.cash < 0 ? 'bad' : ''}>{money(p.cash)}</dd></div>
          <div><dt>Saldo previsto</dt><dd className={proj.net < 0 ? 'bad' : 'good'}>{money(proj.net)}</dd></div>
          <div><dt>Estádio</dt><dd>{num(p.capacity)} lugares</dd></div>
          <div><dt>Torcida</dt><dd>{num(p.fans)} · humor {p.mood}</dd></div>
          <div><dt>Sócios-torcedores</dt><dd>{num(socios(p))}</dd></div>
          <div><dt>Arena</dt><dd>{p.arena === 2 ? 'multiuso' : p.arena === 1 ? 'moderna' : 'não tem'}{p.naming ? ' · nome vendido' : ''}</dd></div>
          <div><dt>CT · base · médico</dt><dd>{p.facilities.ct} · {p.facilities.academy} · {p.facilities.medical}</dd></div>
        </dl>
      </details>
    </div>
  );
}

/** Ranking de técnicos: sua posição, o top 10 e quem está perto de você. */
export function CoachRankingSection({ state }: { state: GameState }) {
  const rows = coachRanking(state);
  const me = rows.find((r) => r.me)!;
  const near = rows.filter((r) => Math.abs(r.pos - me.pos) <= 2 && r.pos > 10);
  const top = rows.slice(0, 10);
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <li className={r.me ? 'is-me' : ''}>
      <span className="rk-pos">{r.pos}º</span>
      <span className="rk-name">
        {r.name}
        <small>{r.club}</small>
      </span>
      <b>{r.points}</b>
    </li>
  );
  return (
    <Section title="Ranking de técnicos" note="Pontos das últimas 5 temporadas: nível da liga, posição final, acessos e títulos.">
      <p className="rk-me">
        Você é o <b>{me.pos}º</b> de {rows.length} técnicos{me.points > 0 ? ` · ${me.points} pontos` : ''}
      </p>
      <ol className="ranking">
        {top.map((r) => (
          <Row key={r.pos} r={r} />
        ))}
        {near.length > 0 && <li className="rk-gap">…</li>}
        {near.map((r) => (
          <Row key={r.pos} r={r} />
        ))}
      </ol>
    </Section>
  );
}

/** Dança dos técnicos: quem caiu e quem assumiu nas últimas temporadas. */
export function CoachMovesSection({ state }: { state: GameState }) {
  const moves = state.coachMoves ?? [];
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1].season;
  const recent = moves.filter((m) => m.season === last);
  const free = state.freeCoaches ?? [];
  return (
    <Section title="Dança dos técnicos" note={`Mudanças no fim da temporada ${START_YEAR + last - 1}. Técnicos demitidos ficam livres e podem voltar em outro clube.`}>
      <ul className="moves">
        {recent.map((m, i) => (
          <li key={i}>{m.text}</li>
        ))}
      </ul>
      {free.length > 0 && <p className="muted">Sem clube agora: {free.slice(-8).reverse().join(', ')}{free.length > 8 ? ` e mais ${free.length - 8}` : ''}.</p>}
    </Section>
  );
}

/** Números e recordes do técnico, e a campanha em cada clube. */
export function CareerRecordSection({ state }: { state: GameState }) {
  const c = state.career!;
  const rec = c.record;
  if (!rec || rec.games === 0) return null;
  const pct = (w: number, d: number, l: number) => (w + d + l > 0 ? Math.round(((w * 3 + d) / ((w + d + l) * 3)) * 100) : 0);
  return (
    <Section title="Números e recordes" note={`${rec.games} jogos · ${rec.w}V ${rec.d}E ${rec.l}D · ${rec.gf} gols marcados · aproveitamento ${pct(rec.w, rec.d, rec.l)}%`}>
      <dl className="cs-numbers">
        <div><dt>Títulos</dt><dd>{rec.titles.length}</dd></div>
        <div><dt>Invencibilidade</dt><dd>{rec.bestUnbeaten} jogos</dd></div>
        {rec.bestWin && (
          <div>
            <dt>Maior vitória</dt>
            <dd>{rec.bestWin.gf} x {rec.bestWin.ga} <small>no {rec.bestWin.opp}</small></dd>
          </div>
        )}
      </dl>
      {rec.titles.length > 0 && <p className="muted">{rec.titles.map((t) => `${t.name} ${t.year} (${t.club})`).join(' · ')}</p>}
      <table className="table leaders">
        <thead>
          <tr><th>Clube</th><th>Período</th><th>V-E-D</th><th>%</th></tr>
        </thead>
        <tbody>
          {c.stints.map((s, i) => (
            <tr key={i}>
              <td>{s.club}</td>
              <td>{START_YEAR + s.from - 1}{s.to === null ? '–' : s.to !== s.from ? `–${START_YEAR + s.to - 1}` : ''}</td>
              <td>{s.w ?? 0}-{s.d ?? 0}-{s.l ?? 0}</td>
              <td>{pct(s.w ?? 0, s.d ?? 0, s.l ?? 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

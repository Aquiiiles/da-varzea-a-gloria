import {
  coachRanking,
  BOARD_INFO, CAREER_END_AGE, COACH_STYLES, START_YEAR, TIERS, coachEdge, payroll, projectFinance, starsFor, tierForReputation,
  type GameState, type JobOffer,
} from '../../engine';
import type { Dispatch } from '../App';
import { money, num } from '../format';
import { Stars } from './CoachTab';
import { LineupEditor } from '../LineupEditor';
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
          <JobOfferCard key={of.clubId} state={state} offer={of} primary={c.unemployed} onAccept={() => dispatch({ t: 'job', idx })} />
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
      <Section title={c.name} note={`${c.age} anos · a carreira vai até os ${CAREER_END_AGE}. Reputação abre portas: ela decide quem te quer e as suas estrelas.`}>
        <div className="coach-card">
          <div>
            <Stars n={stars} />
            <span className="coach-style">{COACH_STYLES[p.coach.style].label}</span>
            <span className="coach-style">{p.coach.formation}</span>
            <p>
              {COACH_STYLES[p.coach.style].effect} Força {edge >= 0 ? '+' : ''}
              {edge.toFixed(2)} em relação ao técnico típico da {TIERS[p.tier].name}. Contrato: {c.contract} temporada(s).
            </p>
          </div>
        </div>
        <Meter value={c.reputation} label="Reputação" text={reputationText(c.reputation)} />
        <p className="muted">Clubes que costumam te procurar: {TIERS[tierForReputation(c.reputation)].name} e vizinhos.</p>
      </Section>

      <Section title="Escalação, esquema e estratégia" note="Lesionados ficam de fora; com o rodízio, quem está muito cansado descansa.">
        <LineupEditor key={JSON.stringify(p.lineup ?? null) + p.coach.formation} state={state} dispatch={dispatch} />
      </Section>

      <CoachRankingSection state={state} />

      <Section title="Carreira">
        <ul className="career-stints">
          {c.stints
            .slice()
            .reverse()
            .map((s, i) => (
              <li key={i}>
                <i className="stint-color" style={{ background: s.colors[0] }} />
                <span>
                  <strong>{s.club}</strong>
                  <small>
                    {START_YEAR + s.from - 1}–{s.to === null ? 'hoje' : START_YEAR + s.to - 1} · {TIERS[s.tier].name}
                    {s.exit === 'demitido' ? ' · demitido' : s.exit === 'proposta' ? ' · saiu por proposta' : s.exit === 'contrato' ? ' · fim de contrato' : ''}
                  </small>
                </span>
              </li>
            ))}
        </ul>
      </Section>
    </div>
  );
}

/** Aba Diretoria (modo técnico): confiança, verba, folha, metas e o clube por dentro. */
export function BoardTab({ state }: TabProps) {
  const c = state.career!;
  const p = state.player;
  const b = c.board;
  const info = BOARD_INFO[b.personality];
  const pay = payroll(p);
  const proj = projectFinance(state);
  return (
    <div className="tab-stack">
      <Section title={`Diretoria ${info.label.toLowerCase()}`} note={info.text}>
        <Meter value={b.confidence} label="Confiança no técnico" text={confidenceText(b.confidence)} />
        <p className="muted">Cumprir a meta principal sobe a confiança; falhar, cair ou dar prejuízo derruba. Abaixo de 15, demissão.</p>
      </Section>

      <Section title="Verba da janela" note="Contratações precisam caber na verba; vender devolve metade do valor para a verba. Salários precisam caber no teto da folha.">
        <dl className="budget">
          <div><dt>Verba para contratações</dt><dd className="good">{money(b.budget)}</dd></div>
          <div><dt>Folha atual</dt><dd>{money(pay)}/ano</dd></div>
          <div><dt>Teto da folha</dt><dd className={pay > b.wageCap ? 'bad' : ''}>{money(b.wageCap)}/ano</dd></div>
          <div className="budget-total"><dt>Espaço na folha</dt><dd className={b.wageCap - pay < 0 ? 'bad' : 'good'}>{money(Math.max(0, b.wageCap - pay))}/ano</dd></div>
        </dl>
      </Section>

      <Section title="Metas da diretoria">
        <ul className="objectives">
          {state.office.objectives.map((ob, i) => (
            <li key={i} className={ob.main ? 'obj-main' : 'obj-bonus'}>
              {ob.text}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="O clube por dentro" note="Estádio, estrutura, ingresso e finanças são decididos pela diretoria.">
        <dl className="budget">
          <div><dt>Caixa</dt><dd className={p.cash < 0 ? 'bad' : ''}>{money(p.cash)}</dd></div>
          <div><dt>Saldo previsto</dt><dd className={proj.net < 0 ? 'bad' : 'good'}>{money(proj.net)}</dd></div>
          <div><dt>Estádio</dt><dd>{num(p.capacity)} lugares</dd></div>
          <div><dt>Torcida</dt><dd>{num(p.fans)} · humor {p.mood}</dd></div>
          <div><dt>CT · base · médico</dt><dd>{p.facilities.ct} · {p.facilities.academy} · {p.facilities.medical}</dd></div>
        </dl>
      </Section>
    </div>
  );
}

/** Ranking de técnicos: sua posição, o top 10 e quem está perto de você. */
function CoachRankingSection({ state }: { state: GameState }) {
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

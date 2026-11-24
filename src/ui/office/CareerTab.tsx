import {
  BOARD_INFO, CAREER_END_AGE, COACH_STYLES, START_YEAR, TIERS, coachEdge, payroll, projectFinance, starsFor, tierForReputation,
  type Formation, type GameState, type JobOffer,
} from '../../engine';
import type { Dispatch } from '../App';
import { money, num } from '../format';
import { Stars } from './CoachTab';
import { LineupEditor } from '../LineupEditor';
import type { TabProps } from './Office';
import { Section } from './common';

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1'];
const FORMATION_TEXT: Record<Formation, string> = {
  '4-4-2': '1 GOL · 4 DEF · 4 MEI · 2 ATA',
  '4-3-3': '1 GOL · 4 DEF · 3 MEI · 3 ATA',
  '3-5-2': '1 GOL · 3 DEF · 5 MEI · 2 ATA',
  '4-5-1': '1 GOL · 4 DEF · 5 MEI · 1 ATA',
};

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
      <div className="opps">
        {c.offers.map((of: JobOffer, idx) => (
          <article key={of.clubId} className="opp job-offer">
            <div>
              <strong>{of.club}</strong>
              <p>
                {TIERS[of.tier].name} · diretoria {BOARD_INFO[of.personality].label.toLowerCase()} · {of.contract} temporadas
              </p>
              <p className="muted">
                Projeto: {of.pitch}. {BOARD_INFO[of.personality].text}
              </p>
            </div>
            <button type="button" className="btn btn-small btn-primary" onClick={() => dispatch({ t: 'job', idx })}>
              Aceitar
            </button>
          </article>
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

      <Section title="Esquema tático" note="O esquema define quem joga. Você é o técnico: troque quando quiser.">
        <div className="seg formation-seg">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              className={`seg-btn${p.coach.formation === f ? ' is-on' : ''}`}
              onClick={() => p.coach.formation !== f && dispatch({ t: 'formation', f })}
            >
              <strong>{f}</strong>
              <small>{FORMATION_TEXT[f]}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Escalação" note="Marque os 11 titulares ou deixe no automático. Lesionados ficam de fora; com o rodízio, quem está muito cansado descansa.">
        <LineupEditor key={JSON.stringify(p.lineup ?? null) + p.coach.formation} state={state} dispatch={dispatch} />
      </Section>

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

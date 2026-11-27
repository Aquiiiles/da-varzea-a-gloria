import {
  COACH_STYLES, DELEGATE_INFO, STAFF_WAGE, TIERS, coachAccepts, coachEdge, coachSeverance, moraleEdge, type Coach, type DelegateArea, type Formation, type StaffRole,
} from '../../engine';
import { money } from '../format';
import type { TabProps } from './Office';
import { Section } from './common';

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1'];
const FORMATION_TEXT: Record<Formation, string> = {
  '4-4-2': '1 GOL · 4 DEF · 4 MEI · 2 ATA',
  '4-3-3': '1 GOL · 4 DEF · 3 MEI · 3 ATA',
  '3-5-2': '1 GOL · 3 DEF · 5 MEI · 2 ATA',
  '4-5-1': '1 GOL · 4 DEF · 5 MEI · 1 ATA',
  '5-3-2': '1 GOL · 5 DEF · 3 MEI · 2 ATA',
  '5-4-1': '1 GOL · 5 DEF · 4 MEI · 1 ATA',
  '3-4-3': '1 GOL · 3 DEF · 4 MEI · 3 ATA',
};

const STAFF: { id: StaffRole; name: string; effect: string; levels: string[] }[] = [
  { id: 'scout', name: 'Olheiro', effect: 'Lê o potencial com mais precisão (base, peneira e mercado).', levels: ['Ninguém', 'Olheiro de várzea', 'Rede regional', 'Rede nacional', 'Rede internacional'] },
  { id: 'fitness', name: 'Preparador físico', effect: 'Veteranos caem mais devagar.', levels: ['Ninguém', 'Preparador', 'Equipe de preparação', 'Ciência do esporte', 'Laboratório de performance'] },
];

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n + 1} de 5 estrelas`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''}>
          ★
        </i>
      ))}
    </span>
  );
}

function moraleText(m: number): string {
  if (m >= 80) return 'Empolgado';
  if (m >= 60) return 'Confiante';
  if (m >= 40) return 'Neutro';
  if (m >= 20) return 'Insatisfeito';
  return 'Por um fio';
}

function CoachCard({ c, tier, children }: { c: Coach; tier: TabProps['state']['player']['tier']; children?: React.ReactNode }) {
  const edge = coachEdge(c.rating, tier);
  return (
    <div className="coach-card">
      <div>
        <strong>{c.name}</strong>
        <Stars n={c.rating} />
        <span className="coach-style">{COACH_STYLES[c.style].label}</span>
        <span className="coach-style">{c.formation}</span>
        <p>
          {COACH_STYLES[c.style].effect} {c.age} anos · {money(c.wage)}/temp. · {c.contract} temp. de contrato · força {edge >= 0 ? '+' : ''}
          {edge.toFixed(2)} no nível
        </p>
      </div>
      {children}
    </div>
  );
}

export function CoachTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const o = state.office;
  const c = p.coach;
  const severance = coachSeverance(c);
  const mEdge = moraleEdge(c.morale);

  return (
    <div className="tab-stack">
      <Section title="Técnico" note="O esquema dele define quem joga. Atenda os pedidos para manter a moral alta: moral mexe na força do time e, no chão, ele pede demissão.">
        <CoachCard c={c} tier={p.tier} />
        <div className="moodbar">
          <div className="moodbar-head">
            <span>Moral do técnico</span>
            <b>
              {c.morale} · {moraleText(c.morale)} ({mEdge >= 0 ? '+' : ''}
              {mEdge.toFixed(2)} de força)
            </b>
          </div>
          <div className="meter">
            <span className="meter-fill" style={{ width: `${c.morale}%`, background: c.morale < 25 ? 'var(--bad)' : c.morale < 45 ? 'var(--warn)' : 'var(--good)' }} />
          </div>
        </div>
        {o.request && (
          <div className="request">
            <span className="request-label">Pedido do técnico para esta janela</span>
            <p>“{o.request.text}”</p>
          </div>
        )}
      </Section>

      <Section title="Esquema tático" note={`Trocar o esquema do técnico custa 10 de moral e só dá uma vez por janela.${o.formationChanged ? ' Já foi trocado nesta janela.' : ''}`}>
        <div className="seg formation-seg">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              className={`seg-btn${c.formation === f ? ' is-on' : ''}`}
              disabled={o.formationChanged && c.formation !== f}
              onClick={() => c.formation !== f && dispatch({ t: 'formation', f })}
            >
              <strong>{f}</strong>
              <small>{FORMATION_TEXT[f]}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Técnicos disponíveis"
        note={`Trocar de técnico custa a multa de ${money(severance)} (metade do que falta no contrato do atual). Técnico estrelado demais não aceita a ${TIERS[p.tier].name}.`}
      >
        <ul className="coaches">
          {o.coaches.map((cand, idx) =>
            cand ? (
              <li key={idx}>
                <CoachCard c={cand} tier={p.tier}>
                  {coachAccepts(cand, p.tier) ? (
                    <button type="button" className="btn btn-small" disabled={p.cash < severance} onClick={() => dispatch({ t: 'coach', idx })}>
                      Contratar
                    </button>
                  ) : (
                    <span className="done">Não aceita o clube</span>
                  )}
                </CoachCard>
              </li>
            ) : (
              <li key={idx} className="pl pl-gone">
                Contratado
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section title="Diretores (delegar)" note="Entregue uma área e o diretor cuida dela sozinho, toda temporada, na hora de jogar. Menos cliques, decisões conservadoras.">
        <ul className="delegates">
          {(Object.keys(DELEGATE_INFO) as DelegateArea[]).map((area) => (
            <li key={area}>
              <label className="toggle">
                <input type="checkbox" checked={p.delegate[area]} onChange={() => dispatch({ t: 'delegate', area })} />
                <span>
                  <strong>{DELEGATE_INFO[area].label}</strong>
                  <small>{DELEGATE_INFO[area].text}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Staff" note="Staff melhor custa salário anual. Dá para subir ou cortar a qualquer momento da janela.">
        <ul className="facilities">
          {STAFF.map((s) => {
            const lvl = p.staff[s.id];
            return (
              <li key={s.id} className="facility">
                <div>
                  <strong>
                    {s.name}: {s.levels[lvl]}
                  </strong>
                  <span className="pips" aria-label={`nível ${lvl} de 4`}>
                    {[0, 1, 2, 3].map((i) => (
                      <i key={i} className={i < lvl ? 'on' : ''} />
                    ))}
                  </span>
                  <p>
                    {s.effect} Salário atual: {money(STAFF_WAGE[lvl])}/temp.
                  </p>
                </div>
                <div className="stepper">
                  <button type="button" className="btn btn-small" disabled={lvl === 0} onClick={() => dispatch({ t: 'staff', which: s.id, dir: -1 })} aria-label={`Cortar ${s.name}`}>
                    −
                  </button>
                  <button type="button" className="btn btn-small" disabled={lvl >= 4} onClick={() => dispatch({ t: 'staff', which: s.id, dir: 1 })}>
                    {lvl < 4 ? `+ (${money(STAFF_WAGE[lvl + 1])}/temp.)` : 'Máx.'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

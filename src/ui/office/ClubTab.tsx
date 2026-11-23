import { ORIGINS, STAFF_WAGE, loanFor, masterSponsor, type StaffRole } from '../../engine';
import { money, num } from '../format';
import type { TabProps } from './Office';
import { Section } from './common';

const STAFF: { id: StaffRole; name: string; effect: string; levels: string[] }[] = [
  { id: 'coach', name: 'Técnico', effect: '+0,5 de força por nível em todos os jogos.', levels: ['Ex-jogador do bairro', 'Técnico licenciado', 'Técnico experiente', 'Técnico de ponta', 'Técnico de seleção'] },
  { id: 'scout', name: 'Olheiro', effect: 'Lê o potencial com mais precisão (base, peneira e mercado).', levels: ['Ninguém', 'Olheiro de várzea', 'Rede regional', 'Rede nacional', 'Rede internacional'] },
  { id: 'fitness', name: 'Preparador físico', effect: 'Veteranos caem mais devagar.', levels: ['Ninguém', 'Preparador', 'Equipe de preparação', 'Ciência do esporte', 'Laboratório de performance'] },
];

export function ClubTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const o = state.office;
  const loans = p.sponsors.filter((s) => s.perSeason < 0).length;

  return (
    <div className="tab-stack">
      <Section title="Comissão técnica" note="Staff melhor custa salário anual. Dá para subir ou cortar a qualquer momento da janela.">
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

      <Section title="Patrocínios e dívidas">
        <ul className="ledger">
          <li>
            <span>Patrocínio master (divisão, torcida e hype)</span>
            <b className="good">{money(masterSponsor(p, p.tier))}/temp.</b>
          </li>
          {p.sponsors.map((s, i) => (
            <li key={i}>
              <span>
                {s.name} {s.seasonsLeft === null ? '(permanente)' : `(${s.seasonsLeft} temp.)`}
              </span>
              <b className={s.perSeason >= 0 ? 'good' : 'bad'}>{money(s.perSeason)}/temp.</b>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Banco" note="Empréstimo com 30% de juros, pago em 3 parcelas. No máximo dois ativos e um por temporada.">
        <div className="build-grid">
          {([0, 1] as const).map((size) => {
            const l = loanFor(p.tier, size);
            return (
              <button key={size} type="button" className="build" disabled={o.built.loan || loans >= 2} onClick={() => dispatch({ t: 'loan', size })}>
                <strong>{size === 0 ? 'Empréstimo pequeno' : 'Empréstimo grande'}</strong>
                <span className="good">+{money(l.amount)} agora</span>
                <b className="bad">{money(l.perSeason)}/temp. x3</b>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Identidade">
        <dl className="budget">
          <div><dt>Origem</dt><dd>{ORIGINS[p.origin].label}</dd></div>
          <div><dt>Alma do clube</dt><dd className={p.soul < 30 ? 'bad' : ''}>{Math.round(p.soul)}/100</dd></div>
          <div><dt>Hype</dt><dd>{Math.round(p.hype)}/100</dd></div>
          <div><dt>Torcida</dt><dd>{num(p.fans)}</dd></div>
          <div><dt>Ódio do clássico</dt><dd>{Math.round(p.rivalHatred)}/100</dd></div>
        </dl>
      </Section>
    </div>
  );
}

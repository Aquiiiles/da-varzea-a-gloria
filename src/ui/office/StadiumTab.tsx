import {
  ARENA,
  BUSINESSES, expectedHomeGames, FACILITY_COST, SEAT_PACKS, STADIUM_FINANCE, STADIUM_INSTALLMENT_NAME, TIERS, attendance, commerce, seatsFor, stadiumAllows, type Facility, type Tier,
} from '../../engine';
import { money, num } from '../format';
import type { TabProps } from './Office';
import { Section } from './common';

const FACILITIES: { id: Facility; name: string; effect: string }[] = [
  { id: 'ct', name: 'Centro de treinamento', effect: 'Jogadores até 26 anos evoluem mais rápido.' },
  { id: 'academy', name: 'Categorias de base', effect: 'Mais garotos por temporada, com mais potencial e evolução mais rápida na base.' },
  { id: 'medical', name: 'Departamento médico', effect: 'Menos lesões: o time oscila menos ao longo da temporada.' },
];

export function StadiumTab({ state, dispatch }: TabProps) {
  const p = state.player;
  const o = state.office;
  const total = p.capacity + p.capacityBuilding;
  const financing = p.sponsors.some((s) => s.name === STADIUM_INSTALLMENT_NAME);
  const next = (p.tier > 1 ? p.tier - 1 : 1) as Tier;
  const ok = p.tier === 1 || stadiumAllows(total, next);
  const att = attendance(p);
  const homeGames = expectedHomeGames(p);
  const idolGoals = Math.max(0, ...p.squad.map((f) => f.goals));
  const shop = commerce(p, att, homeGames, idolGoals);

  return (
    <div className="tab-stack">
      <Section
        title="Estádio"
        note={
          p.tier === 1 ? (
            'Você está na Série A. Estádio maior = mais bilheteria.'
          ) : (
            <>
              Para subir para a <strong>{TIERS[next].name}</strong>, o regulamento exige <strong>{num(TIERS[next].minStadium)} lugares</strong>. As obras ficam
              prontas no fim da temporada e já contam na vistoria do acesso.
            </>
          )
        }
      >
        <div className="stadium-meter">
          <div className="meter">
            <span className="meter-fill" style={{ width: `${Math.min(100, (p.capacity / Math.max(1, TIERS[next].minStadium || p.capacity)) * 100)}%` }} />
            {p.capacityBuilding > 0 && (
              <span
                className="meter-build"
                style={{ width: `${Math.min(100, (p.capacityBuilding / Math.max(1, TIERS[next].minStadium || total)) * 100)}%` }}
              />
            )}
          </div>
          <p className={ok ? 'good' : 'bad'}>
            {num(p.capacity)} lugares{p.capacityBuilding > 0 ? ` + ${num(p.capacityBuilding)} em obras` : ''}
            {p.tier > 1 ? ` · exigido: ${num(TIERS[next].minStadium)}` : ''}
          </p>
          <p className="muted">
            Público médio previsto: {num(att)} ({Math.round((att / Math.max(1, p.capacity)) * 100)}% de ocupação) · torcida: {num(p.fans)}
          </p>
        </div>

        <div className="build-grid">
          {SEAT_PACKS.map((pack, i) => {
            const { seats, cost, down, perSeason } = seatsFor(total, i as 0 | 1 | 2);
            const size = i as 0 | 1 | 2;
            return (
              <div key={pack.label} className="build build-card">
                <strong>{pack.label}</strong>
                <span>+{num(seats)} lugares</span>
                <button type="button" className="btn btn-small" disabled={o.built.seats || p.cash < cost} onClick={() => dispatch({ t: 'seats', size })}>
                  À vista: {money(cost)}
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={o.built.seats || financing || p.cash < down}
                  onClick={() => dispatch({ t: 'seats', size, financed: true })}
                >
                  Parcelado: {money(down)} + {STADIUM_FINANCE.seasons}× {money(perSeason)}
                </button>
              </div>
            );
          })}
        </div>
        <p className="muted">
          Parcelado: entrada de {Math.round(STADIUM_FINANCE.down * 100)}% e o resto com {Math.round(STADIUM_FINANCE.interest * 100)}% de juros em{' '}
          {STADIUM_FINANCE.seasons} parcelas anuais (a primeira já nesta temporada). Uma obra parcelada por vez.
        </p>
        {financing && <p className="muted">Ainda há uma obra parcelada sendo paga: só dá para construir à vista.</p>}
        {o.built.seats && <p className="muted">Já há uma obra no estádio nesta temporada.</p>}
      </Section>


      <Section title="Estrutura" note={`Uma obra de estrutura por temporada. Cada nível custa manutenção anual de 10% do investido.${o.built.facility ? ' A obra desta temporada já foi feita.' : ''}`}>
        <ul className="facilities">
          {FACILITIES.map((f) => {
            const level = p.facilities[f.id];
            const cost = level < 5 ? FACILITY_COST[level] : 0;
            return (
              <li key={f.id} className="facility">
                <div>
                  <strong>{f.name}</strong>
                  <span className="pips" aria-label={`nível ${level} de 5`}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <i key={i} className={i < level ? 'on' : ''} />
                    ))}
                  </span>
                  <p>{f.effect}</p>
                </div>
                {level < 5 ? (
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={o.built.facility || p.cash < cost}
                    onClick={() => dispatch({ t: 'facility', which: f.id })}
                  >
                    Nível {level + 1}: {money(cost)}
                  </button>
                ) : (
                  <span className="done">Máximo</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Comércio local"
        note={`Negócios do clube rendem todo ano conforme público, torcida e hype. Um investimento por temporada; manutenção de 8% do investido.${o.built.business ? ' O investimento desta temporada já foi feito.' : ''}`}
      >
        <p className="muted">
          Receita prevista do comércio: <strong className="good">{money(shop.revenue)}/temp.</strong> · manutenção {money(shop.upkeep)}/temp.
        </p>
        <ul className="facilities">
          {BUSINESSES.map((b) => {
            const level = p.businesses[b.id];
            const cost = level < 3 ? b.cost[level] : 0;
            return (
              <li key={b.id} className="facility">
                <div>
                  <strong>{b.name}</strong>
                  <span className="pips" aria-label={`nível ${level} de 3`}>
                    {[0, 1, 2].map((i) => (
                      <i key={i} className={i < level ? 'on' : ''} />
                    ))}
                  </span>
                  <p>
                    {b.text} {level > 0 && <span className="good">Rende {money(shop.byBusiness[b.id])}/temp.</span>}
                  </p>
                </div>
                {level < 3 ? (
                  <button type="button" className="btn btn-small" disabled={o.built.business || p.cash < cost} onClick={() => dispatch({ t: 'business', which: b.id })}>
                    {level === 0 ? 'Abrir' : `Nível ${level + 1}`}: {money(cost)}
                  </button>
                ) : (
                  <span className="done">Máximo</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      <Section
        title="Grandes projetos"
        note={p.tier > 2 ? 'Projetos de clube grande: liberados a partir da Série B.' : 'Investimentos pesados para quem tem caixa: rendem por muitas temporadas.'}
      >
        <ul className="facilities">
          {(['arena', 'multiuso', 'naming'] as const).map((k) => {
            const info = ARENA[k];
            const done = k === 'arena' ? !!p.arena : k === 'multiuso' ? p.arena === 2 : !!p.naming;
            const locked = p.tier > 2 || (k === 'multiuso' && p.arena !== 1) || (k === 'naming' && !p.arena);
            const cost = 'cost' in info ? info.cost : 0;
            return (
              <li key={k} className="facility">
                <div>
                  <strong>{info.label}</strong>
                  <p>{info.text}</p>
                </div>
                {done ? (
                  <span className="done">Feito</span>
                ) : (
                  <button type="button" className="btn btn-small" disabled={locked || p.cash < cost} onClick={() => dispatch({ t: 'project', which: k })}>
                    {cost > 0 ? money(cost) : 'Vender o nome'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

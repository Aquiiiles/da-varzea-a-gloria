import { useState } from 'react';
import {
  START_YEAR, STYLE_TACTIC, TACTICS, hangingAt, injuredAt, suspendedOn, julyWindow, nextMatchAfter, offerOpen, opponentInfo, outcomeOf, playedMatches, teamStrength, weekdayOf,
  type GameState, type Tactic,
} from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { money } from '../format';
import { InterviewCard } from '../InterviewCard';
import { OverviewTab } from '../office/OverviewTab';
import type { TabId } from '../office/Office';
import { MatchRow, SquadStatus, shortDate } from '../SeasonView';

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  state: GameState;
  dispatch: Dispatch;
  goTo: (t: TabId) => void;
  onPlayRound: () => void;
  onFast: () => void;
}

/** Aba Jogo: pré-temporada (escritório) ou o próximo jogo (pré-jogo) com o botão de jogar a rodada. */
export function MatchCenter(props: Props) {
  const { state } = props;
  const running = state.phase === 'season' && !!state.live && !!state.calendar && state.reveal != null;
  return running ? <Matchday {...props} /> : <Preseason {...props} />;
}

function Preseason({ state, dispatch, goTo, onFast }: Props) {
  return (
    <>
      <OverviewTab state={state} dispatch={dispatch} goTo={goTo} />
      <div className="playbar coach-playbar">
        <button type="button" className="btn" onClick={() => dispatch({ t: 'auto' })} title="O auxiliar faz contratações, renovações e cuida da base">
          Auxiliar decide
        </button>
        <button type="button" className="btn" onClick={onFast} title="O auxiliar gere e joga até algo decisivo">
          Rápido
        </button>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ t: 'play' })}>
          Começar {START_YEAR + state.season - 1}
        </button>
      </div>
    </>
  );
}

function Form({ form }: { form: ('V' | 'E' | 'D')[] }) {
  if (form.length === 0) return <span className="muted">sem jogos</span>;
  return (
    <span className="form-chips">
      {form.map((r, i) => (
        <i key={i} className={`res-badge res-${r}`}>
          {r}
        </i>
      ))}
    </span>
  );
}

function Matchday({ state, dispatch, goTo, onPlayRound }: Props) {
  const p = state.player;
  const cal = state.calendar!;
  const day = state.reveal!;
  const live = state.live!;
  const next = nextMatchAfter(state, day);
  const played = playedMatches(cal, day);
  const last = played.at(-1);
  const [open, close] = julyWindow(cal.year);
  const windowOpen = day >= open && day <= close;
  const lastMinute = state.office.offers.filter((of): of is NonNullable<typeof of> => !!of && !!of.july && offerOpen(state, of));
  const [menu, setMenu] = useState(false);

  const opp = next ? opponentInfo(state, next) : null;
  const mine = teamStrength(state);
  const out = next ? [...injuredAt(live, next.day), ...suspendedOn(live, next.day).map((s) => ({ ...s, susp: true }))] : [];
  const hanging = next ? hangingAt(live, day).filter((h) => !out.some((o) => o.id === h.id)) : [];
  const tactic: Tactic = p.tactic ?? STYLE_TACTIC[p.coach.style];
  const myForm = played.slice(-5).map(outcomeOf);
  // a janela de julho para antes do próximo jogo
  const stopsAtWindow = !!next && day < open && next.day > open;

  return (
    <div className="tab-stack">
      {next && opp ? (
        <section className="panel prematch">
          <p className="kicker">
            {next.comp} · {next.round}
          </p>
          <p className="pm-date">
            {WEEKDAY[weekdayOf(cal.year, next.day)]}, {shortDate(cal.year, next.day)} · {next.home ? 'em casa' : 'fora de casa'}
          </p>
          <div className="pm-teams">
            <div className="pm-team">
              <Crest name={p.name} short={p.short} colors={p.colors} size={56} />
              <strong>{p.name}</strong>
              <Form form={myForm} />
            </div>
            <span className="pm-x">x</span>
            <div className="pm-team">
              <Crest name={opp.name} short={opp.club?.short ?? opp.name.slice(0, 3).toUpperCase()} colors={opp.club?.colors ?? ['#444444', '#ffffff']} size={56} />
              <strong>{opp.name}</strong>
              <Form form={opp.form} />
            </div>
          </div>
          {opp.strength !== null && <StrengthBar me={mine} them={opp.strength} />}
          <dl className="pm-facts">
            {opp.pos ? (
              <div>
                <dt>Adversário</dt>
                <dd>
                  {opp.pos}º de {opp.of}
                </dd>
              </div>
            ) : null}
            {opp.star && (
              <div>
                <dt>Destaque deles</dt>
                <dd>
                  {opp.star.name} <small>({opp.star.pos}, {opp.star.ovr})</small>
                </dd>
              </div>
            )}
            <div>
              <dt>Desfalques</dt>
              <dd className={out.length > 0 ? 'bad' : ''}>
                {out.length > 0 ? out.map((i) => `${i.name.split(' ').slice(-1)[0]}${'susp' in i ? ' (suspenso)' : ''}`).join(', ') : 'nenhum'}
              </dd>
            </div>
            {hanging.length > 0 && (
              <div>
                <dt>Pendurados</dt>
                <dd className="warnc">{hanging.map((h) => h.name.split(' ').slice(-1)[0]).join(', ')}</dd>
              </div>
            )}
          </dl>
          <div className="pm-tactic">
            <span className="muted">Estratégia</span>
            <div className="seg seg-compact tactic-seg">
              {(Object.keys(TACTICS) as Tactic[]).map((t) => (
                <button key={t} type="button" className={`seg-btn${tactic === t ? ' is-on' : ''}`} onClick={() => tactic !== t && dispatch({ t: 'tactic', v: t })}>
                  {TACTICS[t].label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="link" onClick={() => goTo('elenco')}>
            Escalação: {p.lineup?.ids ? 'escolhida por você' : 'automática'} ({p.coach.formation})
          </button>
          {stopsAtWindow && <p className="muted">Antes desse jogo abre a janela de julho ({shortDate(cal.year, open)}).</p>}
        </section>
      ) : (
        <section className="panel">
          <p className="kicker">Fim dos jogos</p>
          <p className="lede">Seus jogos da temporada acabaram. Encerre a temporada para ver o balanço e os prêmios.</p>
        </section>
      )}

      {windowOpen && (
        <section className="panel window-banner">
          <p className="kicker">Janela do meio do ano · até {shortDate(cal.year, close)}</p>
          <p className="lede">Dá para contratar e vender. Quem chegar joga a partir do próximo jogo.</p>
          {lastMinute.length > 0 && (
            <p className="window-alert">
              Última hora: {lastMinute.map((of) => `${of.club} quer ${p.squad.find((f) => f.id === of.playerId)?.name ?? 'um jogador'} por ${money(of.fee)}`).join('; ')}.
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => goTo('mercado')}>
            Abrir o mercado
          </button>
        </section>
      )}

      <InterviewCard state={state} dispatch={dispatch} />

      {last && (
        <section className="panel">
          <p className="kicker">Último jogo</p>
          <ul className="cal-list">
            <MatchRow m={last} year={cal.year} played />
          </ul>
        </section>
      )}

      <SquadStatus state={state} day={day} />

      <div className="playbar coach-playbar">
        <div className="sim-menu">
          <button type="button" className="btn" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            Simular
          </button>
          {menu && (
            <div className="sim-pop" role="menu">
              <button type="button" role="menuitem" onClick={() => (setMenu(false), dispatch({ t: 'advance', to: 2 }))}>
                Até o fim do mês
              </button>
              <button type="button" role="menuitem" onClick={() => (setMenu(false), dispatch({ t: 'advance', to: 3 }))}>
                Até o fim da temporada
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={next ? onPlayRound : () => dispatch({ t: 'advance', to: 3 })}>
          {next ? (stopsAtWindow ? 'Ir para a janela' : 'Jogar rodada') : 'Encerrar temporada'}
        </button>
      </div>
    </div>
  );
}

/** Comparação de força (o seu time em cima). */
function StrengthBar({ me, them }: { me: number; them: number }) {
  const diff = me - them;
  const pct = Math.round(Math.max(10, Math.min(90, 50 + diff * 6)));
  const label = diff >= 3 ? 'Favorito' : diff >= 1 ? 'Leve favorito' : diff > -1 ? 'Equilibrado' : diff > -3 ? 'Leve azarão' : 'Azarão';
  return (
    <div className="pm-strength">
      <div className="pm-sbar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="pm-slabel">
        <b>{me.toFixed(1)}</b>
        <span className={diff >= 1 ? 'good' : diff <= -1 ? 'bad' : 'muted'}>{label}</span>
        <b>{them.toFixed(1)}</b>
      </div>
    </div>
  );
}

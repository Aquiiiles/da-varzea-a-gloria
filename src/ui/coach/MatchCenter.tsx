import { useState } from 'react';
import {
  START_YEAR, STYLE_TACTIC, TACTICS, TRAINING, YOUTH_AGE_LIMIT, hangingAt, injuredAt, isDecisive, julyWindow, moodLabel, nextMatchAfter, offerOpen,
  opponentInfo, outcomeOf, playedMatches, rivalName, suspendedOn, teamStrength, ultimatumStatus, weekdayOf,
  type GameState,
} from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { money } from '../format';
import { InterviewCard } from '../InterviewCard';
import { JobOfferCard } from '../office/OfferCards';
import { shortDate } from '../SeasonView';
import { allNews } from '../news';
import type { Go } from './CoachShell';

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  state: GameState;
  dispatch: Dispatch;
  go: Go;
  onPlayRound: () => void;
  onFast: () => void;
}

/** Aba Jogar: o que fazer agora. Pendências em uma linha cada, o próximo jogo e o botão de jogar. */
export function MatchCenter(props: Props) {
  const { state } = props;
  const running = state.phase === 'season' && !!state.live && !!state.calendar && state.reveal != null;
  return running ? <Matchday {...props} /> : <Preseason {...props} />;
}

/** Pendência: uma linha curta com o atalho para resolver. */
function Todo({ title, text, action, onClick, tone }: { title: string; text?: string; action: string; onClick: () => void; tone?: 'bad' | 'warn' | 'good' }) {
  return (
    <li className={`todo${tone ? ` todo-${tone}` : ''}`}>
      <div>
        <strong>{title}</strong>
        {text && <small>{text}</small>}
      </div>
      <button type="button" className="btn btn-small" onClick={onClick}>
        {action}
      </button>
    </li>
  );
}

/** Manchete do jornal (atalho para Competições > Jornal). */
function Headline({ state, go }: { state: GameState; go: Go }) {
  const all = allNews(state);
  const n = all.find((x) => x.hot) ?? all[0];
  if (!n) return null;
  return (
    <button type="button" className="headline-link" onClick={() => go('competicoes', 'jornal')}>
      <span className="np-kicker">Gazeta da Bola</span>
      <span>{n.title}</span>
    </button>
  );
}

/** Linha "como o time vai jogar": esquema, estratégia, treino e escalação (tudo em Time > Preparar). */
function PlanLine({ state, go }: { state: GameState; go: Go }) {
  const p = state.player;
  return (
    <button type="button" className="plan-line" onClick={() => go('time', 'preparar')}>
      <span>
        {p.coach.formation} · {TACTICS[p.tactic ?? STYLE_TACTIC[p.coach.style]].label} · treino {TRAINING[p.training ?? 'equilibrado'].label.toLowerCase()} · escalação{' '}
        {p.lineup?.ids ? 'sua' : 'automática'}
      </span>
      <b>Preparar</b>
    </button>
  );
}

function Preseason({ state, dispatch, go, onFast }: Props) {
  const p = state.player;
  const o = state.office;
  const c = state.career!;
  const offers = o.offers.filter((x) => x && offerOpen(state, x));
  const leaving = p.squad.filter((f) => f.intent === 'aposenta' || (f.contract === 1 && (f.intent === 'sai' || f.intent === 'clube_maior')));
  const aging = p.youth.filter((y) => y.age >= YOUTH_AGE_LIMIT);
  const main = o.objectives.find((x) => x.main);
  return (
    <div className="tab-stack">
      <section className="panel goals">
        <p className="kicker">Temporada {START_YEAR + state.season - 1}</p>
        {main && <p className="goal-main">{main.text}</p>}
        <small className="muted">
          Torcida {p.mood}/100 · {moodLabel(p.mood)} · verba {money(c.board.budget)}
        </small>
      </section>

      {o.extraordinary && (
        <section className={`panel extra ${o.extraordinary.good ? 'extra-good' : 'extra-bad'}`}>
          <p className="kicker">Extraordinário</p>
          <h2 className="headline">{o.extraordinary.title}</h2>
          <p className="lede">{o.extraordinary.text}</p>
        </section>
      )}

      <PlanLine state={state} go={go} />

      <ul className="todos">
        {c.offers.length > 0 && <Todo title={`${c.offers.length} clube${c.offers.length > 1 ? 's querem' : ' quer'} você`} action="Ver" onClick={() => go('carreira', 'voce')} tone="good" />}
        {offers.length > 0 && <Todo title={`${offers.length} proposta${offers.length > 1 ? 's' : ''} pelos seus jogadores`} action="Ver" onClick={() => go('mercado', 'propostas')} tone="warn" />}
        {leaving.length > 0 && <Todo title={`${leaving.length} saída${leaving.length > 1 ? 's' : ''} no fim do ano`} text={leaving.map((f) => f.name.split(' ').slice(-1)[0]).join(', ')} action="Elenco" onClick={() => go('time', 'elenco')} tone="bad" />}
        {aging.length > 0 && <Todo title={`${aging.length} garoto${aging.length > 1 ? 's' : ''} no limite da base`} action="Base" onClick={() => go('time', 'base')} tone="warn" />}
        {!o.meeting && <Todo title="Reunião com a diretoria" action="Diretoria" onClick={() => go('carreira', 'diretoria')} />}
      </ul>

      <Headline state={state} go={go} />

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
    </div>
  );
}

function Form({ form }: { form: ('V' | 'E' | 'D')[] }) {
  if (form.length === 0) return null;
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

function Matchday({ state, dispatch, go, onPlayRound }: Props) {
  const p = state.player;
  const cal = state.calendar!;
  const day = state.reveal!;
  const live = state.live!;
  const c = state.career!;
  const next = nextMatchAfter(state, day);
  const played = playedMatches(cal, day);
  const last = played.at(-1);
  const [open, close] = julyWindow(cal.year);
  const windowOpen = day >= open && day <= close;
  const offers = state.office.offers.filter((of) => of && offerOpen(state, of));
  const [menu, setMenu] = useState(false);

  const opp = next ? opponentInfo(state, next) : null;
  const mine = teamStrength(state);
  const out = next ? [...injuredAt(live, next.day).map((i) => i.name), ...suspendedOn(live, next.day).map((s) => `${s.name} (susp.)`)] : [];
  const hanging = next ? hangingAt(live, day) : [];
  const myForm = played.slice(-5).map(outcomeOf);
  const stopsAtWindow = !!next && day < open && next.day > open;
  const ult = ultimatumStatus(state);
  const mid = c.midOffer;
  const showMid = !!mid && !mid.answered && day <= mid.until;
  const broken = (live.broken ?? []).filter((b) => b.day <= day && day - b.day <= 14);
  const derby = !!next && next.opponent === rivalName(state);
  const final = !!next && isDecisive(next);
  const hasTodos = (ult?.need ?? 0) > 0 || broken.length > 0 || windowOpen || offers.length > 0;

  return (
    <div className="tab-stack">
      {/* pendências: só o que pede ação agora */}
      {hasTodos && (
        <ul className="todos">
          {ult && ult.need > 0 && (
            <li className="todo todo-bad">
              <div>
                <strong>Ultimato da diretoria</strong>
                <small>
                  {ult.need === 1 ? 'Uma vitória' : `${ult.need} vitórias`} nos próximos {ult.left} jogos, ou demissão.
                </small>
              </div>
            </li>
          )}
          {broken.map((b) => (
            <Todo key={`${b.id}-${b.day}`} title={`${b.name.split(' ').slice(-1)[0]} reclama`} text="Promessa de vaga não cumprida" action="Elenco" onClick={() => go('time', 'elenco')} tone="bad" />
          ))}
          {windowOpen && <Todo title="Janela aberta" text={`Até ${shortDate(cal.year, close)}`} action="Mercado" onClick={() => go('mercado', 'janela')} tone="good" />}
          {offers.length > 0 && <Todo title={`${offers.length} proposta${offers.length > 1 ? 's' : ''} pelos seus jogadores`} action="Ver" onClick={() => go('mercado', 'propostas')} tone="warn" />}
        </ul>
      )}

      {showMid && (
        <section className="panel">
          <p className="kicker">Sondagem para o ano que vem</p>
          <JobOfferCard state={state} offer={mid!.offer} primary onAccept={() => dispatch({ t: 'precontract', accept: true })} />
          <button type="button" className="btn btn-danger" onClick={() => dispatch({ t: 'precontract', accept: false })}>
            Recusar e ficar
          </button>
        </section>
      )}

      {next && opp ? (
        <section className={`panel prematch${derby ? ' is-derby' : final ? ' is-final' : ''}`}>
          {derby ? <p className="pm-badge">Clássico</p> : final ? <p className="pm-badge">Decisão · {next.round.split(' · ')[0]}</p> : null}
          <p className="kicker">
            {next.comp} · {next.round}
          </p>
          <p className="pm-date">
            {WEEKDAY[weekdayOf(cal.year, next.day)]}, {shortDate(cal.year, next.day)} · {next.home ? 'em casa' : 'fora'}
            {opp.pos ? ` · adversário ${opp.pos}º` : ''}
          </p>
          <div className="pm-teams">
            <div className="pm-team">
              <Crest name={p.name} short={p.short} colors={p.colors} size={52} />
              <strong>{p.name}</strong>
              <Form form={myForm} />
            </div>
            <span className="pm-x">x</span>
            <div className="pm-team">
              <Crest name={opp.name} short={opp.club?.short ?? opp.name.slice(0, 3).toUpperCase()} colors={opp.club?.colors ?? ['#444444', '#ffffff']} size={52} />
              <strong>{opp.name}</strong>
              <Form form={opp.form} />
            </div>
          </div>
          {opp.strength !== null && <StrengthBar me={mine} them={opp.strength} />}
          {(out.length > 0 || hanging.length > 0) && (
            <p className="pm-out">
              {out.length > 0 && <span className="bad">Fora: {out.map((n) => n.split(' ').slice(-1)[0]).join(', ')}</span>}
              {hanging.length > 0 && <span className="warnc"> · Pendurados: {hanging.map((h) => h.name.split(' ').slice(-1)[0]).join(', ')}</span>}
            </p>
          )}
          <PlanLine state={state} go={go} />
          {stopsAtWindow && <p className="muted">Antes desse jogo abre a janela de julho.</p>}
        </section>
      ) : (
        <section className="panel">
          <p className="kicker">Fim dos jogos</p>
          <p className="lede">Encerre a temporada para ver o balanço.</p>
        </section>
      )}

      <InterviewCard state={state} dispatch={dispatch} />

      {last && (
        <p className="last-line">
          Último jogo: {last.home ? 'x' : '@'} {last.opponent}{' '}
          <b className={`res-${outcomeOf(last)}`}>
            {last.gf} x {last.ga}
          </b>
        </p>
      )}

      <Headline state={state} go={go} />

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

/** Comparação de força (o seu time à esquerda). */
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

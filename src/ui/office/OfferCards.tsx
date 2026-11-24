import { useState } from 'react';
import { BOARD_INFO, TIERS, marketValue, playerImportance, type Footballer, type GameState, type JobOffer, type Offer } from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { money, monthly, num, potLabel } from '../format';
import { INTENT_LABEL } from './SquadTab';

/** Proposta de emprego: escudo, série, diretoria, projeto e como é o clube por dentro. */
export function JobOfferCard({ state, offer, onAccept, primary }: { state: GameState; offer: JobOffer; onAccept: () => void; primary?: boolean }) {
  const club = state.clubs.find((c) => c.id === offer.clubId);
  const r = TIERS[offer.tier];
  const info = BOARD_INFO[offer.personality];
  const strength = club?.strength ?? r.meanStrength;
  const diff = strength - r.meanStrength;
  return (
    <article className="offer-card">
      <header className="offer-head">
        <Crest name={offer.club} short={club?.short ?? offer.club.slice(0, 3).toUpperCase()} colors={club?.colors ?? ['#444444', '#ffffff']} size={52} />
        <div className="offer-title">
          <strong>{offer.club}</strong>
          <span className="offer-badges">
            <span className="badge">{r.name}</span>
            <span className={`badge badge-${offer.personality}`}>Diretoria {info.label.toLowerCase()}</span>
          </span>
        </div>
      </header>
      <p className="offer-pitch">{offer.pitch}</p>
      <dl className="offer-facts">
        <div>
          <dt>Elenco</dt>
          <dd className={diff >= 1 ? 'good' : diff <= -1.5 ? 'bad' : ''}>
            {strength.toFixed(1)} <small>({diff >= 0 ? '+' : ''}{diff.toFixed(1)} na série)</small>
          </dd>
        </div>
        <div>
          <dt>Contrato</dt>
          <dd>{offer.contract} temporadas</dd>
        </div>
        <div>
          <dt>Torcida típica</dt>
          <dd>{num(r.typicalFans)}</dd>
        </div>
      </dl>
      <p className="offer-note">{info.text}</p>
      <button type="button" className={`btn${primary ? ' btn-primary' : ''} offer-cta`} onClick={onAccept}>
        Aceitar a proposta
      </button>
    </article>
  );
}

/** Perfil do jogador na negociação: o quanto ele pesa no time e os dados dele no clube. */
function PlayerProfile({ state, f }: { state: GameState; f: Footballer }) {
  const p = state.player;
  const imp = playerImportance(p.squad, p.coach.formation, f.id);
  const tone = imp.label === 'Peça-chave' ? 'bad' : imp.label === 'Titular importante' ? 'warnc' : imp.starter ? '' : 'good';
  return (
    <div className="player-profile">
      <div className="pp-head">
        <span className={`pp-role ${tone}`}>{imp.label}</span>
        <span className="muted">
          {imp.rank}º do elenco · {imp.posRank}º de {imp.posCount} {f.pos === 'GOL' ? 'goleiros' : f.pos === 'DEF' ? 'defensores' : f.pos === 'MEI' ? 'meias' : 'atacantes'}
        </span>
      </div>
      <p className="pp-impact">
        {imp.delta > 0 ? (
          <>
            Sem ele, o time perde <b className={imp.delta >= 1 ? 'bad' : ''}>{imp.delta.toFixed(1)}</b> de força
            {imp.replacement ? (
              <>
                {' '}
                e quem entra é <b>{imp.replacement.name}</b> ({imp.replacement.ovr}).
              </>
            ) : (
              '.'
            )}
          </>
        ) : (
          'A saída dele não muda a força do time.'
        )}
      </p>
      <dl className="pp-facts">
        <div><dt>Idade</dt><dd>{f.age}</dd></div>
        <div><dt>Potencial</dt><dd>{potLabel(f)}</dd></div>
        <div><dt>Contrato</dt><dd>{f.contract} temp.</dd></div>
        <div><dt>Salário</dt><dd>{monthly(f.wage)}</dd></div>
        <div><dt>Pelo clube</dt><dd>{f.apps} jogos · {f.goals} gols</dd></div>
        <div><dt>Origem</dt><dd>{f.homegrown ? 'cria da base' : 'contratado'}</dd></div>
      </dl>
      {f.intent && <p className={`pp-intent ${INTENT_LABEL[f.intent].tone}`}>Contrato: {INTENT_LABEL[f.intent].text}</p>}
    </div>
  );
}

/** Proposta por um jogador do elenco: aceitar, negociar (pedir mais) ou recusar. */
export function SaleOfferCard({ state, offer, f, idx, dispatch, disabled }: { state: GameState; offer: Offer; f: Footballer; idx: number; dispatch: Dispatch; disabled: boolean }) {
  const buyer = state.clubs.find((c) => c.name === offer.club);
  const value = marketValue(f);
  const ratio = offer.fee / Math.max(1, value);
  const tone = ratio >= 1.2 ? 'good' : ratio < 0.9 ? 'bad' : '';
  const label = ratio >= 1.2 ? `${Math.round((ratio - 1) * 100)}% acima do valor` : ratio < 0.9 ? `${Math.round((1 - ratio) * 100)}% abaixo do valor` : 'perto do valor';
  const [asking, setAsking] = useState(false);
  const [profile, setProfile] = useState(false);
  const [ask, setAsk] = useState(() => Math.round(Math.max(offer.fee * 1.2, value)));
  const scale = Math.max(offer.fee, value * 1.4);
  return (
    <article className="offer-card">
      <header className="offer-head">
        <Crest name={offer.club} short={buyer?.short ?? offer.club.slice(0, 3).toUpperCase()} colors={buyer?.colors ?? ['#444444', '#ffffff']} size={44} />
        <div className="offer-title">
          <strong>{offer.club}</strong>
          <span className="offer-badges">
            {buyer && <span className="badge">{TIERS[buyer.tier].name}</span>}
            {offer.final && <span className="badge badge-imediatista">Última oferta</span>}
          </span>
        </div>
      </header>
      <p className="offer-pitch">
        Quer contratar <b>{f.name}</b> ({f.pos}, {f.ovr} de overall, {f.age} anos)
      </p>
      <div className="offer-price">
        <span className="offer-fee">{money(offer.fee)}</span>
        <span className={`offer-vs ${tone}`}>{label}</span>
      </div>
      <div className="offer-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (offer.fee / scale) * 100)}%` }} className={tone || 'neutral'} />
        <i style={{ left: `${Math.min(100, (value / scale) * 100)}%` }} />
      </div>
      <p className="offer-note">Valor de mercado: {money(value)}. A proposta expira no fim da janela.</p>
      <button type="button" className="link" onClick={() => setProfile(!profile)}>
        {profile ? 'Esconder perfil' : `Ver perfil de ${f.name.split(' ')[0]}`}
      </button>
      {profile && <PlayerProfile state={state} f={f} />}
      {offer.message && <p className="offer-msg">{offer.message}</p>}
      {asking && (
        <div className="offer-ask">
          <label>
            Pedir
            <input type="number" min={offer.fee + 1} step={Math.max(1, Math.round(offer.fee / 50))} value={ask} onChange={(e) => setAsk(Math.max(0, Math.round(Number(e.target.value))))} />
            <span className="muted">mil</span>
          </label>
          <button type="button" className="btn btn-small btn-primary" disabled={ask <= offer.fee} onClick={() => dispatch({ t: 'counter', idx, fee: ask }) && setAsking(false)}>
            Enviar contraproposta
          </button>
          <small className="muted">Peça demais e o clube pode desistir.</small>
        </div>
      )}
      <div className="offer-actions">
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => dispatch({ t: 'offer', idx })}>
          Aceitar
        </button>
        <button type="button" className="btn" disabled={disabled} onClick={() => setAsking(!asking)}>
          Negociar
        </button>
        <button type="button" className="btn btn-danger" onClick={() => dispatch({ t: 'reject', idx })}>
          Recusar
        </button>
      </div>
    </article>
  );
}

export type { Dispatch };

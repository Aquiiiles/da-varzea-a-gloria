import { BOARD_INFO, TIERS, marketValue, type Footballer, type GameState, type JobOffer, type Offer } from '../../engine';
import type { Dispatch } from '../App';
import { Crest } from '../Crest';
import { money, num } from '../format';

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

/** Proposta por um jogador do elenco: quem quer, quanto oferece e como isso se compara ao valor dele. */
export function SaleOfferCard({ state, offer, f, onSell, disabled }: { state: GameState; offer: Offer; f: Footballer; onSell: () => void; disabled: boolean }) {
  const buyer = state.clubs.find((c) => c.name === offer.club);
  const value = marketValue(f);
  const ratio = offer.fee / Math.max(1, value);
  const tone = ratio >= 1.2 ? 'good' : ratio < 0.9 ? 'bad' : '';
  const label = ratio >= 1.2 ? `${Math.round((ratio - 1) * 100)}% acima do valor` : ratio < 0.9 ? `${Math.round((1 - ratio) * 100)}% abaixo do valor` : 'perto do valor';
  return (
    <article className="offer-card">
      <header className="offer-head">
        <Crest name={offer.club} short={buyer?.short ?? offer.club.slice(0, 3).toUpperCase()} colors={buyer?.colors ?? ['#444444', '#ffffff']} size={44} />
        <div className="offer-title">
          <strong>{offer.club}</strong>
          <span className="offer-badges">{buyer && <span className="badge">{TIERS[buyer.tier].name}</span>}</span>
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
        <span style={{ width: `${Math.min(100, (offer.fee / Math.max(offer.fee, value * 1.4)) * 100)}%` }} className={tone || 'neutral'} />
        <i style={{ left: `${Math.min(100, (value / Math.max(offer.fee, value * 1.4)) * 100)}%` }} />
      </div>
      <p className="offer-note">Valor de mercado: {money(value)}. A proposta expira no fim da janela.</p>
      <button type="button" className="btn offer-cta" disabled={disabled} onClick={onSell}>
        Vender {f.name.split(' ')[0]}
      </button>
    </article>
  );
}

export type { Dispatch };

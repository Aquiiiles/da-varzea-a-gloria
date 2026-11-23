import type { ReactNode } from 'react';
import type { Effect, Footballer, GameState, Tier } from '../../engine';
import { describeEffects, ovrTone, potLabel } from '../format';

export function Chips({ state, effects }: { state: GameState; effects: readonly Effect[] }) {
  return (
    <span className="chips">
      {describeEffects(state, effects).map((c, i) => (
        <span key={i} className={`chip chip-${c.tone}`}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

interface PlayerLineProps {
  f: Footballer;
  tier: Tier;
  /** destaque (ex.: titular) */
  badge?: string;
  /** linha de detalhes abaixo do nome */
  meta: ReactNode;
  /** coluna da direita (preço, salário...) */
  aside?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

/** Linha de jogador estilo "card de elenco": OVR grande, posição, nome, idade, potencial. */
export function PlayerLine({ f, tier, badge, meta, aside, open, onToggle, children }: PlayerLineProps) {
  return (
    <li className={`pl${open ? ' is-open' : ''}`}>
      <button type="button" className="pl-main" onClick={onToggle} aria-expanded={open}>
        <span className={`pl-ovr ${ovrTone(f.ovr, tier)}`}>{f.ovr}</span>
        <span className={`pl-pos pos-${f.pos}`}>{f.pos}</span>
        <span className="pl-id">
          <strong>
            {f.name}
            {badge && <em className="pl-badge">{badge}</em>}
            {f.homegrown && <em className="pl-badge pl-home" title="Cria da base">BASE</em>}
          </strong>
          <small>
            {f.age} anos · POT {potLabel(f)} · {meta}
          </small>
        </span>
        {aside && <span className="pl-aside">{aside}</span>}
      </button>
      {open && children && <div className="pl-actions">{children}</div>}
    </li>
  );
}

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="panel section">
      <h2 className="section-title">{title}</h2>
      {note && <p className="section-note">{note}</p>}
      {children}
    </section>
  );
}

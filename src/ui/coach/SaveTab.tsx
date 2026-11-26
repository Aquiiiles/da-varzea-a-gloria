import { useState } from 'react';
import { START_YEAR, encodeRun, type GameState } from '../../engine';
import { deleteCareer, listCareers, type CareerSave } from '../../storage';
import { Crest } from '../Crest';

const initials = (name: string) =>
  name
    .replace(/^(Cópia: )?Técnico /, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

/** Aba Salvar: o save atual, cópias, outros saves, link da carreira e voltar ao menu. */
export function SaveTab({ state, onSnapshot, onMenu, onResume }: { state: GameState; onSnapshot?: () => void; onMenu?: () => void; onResume?: (query: string, slot: string) => void }) {
  const [saves, setSaves] = useState<CareerSave[]>(() => listCareers());
  const [copied, setCopied] = useState(false);
  const current = encodeRun(state);
  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?${current}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Copie o link da carreira:', url);
    }
  };
  return (
    <div className="tab-stack">
      <section className="panel">
        <p className="kicker">Esta carreira</p>
        <p className="lede">
          {state.career?.name} · {state.player.name} · {START_YEAR + state.season - 1}
        </p>
        <p className="muted">Salva sozinha a cada decisão.</p>
        <div className="save-actions">
          {onSnapshot && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSnapshot();
                setSaves(listCareers());
              }}
            >
              Salvar uma cópia
            </button>
          )}
          <button type="button" className="btn" onClick={copyLink}>
            {copied ? 'Link copiado' : 'Copiar o link da carreira'}
          </button>
          {onMenu && (
            <button type="button" className="btn" onClick={onMenu}>
              Voltar ao menu
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <p className="kicker">Saves</p>
        {saves.length === 0 ? (
          <p className="muted">Nenhum save.</p>
        ) : (
          <ul className="save-list">
            {saves.map((c) => {
              const isCurrent = c.query === current;
              return (
                <li key={c.id}>
                  <button type="button" className="save" disabled={isCurrent || !onResume} onClick={() => onResume?.(c.query, c.id)}>
                    <Crest name={c.name} short={initials(c.name)} colors={c.colors} size={32} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.tierName} · {START_YEAR + c.season - 1}
                      </small>
                    </span>
                    <span className="save-go">{isCurrent ? 'Aberto' : 'Abrir'}</span>
                  </button>
                  {!isCurrent && (
                    <button
                      type="button"
                      className="save-del"
                      aria-label={`Apagar save ${c.name}`}
                      onClick={() => {
                        deleteCareer(c.id);
                        setSaves(listCareers());
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

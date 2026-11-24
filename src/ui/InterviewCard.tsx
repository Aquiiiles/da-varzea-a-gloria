import { useState } from 'react';
import { currentInterview, type GameState } from '../engine';
import type { Dispatch } from './App';

const TONE_LABEL = { humilde: 'Humilde', confiante: 'Confiante', 'polêmico': 'Polêmico' } as const;

/**
 * Entrevista pós-jogo ou coletiva antes do jogo decisivo. Opcional: dá para pular.
 * As respostas mexem na torcida, na diretoria, na reputação e no vestiário (no fim da temporada).
 */
export function InterviewCard({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const it = currentInterview(state);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  /** entrevista respondida agora (mostra as respostas até fechar) */
  const [justAnswered, setJustAnswered] = useState<string | null>(null);
  if (!it) return null;
  const key = `${it.kind}:${it.day}`;
  if (skipped.has(key)) return null;
  const done = (state.live?.interviews ?? []).filter((x) => x.day === it.day && x.kind === it.kind);
  // já respondida antes (e não agora): não aparece de novo
  if (done.length >= it.questions.length && justAnswered !== key) return null;
  const m = it.match;
  return (
    <section className="panel interview">
      <p className="kicker kicker-alert">{it.kind === 'coletiva' ? 'Coletiva' : 'Entrevista pós-jogo'}</p>
      <h3 className="interview-title">{it.title}</h3>
      <p className="muted">
        {m.comp} · {m.round} · {m.home ? 'x' : '@'} {m.opponent}
        {it.kind === 'pos' ? ` · ${m.gf} x ${m.ga}` : ''}
      </p>
      {it.questions.map((q, qi) => {
        const ans = done.find((d) => d.q === qi);
        return (
          <div key={qi} className="interview-q">
            <p className="interview-ask">{q.text}</p>
            {ans ? (
              <p className="interview-quote">"{ans.quote}"</p>
            ) : (
              <div className="interview-answers">
                {q.answers.map((a, ai) => (
                  <button
                    key={ai}
                    type="button"
                    className="option"
                    onClick={() => dispatch({ t: 'interview', day: it.day, q: qi, a: ai }) && setJustAnswered(key)}
                  >
                    <strong>{TONE_LABEL[a.tone]}</strong>
                    <span>{a.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="link" onClick={() => setSkipped(new Set([...skipped, key]))}>
        {done.length > 0 ? 'Fechar' : 'Pular a entrevista'}
      </button>
    </section>
  );
}

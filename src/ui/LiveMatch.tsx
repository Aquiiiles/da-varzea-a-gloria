import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveMoment } from '../engine';

/** Duração da transmissão (ms) para 90 minutos; prorrogação estende proporcionalmente. */
const MS_PER_MINUTE = 85;

interface Props {
  moment: LiveMoment;
  index: number;
  total: number;
  onDone: () => void;
}

/**
 * Transmissão "ao vivo": relógio acelerado, lances aparecendo e placar atualizando.
 * O resultado já existe no motor; aqui só revelamos aos poucos, sem spoiler.
 */
export function LiveMatch({ moment: m, index, total, onDone }: Props) {
  const end = m.events[m.events.length - 1]?.minute ?? 90;
  const [minute, setMinute] = useState(0);
  const [finished, setFinished] = useState(false);
  const feedRef = useRef<HTMLOListElement>(null);
  const reduced = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setMinute(0);
    setFinished(false);
  }, [m]);

  useEffect(() => {
    if (finished) return;
    if (reduced) {
      setMinute(end);
      setFinished(true);
      return;
    }
    const t = setInterval(() => {
      setMinute((x) => {
        if (x >= end) {
          clearInterval(t);
          setFinished(true);
          return end;
        }
        return x + 1;
      });
    }, MS_PER_MINUTE);
    return () => clearInterval(t);
  }, [end, finished, reduced, m]);

  // os lances finais (apito final, pênaltis) só aparecem quando o jogo acaba
  const endingCount = m.result.pens ? 2 : 1;
  const shown = m.events.filter((e, i) => (i >= m.events.length - endingCount ? finished : e.minute <= minute));
  const score = shown.length > 0 ? shown[shown.length - 1].score : [0, 0];
  const lastGoal = [...shown].reverse().find((e) => e.kind === 'gol');
  const flash = lastGoal && minute - lastGoal.minute <= 3 && !finished;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [shown.length, reduced]);

  const won = finished && (m.result.winner ? (m.playerHome ? m.result.winner === m.result.home : m.result.winner === m.result.away) : null);
  const myGoals = m.playerHome ? m.result.hg : m.result.ag;
  const theirGoals = m.playerHome ? m.result.ag : m.result.hg;
  const verdict = !finished ? null : won === true || (won === null && myGoals > theirGoals) ? 'win' : won === false || myGoals < theirGoals ? 'loss' : 'draw';

  return (
    <section className={`panel live${flash ? ' is-goal' : ''}`} aria-live="polite">
      <div className="live-top">
        <span className="brand-live">AO VIVO</span>
        <span className="live-count">
          Jogo {index + 1} de {total}
        </span>
      </div>
      <p className="kicker">{m.title}</p>
      <p className="live-stake">{m.stake}</p>

      <div className="scoreboard">
        <div className={`sb-team${m.playerHome ? ' sb-me' : ''}`}>{m.homeName}</div>
        <div className="sb-score">
          <span>{score[0]}</span>
          <span className="sb-x">x</span>
          <span>{score[1]}</span>
        </div>
        <div className={`sb-team${!m.playerHome ? ' sb-me' : ''}`}>{m.awayName}</div>
        <div className="sb-clock">{finished ? 'FIM' : `${Math.min(minute, end)}'`}</div>
      </div>
      {flash && <div className="goal-flash">{lastGoal!.mine ? 'GOOOOL!' : 'Gol deles...'}</div>}

      <ol className="feed" ref={feedRef}>
        {[...shown].reverse().map((e, i) => (
          <li key={`${e.minute}-${i}-${e.kind}`} className={`ev ev-${e.kind}${e.mine ? ' ev-mine' : ''}`}>
            <span className="ev-min">{e.minute}'</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ol>

      {finished && verdict && (
        <p className={`live-verdict v-${verdict}`}>{verdict === 'win' ? 'VITÓRIA!' : verdict === 'loss' ? 'Derrota.' : 'Empate.'}</p>
      )}
      <div className="actions">
        {!finished && (
          <button type="button" className="btn" onClick={() => (setMinute(end), setFinished(true))}>
            Pular para o fim
          </button>
        )}
        {finished && (
          <button type="button" className="btn btn-primary" onClick={onDone}>
            {index + 1 < total ? 'Próximo jogo ▶' : 'Ver resumo da temporada'}
          </button>
        )}
      </div>
    </section>
  );
}

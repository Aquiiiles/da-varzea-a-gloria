import { useMemo, useState } from 'react';
import { computeScore, levelFor, runStats, TIERS, type GameState } from '../engine';
import { TrophyRoom } from './TrophyRoom';

export function ResultScreen({ state, onRestart, fromLink }: { state: GameState; onRestart: () => void; fromLink: boolean }) {
  const stats = useMemo(() => runStats(state), [state]);
  const level = levelFor(stats);
  const score = computeScore(stats);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="panel result">
      <p className="kicker">{state.over === 'falencia' ? 'Fim da linha' : 'Fim da run'}{fromLink ? ' · replay' : ''}</p>
      <h1 className="headline">{state.player.name}</h1>
      <div className="level">
        <span className="level-num">{level.level}</span>
        <span className="level-title">{level.label}</span>
      </div>
      <p className="score">Pontuação: {score.toLocaleString('pt-BR')}</p>

      <dl className="result-stats">
        <div><dt>Temporadas</dt><dd>{stats.seasons}</dd></div>
        <div><dt>Acessos</dt><dd>{stats.promotions}</dd></div>
        <div><dt>Títulos de liga</dt><dd>{stats.leagueTitles}</dd></div>
        <div><dt>Melhor divisão alcançada</dt><dd>{TIERS[stats.bestTier].name}</dd></div>
        <div><dt>Barrado pelo estádio</dt><dd>{stats.barred}x</dd></div>
        <div><dt>Ídolo</dt><dd>{stats.idol ? `${stats.idol.name} (${stats.idol.goals} gols)` : '—'}</dd></div>
        <div><dt>Alma</dt><dd>{stats.soul}/100</dd></div>
      </dl>

      <h3>Trajetória</h3>
      <ol className="trajectory">
        {state.history.map((r) => (
          <li key={r.season} className={`traj-${r.outcome}`}>
            <span>{r.year}</span>
            <span>{TIERS[r.tier].name}</span>
            <span>{r.position}º</span>
          </li>
        ))}
      </ol>

      <div className="result-trophies">
        <TrophyRoom state={state} />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Link copiado!' : 'Copiar link da run'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Nova run
        </button>
      </div>
    </section>
  );
}

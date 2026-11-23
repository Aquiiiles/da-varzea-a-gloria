import { useMemo } from 'react';
import { computeScore, levelFor, runStats, TIERS, type GameState } from '../engine';
import { ShareCard } from './ShareCard';
import { TrophyRoom } from './TrophyRoom';

export function ResultScreen({ state, onRestart, fromLink }: { state: GameState; onRestart: () => void; fromLink: boolean }) {
  const stats = useMemo(() => runStats(state), [state]);
  const level = levelFor(stats);
  const score = computeScore(stats);

  return (
    <section className="panel result">
      <p className="kicker">
        {state.over === 'falencia' ? 'Fim da linha' : 'Fim da run'}
        {fromLink ? ' · replay' : ''}
      </p>
      <h1 className="headline">{state.player.name}</h1>
      <div className="level">
        <span className="level-num">{level.level}</span>
        <span className="level-title">{level.label}</span>
      </div>
      <p className="score">Pontuação: {score.toLocaleString('pt-BR')}</p>

      <ShareCard state={state} />

      <dl className="result-stats">
        <div><dt>Temporadas</dt><dd>{stats.seasons}</dd></div>
        <div><dt>Acessos</dt><dd>{stats.promotions}</dd></div>
        <div><dt>Títulos de liga</dt><dd>{stats.leagueTitles}</dd></div>
        <div><dt>Melhor divisão alcançada</dt><dd>{TIERS[stats.bestTier].name}</dd></div>
        <div><dt>Copas</dt><dd>{stats.cupWins + stats.championsWins + stats.worldWins}</dd></div>
        <div><dt>Zebras na copa</dt><dd>{stats.giantKills}</dd></div>
        <div><dt>Maior zebra</dt><dd>{stats.biggestUpset ? `${stats.biggestUpset.score} no ${stats.biggestUpset.opponent}` : '—'}</dd></div>
        <div><dt>Ídolo</dt><dd>{stats.idol ? `${stats.idol.name} (${stats.idol.goals} gols)` : '—'}</dd></div>
        <div><dt>Alma</dt><dd>{stats.soul}/100</dd></div>
      </dl>

      <h3>Trajetória</h3>
      <ol className="trajectory">
        {state.history.map((r) => (
          <li key={r.season} className={`traj-${r.outcome}`}>
            <span>{r.year}</span>
            <span>
              {TIERS[r.tier].name}
              {r.cups.some((c) => c.champion) ? ' 🏆' : ''}
            </span>
            <span>{r.position}º</span>
          </li>
        ))}
      </ol>

      <div className="result-trophies">
        <TrophyRoom state={state} />
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Nova run
        </button>
      </div>
    </section>
  );
}

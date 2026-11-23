import { TIERS } from '../data/pyramid';
import type { GameState, Tier } from './types';

export interface RunStats {
  seasons: number;
  promotions: number;
  relegations: number;
  leagueTitles: number;
  premierTitles: number;
  bestTier: Tier;
  barred: number;
  /** vitórias de copa contra clubes 3+ divisões acima (Marco 3) */
  giantKills: number;
  biggestUpset: { opponent: string; tierGap: number; score: string } | null;
  cupWins: number;
  championsWins: number;
  worldWins: number;
  bankrupt: boolean;
  soul: number;
  idol: { name: string; goals: number } | null;
  trajectory: Tier[];
}

export interface LevelInfo {
  level: number;
  title: string;
  plastic: boolean;
  label: string;
}

export const LEVELS = [
  '',
  'Fechou as portas',
  'Time de pub',
  'Herói da Copa',
  'Clube elevador',
  'Clube profissional',
  'Clube de Premier',
  'Campeão nacional',
  'Rei da Europa',
  'Dinastia',
  'O Milagre',
];

export function runStats(state: GameState): RunStats {
  const h = state.history;
  let bestTier: Tier = 8;
  for (const r of h) {
    if (r.tier < bestTier) bestTier = r.tier;
    if (r.nextTier < bestTier && r.outcome !== 'falencia') bestTier = r.nextTier;
  }
  const idolMan = state.player.squad.reduce<GameState['player']['squad'][number] | null>(
    (best, s) => (!best || s.goals > best.goals ? s : best),
    null,
  );
  return {
    seasons: h.length,
    promotions: h.filter((r) => r.nextTier < r.tier).length,
    relegations: h.filter((r) => r.nextTier > r.tier).length,
    leagueTitles: h.filter((r) => r.position === 1).length,
    premierTitles: h.filter((r) => r.tier === 1 && r.position === 1).length,
    bestTier,
    barred: h.filter((r) => r.outcome === 'barrado_estadio').length,
    giantKills: 0,
    biggestUpset: null,
    cupWins: 0,
    championsWins: 0,
    worldWins: 0,
    bankrupt: state.over === 'falencia',
    soul: Math.round(state.player.soul),
    idol: idolMan && idolMan.goals > 0 ? { name: idolMan.name, goals: idolMan.goals } : null,
    trajectory: h.map((r) => r.tier),
  };
}

/** Pontuação para ranking: presença em divisões altas + conquistas. */
export function computeScore(s: RunStats): number {
  let score = 0;
  for (const t of s.trajectory) score += (9 - t) * (9 - t) * 2; // nível 1 = 128/temporada
  score += s.promotions * 40;
  score += s.leagueTitles * 60;
  score += s.premierTitles * 400;
  score += s.giantKills * 50;
  score += s.cupWins * 150;
  score += s.championsWins * 1000;
  score += s.worldWins * 1500;
  score += Math.round(s.soul * 2);
  if (s.bankrupt) score = Math.round(score * 0.5);
  return score;
}

/** Escada de níveis. 8–10 exigem a Copa dos Campeões. */
export function levelFor(s: RunStats): LevelInfo {
  let level: number;
  if (s.bankrupt) level = 1;
  else if (s.worldWins > 0 && s.championsWins > 0) level = 10;
  else if (s.championsWins >= 2 || (s.championsWins >= 1 && s.premierTitles >= 3)) level = 9;
  else if (s.championsWins >= 1) level = 8;
  else if (s.premierTitles >= 1) level = 7;
  else if (s.bestTier === 1) level = 6;
  else if (s.bestTier <= 4) level = 5;
  else if (s.promotions >= 2) level = 4;
  else if (s.giantKills >= 1) level = 3;
  else level = 2;
  const plastic = s.soul < 30;
  const title = LEVELS[level];
  return { level, title, plastic, label: plastic ? `${title} (clube de plástico)` : title };
}

export function tierName(t: Tier): string {
  return TIERS[t].name;
}

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
  /** modo técnico */
  coach: boolean;
  /** modo técnico: clubes treinados e demissões */
  clubs: number;
  firings: number;
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
  'Time de várzea',
  'Herói da Copa',
  'Clube elevador',
  'Clube de série nacional',
  'Clube de Série A',
  'Campeão nacional',
  'Rei da América',
  'Dinastia',
  'O Milagre',
];

export function runStats(state: GameState): RunStats {
  const h = state.history;
  let bestTier: Tier = 7;
  for (const r of h) {
    if (r.tier < bestTier) bestTier = r.tier;
    if (r.nextTier < bestTier && r.outcome !== 'falencia') bestTier = r.nextTier;
  }
  const cupGames = h.flatMap((r) => r.cups.flatMap((c) => c.matches));
  const wins = (id: string) => h.filter((r) => r.cups.some((c) => c.id === id && c.champion)).length;
  let biggestUpset: RunStats['biggestUpset'] = null;
  for (const r of h) {
    for (const c of r.cups) {
      for (const m of c.matches) {
        if (!m.won || m.opponentTier === null) continue;
        const gap = r.tier - m.opponentTier;
        if (gap >= 2 && (!biggestUpset || gap > biggestUpset.tierGap)) {
          const mine = m.home ? m.result.hg : m.result.ag;
          const theirs = m.home ? m.result.ag : m.result.hg;
          biggestUpset = { opponent: m.opponent, tierGap: gap, score: `${mine} x ${theirs}${m.result.pens ? ' (pên.)' : ''}` };
        }
      }
    }
  }
  const everyone = [...state.player.squad, ...state.player.alumni];
  const idolMan = everyone.reduce<(typeof everyone)[number] | null>((best, s) => (!best || s.goals > best.goals ? s : best), null);
  return {
    seasons: h.length,
    promotions: h.filter((r) => r.nextTier < r.tier).length,
    relegations: h.filter((r) => r.nextTier > r.tier).length,
    leagueTitles: h.reduce((n, r) => n + r.comps.filter((c) => c.won).length, 0),
    premierTitles: h.filter((r) => r.comps.some((c) => c.id === 'serie_a' && c.won)).length,
    bestTier,
    barred: h.filter((r) => r.outcome === 'barrado_estadio').length,
    giantKills: cupGames.filter((m) => m.giantKill).length,
    biggestUpset,
    cupWins: wins('copa'),
    championsWins: wins('cc'),
    worldWins: wins('mundial'),
    bankrupt: state.over === 'falencia',
    soul: Math.round(state.player.soul),
    idol: idolMan && idolMan.goals > 0 ? { name: idolMan.name, goals: idolMan.goals } : null,
    trajectory: h.map((r) => r.tier),
    coach: !!state.career,
    clubs: state.career?.stints.length ?? 1,
    firings: state.career?.stints.filter((x) => x.exit === 'demitido').length ?? 0,
  };
}

/** Pontuação para ranking: presença em divisões altas + conquistas. */
export function computeScore(s: RunStats): number {
  let score = 0;
  for (const t of s.trajectory) score += (8 - t) * (8 - t) * 2; // Série A = 98/temporada
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

/** Escada do técnico (modo técnico). */
export const COACH_LEVELS = [
  '',
  'Pendurou a prancheta',
  'Professor de várzea',
  'Rei da zebra',
  'Técnico rodado',
  'Técnico de série nacional',
  'Técnico de Série A',
  'Campeão brasileiro',
  'Rei da América',
  'Dinastia no banco',
  'Lenda do banco',
];

/** Escada de níveis. 8–10 exigem a Libertadores. */
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
  if (s.coach) {
    if (level === 1) level = 2;
    const title = COACH_LEVELS[level];
    return { level, title, plastic: false, label: s.firings >= 4 ? `${title} (rodou o Brasil)` : title };
  }
  const plastic = s.soul < 30;
  const title = LEVELS[level];
  return { level, title, plastic, label: plastic ? `${title} (clube de plástico)` : title };
}

export function tierName(t: Tier): string {
  return TIERS[t].name;
}

import { START_YEAR, TIERS } from '../data/pyramid';
import { PLAYER_ID } from './season';
import type { GameState, Tier } from './types';

const CUP_SIZE: Record<string, Trophy['size']> = { mundial: 3, cc: 3, le: 2, copa: 2 };
const CUP_RANK: Record<string, number> = { mundial: 0, cc: 1, le: 3, copa: 13 };

export interface Trophy {
  id: string;
  name: string;
  /** peso visual: 1 = taça pequena, 3 = taça gigante */
  size: 1 | 2 | 3;
  tier?: Tier;
  years: number[];
}

/** Sala de troféus: derivada do histórico (função pura, nada extra no estado). */
export function trophies(state: GameState): Trophy[] {
  const map = new Map<string, Trophy>();
  const add = (id: string, name: string, size: Trophy['size'], year: number, tier?: Tier) => {
    const t = map.get(id) ?? { id, name, size, tier, years: [] };
    t.years.push(year);
    map.set(id, t);
  };
  for (const r of state.history) {
    if (r.position === 1) add(`liga-${r.tier}`, `Campeão da ${TIERS[r.tier].name}`, r.tier === 1 ? 3 : r.tier <= 3 ? 2 : 1, r.year, r.tier);
    if (r.outcome === 'acesso_playoff') add(`playoff-${r.tier}`, `Playoff da ${TIERS[r.tier].name}`, 1, r.year, r.tier);
    for (const c of r.cups) if (c.champion) add(c.id, c.name, CUP_SIZE[c.id], r.year);
  }
  // ordena: copas internacionais, depois ligas da mais alta para a mais baixa
  const rank = (t: Trophy) => CUP_RANK[t.id] ?? 10 + (t.tier ?? 9) * 2 + (t.id.startsWith('playoff') ? 1 : 0);
  return [...map.values()].sort((a, b) => rank(a) - rank(b));
}

export interface ClubRecords {
  topScorer: { name: string; goals: number } | null;
  mostApps: { name: string; apps: number } | null;
  biggestWin: { score: string; opponent: string; year: number } | null;
  worstDefeat: { score: string; opponent: string; year: number } | null;
  bestCampaign: { points: number; year: number; tier: Tier; position: number } | null;
  bestAttendance: { value: number; year: number } | null;
  bestSeasonScorer: { name: string; goals: number; year: number } | null;
  seasonsByTier: Partial<Record<Tier, number>>;
}

export function clubRecords(state: GameState): ClubRecords {
  const everyone = [...state.player.squad, ...state.player.alumni, ...state.player.onLoan];
  const byGoals = everyone.slice().sort((a, b) => b.goals - a.goals || a.id - b.id)[0];
  const byApps = everyone.slice().sort((a, b) => b.apps - a.apps || a.id - b.id)[0];

  let biggestWin: ClubRecords['biggestWin'] = null;
  let worstDefeat: ClubRecords['worstDefeat'] = null;
  let bestWinDiff = 0;
  let worstDiff = 0;
  let bestCampaign: ClubRecords['bestCampaign'] = null;
  let bestAttendance: ClubRecords['bestAttendance'] = null;
  let bestSeasonScorer: ClubRecords['bestSeasonScorer'] = null;
  const seasonsByTier: ClubRecords['seasonsByTier'] = {};

  for (const r of state.history) {
    seasonsByTier[r.tier] = (seasonsByTier[r.tier] ?? 0) + 1;
    for (const m of r.playerMatches) {
      const home = m.home === PLAYER_ID;
      const mine = home ? m.hg : m.ag;
      const theirs = home ? m.ag : m.hg;
      const opp = r.clubNames[home ? m.away : m.home] ?? '?';
      const diff = mine - theirs;
      if (diff > bestWinDiff || (diff === bestWinDiff && diff > 0 && biggestWin && mine > Number(biggestWin.score.split(' x ')[0]))) {
        bestWinDiff = diff;
        biggestWin = { score: `${mine} x ${theirs}`, opponent: opp, year: r.year };
      }
      if (diff < worstDiff) {
        worstDiff = diff;
        worstDefeat = { score: `${mine} x ${theirs}`, opponent: opp, year: r.year };
      }
    }
    // melhor campanha: a de maior aproveitamento na divisão mais alta disputada
    const games = r.table.find((t) => t.clubId === PLAYER_ID)?.played ?? 1;
    const ratio = (r.points + r.deduction) / (games * 3);
    if (!bestCampaign || r.tier < bestCampaign.tier || (r.tier === bestCampaign.tier && ratio > bestCampaign.points / (games * 3))) {
      bestCampaign = { points: r.points + r.deduction, year: r.year, tier: r.tier, position: r.position };
    }
    if (!bestAttendance || r.finance.attendance > bestAttendance.value) bestAttendance = { value: r.finance.attendance, year: r.year };
    if (r.topScorer && (!bestSeasonScorer || r.topScorer.goals > bestSeasonScorer.goals)) bestSeasonScorer = { ...r.topScorer, year: r.year };
  }

  return {
    topScorer: byGoals && byGoals.goals > 0 ? { name: byGoals.name, goals: byGoals.goals } : null,
    mostApps: byApps && byApps.apps > 0 ? { name: byApps.name, apps: byApps.apps } : null,
    biggestWin,
    worstDefeat,
    bestCampaign,
    bestAttendance,
    bestSeasonScorer,
    seasonsByTier,
  };
}

export function seasonYear(season: number): number {
  return START_YEAR + season - 1;
}

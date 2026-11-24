import type { AwardsInput, LeagueInfo } from './awards';
import { aiCoachName } from './stats';
import type { GameState, Tier } from './types';

/**
 * Ranking de técnicos: cada técnico soma pontos por temporada pelo nível da liga, a posição final,
 * acesso e títulos. O ranking é a soma das últimas 5 temporadas (como num ranking de verdade).
 * Os técnicos da IA são os dos clubes (um por clube); o jogador entra com a chave "me" (modo técnico).
 */

export const RANKING_SEASONS = 5;
const BASE: Record<Tier, number> = { 1: 100, 2: 55, 3: 32, 4: 20, 5: 12, 6: 6, 7: 3 };
const CUP: Record<AwardsInput['cupChampions'][number]['id'], number> = { estado: 5, copa: 60, le: 50, cc: 120, mundial: 150 };
export const ME = 'me';

/** Pontos da temporada de cada clube (pela competição principal dele). */
export function seasonCoachPoints(leagues: LeagueInfo[], cups: AwardsInput['cupChampions'], playerId: string): Map<string, number> {
  const pts = new Map<string, number>();
  const add = (id: string, v: number) => pts.set(id, (pts.get(id) ?? 0) + v);
  // a liga mais alta de cada clube vale (clube nacional também joga o Estadual)
  const seen = new Set<string>();
  for (const L of leagues.slice().sort((a, b) => a.tier - b.tier)) {
    const n = L.ranking.length;
    L.ranking.forEach((id, i) => {
      if (seen.has(id)) return;
      seen.add(id);
      let v = BASE[L.tier] * (1.5 - (i + 1) / n);
      if (L.champion === id) v += BASE[L.tier] * 0.5;
      if (L.promoted.includes(id)) v += BASE[L.tier] * 0.3;
      add(id, v);
    });
  }
  for (const c of cups) add(c.clubId, CUP[c.id]);
  if (pts.has(playerId)) {
    pts.set(ME, pts.get(playerId)!);
    pts.delete(playerId);
  }
  return pts;
}

/** Guarda os pontos da temporada (só as últimas 5 temporadas contam). */
export function recordCoachPoints(state: GameState, season: Map<string, number>): void {
  const all = (state.coachPoints ??= {});
  const ids = new Set([...Object.keys(all), ...season.keys()]);
  for (const id of ids) {
    if (id === ME && !state.career) continue;
    const list = all[id] ?? [];
    list.push(Math.round(season.get(id) ?? 0));
    all[id] = list.slice(-RANKING_SEASONS);
  }
  // clubes que sumiram do mundo (várzea) saem do ranking
  const alive = new Set([ME, ...state.clubs.map((c) => c.id)]);
  for (const id of Object.keys(all)) if (!alive.has(id)) delete all[id];
}

export interface RankingEntry {
  pos: number;
  name: string;
  club: string;
  points: number;
  me: boolean;
}

/** Ranking atual de técnicos. */
export function coachRanking(state: GameState): RankingEntry[] {
  const all = state.coachPoints ?? {};
  const sum = (id: string) => (all[id] ?? []).reduce((s, v) => s + v, 0);
  const rows: Omit<RankingEntry, 'pos'>[] = state.clubs.map((c) => ({ name: aiCoachName(state.seed, c.id), club: c.name, points: sum(c.id), me: false }));
  if (state.career) {
    rows.push({ name: state.career.name, club: state.career.unemployed ? 'sem clube' : state.player.name, points: sum(ME), me: true });
  }
  return rows
    .sort((a, b) => b.points - a.points || Number(b.me) - Number(a.me) || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

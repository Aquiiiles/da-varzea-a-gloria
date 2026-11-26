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

/** Chave do técnico no ranking: o nome (os pontos acompanham o técnico quando ele troca de clube). */
export function coachKey(name: string): string {
  return `t:${name}`;
}

/** Nome do técnico atual de um clube da IA. */
export function coachOfClub(state: GameState, clubId: string): string {
  const c = state.clubs.find((x) => x.id === clubId);
  return aiCoachName(state.seed, clubId, c);
}

/** Guarda os pontos da temporada (só as últimas 5 temporadas contam), por técnico. */
export function recordCoachPoints(state: GameState, season: Map<string, number>): void {
  const all = (state.coachPoints ??= {});
  // saves antigos: pontos por clube viram pontos do técnico atual do clube
  for (const id of Object.keys(all)) {
    if (id === ME || id.startsWith('t:')) continue;
    const key = coachKey(coachOfClub(state, id));
    all[key] = all[key] ?? all[id];
    delete all[id];
  }
  const byCoach = new Map<string, number>();
  for (const [id, v] of season) byCoach.set(id === ME ? ME : coachKey(coachOfClub(state, id)), v);
  const keys = new Set([...Object.keys(all), ...byCoach.keys()]);
  for (const key of keys) {
    if (key === ME && !state.career) continue;
    const list = all[key] ?? [];
    list.push(Math.round(byCoach.get(key) ?? 0));
    all[key] = list.slice(-RANKING_SEASONS);
  }
  // quem zerou nas últimas temporadas sai do ranking
  for (const key of Object.keys(all)) if (key !== ME && all[key].every((v) => v === 0)) delete all[key];
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
  // empate (como no começo da carreira): vale o tamanho do clube
  const rows: (Omit<RankingEntry, 'pos'> & { weight: number })[] = state.clubs.map((c) => {
    const name = aiCoachName(state.seed, c.id, c);
    return { name, club: c.name, points: sum(coachKey(name)) || sum(c.id), me: false, weight: c.strength };
  });
  // técnicos sem clube que ainda têm pontos
  const employed = new Set(rows.map((r) => r.name));
  for (const key of Object.keys(all)) {
    if (!key.startsWith('t:')) continue;
    const name = key.slice(2);
    if (!employed.has(name)) rows.push({ name, club: 'sem clube', points: sum(key), me: false, weight: 0 });
  }
  if (state.career) {
    rows.push({ name: state.career.name, club: state.career.unemployed ? 'sem clube' : state.player.name, points: sum(ME), me: true, weight: state.career.unemployed ? 0 : state.player.strength });
  }
  return rows
    .sort((a, b) => b.points - a.points || b.weight - a.weight || a.name.localeCompare(b.name))
    .map(({ weight: _w, ...r }, i) => ({ ...r, pos: i + 1 }));
}

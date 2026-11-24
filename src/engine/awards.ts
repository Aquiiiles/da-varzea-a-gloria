import { aiCoachName, type PlayerStat, type SeasonStats } from './stats';
import type { AwardEntry, AwardItem, AwardSet, CompId, Position, SeasonAwards, Tier } from './types';

/**
 * Prêmios da temporada: de cada liga (craque, artilheiro, seleção, técnico, revelação)
 * e gerais (Bola de Ouro, Chuteira de Ouro, time da temporada, técnico da temporada, revelação do ano).
 * Tudo sai das estatísticas dos jogos; não usa sorteio.
 */

export interface LeagueInfo {
  /** chave do calendário (estatísticas) */
  key: string;
  compId: CompId;
  name: string;
  tier: Tier;
  ids: string[];
  ranking: string[];
  champion: string;
  promoted: string[];
}

export interface AwardsInput {
  seed: number;
  stats: SeasonStats;
  leagues: LeagueInfo[];
  playerId: string;
  playerCoach: string;
  nameOf: (clubId: string) => string;
  tierOf: (clubId: string) => Tier | null;
  strengthOf: (clubId: string) => number;
  /** clubes campeões de copas nesta temporada (id da copa → clube) */
  cupChampions: { id: 'estado' | 'copa' | 'cc' | 'le' | 'mundial'; clubId: string }[];
}

/** Peso do nível do clube nos prêmios gerais (jogar bem na Série A vale mais que na Várzea). */
const LEVEL_BONUS: Record<Tier, number> = { 1: 1.6, 2: 0.9, 3: 0.5, 4: 0.25, 5: 0.1, 6: 0, 7: -0.2 };
const CUP_BONUS = { estado: 0.05, copa: 0.4, cc: 0.6, le: 0.3, mundial: 0.6 } as const;
const COACH_CUP_BONUS = { estado: 0.5, copa: 2, cc: 3, le: 1.5, mundial: 3 } as const;
const TEAM_SHAPE: Record<Position, number> = { GOL: 1, DEF: 4, MEI: 3, ATA: 3 };
const YOUNG = 21;
/** Peso da liga no técnico da temporada (um grande trabalho na Série A pesa mais que na Várzea). */
const COACH_LEVEL: Record<Tier, number> = { 1: 1, 2: 0.6, 3: 0.4, 4: 0.3, 5: 0.25, 6: 0.15, 7: 0.1 };

interface Candidate {
  id: number;
  clubId: string;
  st: PlayerStat;
  score: number;
}

function fmtRating(st: PlayerStat): string {
  return (st.rating / Math.max(1, st.apps)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function computeAwards(inp: AwardsInput): SeasonAwards {
  const { stats } = inp;
  const entry = (c: Candidate, detail: string): AwardEntry => {
    const who = stats.people.get(c.id)!;
    return { name: who.f.name, club: inp.nameOf(c.clubId), mine: c.clubId === inp.playerId, pos: who.f.pos, age: who.f.age, detail };
  };
  const playerLine = (c: Candidate) => `nota ${fmtRating(c.st)} · ${c.st.goals} gol(s) · ${c.st.assists} assist.`;

  const item = (id: AwardItem['id'], title: string, list: AwardEntry[]): AwardItem | null =>
    list.length > 0 ? { id, title, winner: list[0], finalists: list.slice(0, 3) } : null;

  const team = (cands: Candidate[]): AwardEntry[] => {
    const out: AwardEntry[] = [];
    for (const pos of ['GOL', 'DEF', 'MEI', 'ATA'] as Position[]) {
      cands
        .filter((c) => stats.people.get(c.id)!.f.pos === pos)
        .slice(0, TEAM_SHAPE[pos])
        .forEach((c) => out.push(entry(c, `nota ${fmtRating(c.st)}`)));
    }
    return out;
  };

  const byScore = (a: Candidate, b: Candidate) => b.score - a.score || a.id - b.id;
  const byGoals = (a: Candidate, b: Candidate) => b.st.goals - a.st.goals || a.st.apps - b.st.apps || a.id - b.id;
  const isYoung = (c: Candidate) => stats.people.get(c.id)!.f.age <= YOUNG;

  /** Técnicos: campanha acima do esperado para a força do elenco. */
  const coachScore = (L: LeagueInfo, clubId: string): { score: number; detail: string } => {
    const expected = L.ids.slice().sort((a, b) => inp.strengthOf(b) - inp.strengthOf(a) || (a < b ? -1 : 1)).indexOf(clubId) + 1;
    const actual = L.ranking.indexOf(clubId) + 1;
    // diferença entre o esperado e o real, na escala de uma liga de 20 clubes
    let score = ((expected - actual) / L.ids.length) * 20;
    if (L.champion === clubId) score += 3;
    if (L.promoted.includes(clubId)) score += 2;
    const detail = L.champion === clubId ? `campeão (cotado em ${expected}º)` : `${actual}º lugar (cotado em ${expected}º)`;
    return { score, detail };
  };
  const coachName = (clubId: string) => (clubId === inp.playerId ? inp.playerCoach : aiCoachName(inp.seed, clubId));
  const coachEntry = (clubId: string, detail: string): AwardEntry => ({ name: coachName(clubId), club: inp.nameOf(clubId), mine: clubId === inp.playerId, detail });

  // ---------------------- por liga ----------------------
  const leagues: AwardSet[] = [];
  const coachPool: { clubId: string; score: number; detail: string; tier: Tier }[] = [];
  for (const L of inp.leagues) {
    const comp = stats.byComp.get(L.key);
    if (!comp) continue;
    let maxApps = 0;
    for (const st of comp.values()) maxApps = Math.max(maxApps, st.apps);
    const minApps = Math.max(3, Math.round(maxApps * 0.4));
    const pos = (clubId: string) => L.ranking.indexOf(clubId) + 1;
    const cands: Candidate[] = [];
    for (const [id, st] of comp) {
      const who = stats.people.get(id);
      if (!who || !L.ids.includes(who.clubId)) continue;
      const p = pos(who.clubId);
      const score = st.rating / Math.max(1, st.apps) + st.goals * 0.06 + st.assists * 0.04 + (L.champion === who.clubId ? 0.3 : p > 0 && p <= 4 ? 0.1 : 0);
      cands.push({ id, clubId: who.clubId, st, score: st.apps >= minApps ? score : -Infinity });
    }
    const eligible = cands.filter((c) => c.score > -Infinity).sort(byScore);
    const scorers = cands.filter((c) => c.st.goals > 0).sort(byGoals);
    const coaches = L.ids
      .map((id) => ({ id, ...coachScore(L, id) }))
      .sort((a, b) => b.score - a.score || L.ranking.indexOf(a.id) - L.ranking.indexOf(b.id));
    coachPool.push(...coaches.slice(0, 3).map((c) => ({ clubId: c.id, score: c.score, detail: `${L.name}: ${c.detail}`, tier: L.tier })));
    const items = [
      item('craque', 'Craque do campeonato', eligible.slice(0, 3).map((c) => entry(c, playerLine(c)))),
      item('artilheiro', 'Artilheiro', scorers.slice(0, 3).map((c) => entry(c, `${c.st.goals} gols em ${c.st.apps} jogos`))),
      item('tecnico', 'Técnico do campeonato', coaches.slice(0, 3).map((c) => coachEntry(c.id, c.detail))),
      item('revelacao', 'Revelação', eligible.filter(isYoung).slice(0, 3).map((c) => entry(c, playerLine(c)))),
    ].filter((x): x is AwardItem => x !== null);
    const mine = L.ids.includes(inp.playerId);
    leagues.push({ scope: L.name, compId: L.compId, items, team: mine ? team(eligible) : undefined });
  }

  // ---------------------- gerais ----------------------
  const titles = new Map<string, number>();
  const coachTitles = new Map<string, number>();
  const addTitle = (map: Map<string, number>, id: string, v: number) => map.set(id, (map.get(id) ?? 0) + v);
  for (const L of inp.leagues) {
    addTitle(titles, L.champion, 0.15 + LEVEL_BONUS[L.tier] * 0.25);
  }
  for (const c of inp.cupChampions) {
    addTitle(titles, c.clubId, CUP_BONUS[c.id]);
    addTitle(coachTitles, c.clubId, COACH_CUP_BONUS[c.id]);
  }
  const total = stats.total;
  let maxApps = 0;
  for (const st of total.values()) maxApps = Math.max(maxApps, st.apps);
  const minApps = Math.max(5, Math.round(maxApps * 0.35));
  const all: Candidate[] = [];
  for (const [id, st] of total) {
    const who = stats.people.get(id);
    if (!who) continue;
    const tier = inp.tierOf(who.clubId) ?? 7;
    const score = st.rating / Math.max(1, st.apps) + st.goals * 0.05 + st.assists * 0.03 + LEVEL_BONUS[tier] + (titles.get(who.clubId) ?? 0);
    all.push({ id, clubId: who.clubId, st, score: st.apps >= minApps ? score : -Infinity });
  }
  const eligibleAll = all.filter((c) => c.score > -Infinity).sort(byScore);
  // Chuteira de Ouro: gols ponderados pelo nível (gol na Série A vale mais que na Várzea)
  const goldenBoot = all
    .filter((c) => c.st.goals > 0)
    .map((c) => ({ c, w: c.st.goals * (1 + LEVEL_BONUS[inp.tierOf(c.clubId) ?? 7] * 0.25) }))
    .sort((a, b) => b.w - a.w || byGoals(a.c, b.c))
    .map((x) => x.c);
  const coachYear = coachPool
    .map((c) => ({ ...c, score: c.score * COACH_LEVEL[c.tier] + (coachTitles.get(c.clubId) ?? 0) }))
    .sort((a, b) => b.score - a.score || a.tier - b.tier);
  const seenCoach = new Set<string>();
  const coachYearUnique = coachYear.filter((c) => (seenCoach.has(c.clubId) ? false : (seenCoach.add(c.clubId), true)));

  const general: AwardSet = {
    scope: 'Temporada',
    items: [
      item('bola', 'Bola de Ouro', eligibleAll.slice(0, 3).map((c) => entry(c, playerLine(c)))),
      item('chuteira', 'Chuteira de Ouro', goldenBoot.slice(0, 3).map((c) => entry(c, `${c.st.goals} gols em ${c.st.apps} jogos`))),
      item('tecnico_ano', 'Técnico da temporada', coachYearUnique.slice(0, 3).map((c) => coachEntry(c.clubId, c.detail))),
      item('revelacao_ano', 'Revelação do ano', eligibleAll.filter(isYoung).slice(0, 3).map((c) => entry(c, playerLine(c)))),
    ].filter((x): x is AwardItem => x !== null),
    team: team(eligibleAll),
  };
  return { general, leagues };
}

/** Prêmios ganhos pelo clube do jogador (para manchetes, torcida e sala de troféus). */
export function myAwards(a: SeasonAwards): { scope: string; title: string; name: string }[] {
  const out: { scope: string; title: string; name: string }[] = [];
  for (const set of [a.general, ...a.leagues]) {
    for (const it of set.items) if (it.winner.mine) out.push({ scope: set.scope, title: it.title, name: it.winner.name });
  }
  return out;
}

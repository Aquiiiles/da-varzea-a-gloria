import { applyResult, emptyRow, sortTable } from './league';
import { FATIGUE_RECOVERY } from './squadplan';
import type { CalendarMatch, CalendarStage, LiveSeason, SeasonCalendar, TableRow } from './types';

/** Jogos do jogador já mostrados (até o dia `day`). */
export function playedMatches(cal: SeasonCalendar, day: number): CalendarMatch[] {
  return cal.matches.filter((m) => m.day <= day);
}

/**
 * Próximos jogos sem estragar surpresa: de cada competição, só o próximo jogo
 * (no mata-mata ele só existe se o clube passou, e a fase anterior já foi mostrada).
 */
export function upcomingMatches(cal: SeasonCalendar, day: number, limit = 4): CalendarMatch[] {
  const seen = new Set<string>();
  const out: CalendarMatch[] = [];
  for (const m of cal.matches) {
    if (m.day <= day || seen.has(m.comp)) continue;
    seen.add(m.comp);
    out.push(m);
  }
  return out.sort((a, b) => a.day - b.day).slice(0, limit);
}

/** A fase já começou até o dia `day`? */
export function stageStarted(stage: CalendarStage, day: number): boolean {
  return stage.matches.some(([d]) => d <= day);
}

/** Tabela da fase com os jogos até o dia `day`. */
export function partialTable(stage: CalendarStage, day: number): TableRow[] {
  const table = new Map<string, TableRow>();
  for (const id of stage.ids) table.set(id, emptyRow(id, stage.deductions[id] ?? 0));
  for (const [d, h, a, hg, ag] of stage.matches) {
    if (d > day) continue;
    applyResult(table, { home: stage.ids[h], away: stage.ids[a], hg, ag });
  }
  return sortTable([...table.values()]);
}

/** Resultado de um jogo do ponto de vista do jogador: 'V', 'E' ou 'D' (mata-mata conta quem passou). */
export function outcomeOf(m: CalendarMatch): 'V' | 'E' | 'D' {
  if (m.gf > m.ga) return 'V';
  if (m.gf < m.ga) return 'D';
  if (m.advanced === true) return 'V';
  if (m.advanced === false) return 'D';
  return 'E';
}

/** Lesionados no dia `day` (com a data de volta). */
export function injuredAt(live: LiveSeason, day: number): LiveSeason['injuries'] {
  return live.injuries.filter((i) => i.from <= day && i.to > day);
}

/** Cansaço de cada jogador no dia `day` (último jogo até ali, menos a recuperação dos dias seguintes). */
export function fatigueAt(live: LiveSeason, day: number): Record<number, number> {
  let last: LiveSeason['fatigue'][number] | null = null;
  for (const f of live.fatigue) if (f.day <= day) last = f;
  if (!last) return {};
  const rest = (day - last.day) * FATIGUE_RECOVERY;
  const out: Record<number, number> = {};
  for (const [id, v] of Object.entries(last.fatigue)) out[Number(id)] = Math.max(0, Math.round(v - rest));
  return out;
}

/** Suspensos no jogo do dia `day`. */
export function suspendedOn(live: LiveSeason, day: number): NonNullable<LiveSeason['suspensions']> {
  return (live.suspensions ?? []).filter((s) => s.day === day);
}

/** Pendurados até o dia `day`: jogadores com 2 amarelos (o 3º suspende). */
export function hangingAt(live: LiveSeason, day: number): { id: number; name: string }[] {
  const count = new Map<number, { name: string; n: number }>();
  for (const c of live.cards ?? []) {
    if (c.day > day || c.kind !== 'amarelo') continue;
    const cur = count.get(c.id) ?? { name: c.name, n: 0 };
    cur.n = (cur.n + 1) % 3;
    count.set(c.id, cur);
  }
  return [...count.entries()].filter(([, v]) => v.n === 2).map(([id, v]) => ({ id, name: v.name }));
}

/** Forma e moral de cada jogador no dia `day` (depois do último jogo até ali). */
export function statusAt(live: LiveSeason, day: number): { form: Record<number, number>; morale: Record<number, number> } {
  let last: NonNullable<LiveSeason['status']>[number] | null = null;
  for (const s of live.status ?? []) if (s.day <= day) last = s;
  return last ? { form: last.form, morale: last.morale } : { form: {}, morale: {} };
}

/** Chave da competição nas estatísticas (a mesma do calendário). */
export const COMP_STATS_KEY: Record<string, string> = {
  serie_a: 'serie-a', serie_b: 'serie-b', serie_c: 'serie-c', serie_d: 'serie-d', estadual_a: 'est-a', estadual_b: 'est-b', varzea: 'varzea',
};

export interface StatLine {
  id: number;
  name: string;
  club: string;
  apps: number;
  goals: number;
  assists: number;
  /** nota média */
  rating: number;
}

/** Estatísticas somadas até o dia `day` (de uma competição ou de todas). */
export function statsUpTo(live: LiveSeason, day: number, comp?: string): StatLine[] {
  const s = live.stats;
  if (!s) return [];
  const acc = new Map<number, StatLine & { sum: number }>();
  for (const [d, c, id, g, a, r] of s.log) {
    if (d > day || (comp && c !== comp)) continue;
    let x = acc.get(id);
    if (!x) {
      const [name, club] = s.people[id] ?? ['?', '?'];
      acc.set(id, (x = { id, name, club, apps: 0, goals: 0, assists: 0, rating: 0, sum: 0 }));
    }
    x.apps++;
    x.goals += g;
    x.assists += a;
    x.sum += r / 10;
  }
  return [...acc.values()].map(({ sum, ...x }) => ({ ...x, rating: x.apps > 0 ? Math.round((sum / x.apps) * 10) / 10 : 0 }));
}

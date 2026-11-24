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

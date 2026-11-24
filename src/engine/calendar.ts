/**
 * Calendário da temporada brasileira. Os dias são "dias do ano" (1 = 1º de janeiro).
 *
 * Cada competição tem uma janela e um tipo de data: ligas no fim de semana (domingo),
 * copas no meio da semana (quarta). As rodadas são espalhadas por igual dentro da janela.
 * Tudo é calculado a partir do ano, sem relógio do sistema (o motor continua determinístico).
 */

export type CalendarKey =
  | 'varzea' | 'est-b' | 'est-a'
  | 'serie-a' | 'serie-b' | 'serie-c' | 'serie-d'
  | 'copa-estado' | 'copa' | 'cc' | 'le' | 'mundial';

interface Window {
  start: number;
  end: number;
  /** dias da semana usados (0 = domingo … 6 = sábado); o segundo só entra se faltar data no primeiro */
  weekdays: [number] | [number, number];
}

/**
 * Janelas (dia do ano). Estaduais no 1º semestre; séries nacionais depois do Estadual.
 * Ligas no domingo (quarta quando faltar data); copas em outros dias para não bater com a liga.
 */
export const WINDOWS: Record<CalendarKey, Window> = {
  varzea: { start: 22, end: 110, weekdays: [0, 3] },
  'est-b': { start: 22, end: 110, weekdays: [0, 3] },
  'est-a': { start: 15, end: 110, weekdays: [0, 3] },
  'serie-a': { start: 116, end: 340, weekdays: [0, 3] },
  'serie-b': { start: 116, end: 335, weekdays: [0, 3] },
  'serie-c': { start: 123, end: 300, weekdays: [0, 3] },
  'serie-d': { start: 123, end: 255, weekdays: [0, 3] },
  'copa-estado': { start: 36, end: 290, weekdays: [2] },
  // a Copa do Brasil começa depois do Estadual (os 2 melhores do Estadual sem série entram nela)
  copa: { start: 120, end: 315, weekdays: [4] },
  cc: { start: 92, end: 320, weekdays: [2] },
  le: { start: 92, end: 320, weekdays: [2] },
  mundial: { start: 345, end: 355, weekdays: [3, 6] },
};

/** Primeiro e último dia da temporada (para o avanço "até o fim"). */
export const SEASON_START = 10;
export const SEASON_END = 358;

/** Dia da semana (0 = domingo) de um dia do ano. */
export function weekdayOf(year: number, day: number): number {
  return new Date(Date.UTC(year, 0, day)).getUTCDay();
}

const cache = new Map<string, number[]>();

/** Datas possíveis de uma competição: o dia principal da semana; se não bastar, também o secundário. */
function slots(key: CalendarKey, year: number, total: number): number[] {
  const id = `${key}|${year}|${total}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const w = WINDOWS[key];
  const pick = (days: number[]) => {
    const out: number[] = [];
    for (let d = w.start; d <= w.end; d++) if (days.includes(weekdayOf(year, d))) out.push(d);
    return out;
  };
  let cand = pick([w.weekdays[0]]);
  if (cand.length < total && w.weekdays.length > 1) cand = pick(w.weekdays);
  // espalha as `total` rodadas por igual entre as datas possíveis (sempre em datas diferentes, se houver)
  const out: number[] = [];
  for (let k = 0; k < total; k++) {
    const i = total <= 1 ? Math.floor((cand.length - 1) / 2) : Math.round((k * (cand.length - 1)) / (total - 1));
    out.push(cand[Math.min(cand.length - 1, Math.max(0, i))] ?? w.start);
  }
  if (cache.size > 500) cache.clear();
  cache.set(id, out);
  return out;
}

/** Data (dia do ano) da `k`-ésima rodada (de `total`) de uma competição. */
export function matchDay(key: CalendarKey, year: number, k: number, total: number): number {
  return slots(key, year, total)[Math.min(total - 1, Math.max(0, k))];
}

/** Janela do meio do ano: 1º a 31 de julho (dias do ano). */
export function julyWindow(year: number): [number, number] {
  const start = Math.round((Date.UTC(year, 6, 1) - Date.UTC(year, 0, 0)) / 86400000);
  return [start, start + 30];
}

/** Dia do ano → [dia, mês] (para a interface). */
export function dayToDate(year: number, day: number): { d: number; m: number } {
  const dt = new Date(Date.UTC(year, 0, day));
  return { d: dt.getUTCDate(), m: dt.getUTCMonth() + 1 };
}

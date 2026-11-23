import { playKnockout, playMatch } from './match';
import type { Rng } from './rng';
import type { MatchResult, PlayoffResult, TableRow } from './types';

export interface LeagueContext {
  /** força efetiva do clube contra aquele adversário (bônus de clássico etc.) */
  strength(clubId: string, opponentId: string): number;
  /** vantagem de mando do clube quando joga em casa */
  homeAdv(clubId: string): number;
}

/** Tabela de turno e returno pelo método do círculo. Retorna rodadas com pares [mandante, visitante]. */
export function roundRobin(ids: readonly string[]): [string, string][][] {
  const list = ids.slice();
  if (list.length % 2 === 1) list.push('__bye__');
  const n = list.length;
  const rounds: [string, string][][] = [];
  const arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === '__bye__' || b === '__bye__') continue;
      // alterna mando para equilibrar
      round.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    // gira mantendo o primeiro fixo
    arr.splice(1, 0, arr.pop()!);
  }
  const second = rounds.map((round) => round.map(([h, a]) => [a, h] as [string, string]));
  return [...rounds, ...second];
}

export function emptyRow(clubId: string, deduction = 0): TableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: -deduction, deduction };
}

export function applyResult(table: Map<string, TableRow>, m: MatchResult): void {
  const h = table.get(m.home)!;
  const a = table.get(m.away)!;
  h.played++;
  a.played++;
  h.gf += m.hg;
  h.ga += m.ag;
  a.gf += m.ag;
  a.ga += m.hg;
  if (m.hg > m.ag) {
    h.won++;
    a.lost++;
    h.points += 3;
  } else if (m.hg < m.ag) {
    a.won++;
    h.lost++;
    a.points += 3;
  } else {
    h.drawn++;
    a.drawn++;
    h.points++;
    a.points++;
  }
}

/** Critérios: pontos, saldo, gols pró, vitórias, id (estável). */
export function sortTable(rows: TableRow[]): TableRow[] {
  return rows.slice().sort(
    (x, y) =>
      y.points - x.points ||
      y.gf - y.ga - (x.gf - x.ga) ||
      y.gf - x.gf ||
      y.won - x.won ||
      (x.clubId < y.clubId ? -1 : x.clubId > y.clubId ? 1 : 0),
  );
}

export interface LeagueRun {
  table: TableRow[];
  /** todas as rodadas com resultados (necessário para "última rodada decisiva") */
  rounds: MatchResult[][];
}

export function simulateLeague(
  rng: Rng,
  ids: readonly string[],
  ctx: LeagueContext,
  deductions: Record<string, number> = {},
): LeagueRun {
  const table = new Map<string, TableRow>();
  for (const id of ids) table.set(id, emptyRow(id, deductions[id] ?? 0));
  const schedule = roundRobin(ids);
  const rounds: MatchResult[][] = [];
  for (const round of schedule) {
    const results: MatchResult[] = [];
    for (const [h, a] of round) {
      const m = playMatch(rng, h, a, ctx.strength(h, a), ctx.strength(a, h), ctx.homeAdv(h));
      applyResult(table, m);
      results.push(m);
    }
    rounds.push(results);
  }
  return { table: sortTable([...table.values()]), rounds };
}

/**
 * Playoff de 4 clubes por 1 vaga: semis em jogo único na casa do melhor colocado
 * (1º x 4º, 2º x 3º do grupo), final em campo neutro.
 */
export function simulatePlayoff(rng: Rng, seeds: readonly string[], ctx: LeagueContext): PlayoffResult {
  if (seeds.length !== 4) throw new Error('playoff exige 4 clubes');
  const ko = (h: string, a: string, neutral: boolean) =>
    playKnockout(rng, h, a, ctx.strength(h, a), ctx.strength(a, h), neutral ? 0 : ctx.homeAdv(h));
  const s1 = ko(seeds[0], seeds[3], false);
  const s2 = ko(seeds[1], seeds[2], false);
  const final = ko(s1.winner!, s2.winner!, true);
  return { semis: [s1, s2], final, winner: final.winner! };
}

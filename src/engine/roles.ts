import { personalityOf } from './personality';
import type { Footballer } from './types';

/** Funções no time (modo técnico). null = o técnico deixa o auxiliar escolher. */
export interface Roles {
  captain: number | null;
  pens: number | null;
  fk: number | null;
}

/** Liderança: experiência, qualidade e jeito (leal e profissional seguram o grupo). */
export function leadership(f: Footballer): number {
  const j = personalityOf(f);
  return f.ovr * 0.5 + Math.min(f.age, 34) + (j === 'leal' || j === 'profissional' ? 5 : j === 'temperamental' ? -4 : 0);
}

const best = (list: Footballer[], score: (f: Footballer) => number): Footballer | null =>
  list.reduce<Footballer | null>((b, f) => (!b || score(f) > score(b) || (score(f) === score(b) && f.id < b.id) ? f : b), null);

/** Quem faz cada função entre os jogadores dados (o escolhido, se estiver ali; senão o mais indicado). */
export function resolveRoles(players: Footballer[], chosen?: Partial<Roles> | null): { captain: Footballer | null; pens: Footballer | null; fk: Footballer | null; vice: boolean } {
  const find = (id: number | null | undefined) => (id == null ? null : players.find((f) => f.id === id) ?? null);
  const autoCaptain = best(players, leadership);
  const captain = find(chosen?.captain) ?? autoCaptain;
  const shooters = players.filter((f) => f.pos === 'ATA' || f.pos === 'MEI');
  const pens = find(chosen?.pens) ?? best(shooters.length > 0 ? shooters : players, (f) => f.ovr + (f.pos === 'ATA' ? 2 : 0));
  const fk = find(chosen?.fk) ?? best(shooters.length > 0 ? shooters : players, (f) => f.ovr + (f.pos === 'MEI' ? 2 : 0));
  return { captain, pens, fk, vice: chosen?.captain != null && !find(chosen.captain) };
}

/** Força extra quando o time está perdendo e o capitão está em campo. */
export function captainBoost(captain: Footballer | null, vice: boolean): number {
  if (!captain) return 0;
  const j = personalityOf(captain);
  const b = 0.4 + (captain.age >= 30 ? 0.2 : 0) + (j === 'leal' || j === 'profissional' ? 0.2 : 0);
  return vice ? b / 2 : b;
}

/** Multiplicador de gols do cobrador de falta (bom batedor faz diferença). */
export function freeKickMult(fk: Footballer | null, avg: number): number {
  if (!fk) return 1;
  return 1 + Math.max(-0.03, Math.min(0.06, (fk.ovr - avg) * 0.004));
}

/** Bônus por cobrança na disputa de pênaltis. */
export function penaltyEdge(pens: Footballer | null, avg: number): number {
  if (!pens) return 0;
  return Math.max(-0.04, Math.min(0.05, (pens.ovr - avg) * 0.004));
}

import { TIERS } from '../data/pyramid';
import { develop, makeFootballer, retires, squadStrength } from './footballers';
import type { Rng } from './rng';
import type { Club, Footballer, Position, Tier } from './types';

/** Composição de um elenco da IA (20 jogadores). */
const PLAN: Position[] = ['GOL', 'GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA', 'ATA', 'DEF', 'MEI'];
export const AI_SQUAD_SIZE = PLAN.length;
const MIN_SQUAD = 18;

export interface IdSource {
  next: () => number;
  names: Set<string>;
  season: number;
}

/** Força-alvo de um clube da IA: média do nível + prestígio. */
export function targetStrength(c: Club): number {
  return TIERS[c.tier].meanStrength + (c.prestige ?? 0);
}

function newPlayer(rng: Rng, ids: IdSource, pos: Position, ovr: number, age: number): Footballer {
  return makeFootballer(rng, { id: ids.next(), pos, ovr, age, scout: 2, season: ids.season, contract: 3, names: ids.names });
}

/** Elenco inicial calibrado para que o time titular tenha a força `target`. */
export function generateSquad(rng: Rng, target: number, ids: IdSource): Footballer[] {
  const squad = PLAN.map((pos, i) => newPlayer(rng, ids, pos, target + (i < 11 ? 1 : -3) + rng.normal(2.5), rng.int(18, 33)));
  calibrate(squad, target);
  return squad;
}

/** Desloca o overall de todos para a força bater com o alvo (±0,3). */
export function calibrate(squad: Footballer[], target: number): void {
  for (let k = 0; k < 3; k++) {
    const diff = Math.round(target - squadStrength(squad));
    if (Math.abs(diff) < 1) return;
    for (const f of squad) {
      f.ovr = Math.max(25, Math.min(95, f.ovr + diff));
      f.pot = Math.max(f.pot + diff, f.ovr);
      f.potLo = Math.max(25, Math.min(99, f.potLo + diff));
      f.potHi = Math.max(f.potLo, Math.min(99, f.potHi + diff));
    }
  }
}

function weakestAt(squad: Footballer[], pos: Position): Footballer | undefined {
  return squad.filter((f) => f.pos === pos).sort((a, b) => a.ovr - b.ovr || a.id - b.id)[0];
}

function neededPosition(squad: Footballer[]): Position {
  const count: Record<Position, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  for (const f of squad) count[f.pos]++;
  const want: Record<Position, number> = { GOL: 2, DEF: 7, MEI: 7, ATA: 4 };
  let best: Position = 'MEI';
  let gap = -Infinity;
  for (const pos of ['GOL', 'DEF', 'MEI', 'ATA'] as Position[]) {
    const g = want[pos] - count[pos];
    if (g > gap) {
      gap = g;
      best = pos;
    }
  }
  return best;
}

export interface AiTransfer {
  player: string;
  from: string;
  to: string;
  ovr: number;
}

/**
 * Temporada da IA: todos evoluem e envelhecem, veteranos se aposentam, clubes que ficaram fortes demais para o nível
 * vendem o craque para clubes que precisam subir de patamar; quem ficou fraco se reforça.
 * Retorna as transferências entre clubes (viram notícia).
 */
export function evolveAiClubs(rng: Rng, clubs: Club[], ids: IdSource): AiTransfer[] {
  const transfers: AiTransfer[] = [];
  const market: { f: Footballer; from: Club }[] = [];

  for (const c of clubs) {
    const ct = Math.max(0, 4 - c.tier * 0.5);
    const { squad } = c;
    for (const f of squad) develop(rng, f, { ct, fitness: 1, inEleven: false });
    c.squad = squad.filter((f) => !retires(rng, f));
    for (const f of c.squad) f.contract = 3;
  }

  // clubes fortes demais para o nível vendem o melhor jogador
  for (const c of clubs) {
    for (let k = 0; k < 3 && squadStrength(c.squad) > targetStrength(c) + 1 && c.squad.length > 14; k++) {
      const star = c.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0];
      c.squad = c.squad.filter((f) => f !== star);
      market.push({ f: star, from: c });
    }
  }

  // reforços: primeiro do mercado de vendidos (se servirem), senão revelados/estrangeiros
  const needy = clubs.slice().sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1));
  for (const c of needy) {
    const target = targetStrength(c);
    for (let k = 0; k < 4; k++) {
      const strength = squadStrength(c.squad);
      if (c.squad.length >= MIN_SQUAD && strength >= target - 1) break;
      const pos = neededPosition(c.squad);
      const fitIdx = market.findIndex((m) => m.from !== c && m.f.ovr >= target - 1 && m.f.ovr <= target + 8);
      let incoming: Footballer;
      if (fitIdx >= 0 && strength < target - 1) {
        const { f, from } = market.splice(fitIdx, 1)[0];
        incoming = f;
        transfers.push({ player: f.name, from: from.name, to: c.name, ovr: f.ovr });
      } else {
        incoming = newPlayer(rng, ids, pos, target + rng.normal(2) + (strength < target - 1 ? 1 : -3), rng.int(19, 29));
      }
      c.squad.push(incoming);
      if (c.squad.length > AI_SQUAD_SIZE + 2) {
        const out = weakestAt(c.squad, incoming.pos);
        if (out && out !== incoming) c.squad = c.squad.filter((f) => f !== out);
      }
    }
    while (c.squad.length < MIN_SQUAD) c.squad.push(newPlayer(rng, ids, neededPosition(c.squad), target - 4 + rng.normal(2), rng.int(18, 24)));
  }
  return transfers;
}

/** Jogador de reposição para um clube da IA que acabou de vender alguém. */
export function replacementFor(rng: Rng, c: Club, ids: IdSource): Footballer {
  return newPlayer(rng, ids, neededPosition(c.squad), targetStrength(c) - 3 + rng.normal(2), rng.int(19, 27));
}

export function refreshStrength(c: Club): void {
  c.strength = Math.round(squadStrength(c.squad) * 10) / 10;
}



export function tierTarget(tier: Tier, prestige = 0): number {
  return TIERS[tier].meanStrength + prestige;
}

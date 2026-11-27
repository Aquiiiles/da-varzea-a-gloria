import { TIERS } from '../data/pyramid';
import { FOREIGN_FIRST, FOREIGN_LAST, REAL_SA, REAL_WORLD } from '../data/names';
import { julyWindow } from './calendar';
import { bestEleven, makeFootballer, marketValue, round1 } from './footballers';
import type { Rng } from './rng';
import type { Footballer, GameState, Listing, Offer, Tier } from './types';

/**
 * Mercado mais vivo: comissão de empresário, multa rescisória, empréstimo de clubes grandes,
 * craques estrangeiros, chegadas em julho e propostas de última hora.
 */

/** Comissão do empresário: 6% da taxa, ou 30% do salário anual quando vem de graça. */
export function agentFee(fee: number, wage: number): number {
  return Math.max(1, Math.round(fee > 0 ? fee * 0.06 : wage * 0.3));
}

/** Últimos dias da janela de julho (29 a 31): quando chegam as propostas de última hora. */
export function deadlineDays(year: number): [number, number] {
  const [, close] = julyWindow(year);
  return [close - 2, close];
}

/** Dia mostrado na temporada (ou null se não há temporada em andamento). */
function today(state: GameState): number | null {
  return state.live && state.calendar && state.reveal != null ? state.reveal : null;
}

/** O jogador do mercado já está disponível? (os de julho só na janela do meio do ano) */
export function listingOpen(state: GameState, l: Listing): boolean {
  if (!l.july) return true;
  const d = today(state);
  if (d === null) return false;
  const [open, close] = julyWindow(state.calendar!.year);
  return d >= open && d <= close;
}

/** A proposta já chegou? (as de última hora só nos últimos dias da janela) */
export function offerOpen(state: GameState, of: Offer): boolean {
  if (!of.july) {
    // proposta da pré-temporada: com a bola rolando, só dá para responder na janela de julho
    if (state.phase !== 'season') return true;
    const d = today(state);
    if (d === null) return false;
    const [open, close] = julyWindow(state.calendar!.year);
    return d >= open && d <= close;
  }
  const d = today(state);
  if (d === null) return false;
  const [from, to] = deadlineDays(state.calendar!.year);
  return d >= from && d <= to;
}

function foreignName(rng: Rng, taken: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const n = `${rng.pick(FOREIGN_FIRST)} ${rng.pick(FOREIGN_LAST)}`;
    if (!taken.has(n)) {
      taken.add(n);
      return n;
    }
  }
  return `${rng.pick(FOREIGN_FIRST)} ${rng.pick(FOREIGN_LAST)} Jr.`;
}

/** Craques estrangeiros (só Séries A e B): bons, caros e de salário alto. */
export function foreignListings(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number, names: Set<string>): Listing[] {
  if (tier > 2) return [];
  const mean = TIERS[tier].meanStrength;
  const out: Listing[] = [];
  const n = 1 + (rng.chance(0.5) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const f = makeFootballer(rng, { id: nextId(), ovr: mean + rng.int(4, 8), age: rng.int(23, 30), scout, season, contract: rng.int(2, 4), wageMult: rng.float(1.4, 1.8), names });
    const from = tier === 1 && rng.chance(0.3) ? rng.pick(REAL_WORLD) : rng.pick(REAL_SA);
    f.name = foreignName(rng, names);
    f.foreign = from;
    out.push({ player: f, fee: Math.round(marketValue(f) * rng.float(1.3, 1.6)), from, profile: 'pronto', kind: 'estrangeiro' });
  }
  return out;
}

/** Empréstimos de clubes maiores: reservas bons que o dono quer ver jogando. O dono paga metade do salário. */
export function loanListings(state: GameState, rng: Rng): Listing[] {
  const p = state.player;
  if (p.tier <= 1) return [];
  const owners = state.clubs.filter((c) => c.tier < p.tier && c.tier >= p.tier - 2 && c.squad.length > 16);
  const out: Listing[] = [];
  const mean = TIERS[p.tier].meanStrength;
  for (const club of rng.shuffle(owners.slice())) {
    if (out.length >= 2) break;
    const xi = bestEleven(club.squad).ids;
    const cand = club.squad.filter((f) => !xi.has(f.id) && f.age <= 26 && f.ovr >= mean && !out.some((l) => l.player.id === f.id));
    if (cand.length === 0) continue;
    const f = rng.pick(cand);
    const loaned: Footballer = { ...f, wage: round1(f.wage * 0.5), contract: 1, loan: { clubId: club.id, club: club.name, wage: f.wage }, intent: undefined, askWage: undefined, leaving: undefined };
    out.push({ player: loaned, fee: Math.round(marketValue(f) * 0.05), from: club.name, profile: f.age <= 21 ? 'promessa' : 'pronto', kind: 'emprestimo', clubId: club.id });
  }
  return out;
}

/** Chegadas de julho: jogadores livres (voltando do exterior ou dispensados) que só aparecem no meio do ano. */
export function julyListings(rng: Rng, tier: Tier, scout: number, nextId: () => number, season: number, names: Set<string>): Listing[] {
  const mean = TIERS[tier].meanStrength;
  const out: Listing[] = [];
  const n = 2 + (rng.chance(0.5) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const back = rng.chance(0.4);
    const f = makeFootballer(rng, { id: nextId(), ovr: mean + rng.int(-3, back ? 4 : 2), age: rng.int(back ? 27 : 22, back ? 33 : 30), scout, season, contract: rng.int(1, 2), wageMult: rng.float(1.2, 1.5), names });
    out.push({ player: f, fee: 0, from: back ? 'Volta do exterior' : 'Sem clube', profile: 'livre', july: true });
  }
  return out;
}

/** Propostas de última hora (fim da janela de julho): pagam bem, mas tiram um jogador no meio da temporada. */
export function deadlineOffers(rng: Rng, squad: readonly Footballer[], tier: Tier, buyers: { name: string; tier: Tier }[], taken: Set<number>): Offer[] {
  if (buyers.length === 0 || !rng.chance(0.6)) return [];
  const mean = TIERS[tier].meanStrength;
  const cand = squad.filter((f) => !taken.has(f.id) && !f.loan && f.ovr >= mean);
  if (cand.length === 0) return [];
  const f = rng.pick(cand);
  const buyer = rng.pick(buyers);
  const fee = Math.round(marketValue(f) * rng.float(1.15, 1.45) * (1 + (tier - buyer.tier) * 0.08));
  return [{ playerId: f.id, fee, club: buyer.name, clubTier: buyer.tier, max: Math.round(fee * rng.float(1.02, 1.15)), final: rng.chance(0.5), july: true }];
}

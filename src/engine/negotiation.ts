import { TIERS } from '../data/pyramid';
import { bestEleven, marketValue, marketWage, round1 } from './footballers';
import { hashSeed } from './rng';
import type { Club, Footballer, GameState, Negotiation, Tier } from './types';

export const MAX_ROUNDS = 3;

/** Traço de personalidade estável por jogador (0..1), derivado da seed. */
function trait(state: GameState, f: Footballer, label: string): number {
  return (hashSeed(state.seed, label, f.id) % 1000) / 1000;
}

/** Quanto o clube pede: valor de mercado x importância no time x divisão. */
export function clubAsking(state: GameState, club: Club, f: Footballer): number {
  const xi = bestEleven(club.squad).ids;
  const best = club.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0];
  const importance = best?.id === f.id ? 1.6 : xi.has(f.id) ? 1.3 : 1;
  // vender para um clube menor custa mais; o clube grande cobra caro de quem está abaixo
  const direction = club.tier < state.player.tier ? 1 + 0.08 * (state.player.tier - club.tier) : 0.95;
  const greed = 0.9 + trait(state, f, 'club-greed') * 0.3;
  return Math.max(1, Math.round(marketValue(f) * importance * direction * greed));
}

/** Salário anual que o jogador quer para se mudar. */
export function playerAsking(state: GameState, club: Club, f: Footballer): number {
  const drop = Math.max(0, state.player.tier - club.tier); // quantos níveis ele desce
  const ambition = 0.95 + trait(state, f, 'player-greed') * 0.25;
  return round1(Math.max(f.wage * 1.05, marketWage(f.ovr) * (1 + 0.15 * drop)) * ambition);
}

/** O jogador topa conversar? (não quer descer 3 ou mais níveis sem um salário muito alto) */
export function willingToDrop(state: GameState, club: Club): boolean {
  return state.player.tier - club.tier < 3;
}

export interface BidOutcome {
  status: Negotiation['status'];
  message: string;
  askFee?: number;
  askWage?: number;
}

/**
 * Avalia uma proposta. O clube decide pela taxa; o jogador, pelo salário.
 * Até 80% do pedido o clube faz contraproposta; abaixo disso, recusa. O jogador idem com 85% do salário.
 */
export function evaluateBid(state: GameState, club: Club, f: Footballer, fee: number, wage: number, rounds: number): BidOutcome {
  const ask = clubAsking(state, club, f);
  const want = playerAsking(state, club, f);
  const last = rounds >= MAX_ROUNDS;
  if (fee < ask) {
    if (fee >= ask * 0.8 && !last) return { status: 'contra_clube', message: `${club.name} pede R$ ${ask} mil para liberar ${f.name}.`, askFee: ask };
    return { status: last ? 'encerrada' : 'recusada', message: last ? `${club.name} encerra a conversa.` : `${club.name} recusa: proposta muito abaixo do que vale ${f.name}.` };
  }
  const tooFar = !willingToDrop(state, club);
  const needed = tooFar ? want * 1.4 : want;
  if (wage < needed) {
    if (wage >= needed * 0.85 && !last) {
      return {
        status: 'contra_jogador',
        message: `${club.name} aceita a taxa. ${f.name} pede R$ ${Math.round(needed)} mil por temporada${tooFar ? ' (para descer de divisão, só ganhando bem)' : ''}.`,
        askWage: round1(needed),
      };
    }
    return {
      status: last ? 'encerrada' : 'recusada',
      message: tooFar ? `${f.name} não quer descer para a ${TIERS[state.player.tier].name} por esse salário.` : `${f.name} recusa o salário oferecido.`,
    };
  }
  return { status: 'aceita', message: `Acerto fechado! ${f.name} é do ${state.player.name}.` };
}

export function negotiationFor(state: GameState, clubId: string, playerId: number): Negotiation | undefined {
  return state.office.negotiations.find((n) => n.clubId === clubId && n.playerId === playerId);
}

export function levelGap(a: Tier, b: Tier): number {
  return a - b;
}

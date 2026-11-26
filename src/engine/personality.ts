import { hashSeed } from './rng';
import type { Footballer } from './types';

/** Jeito do jogador: muda como ele reage ao banco, às conversas, aos cartões e ao contrato. */
export type Personality = 'ambicioso' | 'leal' | 'temperamental' | 'profissional' | 'equilibrado';

export const PERSONALITY_INFO: Record<Personality, { label: string; effect: string }> = {
  ambicioso: { label: 'Ambicioso', effect: 'Odeia o banco e sonha com clube maior.' },
  leal: { label: 'Leal', effect: 'Aguenta o banco e gosta de renovar.' },
  temperamental: { label: 'Temperamental', effect: 'Leva mais cartão e não aceita bronca.' },
  profissional: { label: 'Profissional', effect: 'Aceita cobrança e quase não leva cartão.' },
  equilibrado: { label: 'Equilibrado', effect: 'Sem surpresas.' },
};

/** Fixo por jogador (vem do id e do nome), igual em toda run com a mesma seed. */
export function personalityOf(f: Pick<Footballer, 'id' | 'name'>): Personality {
  const x = hashSeed('jeito', f.id, f.name) % 100;
  return x < 16 ? 'ambicioso' : x < 32 ? 'leal' : x < 46 ? 'temperamental' : x < 62 ? 'profissional' : 'equilibrado';
}

/** Multiplicador da queda de moral por ficar no banco. */
export function benchFactor(p: Personality): number {
  return p === 'ambicioso' ? 1.5 : p === 'leal' ? 0.5 : p === 'profissional' ? 0.75 : 1;
}

/** Multiplicador da chance de cartão. */
export function cardFactor(p: Personality): number {
  return p === 'temperamental' ? 1.5 : p === 'profissional' ? 0.7 : 1;
}

/** Moral mínima para uma cobrança dar certo. */
export function scoldThreshold(p: Personality): number {
  return p === 'profissional' ? 30 : p === 'temperamental' ? 65 : 45;
}

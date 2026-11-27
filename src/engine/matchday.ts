import { personName } from './names';
import { createRng, hashSeed } from './rng';
import type { Footballer, Tactic } from './types';

/* ------------------------------ leitura do adversário ------------------------------ */

/** Como o adversário costuma jogar (fixo na temporada; o auxiliar avisa antes do jogo). */
export type OppProfile = 'pressiona' | 'cansa' | 'bola_parada' | 'contra_ataque' | 'retranca' | 'equilibrado';

export const OPP_PROFILE_INFO: Record<OppProfile, { label: string; tip: string }> = {
  pressiona: { label: 'Pressiona no começo', tip: 'Eles vêm com tudo nos primeiros 30 minutos e cansam depois. Segure o começo e cresça no 2º tempo.' },
  cansa: { label: 'Cansa no 2º tempo', tip: 'O fôlego deles acaba depois dos 60. Guarde trocas para o fim e aperte.' },
  bola_parada: { label: 'Forte na bola parada', tip: 'Fazem muito gol de escanteio. Marcação individual neutraliza.' },
  contra_ataque: { label: 'Mata no contra-ataque', tip: 'Se você se lançar (ofensivo ou pressão alta), eles castigam. Jogue equilibrado.' },
  retranca: { label: 'Fecha a casinha', tip: 'Defendem com todo mundo. Só pressão alta ou time ofensivo abre a defesa.' },
  equilibrado: { label: 'Sem ponto fraco claro', tip: 'Time equilibrado: jogue o seu jogo.' },
};

const PROFILES: OppProfile[] = ['pressiona', 'cansa', 'bola_parada', 'contra_ataque', 'retranca', 'equilibrado'];

export function opponentProfile(seed: number, season: number, oppKey: string): OppProfile {
  return PROFILES[hashSeed(seed, season, 'perfil', oppKey) % PROFILES.length];
}

/* ------------------------------ bola parada ------------------------------ */

export interface SetPieces {
  /** escanteio: curto (troca de passes) ou na área (cruzamento) */
  corner: 'curto' | 'area';
  /** marcação na bola parada deles */
  marking: 'zona' | 'individual';
}

export const DEFAULT_SET_PIECES: SetPieces = { corner: 'curto', marking: 'zona' };

/* ------------------------------ árbitro ------------------------------ */

export type RefProfile = 'rigoroso' | 'caseiro' | 'deixa_jogar' | 'normal';

export const REF_INFO: Record<RefProfile, { label: string; text: string }> = {
  rigoroso: { label: 'Rigoroso', text: 'Cartão fácil. Pressão alta e marcação individual custam caro.' },
  caseiro: { label: 'Caseiro', text: 'Costuma ajudar o mandante.' },
  deixa_jogar: { label: 'Deixa o jogo correr', text: 'Poucos cartões: dá para apertar mais.' },
  normal: { label: 'Normal', text: 'Sem tendência.' },
};

export function refereeFor(seed: number, season: number, day: number): { name: string; profile: RefProfile } {
  const rng = createRng(hashSeed(seed, season, 'arbitro', day));
  const roll = rng.next();
  const profile: RefProfile = roll < 0.25 ? 'rigoroso' : roll < 0.45 ? 'caseiro' : roll < 0.65 ? 'deixa_jogar' : 'normal';
  return { name: personName(rng), profile };
}

export function refCardFactor(p: RefProfile): number {
  return p === 'rigoroso' ? 1.4 : p === 'deixa_jogar' ? 0.7 : 1;
}

/* ------------------------------ efeitos por bloco ------------------------------ */

export interface BlockMods {
  /** variação de força [meu time, adversário] */
  delta: [number, number];
  /** multiplicador de gols [meus, deles] */
  mult: [number, number];
}

/**
 * Tudo o que muda no bloco além da escalação: o jeito do adversário, bola parada, árbitro caseiro e torcida.
 * `behind` = seu time está perdendo no começo do bloco.
 */
export function blockMods(o: {
  block: number;
  profile: OppProfile;
  tactic: Tactic | null;
  setPieces: SetPieces;
  home: boolean;
  ref: RefProfile;
  behind: boolean;
  mood: number;
  setPieceEdge: number;
}): BlockMods {
  const d: [number, number] = [0, 0];
  const m: [number, number] = [1, 1];
  const attacking = o.tactic === 'ofensivo' || o.tactic === 'pressao';
  switch (o.profile) {
    case 'pressiona':
      if (o.block < 6) m[1] *= 1.15;
      else if (o.block >= 12) m[1] *= 0.92;
      break;
    case 'cansa':
      if (o.block >= 12) d[1] -= 1.5;
      break;
    case 'bola_parada':
      if (o.setPieces.marking !== 'individual') m[1] *= 1.08;
      break;
    case 'contra_ataque':
      if (attacking) m[1] *= 1.12;
      break;
    case 'retranca':
      m[0] *= attacking ? 0.97 : 0.88;
      m[1] *= 0.9;
      break;
  }
  // bola parada: cruzamento na área rende com zagueiro bom de cabeça, mas expõe ao contra-ataque
  if (o.setPieces.corner === 'area') {
    m[0] *= 1 + o.setPieceEdge;
    m[1] *= 1.02;
  }
  if (o.setPieces.marking === 'individual') m[1] *= 0.97;
  // árbitro caseiro
  if (o.ref === 'caseiro') d[o.home ? 0 : 1] += 0.6;
  // torcida: em casa, perdendo, o estádio empurra (ou vaia)
  if (o.home && o.behind) {
    if (o.mood >= 60) d[0] += 0.3 + ((o.mood - 60) / 40) * 0.4;
    else if (o.mood < 30) d[0] -= 0.4;
  }
  return { delta: d, mult: m };
}

/** Bônus do escanteio na área: o melhor zagueiro contra a média do time. */
export function setPieceEdge(xi: Footballer[]): number {
  const defs = xi.filter((f) => f.pos === 'DEF');
  if (defs.length === 0 || xi.length === 0) return 0;
  const best = Math.max(...defs.map((f) => f.ovr));
  const avg = xi.reduce((s, f) => s + f.ovr, 0) / xi.length;
  return Math.max(-0.02, Math.min(0.06, (best - avg) * 0.005));
}

/** Cartões no clássico: quanto maior a tensão, mais pegado. */
export function derbyCardFactor(hatred: number): number {
  return 1 + hatred / 150;
}

import { positionPenalty } from './footballers';
import { hashSeed } from './rng';
import type { Footballer, Formation, Position } from './types';

/**
 * Posição detalhada (modo técnico). O motor geral continua com GOL/DEF/MEI/ATA; aqui é a camada de cima:
 * lateral ou zagueiro, volante ou meia, ponta ou centroavante. Fixa por jogador (vem do id e do nome).
 */
export type Detail = 'GOL' | 'LAT' | 'ZAG' | 'VOL' | 'MEI' | 'PON' | 'CA';

export const DETAIL_GROUP: Record<Detail, Position> = { GOL: 'GOL', LAT: 'DEF', ZAG: 'DEF', VOL: 'MEI', MEI: 'MEI', PON: 'ATA', CA: 'ATA' };
export const DETAIL_LABEL: Record<Detail, string> = { GOL: 'Goleiro', LAT: 'Lateral', ZAG: 'Zagueiro', VOL: 'Volante', MEI: 'Meia', PON: 'Ponta', CA: 'Centroavante' };

export function detailOf(f: Pick<Footballer, 'id' | 'name' | 'pos'>): Detail {
  const x = hashSeed('posicao', f.id, f.name) % 100;
  switch (f.pos) {
    case 'GOL':
      return 'GOL';
    case 'DEF':
      return x < 58 ? 'ZAG' : 'LAT';
    case 'MEI':
      return x < 45 ? 'VOL' : 'MEI';
    case 'ATA':
      return x < 40 ? 'PON' : 'CA';
  }
}

/** Vagas detalhadas de cada esquema, na mesma ordem de `formationSlots` (goleiro, defesa, meio, ataque; da esquerda para a direita). */
export const FORMATION_DETAILS: Record<Formation, Detail[]> = {
  '4-4-2': ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'MEI', 'VOL', 'VOL', 'MEI', 'CA', 'CA'],
  '4-3-3': ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'MEI', 'VOL', 'MEI', 'PON', 'CA', 'PON'],
  // no 3-5-2 os alas são laterais que jogam no meio
  '3-5-2': ['GOL', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'VOL', 'MEI', 'VOL', 'LAT', 'CA', 'CA'],
  '4-5-1': ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'PON', 'VOL', 'MEI', 'VOL', 'PON', 'CA'],
};

/** Perda de quem joga numa vaga: na posição exata nada; mesma área, um pouco; outra área, a perda de sempre. */
export function slotPenalty(slot: Detail, f: Pick<Footballer, 'id' | 'name' | 'pos'>): number {
  const d = detailOf(f);
  if (d === slot) return 0;
  if (DETAIL_GROUP[slot] === f.pos) return 2;
  // ala: lateral no meio e meia aberto no ataque são improvisos leves
  if ((slot === 'LAT' && d === 'PON') || (slot === 'PON' && d === 'LAT')) return 3;
  return positionPenalty(DETAIL_GROUP[slot], f.pos);
}

/** O melhor XI nas vagas do esquema (cada um na melhor vaga possível). `bonus` favorece escolhidos. */
export function bestLineup(squad: readonly Footballer[], formation: Formation, bonus?: (f: Footballer) => number): number[] {
  const slots = FORMATION_DETAILS[formation];
  const pairs: { s: number; f: Footballer; v: number }[] = [];
  for (let s = 0; s < slots.length; s++) for (const f of squad) pairs.push({ s, f, v: f.ovr + (bonus?.(f) ?? 0) - slotPenalty(slots[s], f) });
  pairs.sort((a, b) => b.v - a.v || a.f.id - b.f.id || a.s - b.s);
  const out: (number | null)[] = slots.map(() => null);
  const used = new Set<number>();
  for (const p of pairs) {
    if (out[p.s] !== null || used.has(p.f.id)) continue;
    out[p.s] = p.f.id;
    used.add(p.f.id);
  }
  return out.filter((x): x is number => x !== null);
}

/** Põe os escolhidos nas vagas, cada um onde rende mais. */
export function arrangeLineup(squad: readonly Footballer[], ids: readonly number[], formation: Formation): number[] {
  const set = new Set(ids);
  return bestLineup(squad.filter((f) => set.has(f.id)), formation);
}

/* ------------------------------ características ------------------------------ */

export type Trait = 'velocidade' | 'cabeceio' | 'finalizacao' | 'passe' | 'marcacao' | 'drible' | 'reflexo';

export const TRAIT_INFO: Record<Trait, { label: string; short: string; effect: string }> = {
  velocidade: { label: 'Rápido', short: 'VEL', effect: 'Decide no contra-ataque.' },
  cabeceio: { label: 'Cabeceador', short: 'CAB', effect: 'Bola parada na área rende mais.' },
  finalizacao: { label: 'Finalizador', short: 'FIN', effect: 'Faz mais gols.' },
  passe: { label: 'Bom passe', short: 'PAS', effect: 'O time cria mais.' },
  marcacao: { label: 'Marcador', short: 'MAR', effect: 'O adversário cria menos.' },
  drible: { label: 'Driblador', short: 'DRI', effect: 'Abre defesas fechadas.' },
  reflexo: { label: 'Reflexo', short: 'REF', effect: 'Goleiro que pega mais, inclusive pênalti.' },
};

const TRAIT_POOL: Record<Detail, Trait[]> = {
  GOL: ['reflexo'],
  ZAG: ['cabeceio', 'marcacao'],
  LAT: ['velocidade', 'marcacao', 'passe'],
  VOL: ['marcacao', 'passe'],
  MEI: ['passe', 'drible', 'finalizacao'],
  PON: ['velocidade', 'drible'],
  CA: ['finalizacao', 'cabeceio', 'velocidade'],
};

/** Características do jogador (0 a 2), fixas. */
export function traitsOf(f: Pick<Footballer, 'id' | 'name' | 'pos'>): Trait[] {
  const pool = TRAIT_POOL[detailOf(f)];
  const x = hashSeed('caracteristica', f.id, f.name);
  const n = x % 10 < 1 ? 0 : x % 10 < 8 ? 1 : 2;
  const first = pool[Math.floor(x / 10) % pool.length];
  if (n === 0) return [];
  if (n === 1 || pool.length === 1) return [first];
  return [first, pool[(pool.indexOf(first) + 1 + (Math.floor(x / 100) % (pool.length - 1))) % pool.length]];
}

/** Efeito das características de quem está em campo. */
export function traitMods(field: readonly Footballer[], o: { tactic: string | null; profile: string; corner: string }): { mine: number; theirs: number; penAgainst: number } {
  const count = (t: Trait, pos?: Position[]) => field.filter((f) => (!pos || pos.includes(f.pos)) && traitsOf(f).includes(t)).length;
  const cap = (n: number, each: number, max: number) => Math.min(max, n * each);
  let mine = 1 + cap(count('finalizacao', ['MEI', 'ATA']), 0.02, 0.06) + cap(count('passe'), 0.015, 0.045);
  mine += cap(count('drible'), o.profile === 'retranca' ? 0.03 : 0.015, 0.06);
  mine += cap(count('velocidade'), o.tactic === 'contra_ataque' ? 0.04 : 0.01, o.tactic === 'contra_ataque' ? 0.08 : 0.03);
  if (o.corner === 'area') mine += cap(count('cabeceio'), 0.015, 0.045);
  let theirs = 1 - cap(count('marcacao'), 0.02, 0.06);
  if (o.profile === 'bola_parada') theirs -= cap(count('cabeceio', ['DEF']), 0.01, 0.03);
  const keeper = field.some((f) => f.pos === 'GOL' && traitsOf(f).includes('reflexo'));
  if (keeper) theirs -= 0.04;
  return { mine, theirs, penAgainst: keeper ? -0.04 : 0 };
}

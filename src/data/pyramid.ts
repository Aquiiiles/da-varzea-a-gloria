import type { Tier } from '../engine/types';

export interface TierRules {
  tier: Tier;
  name: string;
  short: string;
  size: number;
  /** quantos sobem direto */
  autoUp: number;
  /** posições do playoff de acesso [de, até], 1 vaga */
  playoff: [number, number] | null;
  /** quantos caem */
  down: number;
  /** capacidade mínima de estádio para JOGAR nesta divisão */
  minStadium: number;
  /** overall médio dos clubes da IA */
  meanStrength: number;
  spread: number;
  /** escala de dinheiro (oportunidades, eventos, peneira) */
  moneyScale: number;
  /** cota de TV por temporada (mil £); a premiação por posição soma até +40% */
  tv: number;
  /** patrocínio master de referência por temporada (mil £) */
  sponsor: number;
  /** ingresso de referência (mil £ por torcedor por jogo) */
  ticket: number;
  /** torcida típica de um clube desta divisão */
  typicalFans: number;
}

/**
 * Pirâmide simplificada. A conta fecha: quem sobe da divisão N+1 = quem cai da N,
 * então todas as divisões mantêm o tamanho. Os 3 últimos da Liga Regional (nível 8)
 * deixam a pirâmide e são substituídos por clubes recém-filiados.
 *
 * Receita típica por temporada (mil £): 8: ~150 · 7: ~300 · 6: ~650 · 5: ~1,5 mi ·
 * 4: ~4 mi · 3: ~10 mi · 2: ~30 mi · 1: ~150 mi.
 */
export const TIERS: Record<Tier, TierRules> = {
  1: { tier: 1, name: 'Premier', short: 'PRE', size: 20, autoUp: 0, playoff: null, down: 3, minStadium: 20000, meanStrength: 78, spread: 3.5, moneyScale: 1000, tv: 52000, sponsor: 40000, ticket: 0.065, typicalFans: 40000 },
  2: { tier: 2, name: 'Championship', short: 'CHA', size: 24, autoUp: 2, playoff: [3, 6], down: 3, minStadium: 12000, meanStrength: 74, spread: 2.5, moneyScale: 200, tv: 10000, sponsor: 8000, ticket: 0.023, typicalFans: 20000 },
  3: { tier: 3, name: 'Liga 1', short: 'L1', size: 24, autoUp: 2, playoff: [3, 6], down: 4, minStadium: 8000, meanStrength: 70, spread: 2.5, moneyScale: 67, tv: 3300, sponsor: 2800, ticket: 0.015, typicalFans: 10000 },
  4: { tier: 4, name: 'Liga 2', short: 'L2', size: 24, autoUp: 3, playoff: [4, 7], down: 2, minStadium: 5000, meanStrength: 66, spread: 2.5, moneyScale: 27, tv: 1300, sponsor: 1100, ticket: 0.012, typicalFans: 5000 },
  5: { tier: 5, name: 'Nacional', short: 'NAC', size: 24, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 3000, meanStrength: 62, spread: 2.5, moneyScale: 10, tv: 480, sponsor: 420, ticket: 0.0105, typicalFans: 2200 },
  6: { tier: 6, name: 'Nacional Norte/Sul', short: 'NNS', size: 22, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 1500, meanStrength: 58, spread: 2.5, moneyScale: 4.3, tv: 210, sponsor: 180, ticket: 0.01, typicalFans: 1000 },
  7: { tier: 7, name: 'Liga Regional Premier', short: 'LRP', size: 22, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 800, meanStrength: 54, spread: 2.5, moneyScale: 2, tv: 95, sponsor: 85, ticket: 0.01, typicalFans: 500 },
  8: { tier: 8, name: 'Liga Regional', short: 'LR', size: 20, autoUp: 1, playoff: [2, 5], down: 3, minStadium: 0, meanStrength: 50, spread: 2.5, moneyScale: 1, tv: 45, sponsor: 40, ticket: 0.01, typicalFans: 250 },
};

export const ALL_TIERS: Tier[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const BOTTOM_TIER: Tier = 8;
export const MAX_SEASONS = 25;
export const START_YEAR = 2027;

/** Limites do elenco profissional. */
export const SQUAD_MIN = 16;
export const SQUAD_MAX = 28;
export const YOUTH_MAX = 10;
/** Máximo de jovens emprestados ao mesmo tempo e idade máxima para emprestar. */
export const MAX_LOANS = 4;
export const LOAN_AGE_LIMIT = 21;
/** Idade em que o garoto da base precisa subir ou ser dispensado. */
export const YOUTH_AGE_LIMIT = 19;

/** Custo de cada nível de instalação (CT, base, departamento médico). Índice = nível a construir − 1. */
export const FACILITY_COST = [60, 220, 800, 2800, 9000];
/** Manutenção anual = 10% do custo acumulado das instalações. */
export const FACILITY_UPKEEP_RATE = 0.1;
/** Salário anual do staff por nível (0–4). */
export const STAFF_WAGE = [0, 12, 50, 220, 900];
/** Manutenção anual por lugar no estádio (mil £). */
export const SEAT_UPKEEP = 0.008;
/** Ampliações: % da capacidade atual e mínimo de lugares. */
export const SEAT_PACKS: { pct: number; min: number; label: string }[] = [
  { pct: 0.25, min: 200, label: 'Arquibancada extra' },
  { pct: 0.6, min: 600, label: 'Novo setor' },
  { pct: 1.2, min: 2000, label: 'Estádio novo' },
];

export function seatCost(capacity: number): number {
  return 0.15 + (capacity / 20000) * 0.5;
}

export function tierUp(t: Tier): Tier {
  return (t > 1 ? t - 1 : 1) as Tier;
}
export function tierDown(t: Tier): Tier {
  return (t < 8 ? t + 1 : 8) as Tier;
}

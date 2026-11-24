import type { Tier } from '../engine/types';

/**
 * Escada do futebol brasileiro (nomes genéricos, sem marcas):
 * 1 Série A · 2 Série B · 3 Série C · 4 Série D · 5 Estadual (1ª divisão) · 6 Estadual Série B · 7 Várzea.
 *
 * O "nível" de um clube é a divisão nacional, se tiver; senão, a divisão estadual.
 * Clubes nacionais do nosso estado também jogam o Estadual no 1º semestre.
 *
 * Valores de dinheiro em R$ mil. Receita típica por temporada:
 * Várzea ~R$ 400 mil · Estadual B ~R$ 700 mil · Estadual ~R$ 1,3 mi · Série D ~R$ 2,5 mi ·
 * Série C ~R$ 6 mi · Série B ~R$ 18 mi · Série A ~R$ 110 mi.
 */
export interface TierRules {
  tier: Tier;
  name: string;
  short: string;
  /** capacidade mínima de estádio para disputar este nível */
  minStadium: number;
  /** overall médio dos clubes da IA deste nível */
  meanStrength: number;
  spread: number;
  /** escala de dinheiro (oportunidades, eventos, peneira, empréstimos) */
  moneyScale: number;
  /** cota de TV/federação + premiação base por temporada (R$ mil) */
  tv: number;
  /** patrocínio master de referência (R$ mil) */
  sponsor: number;
  /** ingresso médio (R$ mil por torcedor por jogo) */
  ticket: number;
  /** torcida típica de um clube deste nível */
  typicalFans: number;
}

export const TIERS: Record<Tier, TierRules> = {
  1: { tier: 1, name: 'Série A', short: 'A', minStadium: 20000, meanStrength: 72, spread: 3.5, moneyScale: 730, tv: 45000, sponsor: 30000, ticket: 0.06, typicalFans: 35000 },
  2: { tier: 2, name: 'Série B', short: 'B', minStadium: 12000, meanStrength: 67, spread: 2.5, moneyScale: 113, tv: 4000, sponsor: 3000, ticket: 0.04, typicalFans: 15000 },
  3: { tier: 3, name: 'Série C', short: 'C', minStadium: 8000, meanStrength: 62, spread: 2.5, moneyScale: 43, tv: 1500, sponsor: 1600, ticket: 0.03, typicalFans: 8000 },
  4: { tier: 4, name: 'Série D', short: 'D', minStadium: 4000, meanStrength: 57.5, spread: 2.5, moneyScale: 16.7, tv: 600, sponsor: 700, ticket: 0.025, typicalFans: 4000 },
  5: { tier: 5, name: 'Estadual', short: 'EST', minStadium: 2000, meanStrength: 53.5, spread: 2.5, moneyScale: 8.7, tv: 450, sponsor: 400, ticket: 0.02, typicalFans: 2500 },
  6: { tier: 6, name: 'Estadual Série B', short: 'EB', minStadium: 500, meanStrength: 49.5, spread: 2.5, moneyScale: 4.7, tv: 300, sponsor: 300, ticket: 0.015, typicalFans: 800 },
  7: { tier: 7, name: 'Várzea', short: 'VÁR', minStadium: 0, meanStrength: 45.5, spread: 2.5, moneyScale: 2.7, tv: 170, sponsor: 200, ticket: 0.01, typicalFans: 300 },
};

export const ALL_TIERS: Tier[] = [1, 2, 3, 4, 5, 6, 7];
export const NATIONAL_TIERS: Tier[] = [1, 2, 3, 4];
export const BOTTOM_TIER: Tier = 7;
export const MAX_SEASONS = 50;
export const START_YEAR = 2027;

/** Tamanho das competições. */
export const SIZES = {
  serieA: 20,
  serieB: 20,
  serieC: 20,
  serieD: 32,
  estadualA: 16,
  estadualB: 16,
  varzea: 20,
  /** clubes de outros estados sem divisão nacional (fonte das vagas da Série D e da Copa Nacional) */
  pool: 44,
};

/** Clubes do nosso estado em cada divisão nacional no começo do jogo. */
export const OUR_STATE_NATIONAL: Record<1 | 2 | 3 | 4, number> = { 1: 2, 2: 2, 3: 2, 4: 2 };

/** Vagas do nosso estado na Série D (pelo Estadual). */
export const SERIE_D_SPOTS = 2;

/** Limites do elenco profissional. */
export const SQUAD_MIN = 16;
export const SQUAD_MAX = 28;
export const YOUTH_MAX = 10;
/** Máximo de jovens emprestados ao mesmo tempo e idade máxima para emprestar. */
export const MAX_LOANS = 4;
export const LOAN_AGE_LIMIT = 21;
/** Idade em que o garoto da base precisa subir ou ser dispensado. */
export const YOUTH_AGE_LIMIT = 19;

/** Custo de cada nível de instalação (CT, base, departamento médico), R$ mil. */
export const FACILITY_COST = [160, 600, 2200, 7500, 24000];
/** Manutenção anual = 10% do custo acumulado das instalações. */
export const FACILITY_UPKEEP_RATE = 0.1;
/** Salário anual do staff por nível (0–4), R$ mil. */
export const STAFF_WAGE = [0, 30, 135, 600, 2400];
/** Manutenção anual por lugar no estádio (R$ mil). */
export const SEAT_UPKEEP = 0.02;
/** Ampliações: % da capacidade atual e mínimo de lugares. */
export const SEAT_PACKS: { pct: number; min: number; label: string }[] = [
  { pct: 0.25, min: 200, label: 'Arquibancada extra' },
  { pct: 0.6, min: 600, label: 'Novo setor' },
  { pct: 1.2, min: 2000, label: 'Estádio novo' },
];

/**
 * Custo por lugar (R$ mil): fica mais caro em estádios grandes.
 * Arquibancada simples sai a ~R$ 130 por lugar; arena de Série A, ~R$ 500.
 */
export function seatCost(capacity: number): number {
  return 0.12 + (capacity / 20000) * 0.6;
}

/** Obra parcelada: entrada à vista + o restante com juros em parcelas anuais. */
export const STADIUM_FINANCE = { down: 0.25, interest: 0.2, seasons: 3 };
export const LOAN_NAME = 'Parcela do empréstimo';
export const STADIUM_INSTALLMENT_NAME = 'Parcela da obra do estádio';

export function tierUp(t: Tier): Tier {
  return (t > 1 ? t - 1 : 1) as Tier;
}
export function tierDown(t: Tier): Tier {
  return (t < 7 ? t + 1 : 7) as Tier;
}

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
  /** força média dos clubes da IA */
  meanStrength: number;
  spread: number;
  /** multiplicador de custos e receitas */
  moneyScale: number;
  /** cota de TV / premiação por temporada (mil £) */
  tv: number;
  /** torcida típica de um clube desta divisão */
  typicalFans: number;
}

/**
 * Pirâmide simplificada. A conta fecha: quem sobe da divisão N+1 = quem cai da N,
 * então todas as divisões mantêm o tamanho. Os 3 últimos da Liga Regional (nível 8)
 * deixam a pirâmide e são substituídos por clubes recém-filiados.
 */
export const TIERS: Record<Tier, TierRules> = {
  1: { tier: 1, name: 'Premier', short: 'PRE', size: 20, autoUp: 0, playoff: null, down: 3, minStadium: 20000, meanStrength: 80, spread: 7, moneyScale: 65, tv: 1100, typicalFans: 38000 },
  2: { tier: 2, name: 'Championship', short: 'CHA', size: 24, autoUp: 2, playoff: [3, 6], down: 3, minStadium: 12000, meanStrength: 71, spread: 5, moneyScale: 34, tv: 550, typicalFans: 20000 },
  3: { tier: 3, name: 'Liga 1', short: 'L1', size: 24, autoUp: 2, playoff: [3, 6], down: 4, minStadium: 8000, meanStrength: 63, spread: 5, moneyScale: 19, tv: 300, typicalFans: 11000 },
  4: { tier: 4, name: 'Liga 2', short: 'L2', size: 24, autoUp: 3, playoff: [4, 7], down: 2, minStadium: 5000, meanStrength: 55, spread: 5, moneyScale: 11, tv: 160, typicalFans: 6000 },
  5: { tier: 5, name: 'Nacional', short: 'NAC', size: 24, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 3000, meanStrength: 46, spread: 5, moneyScale: 5.5, tv: 80, typicalFans: 3000 },
  6: { tier: 6, name: 'Nacional Norte/Sul', short: 'NNS', size: 22, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 1500, meanStrength: 38, spread: 5, moneyScale: 3.2, tv: 50, typicalFans: 1500 },
  7: { tier: 7, name: 'Liga Regional Premier', short: 'LRP', size: 22, autoUp: 1, playoff: [2, 5], down: 2, minStadium: 800, meanStrength: 30, spread: 5, moneyScale: 2, tv: 42, typicalFans: 700 },
  8: { tier: 8, name: 'Liga Regional', short: 'LR', size: 20, autoUp: 1, playoff: [2, 5], down: 3, minStadium: 0, meanStrength: 22, spread: 5, moneyScale: 1, tv: 26, typicalFans: 300 },
};

export const ALL_TIERS: Tier[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const BOTTOM_TIER: Tier = 8;
export const MAX_SEASONS = 25;
export const START_YEAR = 2027;

export function tierUp(t: Tier): Tier {
  return (t > 1 ? t - 1 : 1) as Tier;
}
export function tierDown(t: Tier): Tier {
  return (t < 8 ? t + 1 : 8) as Tier;
}

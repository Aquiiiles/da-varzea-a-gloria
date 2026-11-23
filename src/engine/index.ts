/** API pública do motor. A UI importa só daqui. */
export * from './types';
export { newGame, apply, tryApply, canApply, replay, ORIGINS, sanitizeName, ActionError } from './game';
export { seatsFor, loanFor, sellPrice, releaseCost, renewWage, projectFinance, effectsCashCost } from './office';
export { encodeRun, decodeRun, encodeAction, decodeAction, seedFromEntropy, type RunCode } from './codec';
export { runStats, computeScore, levelFor, LEVELS, type RunStats, type LevelInfo } from './score';
export { stadiumAllows, teamStrength, PLAYER_ID } from './season';
export { payroll, staffCost, upkeep, attendance, masterSponsor, TICKET_POLICY } from './finance';
export { bestEleven, squadStrength, marketValue, marketWage, tryoutCost } from './footballers';
export { scaled } from './effects';
export {
  TIERS, MAX_SEASONS, START_YEAR, FACILITY_COST, STAFF_WAGE, SEAT_PACKS, SQUAD_MIN, SQUAD_MAX, YOUTH_MAX, YOUTH_AGE_LIMIT,
} from '../data/pyramid';

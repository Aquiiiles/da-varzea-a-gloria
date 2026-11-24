/** API pública do motor. A UI importa só daqui. */
export * from './types';
export { newGame, apply, tryApply, canApply, replay, ORIGINS, sanitizeName, ActionError } from './game';
export { seatsFor, loanFor, sellPrice, releaseCost, renewWage, renewTarget, MAX_RAISE, projectFinance, effectsCashCost, expectedHomeGames, renewalOffer } from './office';
export { negotiationFor, MAX_ROUNDS } from './negotiation';
export { trophies, clubRecords, type Trophy, type ClubRecords } from './trophies';
export { achievements, type Achievement } from './achievements';
export { coachSeverance, coachAccepts, moraleEdge, moodLabel, commerce, businessInvested } from './clubops';
export { hashSeed } from './rng';
export { encodeRun, decodeRun, encodeAction, decodeAction, seedFromEntropy, type RunCode } from './codec';
export { runStats, computeScore, levelFor, LEVELS, type RunStats, type LevelInfo } from './score';
export { stadiumAllows, teamStrength, renewalCap, coachEdge, PLAYER_ID } from './season';
export { payroll, staffCost, upkeep, attendance, masterSponsor, TICKET_POLICY } from './finance';
export { bestEleven, squadStrength, marketValue, marketWage, tryoutCost } from './footballers';
export { scaled } from './effects';
export {
  TIERS, MAX_SEASONS, START_YEAR, FACILITY_COST, STAFF_WAGE, SEAT_PACKS, STADIUM_FINANCE, STADIUM_INSTALLMENT_NAME, LOAN_NAME, SQUAD_MIN, SQUAD_MAX, YOUTH_MAX, YOUTH_AGE_LIMIT, MAX_LOANS, LOAN_AGE_LIMIT,
} from '../data/pyramid';
export { COACH_STYLES, BUSINESSES, DELEGATE_INFO } from '../data/club';
export { initials } from './clubs';

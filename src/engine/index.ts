/** API pública do motor. A UI importa só daqui. */
export * from './types';
export { newGame, choose, advance, replay, optionCount, ORIGINS, sanitizeName } from './game';
export { encodeRun, decodeRun, seedFromEntropy, type RunCode } from './codec';
export { runStats, computeScore, levelFor, LEVELS, type RunStats, type LevelInfo } from './score';
export { stadiumAllows, PLAYER_ID } from './season';
export { wageBill } from './finance';
export { scaled } from './effects';
export { TIERS, MAX_SEASONS, START_YEAR } from '../data/pyramid';

/**
 * Saves no navegador. Guardamos só a "receita" da run (seed + fundação + ações, a mesma da URL):
 * o estado é reconstruído pelo motor com `replay`, então o save é pequeno e nunca fica inconsistente.
 * Todo acesso ao localStorage é protegido: em aba anônima ou com o storage bloqueado, o jogo segue sem saves.
 */
import { computeScore, encodeRun, levelFor, runStats, TIERS, type GameState } from './engine';

const CAREERS_KEY = 'dvg:careers:v2';
const HALL_KEY = 'dvg:hall:v2';
const MAX_CAREERS = 5;
const MAX_HALL = 10;

export interface CareerSave {
  /** identificador estável da carreira: seed em base36 */
  id: string;
  name: string;
  colors: [string, string];
  tierName: string;
  season: number;
  query: string;
  updatedAt: number;
}

export interface HallEntry {
  id: string;
  name: string;
  colors: [string, string];
  level: number;
  label: string;
  score: number;
  bestTier: string;
  query: string;
  finishedAt: number;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* storage cheio ou bloqueado: segue sem salvar */
  }
}

export function careerId(state: GameState): string {
  return state.seed.toString(36);
}

export function listCareers(): CareerSave[] {
  return read<CareerSave>(CAREERS_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listHall(): HallEntry[] {
  return read<HallEntry>(HALL_KEY).sort((a, b) => b.score - a.score);
}

/** Salva a carreira (ou, se a run acabou, move para o hall da fama). */
export function saveCareer(state: GameState): void {
  const id = careerId(state);
  const others = read<CareerSave>(CAREERS_KEY).filter((c) => c.id !== id);
  if (state.phase === 'over') {
    write(CAREERS_KEY, others);
    const stats = runStats(state);
    const lvl = levelFor(stats);
    const entry: HallEntry = {
      id,
      name: state.player.name,
      colors: state.player.colors,
      level: lvl.level,
      label: lvl.label,
      score: computeScore(stats),
      bestTier: TIERS[stats.bestTier].name,
      query: encodeRun(state),
      finishedAt: Date.now(),
    };
    const hall = read<HallEntry>(HALL_KEY).filter((h) => h.id !== id);
    hall.push(entry);
    hall.sort((a, b) => b.score - a.score);
    write(HALL_KEY, hall.slice(0, MAX_HALL));
    return;
  }
  const save: CareerSave = {
    id,
    name: state.player.name,
    colors: state.player.colors,
    tierName: TIERS[state.player.tier].name,
    season: state.season,
    query: encodeRun(state),
    updatedAt: Date.now(),
  };
  write(CAREERS_KEY, [save, ...others].slice(0, MAX_CAREERS));
}

export function deleteCareer(id: string): void {
  write(CAREERS_KEY, read<CareerSave>(CAREERS_KEY).filter((c) => c.id !== id));
}

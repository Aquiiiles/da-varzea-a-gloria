/**
 * Saves no navegador. Guardamos só a "receita" da run (seed + fundação + ações, a mesma da URL):
 * o estado é reconstruído pelo motor com `replay`, então o save é pequeno e nunca fica inconsistente.
 * Todo acesso ao localStorage é protegido: em aba anônima ou com o storage bloqueado, o jogo segue sem saves.
 */
import { computeScore, encodeRun, levelFor, parseNamePack, runStats, TIERS, type GameState, type NamePack } from './engine';
import { dailyLabel } from './ui/daily';
import { REAL_PACK } from './data/realclubs';

const CAREERS_KEY = 'dvg:careers:v3';
const HALL_KEY = 'dvg:hall:v3';
const MAX_CAREERS = 10;
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
  /** desafio do dia (dd/mm), se for */
  daily?: string | null;
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
  return (state.career ? 't-' : '') + state.seed.toString(36);
}

/** Nome que aparece nos saves e no Hall da fama (no modo técnico, o técnico e o clube atual). */
function saveName(state: GameState): string {
  const c = state.career;
  if (!c) return state.player.name;
  return c.unemployed || c.stints.length === 0 ? `Técnico ${c.name}` : `Técnico ${c.name} (${state.player.name})`;
}

export function listCareers(): CareerSave[] {
  return read<CareerSave>(CAREERS_KEY).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listHall(): HallEntry[] {
  return read<HallEntry>(HALL_KEY).sort((a, b) => b.score - a.score);
}

/** Salva a carreira (ou, se a run acabou, move para o hall da fama). `slot` = save aberto (cópias guardam no próprio lugar). */
export function saveCareer(state: GameState, slot?: string | null): void {
  const id = slot ?? careerId(state);
  const keepName = slot ? read<CareerSave>(CAREERS_KEY).find((c) => c.id === slot)?.name : undefined;
  const others = read<CareerSave>(CAREERS_KEY).filter((c) => c.id !== id);
  if (state.phase === 'over') {
    write(CAREERS_KEY, others);
    const stats = runStats(state);
    const lvl = levelFor(stats);
    const entry: HallEntry = {
      id,
      name: saveName(state),
      colors: state.player.colors,
      level: lvl.level,
      label: lvl.label,
      score: computeScore(stats),
      bestTier: TIERS[stats.bestTier].name,
      query: encodeRun(state),
      finishedAt: Date.now(),
      daily: dailyLabel(state.seed),
    };
    const hall = read<HallEntry>(HALL_KEY).filter((h) => h.id !== id);
    hall.push(entry);
    hall.sort((a, b) => b.score - a.score);
    write(HALL_KEY, hall.slice(0, MAX_HALL));
    return;
  }
  const save: CareerSave = {
    id,
    name: keepName?.startsWith('Cópia: ') ? `Cópia: ${saveName(state)}` : saveName(state),
    colors: state.player.colors,
    tierName: TIERS[state.player.tier].name,
    season: state.season,
    query: encodeRun(state),
    updatedAt: Date.now(),
  };
  write(CAREERS_KEY, [save, ...others].slice(0, MAX_CAREERS));
}

/** Cópia da carreira neste ponto: um save à parte, que o salvamento automático não sobrescreve. */
export function saveSnapshot(state: GameState): boolean {
  const id = `${careerId(state)}-c${Date.now().toString(36)}`;
  const save: CareerSave = {
    id,
    name: `Cópia: ${saveName(state)}`,
    colors: state.player.colors,
    tierName: TIERS[state.player.tier].name,
    season: state.season,
    query: encodeRun(state),
    updatedAt: Date.now(),
  };
  const all = read<CareerSave>(CAREERS_KEY);
  if (all.length >= MAX_CAREERS) return false;
  write(CAREERS_KEY, [save, ...all]);
  return true;
}

export function deleteCareer(id: string): void {
  write(CAREERS_KEY, read<CareerSave>(CAREERS_KEY).filter((c) => c.id !== id));
}

/* ------------------------------ Pacote de nomes ------------------------------ */

const PACK_KEY = 'dvg:namepack:v1';

const FICTIONAL = 'ficticios';

/**
 * Pacote de nomes em uso: os clubes reais (padrão), nomes fictícios (null) ou um pacote importado.
 * Fica só neste navegador.
 */
export function loadNamePack(): NamePack | null {
  try {
    const raw = localStorage.getItem(PACK_KEY);
    if (!raw) return REAL_PACK;
    if (raw === FICTIONAL) return null;
    const pack = parseNamePack(JSON.parse(raw));
    return typeof pack === 'string' ? REAL_PACK : pack;
  } catch {
    return REAL_PACK;
  }
}

/** `'real'` volta ao padrão (clubes reais); null = nomes fictícios; ou um pacote importado. */
export function saveNamePack(pack: NamePack | null | 'real'): boolean {
  try {
    if (pack === 'real') localStorage.removeItem(PACK_KEY);
    else if (pack === null) localStorage.setItem(PACK_KEY, FICTIONAL);
    else localStorage.setItem(PACK_KEY, JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

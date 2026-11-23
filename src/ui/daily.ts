import { hashSeed, type Origin } from '../engine';

const ORIGINS: Origin[] = ['pub', 'fabrica', 'youtuber'];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface Daily {
  date: string;
  label: string;
  seed: number;
  origin: Origin;
}

/** Desafio do dia: mesma seed e mesma origem para todo mundo naquela data. */
export function dailyFor(d: Date): Daily {
  const date = isoDate(d);
  const seed = hashSeed('desafio-do-dia', date) || 1;
  const dayNumber = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return {
    date,
    label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    seed,
    origin: ORIGINS[dayNumber % 3],
  };
}

export function today(): Daily {
  return dailyFor(new Date());
}

/** Se a seed for de um desafio dos últimos 30 dias, devolve o rótulo (dd/mm). */
export function dailyLabel(seed: number): string | null {
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    const day = dailyFor(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
    if (day.seed === seed) return day.label;
  }
  return null;
}

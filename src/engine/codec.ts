import type { Foundation, GameState, Origin } from './types';

/**
 * Codificação da run na URL:
 *   ?s=<seed base36>&n=<nome>&k=<cor1>-<cor2>&o=<p|f|y>&c=<escolhas, 1 dígito cada>
 */
const ORIGIN_CODE: Record<Origin, string> = { pub: 'p', fabrica: 'f', youtuber: 'y' };
const CODE_ORIGIN: Record<string, Origin> = { p: 'pub', f: 'fabrica', y: 'youtuber' };

export interface RunCode {
  seed: number;
  foundation: Foundation;
  choices: number[];
}

export function encodeRun(run: RunCode | GameState): string {
  const params = new URLSearchParams();
  params.set('s', (run.seed >>> 0).toString(36));
  params.set('n', run.foundation.name);
  params.set('k', run.foundation.colors.map((c) => c.replace('#', '')).join('-'));
  params.set('o', ORIGIN_CODE[run.foundation.origin]);
  params.set('c', run.choices.join(''));
  return params.toString();
}

const HEX = /^[0-9a-fA-F]{6}$/;

export function decodeRun(query: string): RunCode | null {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const s = params.get('s');
  if (!s || !/^[0-9a-z]{1,7}$/.test(s)) return null;
  const seed = parseInt(s, 36);
  if (!Number.isFinite(seed) || seed > 0xffffffff) return null;
  const origin = CODE_ORIGIN[params.get('o') ?? ''];
  if (!origin) return null;
  const colors = (params.get('k') ?? '').split('-');
  if (colors.length !== 2 || !colors.every((c) => HEX.test(c))) return null;
  const c = params.get('c') ?? '';
  if (!/^[0-9]*$/.test(c)) return null;
  return {
    seed,
    foundation: {
      name: params.get('n') ?? 'Várzea FC',
      colors: [`#${colors[0].toLowerCase()}`, `#${colors[1].toLowerCase()}`],
      origin,
    },
    choices: c.split('').filter(Boolean).map(Number),
  };
}

/** Seed aleatória para uma nova run (fica FORA do motor: só a UI chama). */
export function seedFromEntropy(entropy: number): number {
  return (Math.floor(entropy * 0xffffffff) >>> 0) || 1;
}

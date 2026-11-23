import type { Action, Facility, Foundation, GameState, Origin, StaffRole } from './types';

/**
 * Codificação da run na URL:
 *   ?s=<seed base36>&n=<nome>&k=<cor1>-<cor2>&o=<p|f|y>&a=<ações separadas por ".">
 *
 * Cada ação vira um token curto: letra + argumento (ex.: "b3" compra a listagem 3, "s1042" vende o jogador 1042,
 * "j" joga a temporada, "z" vai para a próxima).
 */
const ORIGIN_CODE: Record<Origin, string> = { pub: 'p', fabrica: 'f', youtuber: 'y' };
const CODE_ORIGIN: Record<string, Origin> = { p: 'pub', f: 'fabrica', y: 'youtuber' };
const FAC: Record<Facility, string> = { ct: 'c', academy: 'a', medical: 'm' };
const CAF: Record<string, Facility> = { c: 'ct', a: 'academy', m: 'medical' };
const STAFF: Record<StaffRole, string> = { coach: 'c', scout: 's', fitness: 'f' };
const FFATS: Record<string, StaffRole> = { c: 'coach', s: 'scout', f: 'fitness' };

export interface RunCode {
  seed: number;
  foundation: Foundation;
  actions: Action[];
}

export function encodeAction(a: Action): string {
  switch (a.t) {
    case 'buy': return `b${a.idx}`;
    case 'sell': return `s${a.id}`;
    case 'release': return `r${a.id}`;
    case 'renew': return `n${a.id}`;
    case 'promote': return `p${a.id}`;
    case 'cut': return `x${a.id}`;
    case 'tryout': return 't';
    case 'sign': return `g${a.idx}`;
    case 'seats': return `e${a.size}`;
    case 'facility': return `f${FAC[a.which]}`;
    case 'staff': return `h${STAFF[a.which]}${a.dir > 0 ? 'u' : 'd'}`;
    case 'ticket': return `k${a.level}`;
    case 'loan': return `l${a.size}`;
    case 'opp': return `o${a.idx}`;
    case 'event': return `v${a.choice}`;
    case 'auto': return 'a';
    case 'play': return 'j';
    case 'next': return 'z';
  }
}

export function decodeAction(tok: string): Action | null {
  const c = tok[0];
  const rest = tok.slice(1);
  const n = /^\d{1,7}$/.test(rest) ? Number(rest) : NaN;
  switch (c) {
    case 'b': return Number.isNaN(n) ? null : { t: 'buy', idx: n };
    case 's': return Number.isNaN(n) ? null : { t: 'sell', id: n };
    case 'r': return Number.isNaN(n) ? null : { t: 'release', id: n };
    case 'n': return Number.isNaN(n) ? null : { t: 'renew', id: n };
    case 'p': return Number.isNaN(n) ? null : { t: 'promote', id: n };
    case 'x': return Number.isNaN(n) ? null : { t: 'cut', id: n };
    case 't': return rest === '' ? { t: 'tryout' } : null;
    case 'g': return Number.isNaN(n) ? null : { t: 'sign', idx: n };
    case 'e': return n === 0 || n === 1 || n === 2 ? { t: 'seats', size: n } : null;
    case 'f': return CAF[rest] ? { t: 'facility', which: CAF[rest] } : null;
    case 'h': return FFATS[rest[0]] && (rest[1] === 'u' || rest[1] === 'd') && rest.length === 2 ? { t: 'staff', which: FFATS[rest[0]], dir: rest[1] === 'u' ? 1 : -1 } : null;
    case 'k': return n === 0 || n === 1 || n === 2 ? { t: 'ticket', level: n } : null;
    case 'l': return n === 0 || n === 1 ? { t: 'loan', size: n } : null;
    case 'o': return Number.isNaN(n) ? null : { t: 'opp', idx: n };
    case 'v': return n === 0 || n === 1 ? { t: 'event', choice: n } : null;
    case 'a': return rest === '' ? { t: 'auto' } : null;
    case 'j': return rest === '' ? { t: 'play' } : null;
    case 'z': return rest === '' ? { t: 'next' } : null;
    default: return null;
  }
}

export function encodeRun(run: RunCode | GameState): string {
  const params = new URLSearchParams();
  params.set('s', (run.seed >>> 0).toString(36));
  params.set('n', run.foundation.name);
  params.set('k', run.foundation.colors.map((c) => c.replace('#', '')).join('-'));
  params.set('o', ORIGIN_CODE[run.foundation.origin]);
  params.set('a', run.actions.map(encodeAction).join('.'));
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
  const raw = params.get('a') ?? '';
  const actions: Action[] = [];
  for (const tok of raw.split('.').filter(Boolean)) {
    const a = decodeAction(tok);
    if (!a) return null;
    actions.push(a);
  }
  return {
    seed,
    foundation: { name: params.get('n') ?? 'Várzea FC', colors: [`#${colors[0].toLowerCase()}`, `#${colors[1].toLowerCase()}`], origin },
    actions,
  };
}

/** Seed aleatória para uma nova run (fica FORA do motor: só a UI chama). */
export function seedFromEntropy(entropy: number): number {
  return (Math.floor(entropy * 0xffffffff) >>> 0) || 1;
}

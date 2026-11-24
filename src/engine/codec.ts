import type { Action, BusinessId, DelegateArea, Facility, Formation, Foundation, GameState, Origin, StaffRole } from './types';
import type { CoachStyle, Tactic } from './types';

const STYLES: CoachStyle[] = ['ofensivo', 'retranqueiro', 'formador', 'motivador', 'estrategista'];
const TACTIC_LIST: Tactic[] = ['equilibrado', 'ofensivo', 'retranqueiro', 'contra_ataque', 'pressao'];

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
const STAFF: Record<StaffRole, string> = { scout: 's', fitness: 'f' };
const FFATS: Record<string, StaffRole> = { s: 'scout', f: 'fitness' };
const BIZ: Record<BusinessId, string> = { bar: 'b', loja: 'l', escolinha: 'e', estacionamento: 'p', foodtruck: 'f' };
const ZIB: Record<string, BusinessId> = { b: 'bar', l: 'loja', e: 'escolinha', p: 'estacionamento', f: 'foodtruck' };
const DEL: Record<DelegateArea, string> = { contratos: 'c', base: 'b', mercado: 'm', estadio: 'e' };
const LED: Record<string, DelegateArea> = { c: 'contratos', b: 'base', m: 'mercado', e: 'estadio' };

const FORMS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-5-1'];

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
    case 'leave': return `q${a.id}`;
    case 'renew': return `n${a.id}`;
    case 'bid': return `y${a.club.replace(/^c/, '')}_${a.player}_${a.fee}_${Math.round(a.wage * 10)}_${a.years}`;
    case 'offer': return `w${a.idx}`;
    case 'lend': return `d${a.id}`;
    case 'promote': return `p${a.id}`;
    case 'cut': return `x${a.id}`;
    case 'tryout': return 't';
    case 'sign': return `g${a.idx}`;
    case 'seats': return `e${a.size}${a.financed ? 'p' : ''}`;
    case 'facility': return `f${FAC[a.which]}`;
    case 'staff': return `h${STAFF[a.which]}${a.dir > 0 ? 'u' : 'd'}`;
    case 'ticket': return `k${a.level}`;
    case 'coach': return `c${a.idx}`;
    case 'formation': return `i${FORMS.indexOf(a.f)}`;
    case 'business': return `u${BIZ[a.which]}`;
    case 'delegate': return `m${DEL[a.area]}`;
    case 'loan': return `l${a.size}`;
    case 'opp': return `o${a.idx}`;
    case 'event': return `v${a.choice}`;
    case 'auto': return 'a';
    case 'play': return 'j';
    case 'advance': return `D${a.to}`;
    case 'job': return `J${a.idx}`;
    case 'interview': return `I${a.day}_${a.q}_${a.a}`;
    case 'tactic': return `T${TACTIC_LIST.indexOf(a.v)}`;
    case 'lineup': return `L${a.rotate ? 1 : 0}${a.ids ? a.ids.map((id) => `_${id}`).join('') : ''}`;
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
    case 'q': return Number.isNaN(n) ? null : { t: 'leave', id: n };
    case 'n': return Number.isNaN(n) ? null : { t: 'renew', id: n };
    case 'y': {
      const parts = rest.split('_');
      if (parts.length !== 5 || !parts.every((x) => /^\d{1,9}$/.test(x))) return null;
      const [club, player, fee, wage10, years] = parts.map(Number);
      return { t: 'bid', club: `c${club}`, player, fee, wage: wage10 / 10, years };
    }
    case 'w': return Number.isNaN(n) ? null : { t: 'offer', idx: n };
    case 'd': return Number.isNaN(n) ? null : { t: 'lend', id: n };
    case 'p': return Number.isNaN(n) ? null : { t: 'promote', id: n };
    case 'x': return Number.isNaN(n) ? null : { t: 'cut', id: n };
    case 't': return rest === '' ? { t: 'tryout' } : null;
    case 'g': return Number.isNaN(n) ? null : { t: 'sign', idx: n };
    case 'e': {
      if (!/^[012]p?$/.test(rest)) return null;
      const size = Number(rest[0]) as 0 | 1 | 2;
      return rest.endsWith('p') ? { t: 'seats', size, financed: true } : { t: 'seats', size };
    }
    case 'f': return CAF[rest] ? { t: 'facility', which: CAF[rest] } : null;
    case 'h': return FFATS[rest[0]] && (rest[1] === 'u' || rest[1] === 'd') && rest.length === 2 ? { t: 'staff', which: FFATS[rest[0]], dir: rest[1] === 'u' ? 1 : -1 } : null;
    case 'c': return Number.isNaN(n) ? null : { t: 'coach', idx: n };
    case 'i': return n >= 0 && n < FORMS.length ? { t: 'formation', f: FORMS[n] } : null;
    case 'u': return ZIB[rest] ? { t: 'business', which: ZIB[rest] } : null;
    case 'm': return LED[rest] ? { t: 'delegate', area: LED[rest] } : null;
    case 'k': return n === 0 || n === 1 || n === 2 ? { t: 'ticket', level: n } : null;
    case 'l': return n === 0 || n === 1 ? { t: 'loan', size: n } : null;
    case 'o': return Number.isNaN(n) ? null : { t: 'opp', idx: n };
    case 'v': return n === 0 || n === 1 ? { t: 'event', choice: n } : null;
    case 'a': return rest === '' ? { t: 'auto' } : null;
    case 'j': return rest === '' ? { t: 'play' } : null;
    case 'D': return n === 0 || n === 1 || n === 2 || n === 3 ? { t: 'advance', to: n } : null;
    case 'J': return n >= 0 && n < 10 ? { t: 'job', idx: n } : null;
    case 'T': return n >= 0 && n < TACTIC_LIST.length ? { t: 'tactic', v: TACTIC_LIST[n] } : null;
    case 'I': {
      const m = /^(\d{1,3})_(\d)_([012])$/.exec(rest);
      return m ? { t: 'interview', day: Number(m[1]), q: Number(m[2]), a: Number(m[3]) } : null;
    }
    case 'L': {
      const [flag, ...ids] = rest.split('_');
      if (flag !== '0' && flag !== '1') return null;
      if (ids.length > 11 || !ids.every((x) => /^\d{1,7}$/.test(x))) return null;
      return { t: 'lineup', rotate: flag === '1', ids: rest.includes('_') ? ids.map(Number) : null };
    }
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
  if (run.foundation.mode === 'tecnico') {
    params.set('m', 't');
    if (run.foundation.style) params.set('e', run.foundation.style);
  }
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
  const foundation: RunCode['foundation'] = { name: params.get('n') ?? 'Várzea FC', colors: [`#${colors[0].toLowerCase()}`, `#${colors[1].toLowerCase()}`], origin };
  if (params.get('m') === 't') {
    foundation.mode = 'tecnico';
    const style = params.get('e');
    if (style && STYLES.includes(style as CoachStyle)) foundation.style = style as CoachStyle;
  }
  return { seed, foundation, actions };
}

/** Seed aleatória para uma nova run (fica FORA do motor: só a UI chama). */
export function seedFromEntropy(entropy: number): number {
  return (Math.floor(entropy * 0xffffffff) >>> 0) || 1;
}

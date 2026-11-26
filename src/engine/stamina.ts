import { STYLE_TACTIC } from '../data/club';
import type { GameState, Tactic } from './types';

/**
 * Fôlego durante o jogo (modo técnico). Cada jogador em campo perde fôlego a cada bloco de 5 minutos;
 * quem entra vem inteiro. Sem mexer no jogo, o auxiliar faz as trocas de sempre (aos 60' e 75');
 * quando você mexe, as trocas passam a ser suas, e o cansaço do seu time conta contra o padrão.
 */
export const BLOCKS = 18;
export const BLOCK_MIN = 5;
/** fôlego perdido por bloco */
export const DRAIN = 2.6;
/** abaixo disso o jogador começa a render menos */
export const TIRED_AT = 72;

export function drainFactor(tactic: Tactic | null | undefined, age: number): number {
  const t = tactic === 'pressao' ? 1.3 : tactic === 'ofensivo' ? 1.1 : tactic === 'retranqueiro' || tactic === 'contra_ataque' ? 0.9 : 1;
  const a = age >= 32 ? 1.2 : age >= 29 ? 1.08 : age <= 21 ? 0.92 : 1;
  return t * a;
}

/** Fôlego de quem começa o jogo: o cansaço acumulado na temporada pesa um pouco. */
export function startStamina(preFatigue: number): number {
  return Math.max(55, Math.round(100 - preFatigue * 0.3));
}

/** Quanto um jogador cansado tira da força do time (em pontos de força, dividido por 11). */
export function tiredPenalty(stamina: number): number {
  return Math.max(0, TIRED_AT - stamina) * 0.12;
}

export interface StaminaInput {
  firstIds: number[];
  /** mudanças do jogo em ordem: a partir do minuto, quem está em campo e a estratégia */
  changes: { minute: number; ids: number[] | null; tactic?: Tactic | null }[];
  baseTactic: Tactic | null | undefined;
  pre: (id: number) => number;
  age: (id: number) => number;
  /** expulsos e machucados (saem de campo no minuto) */
  gone: { id: number; minute: number }[];
}

/**
 * Fôlego de cada jogador no começo de cada bloco (índice 0..18; o 18 é o apito final).
 * Só entra no mapa de um bloco quem está em campo nele.
 */
export function staminaTimeline(inp: StaminaInput): Map<number, number>[] {
  const out: Map<number, number>[] = [];
  const stamina = new Map<number, number>();
  let field = inp.firstIds.slice();
  for (const id of field) stamina.set(id, startStamina(inp.pre(id)));
  let tactic = inp.baseTactic ?? null;
  const changes = inp.changes.slice().sort((a, b) => a.minute - b.minute);
  for (let b = 0; b <= BLOCKS; b++) {
    const t = b * BLOCK_MIN;
    for (const c of changes) {
      if (c.minute !== t) continue;
      if (c.ids) {
        field = c.ids.slice();
        for (const id of field) if (!stamina.has(id)) stamina.set(id, startStamina(inp.pre(id)));
      }
      if (c.tactic) tactic = c.tactic;
    }
    const out_ = new Set(inp.gone.filter((g) => g.minute < t).map((g) => g.id));
    field = field.filter((id) => !out_.has(id));
    out.push(new Map(field.map((id) => [id, Math.round(stamina.get(id)!)])));
    if (b === BLOCKS) break;
    for (const id of field) stamina.set(id, Math.max(0, stamina.get(id)! - DRAIN * drainFactor(tactic, inp.age(id))));
  }
  return out;
}

/** Perda média de força do time no bloco (11 vagas). */
export function teamTiredness(onField: Map<number, number>): number {
  let s = 0;
  for (const v of onField.values()) s += tiredPenalty(v);
  return s / 11;
}

/**
 * O padrão do auxiliar: o mesmo time titular, com as 3 trocas mais cansadas aos 60' e as 2 seguintes aos 75'
 * (quem entra vem com 96). É contra isso que o seu cansaço é medido quando você assume as trocas.
 */
export function referenceTiredness(inp: StaminaInput): number[] {
  let st = inp.firstIds.map((id) => ({ v: startStamina(inp.pre(id)), d: DRAIN * drainFactor(inp.baseTactic, inp.age(id)) }));
  const out: number[] = [];
  for (let b = 0; b < BLOCKS; b++) {
    if (b === 12 || b === 15) {
      const n = b === 12 ? 3 : 2;
      st = st.slice().sort((x, y) => x.v - y.v);
      for (let i = 0; i < n && i < st.length; i++) st[i] = { v: 96, d: DRAIN * drainFactor(inp.baseTactic, 26) };
    }
    out.push(st.reduce((x, p) => x + tiredPenalty(p.v), 0) / 11);
    st = st.map((p) => ({ v: Math.max(0, p.v - p.d), d: p.d }));
  }
  return out;
}

/** Fôlego dos seus jogadores no começo de cada bloco do jogo do dia (o mesmo cálculo do motor). */
export function matchStamina(state: GameState, day: number): Map<number, number>[] | null {
  const live = state.live;
  const m = state.calendar?.matches.find((x) => x.day === day);
  if (!live || !m?.pre) return null;
  const first = live.elevens.find((e) => e.day === day)?.ids;
  if (!first) return null;
  const p = state.player;
  const ages = new Map(p.squad.map((f) => [f.id, f.age]));
  const base = live.lineups.filter((l) => l.day < day).at(-1)?.tactic ?? STYLE_TACTIC[p.coach.style];
  return staminaTimeline({
    firstIds: first,
    changes: (live.halftimes ?? []).filter((h) => h.day === day).map((h) => ({ minute: h.minute ?? 45, ids: h.ids, tactic: h.tactic ?? null })),
    baseTactic: base,
    pre: (id) => m.pre![id] ?? 0,
    age: (id) => ages.get(id) ?? 26,
    gone: [
      ...live.injuries.filter((i) => i.from === day).map((i) => ({ id: i.id, minute: i.minute ?? 60 })),
      ...(live.cards ?? []).filter((c) => c.day === day && c.kind === 'vermelho').map((c) => ({ id: c.id, minute: c.minute ?? 60 })),
    ],
  });
}

/** Fôlego de todo o elenco num minuto do jogo: em campo, o do momento; quem saiu, o da saída; o banco, inteiro. */
export function staminaAt(state: GameState, day: number, minute: number): Map<number, number> {
  const tl = matchStamina(state, day);
  const m = state.calendar?.matches.find((x) => x.day === day);
  const out = new Map<number, number>();
  if (!tl || !m?.pre) return out;
  const b = Math.min(tl.length - 1, Math.floor(minute / 5));
  for (const f of state.player.squad) out.set(f.id, startStamina(m.pre[f.id] ?? 0));
  for (let i = 0; i <= b; i++) for (const [id, v] of tl[i]) out.set(id, v);
  return out;
}

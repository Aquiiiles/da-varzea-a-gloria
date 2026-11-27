import { bestLineup } from './traits';
import { resolveRoles } from './roles';
import { benchFactor, cardFactor, personalityOf } from './personality';
import { bestEleven, lineupStrength, round1 } from './footballers';
import { deriveRng } from './rng';
import { clamp } from './util';
import type { Footballer, Formation, LineupEntry, RosterChange, Talk } from './types';

/**
 * Elenco ao longo da temporada (só o clube do jogador): quem está no elenco em cada dia (contratações de julho),
 * a escalação escolhida, o cansaço e as lesões. Tudo é calculado em ordem de data a partir dos dias dos jogos,
 * então decidir algo num dia só muda os jogos depois dele.
 */

/** Cansaço: quanto sobe por jogo e quanto recupera por dia. */
export const FATIGUE_PER_MATCH = 24;
export const FATIGUE_RECOVERY = 5;
/** Acima disso o jogador rende menos (perde até ~5 de overall). */
export const FATIGUE_FREE = 40;
/** Com rodízio ligado, quem passa disso descansa (se houver substituto). */
export const FATIGUE_REST = 70;
const BOOST = 100;

export interface Injury {
  id: number;
  name: string;
  /** dia em que machucou e dia em que volta */
  from: number;
  to: number;
  /** minuto do jogo em que machucou */
  minute?: number;
}

export interface MatchPlan {
  day: number;
  /** titulares */
  xi: Footballer[];
  /** força do elenco naquele jogo (antes de técnico, moral e forma) */
  strength: number;
  /** quem estava disponível (com o cansaço do dia já descontado) */
  pool: Footballer[];
  /** cansaço de cada disponível antes do jogo (0 a 100) */
  pre: Record<number, number>;
}

/** Cartões: chance por titular por jogo; 3 amarelos ou um vermelho = suspenso no jogo seguinte. */
export const YELLOW_CHANCE = 0.11;
export const RED_CHANCE = 0.007;
export const YELLOWS_FOR_SUSPENSION = 3;

export interface CardEvent {
  day: number;
  id: number;
  name: string;
  kind: 'amarelo' | 'vermelho';
  /** minuto do jogo */
  minute?: number;
}

export interface Suspension {
  /** dia do jogo em que cumpre a suspensão */
  day: number;
  id: number;
  name: string;
  why: 'amarelos' | 'vermelho';
}

export interface PlanOptions {
  seed: number;
  season: number;
  formation: Formation;
  medical: number;
  fitness: number;
  /** modo técnico: forma e moral individual contam */
  coach?: boolean;
  /** conversas do técnico com jogadores */
  talks?: Talk[];
  /** moral mexida por decisões (assédio, notícias) */
  moraleHits?: { day: number; id: number; delta: number }[];
  /** afastados pelo técnico */
  benched?: { id: number; from: number; to: number }[];
  /** cansaço extra para todo o elenco */
  fatigueHits?: { day: number; delta: number }[];
  /** multiplicador da chance de cartão no dia (árbitro, clássico) */
  cardFactor?: (day: number) => number;
}

export function fatiguePenalty(fatigue: number): number {
  return fatigue > FATIGUE_FREE ? (fatigue - FATIGUE_FREE) * 0.08 : 0;
}

/** Força de um XI: média (com improviso fora de posição) + profundidade do banco, como `squadStrength`. */
function pickXI(roster: Footballer[], formation: Formation, preferred: Set<number> | null, order?: readonly number[] | null, detailed = false): { xi: Footballer[]; strength: number } {
  if (roster.length === 0) return { xi: [], strength: 30 };
  // escalação completa com as vagas escolhidas: cada um joga onde o técnico pôs
  if (order && order.length === 11) {
    const s = lineupStrength(roster, formation, order);
    if (s !== null) {
      const set = new Set(order);
      return { xi: roster.filter((f) => set.has(f.id)), strength: s };
    }
  }
  // modo técnico: cada um na vaga detalhada em que rende mais (lateral na lateral...)
  if (detailed) {
    const ids = bestLineup(roster, formation, (f) => (preferred?.has(f.id) ? BOOST : 0));
    const s = ids.length === 11 ? lineupStrength(roster, formation, ids) : null;
    if (s !== null) {
      const set = new Set(ids);
      return { xi: roster.filter((f) => set.has(f.id)), strength: s };
    }
  }
  const boosted = roster.map((f) => (preferred?.has(f.id) ? { ...f, ovr: f.ovr + BOOST } : f));
  const { ids, ratings } = bestEleven(boosted, formation);
  const real = ratings.map((r) => (r > BOOST ? r - BOOST : r));
  const mean = real.reduce((s, r) => s + r, 0) / real.length;
  const xi = roster.filter((f) => ids.has(f.id));
  const bench = roster.filter((f) => !ids.has(f.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 7);
  const benchAvg = bench.length > 0 ? bench.reduce((s, f) => s + f.ovr, 0) / bench.length : mean - 15;
  const depth = clamp((benchAvg - (mean - 6)) / 6, -1, 0.5);
  return { xi, strength: round1(mean + depth) };
}

/** Forma: fase do jogador (de -3 a +3 de overall), oscila jogo a jogo e volta para o normal. */
export const FORM_MAX = 3;
/** Moral (0–100): sobe jogando, cai no banco quando esperava jogar. */
export const MORALE_START = 60;
export const MORALE_LOW = 30;
export const MORALE_HIGH = 80;

/** Efeito da moral no overall. */
export function moraleEffect(morale: number): number {
  return morale < MORALE_LOW ? -1.5 : morale > MORALE_HIGH ? 0.5 : 0;
}

export class SquadPlan {
  readonly injuries: Injury[] = [];
  /** forma e moral de cada jogador depois de cada jogo (para a interface) */
  readonly statusLog: { day: number; form: Record<number, number>; morale: Record<number, number> }[] = [];
  private form = new Map<number, number>();
  private morale = new Map<number, number>();
  private talked = new Set<Talk>();
  private promises: { id: number; name: string; day: number; left: number }[] = [];
  /** promessas de vaga que não foram cumpridas (dia do jogo em que o jogador se revoltou) */
  readonly broken: { day: number; id: number; name: string }[] = [];
  readonly cards: CardEvent[] = [];
  readonly suspensions: Suspension[] = [];
  /** cansaço de cada jogador depois de cada jogo (para a interface) */
  readonly fatigueLog: { day: number; fatigue: Record<number, number> }[] = [];
  private readonly plans = new Map<number, MatchPlan>();
  private fatigue = new Map<number, number>();
  private lastDay = -1;

  constructor(
    private readonly start: Footballer[],
    private readonly changes: RosterChange[],
    private readonly lineups: LineupEntry[],
    private readonly opts: PlanOptions,
  ) {}

  /** Elenco no dia `day` (mudanças feitas antes desse dia). */
  rosterAt(day: number): Footballer[] {
    let roster = this.start.slice();
    for (const ch of this.changes) {
      if (ch.day >= day) continue;
      if (ch.remove) roster = roster.filter((f) => !ch.remove!.includes(f.id));
      if (ch.add) roster = [...roster, ...ch.add];
    }
    return roster;
  }

  /** Escalação valendo no dia `day` (a última escolhida antes dele). */
  lineupAt(day: number): LineupEntry {
    let cur: LineupEntry = { day: -1, ids: null, rotate: true, formation: this.opts.formation };
    for (const l of this.lineups) if (l.day < day) cur = l;
    return cur;
  }

  private injuredOn(day: number): Set<number> {
    const out = new Set(this.injuries.filter((i) => i.from < day && i.to > day).map((i) => i.id));
    for (const s of this.suspensions) if (s.day === day) out.add(s.id);
    for (const b of this.opts.benched ?? []) if (b.from < day && b.to >= day) out.add(b.id);
    return out;
  }

  private recover(day: number): void {
    if (this.lastDay >= 0) {
      const boost = this.lineupAt(day).training === 'recuperacao' ? 1.4 : 1;
      const rest = (day - this.lastDay) * (FATIGUE_RECOVERY + this.opts.fitness * 0.6) * boost;
      for (const [id, f] of this.fatigue) this.fatigue.set(id, Math.max(0, f - rest));
    }
    this.lastDay = day;
  }

  /** XI e força num dia, com lesões e cansaço até ali (sem mudar o estado do plano). */
  private compute(day: number): MatchPlan {
    const lineup = this.lineupAt(day);
    const injured = this.injuredOn(day);
    const tired = (f: Footballer) => this.fatigue.get(f.id) ?? 0;
    const available = this.rosterAt(day).filter((f) => !injured.has(f.id));
    const personal = (f: Footballer) => (this.opts.coach ? (this.form.get(f.id) ?? 0) + moraleEffect(this.moraleOf(f)) : 0);
    const eff = available.map((f) => ({ ...f, ovr: Math.round(f.ovr - fatiguePenalty(tired(f)) + personal(f)) }));
    let pool = eff;
    if (lineup.rotate) {
      // rodízio: quem está muito cansado descansa se sobrar gente suficiente
      const fresh = eff.filter((f) => tired(f) < FATIGUE_REST);
      if (fresh.length >= 14) pool = fresh;
    }
    const preferred = lineup.ids ? new Set<number>(lineup.ids) : null;
    const { xi, strength } = pickXI(pool, lineup.formation, preferred, lineup.ids, !!this.opts.coach);
    return { day, xi, strength, pool: eff, pre: Object.fromEntries(available.map((f) => [f.id, Math.round(tired(f))])) };
  }

  /** Expulsões e lesões do clube durante o jogo do dia (com o minuto). */
  matchEvents(day: number): { id: number; minute: number; kind: 'vermelho' | 'lesao' }[] {
    const out: { id: number; minute: number; kind: 'vermelho' | 'lesao' }[] = [];
    for (const c of this.cards) if (c.day === day && c.kind === 'vermelho') out.push({ id: c.id, minute: c.minute ?? 60, kind: 'vermelho' });
    for (const i of this.injuries) if (i.from === day) out.push({ id: i.id, minute: i.minute ?? 60, kind: 'lesao' });
    return out;
  }

  /** Moral atual (começa na que o jogador trouxe da temporada passada). */
  moraleOf(f: Footballer): number {
    return this.morale.get(f.id) ?? f.morale ?? MORALE_START;
  }

  /** Moral de cada jogador no fim da temporada. */
  finalMorale(): Map<number, number> {
    return new Map(this.morale);
  }

  /** Força com outro time em campo (mudanças no intervalo), com o cansaço e os desfalques do dia. */
  strengthWith(day: number, ids: number[]): number {
    const plan = this.at(day);
    const want = new Set(ids.filter((id) => id !== 0));
    const pool = plan.pool.filter((f) => want.has(f.id) || !plan.xi.some((x) => x.id === f.id));
    return pickXI(pool, this.lineupAt(day).formation, want, ids, !!this.opts.coach).strength;
  }

  /**
   * Calcula os jogos em ordem de data: escala, soma cansaço e sorteia lesões.
   * Cada dia de jogo tem o próprio sorteio de lesão (não depende do resultado).
   */
  build(matchDays: number[]): void {
    const days = [...new Set(matchDays)].sort((a, b) => a - b);
    const yellows = new Map<number, number>();
    let pending: Omit<Suspension, 'day'>[] = [];
    const hitsDone = new Set<object>();
    for (const day of days) {
      this.recover(day);
      // amistoso no meio da semana: todo mundo chega mais cansado
      for (const h of this.opts.fatigueHits ?? []) {
        if (h.day >= day || hitsDone.has(h)) continue;
        hitsDone.add(h);
        for (const f of this.rosterAt(day)) this.fatigue.set(f.id, Math.min(100, (this.fatigue.get(f.id) ?? 0) + h.delta));
      }
      // suspensos do jogo anterior cumprem neste
      for (const s of pending) this.suspensions.push({ ...s, day });
      pending = [];
      const plan = this.compute(day);
      this.plans.set(day, plan);
      // cartões (sorteio próprio do dia; não muda resultado, lesões nem cansaço)
      const crng = deriveRng(this.opts.seed, this.opts.season, 'cartao', day);
      const sp = this.lineupAt(day).setPieces;
      const aggressive = (this.lineupAt(day).tactic === 'pressao' ? 1.3 : 1) * (sp?.marking === 'individual' ? 1.15 : 1) * (this.opts.coach ? this.opts.cardFactor?.(day) ?? 1 : 1);
      for (const f of plan.xi) {
        const minute = deriveRng(this.opts.seed, this.opts.season, 'minuto', day, f.id).int(5, 88);
        const temper = this.opts.coach ? cardFactor(personalityOf(f)) : 1;
        if (crng.chance(RED_CHANCE * aggressive * temper)) {
          this.cards.push({ day, id: f.id, name: f.name, kind: 'vermelho', minute });
          pending.push({ id: f.id, name: f.name, why: 'vermelho' });
          continue;
        }
        if (crng.chance(YELLOW_CHANCE * aggressive * temper)) {
          this.cards.push({ day, id: f.id, name: f.name, kind: 'amarelo', minute });
          const n = (yellows.get(f.id) ?? 0) + 1;
          if (n >= YELLOWS_FOR_SUSPENSION) {
            yellows.set(f.id, 0);
            pending.push({ id: f.id, name: f.name, why: 'amarelos' });
          } else yellows.set(f.id, n);
        }
      }
      // forma (sorteio próprio do dia) e moral: quem joga sobe, quem esperava jogar e ficou no banco cai
      if (this.opts.coach) this.updatePersonal(day, plan);
      const rng = deriveRng(this.opts.seed, this.opts.season, 'lesao', day);
      for (const f of plan.xi) {
        const before = this.fatigue.get(f.id) ?? 0;
        const press = this.lineupAt(day).tactic === 'pressao' ? 1.25 : 1;
        const training = this.lineupAt(day).training;
        const physical = training === 'fisico' ? 0.8 : 1;
        this.fatigue.set(f.id, Math.min(100, before + FATIGUE_PER_MATCH * press * physical * (1 - this.opts.fitness * 0.05)));
        const chance = 0.016 * (1 + before / 60) * (1 - this.opts.medical * 0.12) * (training === 'recuperacao' ? 0.7 : 1);
        if (rng.chance(chance)) {
          const length = 7 + Math.floor(Math.pow(rng.next(), 2) * 50);
          this.injuries.push({ id: f.id, name: f.name, from: day, to: day + length, minute: deriveRng(this.opts.seed, this.opts.season, 'minuto-lesao', day, f.id).int(5, 88) });
        }
      }
      this.fatigueLog.push({ day, fatigue: Object.fromEntries(this.fatigue) });
    }
  }

  private updatePersonal(day: number, plan: MatchPlan): void {
    {
      const frng = deriveRng(this.opts.seed, this.opts.season, 'forma', day);
      const roster = this.rosterAt(day);
      const inXI = new Set(plan.xi.map((f) => f.id));
      const ranked = roster.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
      const expects = new Set(ranked.slice(0, 16).map((f) => f.id));
      // decisões do técnico (assédio, notícias) antes deste jogo
      for (const h of this.opts.moraleHits ?? []) {
        if (h.day >= day || this.talked.has(h as unknown as Talk)) continue;
        this.talked.add(h as unknown as Talk);
        const f = roster.find((x) => x.id === h.id);
        if (f) this.morale.set(f.id, clamp(this.moraleOf(f) + h.delta, 0, 100));
      }
      // conversas feitas antes deste jogo (valem uma vez)
      for (const t of this.opts.talks ?? []) {
        if (t.day >= day || this.talked.has(t)) continue;
        this.talked.add(t);
        const f = roster.find((x) => x.id === t.id);
        if (!f) continue;
        const m0 = this.moraleOf(f);
        if (t.kind === 'elogiar') this.morale.set(f.id, clamp(m0 + (t.ok ? 8 : 2), 0, 100));
        else if (t.kind === 'cobrar') {
          if (t.ok) this.form.set(f.id, Math.min(FORM_MAX, (this.form.get(f.id) ?? 0) + 1.5));
          else this.morale.set(f.id, clamp(m0 - (personalityOf(f) === 'temperamental' ? 16 : 10), 0, 100));
        } else {
          this.morale.set(f.id, clamp(m0 + 12, 0, 100));
          this.promises.push({ id: f.id, name: f.name, day: t.day, left: 3 });
        }
      }
      const recovery = this.lineupAt(day).training === 'recuperacao';
      // capitão em campo segura o vestiário: quem fica no banco se chateia menos
      const roles = this.lineupAt(day).roles;
      const leader = resolveRoles(plan.xi, roles).captain;
      const calm = leader && !(roles?.captain != null && leader.id !== roles.captain) ? 0.8 : 1;
      for (const f of roster) {
        const cur = this.form.get(f.id) ?? 0;
        const next = (inXI.has(f.id) ? cur * 0.7 + frng.normal(1.2) : cur * 0.85) - (recovery ? 0.15 : 0);
        this.form.set(f.id, Math.max(-FORM_MAX, Math.min(FORM_MAX, Math.round(next * 10) / 10)));
        const m = this.moraleOf(f);
        // quem joga anima; quem esperava jogar e fica no banco se chateia; tudo volta devagar para o normal
        const dm = inXI.has(f.id) ? 1.5 : (expects.has(f.id) ? -1.8 : -0.5) * benchFactor(personalityOf(f)) * calm * (roles?.captain === f.id ? 1.8 : 1);
        this.morale.set(f.id, clamp(Math.round((m + dm + (MORALE_START - m) * 0.06) * 10) / 10, 0, 100));
      }
      // promessa de vaga: tem que jogar em até 3 jogos
      for (const pr of this.promises) {
        if (pr.left <= 0) continue;
        if (inXI.has(pr.id)) {
          pr.left = 0;
          continue;
        }
        pr.left--;
        if (pr.left === 0) {
          const f = roster.find((x) => x.id === pr.id);
          if (f) {
            const jeito = personalityOf(f);
            this.morale.set(f.id, clamp(this.moraleOf(f) - (jeito === 'temperamental' || jeito === 'ambicioso' ? 35 : jeito === 'leal' ? 15 : 25), 0, 100));
          }
          this.broken.push({ day, id: pr.id, name: pr.name });
        }
      }
      this.statusLog.push({ day, form: Object.fromEntries(this.form), morale: Object.fromEntries(this.morale) });
    }
  }

  /** Plano de um dia de jogo (se o dia não estava previsto, calcula com o estado até ali). */
  at(day: number): MatchPlan {
    const hit = this.plans.get(day);
    if (hit) return hit;
    const plan = this.compute(day);
    this.plans.set(day, plan);
    return plan;
  }
}

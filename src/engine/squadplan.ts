import { bestEleven, round1 } from './footballers';
import { deriveRng } from './rng';
import { clamp } from './util';
import type { Footballer, Formation, LineupEntry, RosterChange } from './types';

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
}

export interface MatchPlan {
  day: number;
  /** titulares */
  xi: Footballer[];
  /** força do elenco naquele jogo (antes de técnico, moral e forma) */
  strength: number;
}

export interface PlanOptions {
  seed: number;
  season: number;
  formation: Formation;
  medical: number;
  fitness: number;
}

export function fatiguePenalty(fatigue: number): number {
  return fatigue > FATIGUE_FREE ? (fatigue - FATIGUE_FREE) * 0.08 : 0;
}

/** Força de um XI: média (com improviso fora de posição) + profundidade do banco, como `squadStrength`. */
function pickXI(roster: Footballer[], formation: Formation, preferred: Set<number> | null): { xi: Footballer[]; strength: number } {
  if (roster.length === 0) return { xi: [], strength: 30 };
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

export class SquadPlan {
  readonly injuries: Injury[] = [];
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
    return new Set(this.injuries.filter((i) => i.from < day && i.to > day).map((i) => i.id));
  }

  private recover(day: number): void {
    if (this.lastDay >= 0) {
      const rest = (day - this.lastDay) * (FATIGUE_RECOVERY + this.opts.fitness * 0.6);
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
    const eff = available.map((f) => ({ ...f, ovr: Math.round(f.ovr - fatiguePenalty(tired(f))) }));
    let pool = eff;
    if (lineup.rotate) {
      // rodízio: quem está muito cansado descansa se sobrar gente suficiente
      const fresh = eff.filter((f) => tired(f) < FATIGUE_REST);
      if (fresh.length >= 14) pool = fresh;
    }
    const preferred = lineup.ids ? new Set<number>(lineup.ids) : null;
    const { xi, strength } = pickXI(pool, lineup.formation, preferred);
    return { day, xi, strength };
  }

  /**
   * Calcula os jogos em ordem de data: escala, soma cansaço e sorteia lesões.
   * Cada dia de jogo tem o próprio sorteio de lesão (não depende do resultado).
   */
  build(matchDays: number[]): void {
    const days = [...new Set(matchDays)].sort((a, b) => a - b);
    for (const day of days) {
      this.recover(day);
      const plan = this.compute(day);
      this.plans.set(day, plan);
      const rng = deriveRng(this.opts.seed, this.opts.season, 'lesao', day);
      for (const f of plan.xi) {
        const before = this.fatigue.get(f.id) ?? 0;
        const press = this.lineupAt(day).tactic === 'pressao' ? 1.25 : 1;
        this.fatigue.set(f.id, Math.min(100, before + FATIGUE_PER_MATCH * press * (1 - this.opts.fitness * 0.05)));
        const chance = 0.016 * (1 + before / 60) * (1 - this.opts.medical * 0.12);
        if (rng.chance(chance)) {
          const length = 7 + Math.floor(Math.pow(rng.next(), 2) * 50);
          this.injuries.push({ id: f.id, name: f.name, from: day, to: day + length });
        }
      }
      this.fatigueLog.push({ day, fatigue: Object.fromEntries(this.fatigue) });
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

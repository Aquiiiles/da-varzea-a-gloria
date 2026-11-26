import { bestEleven } from './footballers';
import { personName } from './names';
import { deriveRng, type Rng } from './rng';
import type { Footballer, Formation, MatchResult } from './types';

/**
 * Detalhes dos jogos: quem jogou, quem fez os gols, quem deu as assistências e a nota de cada titular.
 * Usa o mesmo sorteio do jogo (depois do placar), então não muda nenhum resultado.
 */

export interface PlayerStat {
  apps: number;
  goals: number;
  assists: number;
  /** soma das notas (média = rating / apps) */
  rating: number;
}

export interface StatPerson {
  f: Footballer;
  clubId: string;
}

const GOAL_WEIGHT = { GOL: 0, DEF: 0.7, MEI: 2, ATA: 3.2 } as const;
const ASSIST_WEIGHT = { GOL: 0.05, DEF: 0.8, MEI: 3, ATA: 2 } as const;

function emptyStat(): PlayerStat {
  return { apps: 0, goals: 0, assists: 0, rating: 0 };
}

/** Escolhe um índice pelos pesos acumulados (`cum` crescente). `skip` = índice que não pode sair. */
function pick(rng: Rng, cum: Float64Array, w: Float64Array, skip = -1): number {
  const total = cum[cum.length - 1] - (skip >= 0 ? w[skip] : 0);
  if (total <= 0) return -1;
  let x = rng.next() * total;
  for (let i = 0; i < cum.length; i++) {
    if (i === skip) continue;
    x -= w[i];
    if (x < 0) return i;
  }
  return cum.length - 1 === skip ? cum.length - 2 : cum.length - 1;
}

interface Eleven {
  xi: Footballer[];
  mean: number;
  gw: Float64Array;
  gc: Float64Array;
  aw: Float64Array;
  ac: Float64Array;
}

function weights(xi: Footballer[], f: (x: Footballer) => number): [Float64Array, Float64Array] {
  const w = new Float64Array(xi.length);
  const c = new Float64Array(xi.length);
  let acc = 0;
  xi.forEach((x, i) => {
    w[i] = f(x);
    acc += w[i];
    c[i] = acc;
  });
  return [w, c];
}

/** Nome do técnico de um clube da IA (fixo por clube; não fica salvo no estado). */
export function aiCoachName(seed: number, clubId: string, club?: { coachName?: string }): string {
  return club?.coachName ?? personName(deriveRng(seed, 'tecnico', clubId));
}

export class SeasonStats {
  /** estatística por competição (chave do calendário) e por jogador */
  readonly byComp = new Map<string, Map<number, PlayerStat>>();
  private totalCache: Map<number, PlayerStat> | null = null;
  readonly people = new Map<number, StatPerson>();
  private readonly xi = new Map<string, Eleven>();
  /**
   * Registro por jogo (para mostrar estatísticas durante a temporada sem estragar surpresa):
   * [dia, competição, id do jogador, gols, assistências, nota x10]. Do clube do jogador entra tudo;
   * dos outros, só quem marcou ou deu assistência nas competições em `logComps`.
   */
  readonly log: [number, string, number, number, number, number][] = [];
  logComps = new Set<string>();

  constructor(
    private readonly squadOf: (clubId: string) => readonly Footballer[] | null,
    private readonly formationOf: (clubId: string) => Formation,
    /** titulares do clube do jogador em cada jogo (escalação, cansaço e lesões) */
    private readonly playerXI?: (day: number) => Footballer[],
  ) {}

  /** XI de um jogo do clube do jogador (muda de jogo para jogo). */
  private playerEleven(day: number): Eleven {
    const xi = this.playerXI!(day);
    for (const f of xi) if (!this.people.has(f.id)) this.people.set(f.id, { f, clubId: 'player' });
    const [gw, gc] = weights(xi, (f) => GOAL_WEIGHT[f.pos] * Math.pow(1.025, f.ovr - 50));
    const [aw, ac] = weights(xi, (f) => ASSIST_WEIGHT[f.pos] * Math.pow(1.02, f.ovr - 50));
    return { xi, mean: xi.length > 0 ? xi.reduce((s, f) => s + f.ovr, 0) / xi.length : 0, gw, gc, aw, ac };
  }

  private elevenOf(clubId: string): Eleven {
    let e = this.xi.get(clubId);
    if (!e) {
      const squad = this.squadOf(clubId) ?? [];
      const { ids } = bestEleven(squad, this.formationOf(clubId));
      const xi = squad.filter((f) => ids.has(f.id));
      const [gw, gc] = weights(xi, (f) => GOAL_WEIGHT[f.pos] * Math.pow(1.025, f.ovr - 50));
      const [aw, ac] = weights(xi, (f) => ASSIST_WEIGHT[f.pos] * Math.pow(1.02, f.ovr - 50));
      e = { xi, mean: xi.length > 0 ? xi.reduce((s, f) => s + f.ovr, 0) / xi.length : 0, gw, gc, aw, ac };
      this.xi.set(clubId, e);
      for (const f of squad) this.people.set(f.id, { f, clubId });
    }
    return e;
  }

  private compMap(comp: string): Map<number, PlayerStat> {
    let c = this.byComp.get(comp);
    if (!c) this.byComp.set(comp, (c = new Map()));
    this.totalCache = null;
    return c;
  }

  /** Estatística da temporada toda (soma das competições). */
  get total(): Map<number, PlayerStat> {
    if (this.totalCache) return this.totalCache;
    const t = new Map<number, PlayerStat>();
    for (const c of this.byComp.values()) {
      for (const [id, x] of c) {
        const s = t.get(id);
        if (!s) t.set(id, { ...x });
        else {
          s.apps += x.apps;
          s.goals += x.goals;
          s.assists += x.assists;
          s.rating += x.rating;
        }
      }
    }
    this.totalCache = t;
    return t;
  }

  /** Gera os detalhes de um jogo (autores, assistências, notas) e soma nas estatísticas. */
  record(comp: string, m: MatchResult, rng: Rng): void {
    const sides: [string, number, number][] = [
      [m.home, m.hg, m.ag],
      [m.away, m.ag, m.hg],
    ];
    const map = this.compMap(comp);
    for (const [clubId, gf, ga] of sides) {
      const e = clubId === 'player' && this.playerXI ? this.playerEleven(m.day ?? 0) : this.elevenOf(clubId);
      const n = e.xi.length;
      if (n === 0) continue; // clube estrangeiro: sem elenco
      const goals = new Int8Array(n);
      const assists = new Int8Array(n);
      for (let g = 0; g < gf; g++) {
        const si = pick(rng, e.gc, e.gw);
        if (si < 0) continue;
        goals[si]++;
        if (rng.chance(0.7)) {
          const ai = pick(rng, e.ac, e.aw, si);
          if (ai >= 0) assists[ai]++;
        }
      }
      const result = gf > ga ? 0.5 : gf < ga ? -0.4 : 0;
      for (let i = 0; i < n; i++) {
        const f = e.xi[i];
        const defensive = f.pos === 'GOL' || f.pos === 'DEF';
        let r = 6.2 + result + goals[i] * 0.9 + assists[i] * 0.5 + (f.ovr - e.mean) * 0.04 + (rng.next() - 0.5) * 1.9;
        if (defensive) r += ga === 0 ? 0.45 : -0.15 * Math.max(0, ga - 1);
        r = Math.min(10, Math.max(3, r));
        let st = map.get(f.id);
        if (!st) map.set(f.id, (st = emptyStat()));
        st.apps++;
        st.goals += goals[i];
        st.assists += assists[i];
        st.rating += r;
        if (clubId === 'player' || (this.logComps.has(comp) && (goals[i] > 0 || assists[i] > 0))) {
          if (!this.people.has(f.id)) this.people.set(f.id, { f, clubId });
          this.log.push([m.day ?? 0, comp, f.id, goals[i], assists[i], Math.round(r * 10)]);
        }
      }
    }
  }

  /** Gols do jogador `id` na temporada toda. */
  goalsOf(id: number): number {
    return this.total.get(id)?.goals ?? 0;
  }
}

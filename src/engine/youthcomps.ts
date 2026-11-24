import { knockout, roundRobin, sortTable, applyResult, emptyRow, type LeagueContext } from './league';
import { playMatch } from './match';
import { deriveRng, type Rng } from './rng';
import type { Club, Footballer, Position, Tier, YouthComp, YouthGame } from './types';

/**
 * Campeonatos da base (simulados; o jogador só acompanha): Copa de Juniores (Sub-20, janeiro),
 * Estadual Sub-17 e, para clubes das Séries A e B, o Brasileiro Sub-20.
 * O time do jogador sai das categorias de base (completado por outros garotos da escolinha);
 * os times da IA têm força pelo nível e prestígio do clube.
 */

const ME = 'player';
const GOAL_WEIGHT: Record<Position, number> = { GOL: 0, DEF: 0.6, MEI: 2, ATA: 3.2 };

export interface YouthInput {
  seed: number;
  season: number;
  year: number;
  tier: Tier;
  national: number | null;
  academy: number;
  /** garotos da base e jovens do elenco profissional que não são titulares */
  youth: Footballer[];
  prospects: Footballer[];
  clubs: Club[];
  clubName: string;
}

/** Força do time de base de um clube da IA (fixa na temporada). O Sub-17 é mais novo e mais fraco. */
function aiYouthStrength(rng: Rng, c: Club, sub17: boolean): number {
  if (sub17) return 35.5 + (7 - c.tier) * 1.9 + (c.prestige ?? 0) * 0.5 + rng.normal(2);
  return 40 + (7 - c.tier) * 2.6 + (c.prestige ?? 0) * 0.6 + rng.normal(2);
}

/** Time do jogador numa categoria: os 11 melhores entre os garotos da idade, completando com a escolinha. */
function myTeam(players: Footballer[], filler: number): { strength: number; xi: Footballer[] } {
  const xi = players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  const ratings = [...xi.map((f) => f.ovr), ...Array(Math.max(0, 11 - xi.length)).fill(filler)];
  return { strength: ratings.reduce((s, r) => s + r, 0) / ratings.length, xi };
}

interface Runner {
  name: (id: string) => string;
  ctx: LeagueContext;
  rng: () => Rng;
  games: YouthGame[];
  goals: number[];
}

function record(r: Runner, round: string, h: string, a: string, hg: number, ag: number, pens?: [number, number]): void {
  if (h !== ME && a !== ME) return;
  const home = h === ME;
  const g: YouthGame = { round, opponent: r.name(home ? a : h), gf: home ? hg : ag, ga: home ? ag : hg };
  if (pens) g.pens = home ? pens : [pens[1], pens[0]];
  r.games.push(g);
  r.goals.push(g.gf);
}

function league(r: Runner, ids: string[], round: string) {
  const table = new Map(ids.map((id) => [id, emptyRow(id)]));
  roundRobin(ids)
    .slice(0, ids.length % 2 === 0 ? ids.length - 1 : ids.length)
    .forEach((rd, i) => {
      for (const [h, a] of rd) {
        const m = playMatch(r.rng(), h, a, r.ctx.strength(h, a), r.ctx.strength(a, h), r.ctx.homeAdv(h));
        applyResult(table, m);
        record(r, `${round} · ${i + 1}ª rodada`, h, a, m.hg, m.ag);
      }
    });
  return sortTable([...table.values()]).map((x) => x.clubId);
}

function ko(r: Runner, pairs: [string, string][], round: string, neutral: boolean): string[] {
  return pairs.map(([h, a]) => {
    const m = knockout(r.rng(), r.ctx, h, a, neutral);
    record(r, round, h, a, m.hg, m.ag, m.pens);
    return m.winner!;
  });
}

function finishText(champion: string, vice: string, out: { round: string; ids: string[] }[], phaseOrder: string[]): string {
  if (champion === ME) return 'Campeão';
  if (vice === ME) return 'Vice-campeão';
  for (const o of out) if (o.ids.includes(ME)) return `Caiu ${/^(oitavas|quartas)/i.test(o.round) ? 'nas' : 'na'} ${o.round.toLowerCase()}`;
  const pos = phaseOrder.indexOf(ME) + 1;
  return pos > 0 ? `${pos}º na 1ª fase` : 'Eliminado';
}

/** Distribui os gols do time do jogador entre os garotos reais (a escolinha também marca). */
function scorers(rng: Rng, xi: Footballer[], goals: number): { f: Footballer; goals: number }[] {
  const fillers = Math.max(0, 11 - xi.length);
  const w = xi.map((f) => GOAL_WEIGHT[f.pos] * Math.pow(1.04, f.ovr - 45));
  const fillW = 1.6 * fillers;
  const total = w.reduce((s, x) => s + x, 0) + fillW;
  const count = new Map<number, number>();
  for (let g = 0; g < goals; g++) {
    let x = rng.next() * total;
    for (let i = 0; i < xi.length; i++) {
      x -= w[i];
      if (x < 0) {
        count.set(xi[i].id, (count.get(xi[i].id) ?? 0) + 1);
        break;
      }
    }
  }
  return xi.map((f) => ({ f, goals: count.get(f.id) ?? 0 })).filter((x) => x.goals > 0).sort((a, b) => b.goals - a.goals || a.f.id - b.f.id);
}

function runComp(inp: YouthInput, key: string, name: string, players: Footballer[], opponents: Club[], format: 'groups' | 'league'): YouthComp {
  const srng = deriveRng(inp.seed, inp.season, 'base', key, 'forca');
  const filler = 34 + inp.academy * 2 + (7 - inp.tier) * 0.6;
  const team = myTeam(players, filler);
  const strength = new Map<string, number>([[ME, team.strength]]);
  for (const c of opponents) strength.set(c.id, aiYouthStrength(srng, c, key === 'sub17'));
  const names = new Map(opponents.map((c) => [c.id, `${c.name}`]));
  let n = 0;
  const r: Runner = {
    name: (id) => (id === ME ? inp.clubName : names.get(id) ?? id),
    ctx: { strength: (id) => strength.get(id) ?? 40, homeAdv: () => 1.5 },
    rng: () => deriveRng(inp.seed, inp.season, 'base', key, n++),
    games: [],
    goals: [],
  };
  const ids = [ME, ...opponents.map((c) => c.id)];
  let champion: string;
  let vice: string;
  const out: { round: string; ids: string[] }[] = [];
  let phaseOrder: string[] = [];
  if (format === 'groups') {
    // 8 grupos de 4 (turno único) → oitavas, quartas, semi e final em jogo único
    const drawn = deriveRng(inp.seed, inp.season, 'base', key, 'sorteio').shuffle(ids);
    const groups = Array.from({ length: 8 }, (_, i) => drawn.slice(i * 4, i * 4 + 4));
    const order = groups.map((g, i) => league(r, g, `Grupo ${'ABCDEFGH'[i]}`));
    phaseOrder = order.flat();
    let alive: string[] = [];
    for (let i = 0; i < 8; i += 2) alive.push(order[i][0], order[i + 1][1], order[i + 1][0], order[i][1]);
    const groupOut = order.flatMap((g) => g.slice(2));
    if (groupOut.includes(ME)) out.push({ round: 'fase de grupos', ids: [ME] });
    for (const round of ['Oitavas de final', 'Quartas de final', 'Semifinal']) {
      const pairs: [string, string][] = [];
      for (let i = 0; i < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]]);
      const winners = ko(r, pairs, round, false);
      out.unshift({ round, ids: alive.filter((x) => !winners.includes(x)) });
      alive = winners;
    }
    [champion] = ko(r, [[alive[0], alive[1]]], 'Final', true);
    vice = champion === alive[0] ? alive[1] : alive[0];
  } else {
    // pontos corridos (turno único) → semifinais e final
    phaseOrder = league(r, ids, '1ª fase');
    const top = phaseOrder.slice(0, 4);
    const semis = ko(r, [[top[0], top[3]], [top[1], top[2]]], 'Semifinal', false);
    out.push({ round: 'Semifinal', ids: top.filter((x) => !semis.includes(x)) });
    [champion] = ko(r, [[semis[0], semis[1]]], 'Final', true);
    vice = champion === semis[0] ? semis[1] : semis[0];
  }
  const goals = r.goals.reduce((s, g) => s + g, 0);
  const top = scorers(deriveRng(inp.seed, inp.season, 'base', key, 'gols'), team.xi, goals);
  return {
    key,
    name,
    finish: finishText(champion, vice, out, phaseOrder),
    champion: r.name(champion),
    won: champion === ME,
    games: r.games,
    scorers: top.slice(0, 3).map((x) => ({ id: x.f.id, name: x.f.name, goals: x.goals })),
    strength: Math.round(team.strength * 10) / 10,
  };
}

/** Os campeonatos da base da temporada do clube do jogador. */
export function youthSeason(inp: YouthInput): YouthComp[] {
  const pick = deriveRng(inp.seed, inp.season, 'base', 'convidados');
  const sub20 = [...inp.youth, ...inp.prospects].filter((f) => f.age <= 20);
  const sub17 = inp.youth.filter((f) => f.age <= 17);
  const comps: YouthComp[] = [];
  // Copa de Juniores: 31 convidados (quase todos de séries nacionais, alguns do estado)
  const national = inp.clubs.filter((c) => c.national !== null && c.national <= 3);
  const state = inp.clubs.filter((c) => c.stateDiv !== null && c.national === null);
  const guests = [...pick.shuffle(national).slice(0, 25), ...pick.shuffle(state).slice(0, 6)];
  comps.push(runComp(inp, 'juniores', 'Copa de Juniores', sub20, guests, 'groups'));
  // Estadual Sub-17: 11 clubes do estado
  const est = pick.shuffle(inp.clubs.filter((c) => c.stateDiv === 'A' || c.stateDiv === 'B')).slice(0, 11);
  comps.push(runComp(inp, 'sub17', 'Estadual Sub-17', sub17, est, 'league'));
  // Brasileiro Sub-20: só para clubes das Séries A e B
  if (inp.national !== null && inp.national <= 2) {
    const big = inp.clubs.filter((c) => c.national === 1).slice(0, 19);
    comps.push(runComp(inp, 'sub20', 'Brasileiro Sub-20', sub20, big, 'league'));
  }
  return comps;
}

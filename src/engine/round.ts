import { partialTable, outcomeOf } from './calendarView';
import { TACTICS } from '../data/club';
import { blockStats, quickMoment, type BlockStat } from './live';
import { deriveRng, hashSeed } from './rng';
import { PLAYER_ID } from './season';
import type { CalendarMatch, CalendarStage, Club, Footballer, GameState, LiveMoment, TableRow } from './types';

/**
 * Rodada a rodada (modo técnico): tudo aqui é leitura do calendário já simulado.
 * Mostra todos os jogos da rodada do jogador ao mesmo tempo, a forma do adversário e a tabela antes/depois.
 */

export interface RoundGame {
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  hg: number;
  ag: number;
  /** minutos dos gols, em ordem ('h' = mandante) */
  goals: { minute: number; side: 'h' | 'a' }[];
  mine: boolean;
}

export interface RoundView {
  day: number;
  comp: string;
  round: string;
  /** fase de pontos da rodada (null no mata-mata) */
  stage: CalendarStage | null;
  /** jogo do jogador (narração) */
  moment: LiveMoment;
  /** jogos da rodada (o do jogador primeiro) */
  games: RoundGame[];
  /** estatísticas por bloco de 5 minutos (jogos do técnico) */
  stats: BlockStat[] | null;
  /** suas mexidas durante o jogo */
  changes: MatchChange[];
}

export interface MatchChange {
  minute: number;
  ins: string[];
  outs: string[];
  /** nova estratégia (rótulo) */
  tactic: string | null;
}

/** As mexidas do jogador no jogo do dia, com quem entrou e quem saiu. */
export function matchChanges(state: GameState, day: number): MatchChange[] {
  const live = state.live;
  if (!live) return [];
  const name = (id: number) => state.player.squad.find((f) => f.id === id)?.name ?? `#${id}`;
  let field = live.elevens.find((e) => e.day === day)?.ids ?? [];
  const list = (live.halftimes ?? []).filter((h) => h.day === day).sort((a, b) => (a.minute ?? 45) - (b.minute ?? 45));
  return list.map((h) => {
    const minute = h.minute ?? 45;
    // quem já tinha saído por lesão ou expulsão não conta como substituído
    const gone = new Set([
      ...live.injuries.filter((i) => i.from === day && (i.minute ?? 60) < minute).map((i) => i.id),
      ...(live.cards ?? []).filter((c) => c.day === day && c.kind === 'vermelho' && (c.minute ?? 60) < minute).map((c) => c.id),
    ]);
    const next = h.ids ?? field;
    const ins = next.filter((id) => !field.includes(id)).map(name);
    const outs = field.filter((id) => !next.includes(id) && !gone.has(id)).map(name);
    field = next;
    return { minute, ins, outs, tactic: h.tactic ? TACTICS[h.tactic].label : null };
  });
}

/** Fase de pontos em que o jogador joga no dia (e o índice dele). */
function stageOn(state: GameState, day: number): { stage: CalendarStage; me: number } | null {
  const cal = state.calendar;
  if (!cal) return null;
  for (const stage of cal.stages) {
    const me = stage.ids.indexOf(PLAYER_ID);
    if (me < 0) continue;
    if (stage.matches.some(([d, h, a]) => d === day && (h === me || a === me))) return { stage, me };
  }
  return null;
}

/** Minutos dos gols de um jogo da IA (só para mostrar; sorteio próprio, sempre o mesmo). */
function goalMinutes(seed: number, season: number, day: number, k: number, hg: number, ag: number): RoundGame['goals'] {
  const rng = deriveRng(seed, season, 'rodada', day, k);
  const sides = rng.shuffle([...Array(hg).fill('h'), ...Array(ag).fill('a')] as ('h' | 'a')[]);
  return sides.map((side) => ({ side, minute: rng.int(2, 90) })).sort((x, y) => x.minute - y.minute);
}

/** A rodada do jogo do jogador no dia `day`. */
export function roundOn(state: GameState, day: number): RoundView | null {
  const cal = state.calendar;
  const m = cal?.matches.find((x) => x.day === day);
  if (!cal || !m) return null;
  const special = state.live?.moments.find((x) => x.day === day);
  const moment = special ?? quickMoment(state, m);
  const p = state.player;
  // gols do jogo do jogador: os mesmos minutos da narração (tempo normal e prorrogação)
  const myGoals = moment.events.filter((e) => e.kind === 'gol').map((e) => ({ minute: e.minute, side: (e.mine === moment.playerHome ? 'h' : 'a') as 'h' | 'a' }));
  const mineGame: RoundGame = {
    home: moment.playerHome ? PLAYER_ID : 'opp',
    away: moment.playerHome ? 'opp' : PLAYER_ID,
    homeName: moment.homeName,
    awayName: moment.awayName,
    hg: moment.result.hg,
    ag: moment.result.ag,
    goals: myGoals,
    mine: true,
  };
  const at = stageOn(state, day);
  const games: RoundGame[] = [mineGame];
  if (at) {
    const { stage, me } = at;
    const name = (i: number) => (stage.ids[i] === PLAYER_ID ? p.name : cal.clubNames[stage.ids[i]] ?? stage.ids[i]);
    stage.matches.forEach(([d, h, a, hg, ag], k) => {
      if (d !== day || h === me || a === me) return;
      games.push({ home: stage.ids[h], away: stage.ids[a], homeName: name(h), awayName: name(a), hg, ag, goals: goalMinutes(state.seed, state.season, day, k, hg, ag), mine: false });
    });
  }
  const stats = blockStats(moment.result, moment.playerHome, hashSeed(state.seed, state.season, 'stats', day));
  return { day, comp: m.comp, round: m.round, stage: at?.stage ?? null, moment, games, stats, changes: matchChanges(state, day) };
}

export interface TableMove extends TableRow {
  pos: number;
  /** variação de posição na rodada (positivo = subiu) */
  delta: number;
}

/** Tabela depois da rodada, com quanto cada um subiu ou caiu. */
export function tableAfter(stage: CalendarStage, day: number): TableMove[] {
  const before = partialTable(stage, day - 1);
  const posBefore = new Map(before.map((r, i) => [r.clubId, i + 1]));
  const started = before.some((r) => r.played > 0);
  return partialTable(stage, day).map((r, i) => ({ ...r, pos: i + 1, delta: started ? (posBefore.get(r.clubId) ?? i + 1) - (i + 1) : 0 }));
}

export interface OpponentInfo {
  name: string;
  club: Club | null;
  strength: number | null;
  /** últimos resultados do adversário (mais antigo primeiro) */
  form: ('V' | 'E' | 'D')[];
  /** posição na fase de pontos (antes do jogo) */
  pos: number | null;
  of: number | null;
  /** destaque do elenco */
  star: Footballer | null;
}

/** O próximo adversário: força, forma nos últimos jogos e posição. */
export function opponentInfo(state: GameState, m: CalendarMatch): OpponentInfo {
  const club = state.clubs.find((c) => c.name === m.opponent) ?? null;
  const at = stageOn(state, m.day);
  let form: OpponentInfo['form'] = [];
  let pos: number | null = null;
  let of: number | null = null;
  if (at) {
    const { stage, me } = at;
    const game = stage.matches.find(([d, h, a]) => d === m.day && (h === me || a === me))!;
    const opp = game[1] === me ? game[2] : game[1];
    form = stage.matches
      .filter(([d, h, a]) => d < m.day && (h === opp || a === opp))
      .slice(-5)
      .map(([, h, , hg, ag]) => {
        const [gf, ga] = h === opp ? [hg, ag] : [ag, hg];
        return gf > ga ? 'V' : gf < ga ? 'D' : 'E';
      });
    const table = partialTable(stage, m.day - 1);
    pos = table.findIndex((r) => r.clubId === stage.ids[opp]) + 1;
    of = table.length;
  }
  const star = club ? club.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0] ?? null : null;
  return { name: m.opponent, club, strength: club?.strength ?? null, form, pos, of, star };
}

/** Posição do jogador na fase de pontos atual (antes do dia `day`). */
export function myPosition(state: GameState, day: number): { pos: number; of: number; comp: string } | null {
  const cal = state.calendar;
  if (!cal) return null;
  // a última fase de pontos que já começou (ou a primeira)
  const mine = cal.stages.filter((s) => s.ids.includes(PLAYER_ID));
  const started = mine.filter((s) => s.matches.some(([d]) => d <= day));
  const stage = started.at(-1) ?? mine[0];
  if (!stage) return null;
  const t = partialTable(stage, day);
  if (!t.some((r) => r.played > 0)) return null;
  return { pos: t.findIndex((r) => r.clubId === PLAYER_ID) + 1, of: t.length, comp: stage.compName };
}

/** Próximo jogo do jogador depois do dia `day`. */
export function nextMatchAfter(state: GameState, day: number): CalendarMatch | null {
  return state.calendar?.matches.find((m) => m.day > day) ?? null;
}

export { outcomeOf };

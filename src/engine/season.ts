import { SERIE_D_SPOTS, SQUAD_MAX, SQUAD_MIN, START_YEAR, TIERS, YOUTH_AGE_LIMIT, YOUTH_MAX } from '../data/pyramid';
import { evolveAiClubs, refreshStrength, type AiTransfer } from './aisquad';
import { levelOf, makeClub, syncTier } from './clubs';
import { homegrownInXI, moraleEdge, startingCoach } from './clubops';
import { estadual, pointsLeague, serieC, serieD, PLAYER, type CompEnv, type CompTracker, type LeagueOutcome } from './competitions';
import { SEASON_END, SEASON_START, matchDay, type CalendarKey } from './calendar';
import { SeasonStats } from './stats';
import { SquadPlan } from './squadplan';
import { STYLE_TACTIC, TACTICS } from '../data/club';
import { youthSeason } from './youthcomps';
import { recordCoachPoints, seasonCoachPoints } from './ranking';
import { coachCarousel } from './carousel';
import { computeAwards, myAwards, type AwardsInput, type LeagueInfo } from './awards';
import { continentalCup, foreignClubs, nationalCup, stateCup, worldCup, type CupEnv, type CupResult } from './cups';
import { nextId } from './effects';
import { TICKET_POLICY, attendance, seasonFinance } from './finance';
import { bestEleven, develop, makeFootballer, marketValue, marketWage, retires, round1, squadStrength, lineupStrength } from './footballers';
import { applyResult, emptyRow, sortTable, type LeagueContext } from './league';
import { moment } from './live';
import { BASE_HOME_ADVANTAGE, BLOCK_MINUTES, withBlocks, type BlockState, type GoalMult } from './match';
import { renewTarget, renewWage } from './office';
import { deriveRng, type Rng } from './rng';
import { clamp } from './util';
import type {
  Tactic,
  CalendarMatch, CalendarStage, Club, CoachStyle, CompId, CompResult, CompetitionId, CupMatch, CupRun, Footballer, GameState, LiveMoment, MatchResult, NationalDiv,
  Outcome, SeasonResult, StateDiv, TableRow, Tier,
} from './types';

export const PLAYER_ID = PLAYER;
export const DEDUCTION_POINTS = 10;
/** Bônus de força por nível do técnico, relativo ao técnico típico do nível. */
export const COACH_BONUS = 0.4;

/** Nível de técnico típico de cada nível (0 na várzea, 3 na Série A). */
export function coachNorm(tier: Tier): number {
  return (7 - tier) / 2;
}

/** Vantagem do seu técnico sobre o típico do nível (pode ser negativa). */
export function coachEdge(rating: number, tier: Tier): number {
  return Math.round((rating - coachNorm(tier)) * COACH_BONUS * 100) / 100;
}

/** Multiplicadores de gol [a favor, contra] por estilo de técnico. */
const STYLE_GOALS: Record<CoachStyle, GoalMult> = {
  ofensivo: [1.15, 1.1],
  retranqueiro: [0.9, 0.82],
  formador: [1, 1],
  motivador: [1, 1],
  estrategista: [1, 1],
};

export function playerHomeAdv(state: GameState): number {
  const p = state.player;
  const full = Math.min(p.capacity, p.fans) / Math.max(1, TIERS[p.tier].typicalFans);
  return BASE_HOME_ADVANTAGE + Math.min(1, full);
}

/** Força esperada do time (sem a sorte da temporada): XI + técnico + eventos. */
export function teamStrength(state: GameState): number {
  const p = state.player;
  const chosen = p.lineup?.ids ? lineupStrength(p.squad, p.coach.formation, p.lineup.ids) : null;
  return Math.round(((chosen ?? squadStrength(p.squad, p.coach.formation)) + coachEdge(p.coach.rating, p.tier) + moraleEdge(p.coach.morale) + p.formMod) * 10) / 10;
}

/** O clube pode jogar no nível `tier` com esse estádio? */
export function stadiumAllows(capacity: number, tier: Tier): boolean {
  return capacity >= TIERS[tier].minStadium;
}

/** Última rodada vale algo? (pontos corridos: título, acesso ou queda a até 3 pontos). */
function lastRoundStake(out: LeagueOutcome, deduction: number, up: number, down: number, title: boolean): { stake: string; match: MatchResult } | null {
  const rounds = out.rounds;
  const ids = out.roundIds;
  if (!rounds || !ids || rounds.length === 0) return null;
  const table = new Map<string, TableRow>();
  for (const id of ids) table.set(id, emptyRow(id, id === PLAYER ? deduction : 0));
  for (const r of rounds.slice(0, -1)) for (const m of r) applyResult(table, m);
  const before = sortTable([...table.values()]);
  const pos = before.findIndex((r) => r.clubId === PLAYER) + 1;
  if (pos === 0) return null;
  const pts = before[pos - 1].points;
  const match = rounds[rounds.length - 1].find((m) => m.home === PLAYER || m.away === PLAYER);
  if (!match) return null;
  const at = (n: number) => before[Math.min(before.length, Math.max(1, n)) - 1].points;
  const topLine = title ? 1 : up;
  if (topLine > 0 && Math.abs(pts - at(pos <= topLine ? topLine + 1 : topLine)) <= 3) {
    return { stake: title ? 'Última rodada valendo o título!' : pos <= topLine ? 'Última rodada: segurar a vaga de acesso!' : 'Última rodada: dá para roubar a vaga de acesso!', match };
  }
  const dropLine = before.length - down;
  if (down > 0 && Math.abs(pts - at(pos <= dropLine ? dropLine + 1 : dropLine)) <= 3) {
    return { stake: pos <= dropLine ? 'Última rodada: não pode perder para não cair!' : 'Última rodada: só a vitória salva do rebaixamento!', match };
  }
  return null;
}

const STATE_COMP: Record<StateDiv, { id: CompResult['id']; name: string; tier: Tier; knockout: 8 | 4; twoLegFinal: boolean; up: number; down: number; floor?: boolean }> = {
  A: { id: 'estadual_a', name: 'Estadual', tier: 5, knockout: 8, twoLegFinal: true, up: 0, down: 2 },
  B: { id: 'estadual_b', name: 'Estadual Série B', tier: 6, knockout: 4, twoLegFinal: true, up: 2, down: 2 },
  V: { id: 'varzea', name: 'Várzea', tier: 7, knockout: 4, twoLegFinal: false, up: 2, down: 2, floor: true },
};

/**
 * Simula UMA temporada do futebol brasileiro: Estaduais (1º semestre), Séries A–D (2º semestre),
 * copas, acessos e quedas, vagas da Série D, finanças e evolução do elenco. Muta `state`.
 */
export function simulateSeason(state: GameState): SeasonResult {
  const p = state.player;
  const seed = state.seed;
  const season = state.season;
  const tier = p.tier;

  const formRng = deriveRng(seed, season, 'form');
  const sd = (p.origin === 'youtuber' ? 2 : 0.9) * (1 - p.facilities.medical * 0.1) * (p.coach.style === 'motivador' ? 0.7 : 1);
  const form = formRng.normal(sd);
  const pStrength = teamStrength(state) + form;
  // elenco ao longo da temporada: escalação, contratações de julho, cansaço e lesões (só o clube do jogador)
  const live = state.live;
  const plan = new SquadPlan(
    live?.startSquad ?? p.squad,
    live?.changes ?? [],
    live?.lineups ?? [{ day: -1, ids: p.lineup?.ids ?? null, rotate: p.lineup?.rotate ?? true, formation: p.coach.formation, tactic: p.tactic, training: p.training }],
    { seed, season, formation: p.coach.formation, medical: p.facilities.medical, fitness: p.staff.fitness, coach: !!state.career, talks: live?.talks },
  );
  const coachBonus = coachEdge(p.coach.rating, p.tier) + moraleEdge(p.coach.morale) + p.formMod + form;
  /** dia do jogo sendo simulado (as competições avisam pela data da rodada) */
  const clock = { day: 0 };
  const playerStrength = () => plan.at(clock.day).strength + coachBonus;
  const pHome = playerHomeAdv(state);
  const rivalBonus = p.rivalHatred / 50;

  const byId = new Map<string, Club>();
  for (const c of state.clubs) {
    refreshStrength(c); // a força vem do elenco atual (quem vendeu o craque enfraqueceu)
    byId.set(c.id, c);
  }
  const foreign = new Map<string, { name: string; strength: number }>();

  const ctx: LeagueContext = {
    strength(id, opp) {
      if (id === PLAYER) return playerStrength();
      const f = foreign.get(id);
      if (f) return f.strength;
      let s = byId.get(id)!.strength;
      if (opp === PLAYER) {
        if (p.origin === 'youtuber') s += 0.5;
        if (id === p.rivalId) s += rivalBonus;
      }
      return s;
    },
    homeAdv(id) {
      return id === PLAYER ? pHome : BASE_HOME_ADVANTAGE;
    },
    goalMult(h, a) {
      if (h !== PLAYER && a !== PLAYER) return [1, 1];
      // modo técnico: a estratégia escolhida (valendo no dia do jogo); presidente: o estilo do técnico
      // só a estratégia registrada para o dia (nunca a atual: senão uma troca mudaria jogos passados)
      const tactic = plan.lineupAt(clock.day).tactic ?? (state.career ? STYLE_TACTIC[p.coach.style] : null);
      return multFor(tactic, h, a, playerStrength());
    },
    knockoutBonus(id) {
      return id === PLAYER && p.coach.style === 'estrategista' ? 0.4 : 0;
    },
  };

  /** multiplicadores de gol de uma estratégia (do ponto de vista dos jogos do jogador) */
  function multFor(tactic: Tactic | null, h: string, a: string, mine: number): GoalMult {
    let [forMe, againstMe] = tactic ? TACTICS[tactic].goals : STYLE_GOALS[p.coach.style];
    // treino da semana (modo técnico)
    const training = state.career ? plan.lineupAt(clock.day).training : undefined;
    if (training === 'tatico') {
      forMe *= 1.04;
      againstMe *= 0.97;
    } else if (training === 'finalizacao') {
      forMe *= 1.06;
      againstMe *= 1.02;
    }
    if (tactic === 'contra_ataque') {
      const opp = h === PLAYER ? a : h;
      if (ctx.strength(opp, PLAYER) > mine) forMe *= 1.1;
    }
    return h === PLAYER ? [forMe, againstMe] : [againstMe, forMe];
  }
  // modo técnico: os jogos do jogador têm intervalo (o 2º tempo pode ter outro time e outra estratégia)
  const halftimes = state.career ? live?.halftimes ?? [] : null;
  const blockPlan = (h: string, a: string): ((block: number) => BlockState) | null => {
    if (!halftimes || (h !== PLAYER && a !== PLAYER)) return null;
    const day = clock.day;
    const first = ctx.goalMult!(h, a);
    const mine = halftimes.filter((x) => x.day === day).sort((x, y) => (x.minute ?? 45) - (y.minute ?? 45));
    const events = plan.matchEvents(day);
    if (mine.length === 0 && events.length === 0) return () => ({ delta: [0, 0], mult: first });
    const base = playerStrength();
    const firstXI = plan.at(day).xi.map((f) => f.id);
    const cache = new Map<string, BlockState>();
    return (b) => {
      const t = b * BLOCK_MINUTES;
      // quem está em campo neste bloco: a última mudança até aqui, menos expulsos e machucados
      let ids: number[] | null = null;
      let tactic: Tactic | null = null;
      for (const c of mine) {
        if ((c.minute ?? 45) > t) continue;
        if (c.ids) ids = c.ids;
        if (c.tactic) tactic = c.tactic;
      }
      const gone = events.filter((e) => e.minute < t);
      const key = JSON.stringify([ids, tactic, gone.map((e) => e.id)]);
      const hit = cache.get(key);
      if (hit) return hit;
      let st: BlockState;
      if (!ids && gone.length === 0) st = { delta: [0, 0], mult: tactic ? multFor(tactic, h, a, base) : first };
      else {
        const out = new Set(gone.map((e) => e.id));
        const field = (ids ?? firstXI).filter((id) => !out.has(id));
        const reds = gone.filter((e) => e.kind === 'vermelho').length;
        // machucado: entra o melhor do banco (automático); expulso: o time fica com um a menos
        const after = plan.strengthWith(day, field) + coachBonus - reds * 3;
        const d = after - base;
        st = { delta: h === PLAYER ? [d, 0] : [0, d], mult: tactic ? multFor(tactic, h, a, after) : first };
      }
      cache.set(key, st);
      return st;
    };
  };
  /** placar do 1º tempo dos jogos do jogador, por dia (do ponto de vista dele) */
  const halves = new Map<number, [number, number]>();
  const blocksOf = new Map<number, [number, number][]>();

  const capacityAtInspection = p.capacity + p.capacityBuilding;
  const nameOf = (id: string) => (id === PLAYER ? p.name : foreign.get(id)?.name ?? byId.get(id)?.name ?? id);
  const tierOf = (id: string): Tier | null => (id === PLAYER ? tier : byId.get(id)?.tier ?? null);
  const year = START_YEAR + season - 1;
  const stages: CalendarStage[] = [];
  /** registra as fases de pontos das competições do jogador (tabelas parciais do calendário) */
  const tracker = (comp: CompId, compName: string): CompTracker => ({
    stage(name, ids, deductions) {
      stages.push({ comp, compName, name, ids: ids.slice(), deductions: { ...deductions }, matches: [] });
      return stages.length - 1;
    },
    match(i, m) {
      const st = stages[i];
      st.matches.push([m.day ?? 0, st.ids.indexOf(m.home), st.ids.indexOf(m.away), m.hg, m.ag]);
    },
  });
  const stats = new SeasonStats(
    (id) => (id === PLAYER ? p.squad : byId.get(id)?.squad ?? null),
    (id) => (id === PLAYER ? p.coach.formation : '4-4-2'),
    (day) => plan.at(day).xi,
  );
  // artilharia das ligas do jogador durante a temporada
  const NAT_KEY = { 1: 'serie-a', 2: 'serie-b', 3: 'serie-c', 4: 'serie-d' } as const;
  const STATE_KEY = { A: 'est-a', B: 'est-b', V: 'varzea' } as const;
  if (p.national) stats.logComps.add(NAT_KEY[p.national]);
  if (p.stateDiv) stats.logComps.add(STATE_KEY[p.stateDiv]);
  let pass: 1 | 2 = 1;
  const pass1Days: number[] = [];
  const env = (label: CalendarKey, target?: Tier, track?: [CompId, string]): CompEnv & CupEnv => {
    let n = 0;
    return {
      detail:
        pass === 1
          ? (m) => {
              if (m.home === PLAYER || m.away === PLAYER) pass1Days.push(m.day ?? 0);
            }
          : (m, rng) => {
              if (m.half && (m.home === PLAYER || m.away === PLAYER)) halves.set(m.day ?? 0, m.home === PLAYER ? m.half : [m.half[1], m.half[0]]);
              if (m.blocks && (m.home === PLAYER || m.away === PLAYER)) blocksOf.set(m.day ?? 0, m.home === PLAYER ? m.blocks : m.blocks.map(([x, y]) => [y, x] as [number, number]));
              stats.record(label, m, rng);
            },
      rng: deriveRng(seed, season, label),
      matchRng: () => deriveRng(seed, season, label, 'jogo', n++),
      dayOf: (k, total) => (clock.day = matchDay(label, year, k, total)),
      track: pass === 2 && track ? tracker(track[0], track[1]) : undefined,
      ctx,
    name: nameOf,
    tierOf,
      playerTier: tier,
      eligible: (id) => id !== PLAYER || target === undefined || stadiumAllows(capacityAtInspection, target),
    };
  };
  const deduction = p.pendingDeduction;
  const mainIsNational = p.national !== null;
  const ded = (isMain: boolean): Record<string, number> => (isMain && deduction > 0 ? { [PLAYER]: deduction } : {});

  const stateIds = (div: StateDiv) => [...state.clubs.filter((c) => c.stateDiv === div).map((c) => c.id), ...(p.stateDiv === div ? [PLAYER] : [])];
  const natIds = (d: NationalDiv) => [...state.clubs.filter((c) => c.national === d).map((c) => c.id), ...(p.national === d ? [PLAYER] : [])];

  const mine = (on: boolean, id: CompId, name: string): [CompId, string] | undefined => (on ? [id, name] : undefined);
  /**
   * As competições rodam duas vezes: a 1ª passada só descobre as datas dos jogos do clube do jogador
   * (para montar escalação, cansaço e lesões em ordem de data); a 2ª é a de verdade.
   */
  const runAll = () => {
    // ---------------------- 1º semestre: estaduais ----------------------
    const estA = estadual(env('est-a', undefined, mine(p.stateDiv === 'A', 'estadual_a', 'Estadual')), STATE_COMP.A, stateIds('A'), ded(!mainIsNational && p.stateDiv === 'A'));
    const estB = estadual(env('est-b', 5, mine(p.stateDiv === 'B', 'estadual_b', 'Estadual Série B')), STATE_COMP.B, stateIds('B'), ded(!mainIsNational && p.stateDiv === 'B'));
    const varzea = estadual(env('varzea', 6, mine(p.stateDiv === 'V', 'varzea', 'Várzea')), STATE_COMP.V, stateIds('V'), ded(!mainIsNational && p.stateDiv === 'V'));

    // ---------------------- 2º semestre: séries nacionais ----------------------
    const serA = pointsLeague(env('serie-a', undefined, mine(p.national === 1, 'serie_a', 'Série A')), 'serie_a', 'Série A', 1, natIds(1), 0, 4, ded(p.national === 1));
    const serB = pointsLeague(env('serie-b', 1, mine(p.national === 2, 'serie_b', 'Série B')), 'serie_b', 'Série B', 2, natIds(2), 4, 4, ded(p.national === 2));
    const serC = serieC(env('serie-c', 2, mine(p.national === 3, 'serie_c', 'Série C')), natIds(3), ded(p.national === 3));
    const serD = serieD(env('serie-d', 3, mine(p.national === 4, 'serie_d', 'Série D')), natIds(4));

    const stateOut: Record<StateDiv, LeagueOutcome> = { A: estA, B: estB, V: varzea };
    const natOut: Record<NationalDiv, LeagueOutcome> = { 1: serA, 2: serB, 3: serC, 4: serD };

    // ---------------------- copas ----------------------
    const cupRuns: CupRun[] = [];
    const cupMatches: CupMatch[] = [];
    const addCup = (res: CupResult) => {
      if (res.run) cupRuns.push(res.run);
      cupMatches.push(...res.playerMatches);
    };
    const ourState = [...stateIds('A'), ...stateIds('B'), ...stateIds('V')];
    const cupChampions: AwardsInput['cupChampions'] = [];
    const copaEstado = stateCup(env('copa-estado'), ourState);
    cupChampions.push({ id: 'estado', clubId: copaEstado.championId });
    addCup(copaEstado);

    // Copa do Brasil: Séries A e B, 12 melhores da C, 2 melhores do Estadual sem série nacional,
    // o jogador se classificado, e o resto de outros estados
    const playerInCopa = (p.national !== null && p.national <= 3) || p.copaSpot || (p.stateDiv === 'A' && estA.ranking.indexOf(PLAYER) < 4);
    const entrants = new Set<string>([...natIds(1), ...natIds(2)]);
    const byStrength = (ids: string[]) => ids.filter((id) => id !== PLAYER).sort((a, b) => byId.get(b)!.strength - byId.get(a)!.strength || (a < b ? -1 : 1));
    for (const id of byStrength(natIds(3)).slice(0, 12)) entrants.add(id);
    for (const id of estA.ranking.filter((id) => id !== PLAYER && byId.get(id)!.national === null).slice(0, 2)) entrants.add(id);
    if (playerInCopa) entrants.add(PLAYER);
    else entrants.delete(PLAYER);
    const fill = byStrength(state.clubs.filter((c) => c.national === 4 || (c.national === null && c.stateDiv === null)).map((c) => c.id));
    for (const id of fill) {
      if (entrants.size >= 64) break;
      entrants.add(id);
    }
    const copa = nationalCup(env('copa'), [...entrants]);
    cupChampions.push({ id: 'copa', clubId: copa.championId });
    addCup(copa);

    // Libertadores (6 melhores da Série A) e Sul-Americana (7º ao 12º) todo ano, com ou sem o jogador
    let ccChampion = false;
    const continental: Partial<Record<'cc' | 'le' | 'mundial', string>> = {};
    const ranked = byStrength(natIds(1));
    const inLiberta: string[] = [];
    for (const id of ['cc', 'le'] as const) {
      const mine = p.continental === id;
      const domestic = id === 'cc' ? ranked.slice(0, mine ? 5 : 6) : ranked.slice(6, mine ? 11 : 12);
      // um clube estrangeiro não joga as duas copas no mesmo ano
      const others = foreignClubs(deriveRng(seed, season, 'foreign', id), 32 - domestic.length - (mine ? 1 : 0), id === 'cc' ? 76 : 71, 4, `f${id}`, true, inLiberta);
      if (id === 'cc') inLiberta.push(...others.map((f) => f.name));
      for (const f of others) foreign.set(f.id, f);
      const res = continentalCup(env(id), id, [...(mine ? [PLAYER] : []), ...domestic, ...others.map((f) => f.id)]);
      addCup(res);
      cupChampions.push({ id, clubId: res.championId });
      continental[id] = res.championId;
      if (id === 'cc') ccChampion = mine && res.championId === PLAYER;
    }
    // Mundial: o jogador vai no ano seguinte ao título; sem ele, o campeão da Libertadores do ano disputa em dezembro
    if (p.worldCup || continental.cc !== PLAYER) {
      const others = foreignClubs(deriveRng(seed, season, 'foreign', 'mundial'), 7, 81, 4, 'fwc', false);
      for (const f of others) foreign.set(f.id, f);
      const wc = worldCup(env('mundial'), [p.worldCup ? PLAYER : continental.cc!, ...others.map((f) => f.id)]);
      addCup(wc);
      cupChampions.push({ id: 'mundial', clubId: wc.championId });
      continental.mundial = wc.championId;
    }
    return { estA, estB, varzea, serA, serB, serC, serD, stateOut, natOut, cupRuns, cupMatches, copaEstado, copa, ccChampion, cupChampions, continental };
  };
  pass = 1;
  withBlocks(blockPlan, runAll);
  plan.build(pass1Days);
  pass = 2;
  const { estA, estB, varzea, serA, serB, serC, serD, stateOut, natOut, cupRuns, cupMatches, copaEstado, copa, ccChampion, cupChampions, continental } = withBlocks(blockPlan, runAll);
  const cupPrizes = cupRuns.reduce((sum, c) => sum + c.prize, 0);

  // ---------------------- movimentos e vagas ----------------------
  const before = new Map(state.clubs.map((c) => [c.id, { national: c.national, stateDiv: c.stateDiv }]));
  const nextNat = new Map<string, NationalDiv | null>();
  const nextState = new Map<string, StateDiv | null>();
  const allIds = [...state.clubs.map((c) => c.id), PLAYER];
  const curNat = (id: string) => (id === PLAYER ? p.national : before.get(id)!.national);
  const curState = (id: string) => (id === PLAYER ? p.stateDiv : before.get(id)!.stateDiv);
  for (const id of allIds) {
    nextNat.set(id, curNat(id));
    nextState.set(id, curState(id));
  }
  // nacionais
  for (const id of serA.relegated) nextNat.set(id, 2);
  for (const id of serB.promoted) nextNat.set(id, 1);
  for (const id of serB.relegated) nextNat.set(id, 3);
  for (const id of serC.promoted) nextNat.set(id, 2);
  for (const id of serC.relegated) nextNat.set(id, 4);
  const promotedFromD = new Set(serD.promoted);
  for (const id of natIds(4)) nextNat.set(id, promotedFromD.has(id) ? 3 : null); // a Série D é refeita todo ano
  // estaduais
  for (const id of estA.relegated) nextState.set(id, 'B');
  for (const id of estB.promoted) nextState.set(id, 'A');
  for (const id of estB.relegated) nextState.set(id, 'V');
  for (const id of varzea.promoted) nextState.set(id, 'B');
  const leaveState = new Set(varzea.relegated.filter((id) => id !== PLAYER));
  // vagas do estado na Série D: os mais bem colocados no Estadual que não terão série nacional
  const dQualified: string[] = [];
  let barredD = false;
  for (const id of estA.ranking) {
    if (dQualified.length >= SERIE_D_SPOTS) break;
    if (nextNat.get(id) !== null || nextState.get(id) !== 'A') continue;
    if (id === PLAYER && !stadiumAllows(capacityAtInspection, 4)) {
      barredD = true;
      continue;
    }
    dQualified.push(id);
  }
  for (const id of dQualified) nextNat.set(id, 4);
  // demais vagas da Série D: clubes de outros estados
  const dCount = [...nextNat.values()].filter((v) => v === 4).length;
  const poolRng = deriveRng(seed, season, 'pool-d');
  const poolCandidates = state.clubs.filter((c) => c.stateDiv === null && nextNat.get(c.id) === null);
  const poolPicked = new Set<string>();
  while (poolPicked.size < 32 - dCount && poolPicked.size < poolCandidates.length) {
    const c = poolRng.weighted(poolCandidates.filter((x) => !poolPicked.has(x.id)), (x) => Math.pow(1.25, x.strength - 50));
    poolPicked.add(c.id);
  }
  for (const id of poolPicked) nextNat.set(id, 4);

  // ---------------------- resultado do jogador ----------------------
  const mainOut = mainIsNational ? natOut[p.national!] : stateOut[p.stateDiv!];
  const mainComp = mainOut.comp!;
  const comps: CompResult[] = [];
  if (p.stateDiv) comps.push(stateOut[p.stateDiv].comp!);
  if (p.national) comps.push(natOut[p.national].comp!);
  const nextTier = levelOf(nextNat.get(PLAYER) ?? null, nextState.get(PLAYER) ?? null);
  const barredMain = mainOut.barred || (!mainIsNational && p.stateDiv === 'A' && barredD) || (p.national === 4 && serD.barred);
  let outcome: Outcome;
  if (nextTier < tier) outcome = mainComp.won ? 'campeao' : 'acesso';
  else if (nextTier > tier) outcome = 'queda';
  else if (barredMain) outcome = 'barrado_estadio';
  else if (mainComp.won) outcome = 'campeao';
  else outcome = 'fica';
  const stadiumTarget = (tier - 1) as Tier;

  const mainTable = mainComp.tables[0]?.rows ?? [];
  const position = Math.max(1, mainTable.findIndex((r) => r.clubId === PLAYER) + 1);
  const row = mainTable.find((r) => r.clubId === PLAYER) ?? emptyRow(PLAYER);
  const leagueMatches = [...(p.stateDiv ? stateOut[p.stateDiv].playerMatches : []), ...(p.national ? natOut[p.national].playerMatches : [])];
  const allMatches = [...leagueMatches, ...cupMatches.map((m) => m.result)];

  // último jogo decisivo (pontos corridos: Séries A e B)
  const lastRound = p.national === 1 ? lastRoundStake(serA, deduction, 0, 4, true) : p.national === 2 ? lastRoundStake(serB, deduction, 4, 4, false) : null;

  // ---------------------- clássico ----------------------
  const derbyGames = allMatches.filter((m) => m.home === p.rivalId || m.away === p.rivalId);
  let derby: SeasonResult['derby'] = null;
  if (derbyGames.length > 0) {
    derby = { w: 0, d: 0, l: 0 };
    for (const m of derbyGames) {
      const mine = m.home === PLAYER ? m.hg : m.ag;
      const theirs = m.home === PLAYER ? m.ag : m.hg;
      if (m.winner ? m.winner === PLAYER : mine > theirs) derby.w++;
      else if (m.winner ? m.winner !== PLAYER : mine < theirs) derby.l++;
      else derby.d++;
    }
    p.derby.w += derby.w;
    p.derby.d += derby.d;
    p.derby.l += derby.l;
  }

  // ---------------------- objetivos ----------------------
  const xiIds = bestEleven(p.squad, p.coach.formation).ids;
  const homegrownXI = homegrownInXI(p.squad, xiIds);
  const cupWins = cupMatches.filter((m) => m.advanced === true).length;
  const occupancy = (Math.min(p.capacity, attendance(p)) / Math.max(1, p.capacity)) * 100;
  const objectives = state.office.objectives.map((o) => {
    let met: boolean;
    switch (o.kind) {
      case 'subir': met = nextTier < tier; break;
      case 'titulo': met = mainComp.won; break;
      case 'top4': case 'brigar': case 'meio': case 'nao_cair': met = position <= o.target && nextTier <= tier; break;
      case 'classico': met = derby !== null && derby.l === 0; break;
      case 'copa': met = cupWins >= o.target - 1; break;
      case 'base': met = homegrownXI >= o.target; break;
      case 'casa': met = occupancy >= o.target; break;
    }
    return { ...o, met };
  });
  const ms = TIERS[tier].moneyScale;
  const objectiveBonus = objectives.reduce((sum, o) => sum + (o.met ? Math.round((o.main ? 6 : 2) * ms) : 0), 0);

  // gols e jogos de verdade (detalhes de cada partida) para o elenco do jogador
  const total = stats.total;
  let topScorer: { name: string; goals: number } | null = null;
  for (const f of p.squad) {
    const st = total.get(f.id);
    if (!st) continue;
    f.goals += st.goals;
    f.apps += st.apps;
    if (!topScorer || st.goals > topScorer.goals) topScorer = { name: f.name, goals: st.goals };
  }
  const idolGoals = Math.max(0, ...p.squad.map((f) => f.goals));

  // ---------------------- momentos ao vivo ----------------------
  const moments = buildMoments(deriveRng(seed, season, 'live'), { p, nameOf, comps, lastRound, cupRuns, leagueMatches, tier, serD: p.national === 4 ? serD : null, squadOf: (id) => byId.get(id)?.squad ?? [] });

  // ---------------------- calendário (para mostrar a temporada aos poucos) ----------------------
  state.calendar = buildCalendar(season, year, stages, comps, cupRuns, nameOf, tierOf);
  for (const m of state.calendar!.matches) {
    const h = halves.get(m.day);
    if (h) m.half = h;
    const bl = blocksOf.get(m.day);
    if (bl) m.blocks = bl;
  }
  if (state.live) {
    // para a tela da temporada: lesões, cansaço e quem jogou cada partida
    state.live.injuries = plan.injuries.map((i) => ({ ...i }));
    state.live.fatigue = plan.fatigueLog;
    state.live.elevens = [...new Set(state.calendar!.matches.map((m) => m.day))].map((d) => ({ day: d, ids: plan.at(d).xi.map((f) => f.id) }));
    state.live.cards = plan.cards.map((c) => ({ ...c }));
    state.live.status = plan.statusLog;
    state.live.broken = plan.broken.map((b) => ({ ...b }));
    const people: Record<number, [string, string]> = {};
    for (const [, , id] of stats.log) {
      if (people[id]) continue;
      const who = stats.people.get(id);
      if (who) people[id] = [who.f.name, who.clubId === PLAYER ? p.name : nameOf(who.clubId)];
    }
    state.live.stats = { log: stats.log, people };
    state.live.suspensions = plan.suspensions.map((x) => ({ ...x }));
  }

  // ---------------------- finanças ----------------------
  const homeGames = allMatches.filter((m) => m.home === PLAYER).length;
  const rankPos = Math.max(1, mainOut.ranking.indexOf(PLAYER) + 1);
  const estadualCota = mainIsNational && p.stateDiv === 'A' ? Math.round(TIERS[5].tv * 0.6) : 0;
  const finance = seasonFinance(p, tier, homeGames, rankPos, mainOut.ranking.length, cupPrizes + objectiveBonus + estadualCota, idolGoals);
  p.cash = finance.cashEnd;
  for (const s of p.sponsors) if (s.seasonsLeft !== null) s.seasonsLeft--;
  p.sponsors = p.sponsors.filter((s) => s.seasonsLeft === null || s.seasonsLeft > 0);

  const name = p.name;
  const headlines: string[] = [];
  const departures: string[] = [];
  if (deduction > 0) headlines.push(`${name} começou a temporada com -${deduction} pontos de punição`);
  p.pendingDeduction = 0;

  // venda forçada
  if (p.cash < 0) {
    const sellable = p.squad.slice().sort((a, b) => marketValue(b) - marketValue(a) || a.id - b.id);
    let sold = 0;
    while (p.cash < 0 && sold < 3 && p.squad.length > SQUAD_MIN && sellable.length > 0) {
      const f = sellable.shift()!;
      const fee = Math.round(marketValue(f) * 0.7);
      p.cash += fee;
      p.squad = p.squad.filter((x) => x.id !== f.id);
      p.alumni.push(f);
      departures.push(`${f.name} (${f.ovr}) vendido às pressas por R$ ${fee} mil`);
      sold++;
    }
    if (sold > 0) headlines.push(`${name} faz venda forçada de ${sold} jogador(es) para pagar salários`);
  }

  // regra do caixa
  let bankrupt = false;
  const cashBefore = finance.cashEnd - finance.net;
  if (p.cash < 0) {
    p.negativeSeasons++;
    if (p.negativeSeasons >= 3 && p.cash < cashBefore) {
      bankrupt = true;
      headlines.push(`FALÊNCIA: ${name} fecha as portas afogado em dívidas`);
    } else if (p.negativeSeasons >= 2) {
      p.pendingDeduction = DEDUCTION_POINTS;
      headlines.push(`${name} perderá ${DEDUCTION_POINTS} pontos: ${p.negativeSeasons}º ano seguido no vermelho`);
    } else {
      headlines.push(`Caixa do ${name} fecha no vermelho`);
    }
  } else {
    p.negativeSeasons = 0;
  }

  const nextName = TIERS[nextTier].name;
  switch (outcome) {
    case 'campeao':
      headlines.unshift(nextTier < tier ? `${name} campeão da ${mainComp.name}! Rumo à ${nextName}` : `${name} É CAMPEÃO DA ${mainComp.name.toUpperCase()}!`);
      break;
    case 'acesso':
      headlines.unshift(tier === 5 ? `${name} garante vaga na Série D pelo Estadual!` : `${name} garante o acesso à ${nextName}`);
      break;
    case 'barrado_estadio':
      headlines.unshift(`ESTÁDIO PEQUENO: ${name} conquista a vaga em campo mas é barrado da ${TIERS[stadiumTarget].name}`);
      break;
    case 'queda':
      headlines.unshift(tier === 4 ? `${name} não se classifica e deixa a Série D` : `${name} é rebaixado: ${nextName} na próxima temporada`);
      break;
    default:
      headlines.unshift(`${name}: ${mainComp.finish.toLowerCase()} na ${mainComp.name}`);
  }
  if (mainIsNational && p.stateDiv) {
    const est = stateOut[p.stateDiv].comp!;
    headlines.push(est.won ? `${name} é campeão do ${est.name}!` : `${est.name}: ${est.finish.toLowerCase()}`);
  }
  if (topScorer && topScorer.goals > 0) headlines.push(`${topScorer.name} anota ${topScorer.goals} gols na temporada`);
  for (const c of cupRuns) {
    if (c.champion) headlines.splice(1, 0, `${name} É CAMPEÃO DA ${c.name.toUpperCase()}!`);
    else headlines.push(`${c.name}: ${c.reached.toLowerCase()}`);
    for (const m of c.matches) if (m.giantKill) headlines.splice(1, 0, `ZEBRA! ${name} elimina o ${m.opponent} na ${c.name}`);
  }
  if (derby && derby.w > 0 && derby.l === 0) headlines.push(`Clássico é nosso: ${name} invicto contra o rival`);

  // ---------------------- torcedômetro ----------------------
  const moodBefore = p.mood;
  let dm = 0;
  for (const o of objectives) dm += o.met ? (o.main ? 12 : 5) : o.main ? -14 : -2;
  dm += { campeao: 10, acesso: 12, acesso_playoff: 12, barrado_estadio: -10, fica: 0, queda: -18, falencia: -30 }[outcome];
  if (mainIsNational && p.stateDiv && stateOut[p.stateDiv].comp!.won) dm += 8;
  if (derby) dm += (derby.w - derby.l) * 3;
  dm += cupMatches.filter((m) => m.giantKill).length * 6;
  dm += cupRuns.filter((c) => c.champion).length * 10;
  dm += p.ticket === 0 ? 3 : p.ticket === 2 ? -4 : 0;
  dm -= state.office.soldHomegrown * 4;
  if (p.coach.style === 'motivador') dm += 3;
  p.mood = clamp(Math.round(p.mood + dm + (55 - p.mood) * 0.1), 0, 100);
  if (p.mood < 25) {
    // torcida com voz: protesto afasta torcedor (e, no modo técnico, pesa na diretoria)
    p.soul = clamp(p.soul - 2, 0, 100);
    p.fans = Math.round(p.fans * 0.96);
    headlines.push(`PROTESTO: torcida do ${name} vai à porta do estádio e pede mudanças`);
  } else if (p.mood >= 85) {
    p.hype = clamp(p.hype + 5, 0, 100);
    p.fans = Math.round(p.fans * 1.04);
    headlines.push(`FESTA: torcida do ${name} lota as ruas e o estádio vira caldeirão`);
  }

  // vagas para a próxima temporada
  const copaChampion = copa.championId === PLAYER;
  const posA = serA.ranking.indexOf(PLAYER) + 1;
  const nextContinental: GameState['player']['continental'] = bankrupt
    ? null
    : copaChampion || (p.national === 1 && posA >= 1 && posA <= 6)
      ? 'cc'
      : p.national === 1 && posA >= 7 && posA <= 12
        ? 'le'
        : null;
  if (nextContinental === 'cc') headlines.push(`${name} garante vaga na Libertadores`);
  else if (nextContinental === 'le') headlines.push(`${name} vai disputar a Sul-Americana`);
  if (ccChampion) headlines.push(`${name} vai ao Mundial de Clubes!`);
  p.continental = nextContinental;
  p.worldCup = ccChampion;
  p.copaSpot = copaEstado.championId === PLAYER;
  if (p.copaSpot) headlines.push(`${name} garante vaga na Copa do Brasil pela Copa do Estado`);

  // gols e jogos dos jogadores da IA (detalhes de cada partida)
  for (const c of state.clubs) {
    for (const f of c.squad) {
      const st = total.get(f.id);
      if (!st) continue;
      f.goals += st.goals;
      f.apps += st.apps;
    }
  }
  // ---------------------- base: Copinha, Estadual Sub-17, Brasileiro Sub-20 ----------------------
  const xiNow = bestEleven(p.squad, p.coach.formation).ids;
  const youthComps = youthSeason({
    seed, season, year, tier, national: p.national, academy: p.facilities.academy,
    youth: p.youth,
    prospects: p.squad.filter((f) => f.age <= 20 && !xiNow.has(f.id)),
    clubs: state.clubs,
    clubName: p.name,
  });
  for (const yc of youthComps) {
    if (yc.won) {
      headlines.push(`BASE: ${p.name} é campeão da ${yc.name}!`);
      p.hype = clamp(p.hype + 3, 0, 100);
    }
    // destaques: artilheiro do time (3+ gols) e, se campeão, o melhor do time
    const stars = yc.scorers.filter((x) => x.goals >= 3).slice(0, 1).map((x) => ({ id: x.id, why: `Artilheiro da ${yc.name} ${year} (${x.goals} gols)` }));
    if (yc.won) {
      const best = p.youth.filter((y) => !stars.some((s) => s.id === y.id)).sort((a, b) => b.ovr - a.ovr)[0];
      if (best) stars.push({ id: best.id, why: `Destaque do título da ${yc.name} ${year}` });
    }
    for (const st of stars) {
      const y = p.youth.find((x) => x.id === st.id);
      if (!y) continue;
      y.highlight = st.why;
      y.pot = Math.min(99, y.pot + 1);
      y.potHi = Math.min(99, y.potHi + 1);
      y.potLo = Math.min(y.potHi, y.potLo + 1);
      headlines.push(`BASE: ${y.name} ${st.why.charAt(0).toLowerCase()}${st.why.slice(1)}`);
      if (y.age >= 17 && y.askUp === undefined) {
        y.askUp = season;
        headlines.push(`${y.name} quer subir para o profissional: se não subir, pode procurar outro clube`);
      }
    }
  }

  // ---------------------- prêmios ----------------------
  const worldAwardNews: string[] = [];
  const leagueInfo = (key: string, compId: CompId, name: string, t: Tier, ids: string[], out: LeagueOutcome): LeagueInfo => ({
    key, compId, name, tier: t, ids, ranking: out.ranking, champion: out.champion, promoted: out.promoted,
  });
  const leagues = [
    leagueInfo('serie-a', 'serie_a', 'Série A', 1, natIds(1), serA),
    leagueInfo('serie-b', 'serie_b', 'Série B', 2, natIds(2), serB),
    leagueInfo('serie-c', 'serie_c', 'Série C', 3, natIds(3), serC),
    leagueInfo('serie-d', 'serie_d', 'Série D', 4, natIds(4), serD),
    leagueInfo('est-a', 'estadual_a', 'Estadual', 5, stateIds('A'), estA),
    leagueInfo('est-b', 'estadual_b', 'Estadual Série B', 6, stateIds('B'), estB),
    leagueInfo('varzea', 'varzea', 'Várzea', 7, stateIds('V'), varzea),
  ];
  // ranking de técnicos: pontos da temporada (só as últimas 5 contam)
  recordCoachPoints(state, seasonCoachPoints(leagues, cupChampions, PLAYER));
  const awards = computeAwards({
    seed,
    stats,
    leagues,
    playerId: PLAYER,
    playerCoach: p.coach.name,
    coachOf: (id) => byId.get(id)?.coachName,
    nameOf,
    tierOf,
    strengthOf: (id) => (id === PLAYER ? pStrength : byId.get(id)?.strength ?? 0),
    cupChampions,
  });
  // dança dos técnicos da IA (depois dos prêmios, que são do técnico que dirigiu a temporada)
  const carousel = coachCarousel(state, leagues, PLAYER, deriveRng(seed, season, 'danca-tecnicos'));
  const won = myAwards(awards);
  for (const w of won) headlines.push(`PRÊMIO: ${w.name} leva ${w.title.toLowerCase()}${w.scope === 'Temporada' ? '' : ` da ${w.scope}`}`);
  if (won.length > 0) {
    p.hype = clamp(p.hype + 4 * won.length, 0, 100);
    if (won.some((w) => w.title.startsWith('Técnico'))) p.coach.morale = clamp(p.coach.morale + 10, 0, 100);
  }
  const bola = awards.general.items.find((i) => i.id === 'bola');
  if (bola) worldAwardNews.push(`${bola.winner.name} (${bola.winner.club}) ganha a Bola de Ouro`);
  const boot = awards.general.items.find((i) => i.id === 'chuteira');
  if (boot) worldAwardNews.push(`${boot.winner.name} (${boot.winner.club}) leva a Chuteira de Ouro: ${boot.winner.detail}`);
  const coachYear = awards.general.items.find((i) => i.id === 'tecnico_ano');
  if (coachYear) worldAwardNews.push(`${coachYear.winner.name} (${coachYear.winner.club}) é eleito o técnico da temporada`);

  let serieAScorer: { name: string; club: string; goals: number } | null = null;
  for (const [id, st] of stats.byComp.get('serie-a') ?? []) {
    const who = stats.people.get(id);
    if (!who || who.clubId === PLAYER) continue;
    if (!serieAScorer || st.goals > serieAScorer.goals) serieAScorer = { name: who.f.name, club: nameOf(who.clubId), goals: st.goals };
  }

  const newsInput: NewsInput = {
    state,
    nameOf,
    natOut,
    stateOut,
    cups: { estado: copaEstado.championId, copa: copa.championId, ...continental },
    nextNat,
    dQualified,
    serieAScorer,
    transfers: [],
  };

  const result: SeasonResult = {
    season,
    year: START_YEAR + season - 1,
    tier,
    position,
    points: row.points,
    deduction,
    outcome: bankrupt ? 'falencia' : outcome,
    nextTier,
    stadiumRequired: outcome === 'barrado_estadio' ? TIERS[stadiumTarget].minStadium : undefined,
    table: mainTable,
    clubNames: mainComp.clubNames,
    playerMatches: leagueMatches,
    topScorer,
    finance,
    strength: Math.round(pStrength * 10) / 10,
    headlines,
    departures,
    renewals: [],
    cups: cupRuns,
    objectives,
    moments,
    derby,
    mood: p.mood,
    moodDelta: p.mood - moodBefore,
    signings: state.office.signings,
    homegrownXI,
    comps,
    worldNews: [],
    coachReport: { name: p.coach.name, request: null, met: null, morale: p.coach.morale, moraleDelta: 0, left: null },
  };
  // modo técnico: o técnico é o jogador (moral, demissão e contrato ficam com a carreira)
  if (!state.career) settleCoach(state, result);
  result.club = { name: p.name, colors: p.colors };

  // ---------------------- evolução para a próxima temporada ----------------------
  p.capacity += p.capacityBuilding;
  p.capacityBuilding = 0;
  p.national = nextNat.get(PLAYER) ?? null;
  p.stateDiv = nextState.get(PLAYER) ?? p.stateDiv;
  // moral individual (técnico): metade fica para a próxima temporada
  if (state.career) {
    const final = plan.finalMorale();
    for (const f of p.squad) {
      const m = final.get(f.id);
      if (m !== undefined) f.morale = Math.round(m * 0.5 + 30);
    }
  }
  evolveClub(state, result);
  const ids = { next: () => nextId(state), names: allNames(state), season: season + 1 };
  applyMovements(state, nextNat, nextState, leaveState, ids);
  newsInput.transfers = evolveAiClubs(deriveRng(seed, season, 'ai-evolve'), state.clubs, ids);
  result.worldNews = [...buildWorldNews(deriveRng(seed, season, 'news'), newsInput), ...worldAwardNews, ...carousel.map((t) => `DANÇA DOS TÉCNICOS: ${t}`)];
  result.awards = awards;
  result.youth = youthComps;
  if (bankrupt) state.over = 'falencia';
  return result;
}

function allNames(state: GameState): Set<string> {
  const p = state.player;
  const names = new Set([...p.squad, ...p.youth, ...p.onLoan, ...p.alumni].map((f) => f.name));
  for (const c of state.clubs) for (const f of c.squad) names.add(f.name);
  return names;
}

function applyMovements(
  state: GameState,
  nextNat: Map<string, NationalDiv | null>,
  nextState: Map<string, StateDiv | null>,
  leaveState: Set<string>,
  ids: { next: () => number; names: Set<string>; season: number },
): void {
  const rng = deriveRng(state.seed, state.season, 'newclubs');
  const kept: Club[] = [];
  for (const c of state.clubs) {
    if (leaveState.has(c.id)) continue; // rebaixados da Várzea deixam de disputar
    c.national = nextNat.get(c.id) ?? null;
    c.stateDiv = nextState.get(c.id) ?? null;
    syncTier(c);
    kept.push(c);
  }
  const taken = new Set<string>([state.player.name, ...kept.map((c) => c.name)]);
  const varzeaCount = kept.filter((c) => c.stateDiv === 'V').length + (state.player.stateDiv === 'V' ? 1 : 0);
  for (let i = varzeaCount; i < 20; i++) kept.push(makeClub(rng, `c${state.serial++}`, null, 'V', taken, ids));
  state.clubs = kept;
}

interface NewsInput {
  state: GameState;
  nameOf: (id: string) => string;
  natOut: Record<NationalDiv, LeagueOutcome>;
  stateOut: Record<StateDiv, LeagueOutcome>;
  cups: { estado: string; copa: string; cc?: string; le?: string; mundial?: string };
  nextNat: Map<string, NationalDiv | null>;
  dQualified: string[];
  serieAScorer: { name: string; club: string; goals: number } | null;
  transfers: AiTransfer[];
}

/** Notícias do mundo da bola (o que aconteceu com os outros clubes). */
function buildWorldNews(rng: Rng, n: NewsInput): string[] {
  const out: string[] = [];
  const nm = n.nameOf;
  const list = (ids: string[]) => ids.map(nm).join(', ');
  out.push(`${nm(n.natOut[1].champion)} é campeão da Série A`);
  out.push(`Rebaixados da Série A: ${list(n.natOut[1].relegated)}`);
  out.push(`Sobem para a Série A: ${list(n.natOut[2].promoted)}`);
  out.push(`${nm(n.natOut[2].champion)} conquista a Série B`);
  out.push(`${nm(n.natOut[3].champion)} é campeão da Série C · sobem: ${list(n.natOut[3].promoted)}`);
  out.push(`${nm(n.natOut[4].champion)} vence a Série D · sobem: ${list(n.natOut[4].promoted)}`);
  out.push(`${nm(n.stateOut.A.champion)} é campeão estadual`);
  out.push(`${nm(n.stateOut.B.champion)} vence o Estadual Série B; ${nm(n.stateOut.V.champion)} é o rei da Várzea`);
  out.push(`${nm(n.cups.copa)} levanta a Copa do Brasil`);
  out.push(`${nm(n.cups.estado)} conquista a Copa do Estado`);
  if (n.cups.cc) out.push(`${nm(n.cups.cc)} conquista a Libertadores`);
  if (n.cups.le) out.push(`${nm(n.cups.le)} é campeão da Sul-Americana`);
  if (n.cups.mundial) out.push(`${nm(n.cups.mundial)} é campeão do Mundial de Clubes`);
  if (n.dQualified.length > 0) out.push(`Vagas do estado na Série D: ${list(n.dQualified)}`);
  // gigante em queda
  const giant = n.state.clubs.find((c) => (c.prestige ?? 0) >= 4 && n.natOut[1].relegated.includes(c.id));
  if (giant) out.push(`TERREMOTO: o gigante ${giant.name} é rebaixado pela primeira vez em décadas`);
  // rival
  const rival = n.state.clubs.find((c) => c.id === n.state.player.rivalId);
  if (rival) {
    const nextLevel = levelOf(n.nextNat.get(rival.id) ?? null, rival.stateDiv);
    if (nextLevel < rival.tier) out.push(`O rival ${rival.name} sobe para a ${TIERS[nextLevel].name}`);
    else if (nextLevel > rival.tier) out.push(`O rival ${rival.name} cai para a ${TIERS[nextLevel].name}`);
  }
  if (n.serieAScorer) out.push(`${n.serieAScorer.name} (${n.serieAScorer.club}) é o artilheiro da Série A com ${n.serieAScorer.goals} gols`);
  const bottom = n.natOut[1].ranking.slice(-6).filter((id) => id !== PLAYER);
  if (bottom.length > 0) out.push(`${nm(rng.pick(bottom))} demite o técnico após sequência ruim`);
  // transferências reais entre clubes da IA (as mais relevantes)
  for (const t of n.transfers.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 4)) {
    out.push(`MERCADO: ${t.to} contrata ${t.player} (${t.ovr}), destaque do ${t.from}`);
  }
  return out;
}


interface MomentInput {
  p: GameState['player'];
  nameOf: (id: string) => string;
  comps: CompResult[];
  lastRound: { stake: string; match: MatchResult } | null;
  cupRuns: CupRun[];
  leagueMatches: MatchResult[];
  tier: Tier;
  serD: LeagueOutcome | null;
  squadOf: (id: string) => Footballer[];
}

/** Até 3 jogos da temporada para mostrar ao vivo (os mais importantes primeiro). */
function buildMoments(rng: Rng, m: MomentInput): LiveMoment[] {
  const out: LiveMoment[] = [];
  const add = (kind: LiveMoment['kind'], title: string, stake: string, r: MatchResult) => {
    const mo = moment(rng, kind, title, stake, r, PLAYER, m.nameOf, m.p.squad, m.squadOf);
    if (r.day !== undefined) mo.day = r.day;
    out.push(mo);
  };
  const decisive = (matches: CupMatch[], round: string) => matches.filter((x) => x.round === round || x.round === `${round} (volta)`).pop();
  const finals: Record<CompetitionId, LiveMoment['kind']> = { estado: 'final_estado', copa: 'final_copa', cc: 'final_cc', le: 'final_le', mundial: 'mundial' };
  for (const c of m.cupRuns.slice().sort((a, b) => CUP_PRIORITY[a.id] - CUP_PRIORITY[b.id])) {
    const final = decisive(c.matches, 'Final');
    if (final) add(finals[c.id], `Final da ${c.name}`, c.id === 'mundial' ? 'O mundo inteiro está assistindo.' : 'Uma taça em jogo.', final.result);
  }
  for (const comp of m.comps) {
    const final = decisive(comp.ties, 'Final');
    if (final) add(comp.id === 'estadual_a' ? 'final_estadual' : 'playoff', `Final do ${comp.name}`, comp.tier >= 6 ? 'Os finalistas sobem; o título é questão de honra.' : 'A taça do ano está em jogo.', final.result);
  }
  if (m.serD) {
    const qf = decisive(m.serD.comp?.ties ?? [], 'Quartas de final');
    if (qf) add('playoff', 'Série D · quartas de final (volta)', 'Quem passar sobe para a Série C.', qf.result);
  }
  if (m.lastRound) add('ultima_rodada', 'Última rodada', m.lastRound.stake, m.lastRound.match);
  for (const c of m.cupRuns.filter((x) => x.id === 'copa' || x.id === 'estado')) {
    const zebra = c.matches.filter((x) => x.opponentTier !== null && x.opponentTier <= m.tier - 3 && !x.round.startsWith('Final')).pop();
    if (zebra) add('zebra', `${c.name} · ${zebra.round}`, `Cheiro de zebra: o adversário está ${m.tier - zebra.opponentTier!} níveis acima.`, zebra.result);
  }
  if (out.length < 3) {
    const derby = m.leagueMatches.find((x) => x.home === m.p.rivalId || x.away === m.p.rivalId);
    if (derby) add('classico', 'Clássico', 'O jogo que a cidade espera o ano inteiro.', derby);
  }
  return out.slice(0, 3);
}

function fromCupMatch(comp: string, m: CupMatch): CalendarMatch {
  const r = m.result;
  const out: CalendarMatch = {
    day: r.day ?? 0,
    comp,
    round: m.round,
    opponent: m.opponent,
    opponentTier: m.opponentTier,
    home: m.home,
    gf: m.home ? r.hg : r.ag,
    ga: m.home ? r.ag : r.hg,
    advanced: m.advanced,
  };
  if (r.pens) out.pens = m.home ? r.pens : [r.pens[1], r.pens[0]];
  if (r.extraTime) out.extraTime = true;
  if (r.advantage) out.advantage = true;
  return out;
}

/** Calendário da temporada do jogador: fases de pontos (tabelas parciais) e todos os jogos dele em ordem de data. */
function buildCalendar(
  season: number,
  year: number,
  stages: CalendarStage[],
  comps: CompResult[],
  cupRuns: CupRun[],
  nameOf: (id: string) => string,
  tierOf: (id: string) => Tier | null,
): GameState['calendar'] {
  const matches: CalendarMatch[] = [];
  const clubNames: Record<string, string> = {};
  for (const st of stages) {
    for (const id of st.ids) clubNames[id] = nameOf(id);
    const me = st.ids.indexOf(PLAYER);
    if (me < 0) continue;
    let n = 0;
    for (const [day, h, a, hg, ag] of st.matches) {
      if (h !== me && a !== me) continue;
      n++;
      const home = h === me;
      const opp = st.ids[home ? a : h];
      matches.push({
        day,
        comp: st.compName,
        round: st.name === 'Classificação' || st.name === '1ª fase' ? `${n}ª rodada` : `${st.name} · ${n}ª rodada`,
        opponent: nameOf(opp),
        opponentTier: tierOf(opp),
        home,
        gf: home ? hg : ag,
        ga: home ? ag : hg,
        advanced: null,
      });
    }
  }
  for (const c of comps) for (const t of c.ties) matches.push(fromCupMatch(c.name, t));
  for (const c of cupRuns) for (const t of c.matches) matches.push(fromCupMatch(c.name, t));
  matches.sort((a, b) => a.day - b.day);
  return { season, year, start: SEASON_START, end: SEASON_END, stages, matches, clubNames };
}

const CUP_PRIORITY: Record<CompetitionId, number> = { mundial: 0, cc: 1, le: 2, copa: 3, estado: 4 };


/**
 * Intenção de cada jogador para o fim da temporada, decidida na abertura da janela
 * (aparece no elenco e no painel; o fim da temporada só cumpre o que foi mostrado).
 */
export function decideIntents(state: GameState): void {
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'intents');
  const { ids } = bestEleven(p.squad, p.coach.formation);
  for (const f of p.squad) {
    delete f.intent;
    delete f.askWage;
    if (f.age >= 33 && retires(rng, { ...f, age: f.age + 1 })) {
      f.intent = 'aposenta';
      continue;
    }
    if (f.contract !== 1) continue;
    const ask = renewWage(f.ovr, f.wage, f.homegrown);
    f.askWage = ask;
    if (renewTarget(f.ovr, f.wage, f.homegrown) > renewalCap(p.tier, f.wage)) f.intent = 'clube_maior';
    else if ((f.morale ?? 60) < 30) f.intent = 'sai'; // insatisfeito: não renova
    else if (rng.chance(refusalChance(f, ids.has(f.id)))) f.intent = 'sai';
    else f.intent = ask > f.wage * 1.15 ? 'aumento' : 'renova';
  }
}

/**
 * Técnico no fim da temporada: o pedido da janela foi atendido? A moral sobe ou desce com o pedido e com o resultado.
 * Moral muito baixa = pede demissão. No fim do contrato, renova se estiver satisfeito.
 */
function settleCoach(state: GameState, result: SeasonResult): void {
  const p = state.player;
  const c = p.coach;
  const req = state.office.request;
  const before = c.morale;
  let met: boolean | null = null;
  if (req) {
    switch (req.kind) {
      case 'contratar':
        met = p.squad.some((f) => f.pos === req.pos && f.ovr >= (req.minOvr ?? 0) && f.joined === state.season);
        break;
      case 'promover':
      case 'nao_vender':
        met = p.squad.some((f) => f.id === req.playerId);
        break;
      case 'estrutura':
        met = p.facilities.ct >= (req.level ?? 0);
        break;
    }
  }
  let dm = met === true ? 15 : met === false ? -12 : 0;
  dm += { campeao: 10, acesso: 10, acesso_playoff: 10, barrado_estadio: -5, fica: 0, queda: -15, falencia: -20 }[result.outcome];
  c.morale = clamp(Math.round(c.morale + dm), 0, 100);
  c.contract--;
  let left: string | null = null;
  if (c.morale < 20) left = `${c.name} pede demissão: diz que não tem o apoio da diretoria`;
  else if (c.contract <= 0 && c.morale < 40) left = `${c.name} não renova e deixa o clube`;
  else if (c.contract <= 0) {
    c.contract = 2;
    c.wage = Math.round(c.wage * 1.1);
    result.headlines.push(`${c.name} renova por mais 2 temporadas`);
  }
  if (left) {
    result.headlines.push(left);
    p.coach = { ...startingCoach(), name: 'Auxiliar Juca (interino)', rating: Math.max(0, Math.round(coachNorm(result.nextTier)) - 1), contract: 1, formation: c.formation };
  }
  result.coachReport = { name: c.name, request: req, met, morale: c.morale, moraleDelta: c.morale - before, left };
}

/** Chance de o jogador recusar a renovação automática. */
export function refusalChance(f: Footballer, starter: boolean): number {
  let c = starter ? 0.1 : f.age >= 27 ? 0.4 : 0.2;
  if (f.homegrown) c -= 0.08;
  return Math.max(0, c);
}

/** Teto salarial que o clube topa numa renovação automática. */
export function renewalCap(tier: Tier, currentWage: number): number {
  return Math.max(marketWage(TIERS[tier].meanStrength + 6), currentWage * 1.5);
}

function evolveClub(state: GameState, result: SeasonResult): void {
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'evolve');
  const deps = result.departures;

  // elenco profissional
  const { ids } = bestEleven(p.squad, p.coach.formation);
  const stay: Footballer[] = [];
  for (const f of p.squad) {
    develop(rng, f, { ct: p.facilities.ct + (p.coach.style === 'formador' && f.age <= 23 ? 2 : 0), fitness: p.staff.fitness, inEleven: ids.has(f.id) });
    if (f.loan) {
      // emprestado: volta para o clube dono, com o salário de lá
      const owner = state.clubs.find((c) => c.id === f.loan!.clubId);
      const back: Footballer = { ...f, wage: f.loan.wage, contract: Math.max(1, f.contract + 1) };
      delete back.loan;
      if (owner) owner.squad.push(back);
      deps.push(`${f.name} volta para o ${f.loan.club} no fim do empréstimo`);
      continue;
    }
    f.contract--;
    // o fim da temporada só cumpre o que já estava visível na janela (sem sorteio escondido)
    const intent = f.intent;
    const agreed = f.askWage;
    delete f.intent;
    delete f.askWage;
    if (intent === 'aposenta') {
      deps.push(`${f.name} (${f.age} anos) pendura as chuteiras`);
      p.alumni.push(f);
    } else if (f.contract <= 0 && f.leaving) {
      deps.push(`${f.name} sai de graça: contrato encerrado`);
      p.alumni.push(f);
    } else if (f.contract <= 0 && intent === 'clube_maior') {
      const fee = Math.round(marketValue(f) * 0.1); // fim de contrato: só a compensação por formação
      p.cash += fee;
      p.alumni.push(f);
      deps.push(`${f.name} (${f.ovr}) sai para um clube maior (compensação de R$ ${fee} mil)`);
    } else if (f.contract <= 0 && intent === 'sai') {
      deps.push(`${f.name} não renova e deixa o clube`);
      p.alumni.push(f);
    } else if (f.contract <= 0) {
      // renovação automática: salário de mercado (com o overall novo), veteranos por 1 ano
      const old = f.wage;
      f.wage = agreed ?? renewWage(f.ovr, f.wage, f.homegrown);
      f.contract = f.age >= 32 ? 1 : 3;
      result.renewals.push(`${f.name} renova por ${f.contract} ano(s)${f.wage > old ? ` com aumento de R$ ${Math.round(f.wage - old)} mil/temp.` : ''}`);
      stay.push(f);
    } else {
      stay.push(f);
    }
  }
  p.squad = stay;

  // base
  const youthStay: Footballer[] = [];
  for (const y of p.youth) {
    // pediu para subir na temporada passada e não subiu: metade das vezes vai embora
    if (y.askUp !== undefined && y.askUp < state.season && rng.chance(0.5)) {
      deps.push(`${y.name} cansou de esperar uma chance no profissional e deixa a base`);
      continue;
    }
    develop(rng, y, { ct: p.facilities.ct, fitness: p.staff.fitness, inEleven: false, youth: true, academy: p.facilities.academy });
    if (y.age > YOUTH_AGE_LIMIT) deps.push(`${y.name} deixa a base sem ser aproveitado`);
    else youthStay.push(y);
  }
  p.youth = youthStay;

  // emprestados voltam: jogaram muito, evoluem mais
  for (const f of p.onLoan) {
    const hurt = !!f.recovering;
    delete f.recovering;
    if (hurt) f.ovr = Math.max(30, f.ovr - 1);
    else develop(rng, f, { ct: 0, fitness: 0, inEleven: true, youth: f.age < YOUTH_AGE_LIMIT, academy: 1 });
    if (f.contract > 0) f.contract--;
    const wasYouth = !!f.loanFromYouth;
    delete f.loanFromYouth;
    if (wasYouth && f.age <= YOUTH_AGE_LIMIT && p.youth.length < YOUTH_MAX) {
      p.youth.push(f);
    } else if (p.squad.length < SQUAD_MAX) {
      if (wasYouth) f.wage = round1(marketWage(f.ovr) * 0.8);
      if (f.contract <= 0) f.contract = 3;
      p.squad.push(f);
    } else {
      deps.push(`${f.name} volta de empréstimo e é liberado: elenco cheio`);
      p.alumni.push(f);
      continue;
    }
    deps.push(hurt ? `${f.name} volta da lesão com ${f.ovr} de overall` : `${f.name} volta de empréstimo com ${f.ovr} de overall`);
  }
  p.onLoan = [];

  // elenco mínimo: completa com amadores da várzea
  while (p.squad.length < SQUAD_MIN) {
    const f = makeFootballer(rng, {
      id: nextId(state),
      ovr: TIERS[result.nextTier].meanStrength - 10 + rng.normal(2),
      age: rng.int(19, 30),
      scout: p.staff.scout,
      season: state.season + 1,
      contract: 1,
    });
    p.squad.push(f);
  }

  // torcida, hype, alma
  const fanGrowth = { campeao: 0.4, acesso: 0.3, acesso_playoff: 0.3, barrado_estadio: 0.05, fica: 0, queda: -0.2, falencia: -0.5 }[result.outcome];
  const size = result.table.length;
  const posFactor = (size / 2 - result.position) / size; // -0.5 .. +0.5
  const policy = TICKET_POLICY[p.ticket];
  p.fans = Math.max(20, Math.round(p.fans * (1 + fanGrowth + posFactor * 0.15 + policy.fanGrowth + p.hype / 1500)));
  p.soul = clamp(p.soul + policy.soul, 0, 100);
  p.hype = clamp(Math.round(p.hype * 0.85), 0, 100);
  p.rivalHatred = clamp(Math.round(p.rivalHatred * 0.9), 0, 100);
  p.formMod = 0;
  p.tier = result.nextTier;
}


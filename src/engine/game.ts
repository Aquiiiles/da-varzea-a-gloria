import { EVENTS, EVENT_CHANCE } from '../data/events';
import { OPPORTUNITIES } from '../data/opportunities';
import { FACILITY_COST, LOAN_AGE_LIMIT, MAX_LOANS, MAX_SEASONS, SQUAD_MAX, SQUAD_MIN, STADIUM_FINANCE, STADIUM_INSTALLMENT_NAME, LOAN_NAME, STAFF_WAGE, TIERS, YOUTH_MAX } from '../data/pyramid';
import { generateWorld, initials } from './clubs';
import { applyEffects, nextId } from './effects';
import { bestEleven, foundingSquad, incomingOffers, marketListings, marketWage, round1, tryoutCandidates, tryoutCost, youthIntake } from './footballers';
import { deriveRng } from './rng';
import { PLAYER_ID, decideIntents, simulateSeason, teamStrength } from './season';
import { MAX_ROUNDS, evaluateBid, negotiationFor } from './negotiation';
import { replacementFor } from './aisquad';
import type { Action, AdvanceTo, Club, DelegateArea, Footballer, Foundation, GameEvent, GameState, Opportunity, Origin, PlayerClub, SeasonCalendar, SeasonResult, Tier } from './types';
import { runAssistant } from './assistant';
import { BUSINESSES } from '../data/club';
import { coachAccepts, coachCandidates, coachRequest, coachSeverance, expectedRank, seasonObjectives, startingCoach } from './clubops';
import { ActionError } from './util';
export { ActionError };
import { effectsCashCost, loanFor, releaseCost, renewalOffer, seatsFor, sellPrice } from './office';
import { applyNamePack, type NamePack } from './namepack';
import { dayToDate, julyWindow } from './calendar';
import { answered, currentInterview, interviewEffects } from './interview';
import { CAREER_END_AGE, CAREER_START_AGE, careerWindow, refundBudget, settleCareer, spendBudget, takeOver, wageCheck } from './career';
import { varzeaClubName } from './names';
import { PALETTE } from '../data/names';

interface OriginPreset {
  label: string;
  blurb: string;
  cash: number;
  fans: number;
  soul: number;
  hype: number;
  squadMean: number;
  capacity: number;
  sponsor?: { name: string; perSeason: number };
}

export const ORIGINS: Record<Origin, OriginPreset> = {
  pub: {
    label: 'Time de boteco', blurb: 'Nasceu na mesa do bar: torcida e alma altas, pouco dinheiro.',
    cash: 70, fans: 320, soul: 85, hype: 10, squadMean: 44.5, capacity: 400,
  },
  fabrica: {
    label: 'Time de fábrica', blurb: 'Patrocinador fixo (renda estável), torcida pequena.',
    cash: 95, fans: 150, soul: 65, hype: 5, squadMean: 45.5, capacity: 500,
    sponsor: { name: 'Metalúrgica Aurora', perSeason: 120 },
  },
  youtuber: {
    label: 'Time de YouTuber', blurb: 'Hype e dinheiro altos, moral instável, rivais com bônus contra você.',
    cash: 300, fans: 260, soul: 45, hype: 85, squadMean: 45.5, capacity: 400,
  },
};

export function sanitizeName(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 28);
  return clean.length > 0 ? clean : 'Várzea FC';
}

/* ------------------------------ Criação ------------------------------ */

/** Opções que não entram na run (só aparência): pacote de nomes dos clubes. */
export interface GameOptions {
  pack?: NamePack | null;
}

export function newGame(seed: number, foundation: Foundation, opts: GameOptions = {}): GameState {
  const seedU = seed >>> 0;
  const f: Foundation = { ...foundation, name: sanitizeName(foundation.name) };
  const coachMode = f.mode === 'tecnico';
  const rng = deriveRng(seedU, 'world');
  const taken = new Set<string>([f.name]);
  const playerNames = new Set<string>();
  let pid = 100;
  const { clubs, serial } = generateWorld(rng, taken, { next: () => pid++, names: playerNames, season: 1 });
  if (opts.pack) applyNamePack(clubs, opts.pack, taken);
  const preset = ORIGINS[f.origin];
  const rival = rng.pick(clubs.filter((c) => c.stateDiv === 'V'));
  const squad = foundingSquad(deriveRng(seedU, 'squad'), preset.squadMean, 1, playerNames);

  // modo técnico: o "clube do jogador" começa como um time de várzea qualquer, que volta para a IA quando o técnico aceitar a primeira proposta
  const crng = deriveRng(seedU, 'tecnico-inicio');
  let placeholder = varzeaClubName(crng);
  for (let i = 0; i < 20 && taken.has(placeholder); i++) placeholder = varzeaClubName(crng);
  const clubName = coachMode ? placeholder : f.name;
  const player: PlayerClub = {
    id: PLAYER_ID,
    name: clubName,
    short: initials(clubName),
    colors: coachMode ? [crng.pick(PALETTE), '#ffffff'] : f.colors,
    strength: 0,
    tier: 7,
    national: null,
    stateDiv: 'V',
    copaSpot: false,
    origin: f.origin,
    cash: preset.cash,
    negativeSeasons: 0,
    pendingDeduction: 0,
    capacity: preset.capacity,
    capacityBuilding: 0,
    fans: preset.fans,
    soul: preset.soul,
    hype: preset.hype,
    ticket: 1,
    facilities: { ct: 0, academy: 0, medical: 0 },
    staff: { scout: 0, fitness: 0 },
    coach: coachMode ? { ...startingCoach(), name: f.name, style: f.style ?? 'motivador', age: CAREER_START_AGE } : startingCoach(),
    businesses: { bar: 0, loja: 0, escolinha: 0, estacionamento: 0, foodtruck: 0 },
    mood: 60,
    delegate: { contratos: false, base: false, mercado: false, estadio: false },
    continental: null,
    worldCup: false,
    derby: { w: 0, d: 0, l: 0 },
    sponsors: preset.sponsor ? [{ ...preset.sponsor, seasonsLeft: null }] : [],
    squad,
    youth: [],
    onLoan: [],
    alumni: [],
    rivalId: rival.id,
    rivalHatred: 30,
    formMod: 0,
  };

  const state: GameState = {
    version: 3,
    seed: seedU,
    foundation: f,
    season: 1,
    actions: [],
    phase: 'office',
    player,
    clubs,
    office: emptyOffice(),
    seenOnce: [],
    history: [],
    news: coachMode
      ? [`${f.name}, ex-jogador, pendura as chuteiras e procura o primeiro emprego como técnico`]
      : [`Nasce o ${f.name}: time de bairro se inscreve na ${TIERS[7].name}`, `${rival.name} será o grande rival`],
    over: null,
    serial: Math.max(serial, pid) + 1,
  };
  if (coachMode) {
    state.career = {
      name: f.name,
      age: CAREER_START_AGE,
      reputation: 8,
      board: { personality: 'paciente', confidence: 60, budget: 0, wageCap: 0 },
      contract: 0,
      unemployed: true,
      offers: [],
      stints: [],
    };
  }
  startSeason(state);
  return state;
}

function emptyOffice(): GameState['office'] {
  return { market: [], offers: [], tryout: null, opportunities: [], event: null, eventChoice: null, built: { seats: false, facility: false, loan: false, business: false }, coaches: [], negotiations: [], request: null, formationChanged: false, objectives: [], signings: 0, soldHomegrown: 0 };
}

function tierAllowed(tier: Tier, item: { minTier?: Tier; maxTier?: Tier }): boolean {
  // minTier 6 = só do nível 6 para cima (6..1); maxTier 4 = só do nível 4 para baixo (4..7)
  if (item.minTier !== undefined && tier > item.minTier) return false;
  if (item.maxTier !== undefined && tier < item.maxTier) return false;
  return true;
}

/** Abre o escritório da temporada: mercado, base, oportunidades e evento. */
function startSeason(state: GameState, afterJob = false): void {
  const p = state.player;
  const s = state.season;
  const office = emptyOffice();
  const ids = () => nextId(state);

  const usedNames = usedPlayerNames(state);
  const near = state.clubs.filter((c) => Math.abs(c.tier - p.tier) <= 1).map((c) => c.name);
  office.market = marketListings(deriveRng(state.seed, s, 'market'), p.tier, p.staff.scout, ids, s, near, usedNames);
  const buyers = state.clubs.filter((c) => c.tier <= p.tier && c.tier >= p.tier - 2).map((c) => ({ name: c.name, tier: c.tier }));
  decideIntents(state);
  const offers = incomingOffers(deriveRng(state.seed, s, 'offers'), p.squad, p.tier, buyers);
  office.offers = offers;
  for (const of of offers) {
    const f = p.squad.find((x) => x.id === of.playerId)!;
    state.news.push(`${of.club} faz proposta de R$ ${of.fee} mil por ${f.name}`);
  }

  const intake = youthIntake(deriveRng(state.seed, s, 'youth'), p.facilities.academy, p.staff.scout, p.tier, ids, s, usedNames);
  for (const y of intake) if (p.youth.length < YOUTH_MAX) p.youth.push(y);
  if (intake.length > 0) state.news.push(`${intake.length} garoto(s) aparecem nas categorias de base`);

  const orng = deriveRng(state.seed, s, 'opps');
  const pool = OPPORTUNITIES.filter((o) => tierAllowed(p.tier, o) && !(o.once && state.seenOnce.includes(o.id)));
  const count = 1 + (orng.chance(0.55) ? 1 : 0) + (orng.chance(0.2) ? 1 : 0);
  const picked: Opportunity[] = [];
  while (picked.length < count && picked.length < pool.length) {
    picked.push(orng.weighted(pool.filter((o) => !picked.includes(o)), (o) => o.weight));
  }
  office.opportunities = picked.map((opp) => ({ opp, taken: false }));

  office.event = drawEvent(state);
  office.coaches = coachCandidates(deriveRng(state.seed, s, 'coaches'), p.tier);
  office.request = coachRequest(p, p.coach.formation, TIERS[p.tier].meanStrength, bestEleven(p.squad, p.coach.formation).ids);
  const comp = mainCompClubs(state);
  const rival = comp.find((c) => c.id === p.rivalId) ?? state.clubs.find((c) => c.id === p.rivalId && c.stateDiv === p.stateDiv && c.stateDiv !== null);
  const expected = expectedRank(teamStrength(state), comp.map((c) => c.strength));
  office.objectives = seasonObjectives(deriveRng(state.seed, s, 'objectives'), p.tier, expected, !!rival);
  if (state.career) {
    // modo técnico: eventos, oportunidades e técnicos são assunto da diretoria
    office.event = null;
    office.opportunities = [];
    office.coaches = [];
    office.request = null;
  }
  state.office = office;
  if (state.career) {
    if (afterJob) {
      state.career.offers = [];
      careerWindow(state, false);
    } else careerWindow(state, true);
  }
}

/** Jogador vendido vai para um clube de verdade (o comprador ou um do mesmo nível ou acima). */
function moveToAiClub(state: GameState, f: Footballer, rng: ReturnType<typeof deriveRng>, clubName?: string): string {
  const p = state.player;
  const named = clubName ? state.clubs.find((c) => c.name === clubName) : undefined;
  const pool = state.clubs.filter((c) => c.tier <= p.tier && c.tier >= Math.max(1, p.tier - 2));
  const club = named ?? (pool.length > 0 ? rng.pick(pool) : undefined);
  if (!club) return 'exterior';
  club.squad.push({ ...f, contract: 3, intent: undefined, leaving: undefined });
  return club.name;
}

/** Clubes da competição principal do jogador (série nacional ou divisão estadual). */
export function mainCompClubs(state: GameState): Club[] {
  const p = state.player;
  return p.national !== null ? state.clubs.filter((c) => c.national === p.national) : state.clubs.filter((c) => c.stateDiv === p.stateDiv);
}

/** Nomes de jogadores em uso no mundo (evita repetição em base, mercado, peneira e elencos da IA). */
export function usedPlayerNames(state: GameState): Set<string> {
  const p = state.player;
  const names = new Set([...p.squad, ...p.youth, ...p.onLoan, ...p.alumni].map((f) => f.name));
  for (const c of state.clubs) for (const f of c.squad) names.add(f.name);
  return names;
}

function drawEvent(state: GameState): GameEvent | null {
  const rng = deriveRng(state.seed, state.season, 'event');
  if (!rng.chance(EVENT_CHANCE)) return null;
  const pool = EVENTS.filter((e) => tierAllowed(state.player.tier, e) && !(e.once && state.seenOnce.includes(e.id)));
  return pool.length > 0 ? rng.weighted(pool, (e) => e.weight) : null;
}

/* ------------------------------ Ações ------------------------------ */


function fail(msg: string): never {
  throw new ActionError(msg);
}

/** Valida e aplica uma ação. Devolve NOVO estado (o original não é mutado). */
export function apply(prev: GameState, action: Action): GameState {
  const state = structuredClone(prev);
  applyMut(state, action);
  state.actions.push(action);
  return state;
}

/** Tenta aplicar; se a ação for inválida devolve null (útil para a UI e o assistente). */
export function tryApply(prev: GameState, action: Action): GameState | null {
  try {
    return apply(prev, action);
  } catch (e) {
    if (e instanceof ActionError) return null;
    throw e;
  }
}

export function canApply(state: GameState, action: Action): boolean {
  try {
    applyMut(structuredClone(state), action);
    return true;
  } catch (e) {
    if (e instanceof ActionError) return false;
    throw e;
  }
}

export function applyMut(state: GameState, a: Action): void {
  const p = state.player;
  const o = state.office;
  if (a.t === 'advance') {
    // a temporada já foi simulada (prévia); avançar mostra mais dias e, no fim, fecha a temporada de verdade
    if (state.phase !== 'season' || state.reveal == null || !state.calendar) fail('não há temporada em andamento');
    const target = advanceTarget(state.calendar, state.reveal, a.to);
    if (target === null) finishSeason(state);
    else state.reveal = target;
    return;
  }
  if (state.phase === 'over') fail('a run acabou');
  if (a.t === 'next') {
    if (state.phase === 'season') {
      finishSeason(state);
      if ((state.phase as GameState['phase']) === 'over') return;
    }
    if (state.phase !== 'summary') fail('não há resumo aberto');
    state.reveal = null;
    state.calendar = null;
    state.season++;
    state.phase = 'office';
    startSeason(state);
    return;
  }
  if (state.phase === 'season') {
    midSeason(state, a);
    return;
  }
  if (state.phase !== 'office') fail('o escritório está fechado');
  const actionRng = () => deriveRng(state.seed, state.season, 'act', state.actions.length);
  const career = state.career;
  if (career && BOARD_ACTIONS.has(a.t) && !boardActing) fail('isso é com a diretoria: o técnico cuida do time');
  if (career && career.unemployed && a.t !== 'job' && a.t !== 'formation') fail('você está sem clube: aceite uma proposta');

  switch (a.t) {
    case 'lineup': {
      if (!career) fail('a escalação é com o técnico');
      setLineup(p, a);
      return;
    }
    case 'tactic': {
      if (!career) fail('a estratégia é com o técnico');
      p.tactic = a.v;
      return;
    }
    case 'job': {
      if (!career) fail('só no modo técnico');
      const offer = career.offers[a.idx];
      if (!offer) fail('proposta indisponível');
      takeOver(state, offer);
      state.news.push(`${career.name} é o novo técnico do ${offer.club}`);
      startSeason(state, true);
      return;
    }
    case 'buy': {
      const l = o.market[a.idx];
      if (!l) fail('jogador indisponível');
      if (p.squad.length >= SQUAD_MAX) fail('elenco cheio');
      if (p.cash < l.fee) fail('caixa insuficiente');
      check(wageCheck(state, l.player.wage));
      check(spendBudget(state, l.fee));
      p.cash -= l.fee;
      p.squad.push({ ...l.player, joined: state.season });
      o.market[a.idx] = null;
      o.signings++;
      state.news.push(`${p.name} contrata ${l.player.name} (${l.player.pos}, ${l.player.ovr})${l.fee > 0 ? ` por R$ ${l.fee} mil` : ' sem custo de transferência'}`);
      return;
    }
    case 'sell': {
      const f = p.squad.find((x) => x.id === a.id);
      if (!f) fail('jogador não encontrado');
      if (p.squad.length <= SQUAD_MIN) fail(`o elenco precisa de pelo menos ${SQUAD_MIN} jogadores`);
      const fee = sellPrice(state, a.id);
      p.cash += fee;
      refundBudget(state, fee);
      p.squad = p.squad.filter((x) => x.id !== a.id);
      p.alumni.push(f);
      if (f.homegrown) {
        p.soul = Math.max(0, p.soul - 1);
        o.soldHomegrown++;
      }
      const buyer = moveToAiClub(state, f, actionRng());
      state.news.push(`${f.name} é vendido ao ${buyer} por R$ ${fee} mil`);
      return;
    }
    case 'release': {
      const f = p.squad.find((x) => x.id === a.id);
      if (!f) fail('jogador não encontrado');
      if (p.squad.length <= SQUAD_MIN) fail(`o elenco precisa de pelo menos ${SQUAD_MIN} jogadores`);
      const cost = releaseCost(state, a.id);
      if (p.cash < cost) fail('caixa insuficiente para a multa');
      check(spendBudget(state, cost));
      p.cash -= cost;
      p.squad = p.squad.filter((x) => x.id !== a.id);
      p.alumni.push(f);
      return;
    }
    case 'renew': {
      const f = p.squad.find((x) => x.id === a.id);
      if (!f) fail('jogador não encontrado');
      if (f.contract !== 1) fail('só dá para renovar no último ano de contrato');
      const offer = renewalOffer(f);
      if (!offer) fail(`${f.name} já decidiu se aposentar`);
      check(wageCheck(state, offer.wage - f.wage));
      f.wage = offer.wage;
      f.contract = f.age >= 32 ? 2 : 4;
      f.leaving = false;
      delete f.intent;
      delete f.askWage;
      state.news.push(`${f.name} renova contrato com o ${p.name}`);
      return;
    }
    case 'bid': {
      const club = state.clubs.find((c) => c.id === a.club);
      const f = club?.squad.find((x) => x.id === a.player);
      if (!club || !f) fail('o jogador não está mais nesse clube');
      if (p.squad.length >= SQUAD_MAX) fail('elenco cheio');
      if (!Number.isInteger(a.fee) || a.fee < 0 || !(a.wage > 0) || Math.round(a.wage * 10) !== a.wage * 10 || !Number.isInteger(a.years) || a.years < 1 || a.years > 5) {
        fail('proposta inválida');
      }
      if (p.cash < a.fee) fail('caixa insuficiente para pagar a taxa');
      if (career && a.fee > career.board.budget) fail(`a diretoria não libera: a verba da janela é de R$ ${career.board.budget} mil`);
      check(wageCheck(state, a.wage));
      let n = negotiationFor(state, club.id, f.id);
      if (n && (n.status === 'aceita' || n.status === 'encerrada' || n.rounds >= MAX_ROUNDS)) fail('negociação encerrada nesta janela');
      if (!n) {
        n = { clubId: club.id, playerId: f.id, rounds: 0, status: 'recusada', fee: 0, wage: 0, years: 1, message: '' };
        o.negotiations.push(n);
      }
      n.rounds++;
      n.fee = a.fee;
      n.wage = a.wage;
      n.years = a.years;
      const out = evaluateBid(state, club, f, a.fee, a.wage, n.rounds);
      n.status = out.status;
      n.message = out.message;
      n.askFee = out.askFee;
      n.askWage = out.askWage;
      if (out.status === 'aceita') {
        check(spendBudget(state, a.fee));
        p.cash -= a.fee;
        club.squad = club.squad.filter((x) => x.id !== f.id);
        club.squad.push(replacementFor(actionRng(), club, { next: () => nextId(state), names: usedPlayerNames(state), season: state.season }));
        p.squad.push({ ...f, wage: round1(a.wage), contract: a.years, joined: state.season, goals: 0, apps: 0, homegrown: false });
        o.signings++;
        state.news.push(`${p.name} contrata ${f.name} (${f.pos}, ${f.ovr}) do ${club.name} por R$ ${a.fee} mil`);
      }
      return;
    }
    case 'leave': {
      const f = p.squad.find((x) => x.id === a.id);
      if (!f) fail('jogador não encontrado');
      f.leaving = !f.leaving;
      return;
    }
    case 'offer': {
      if (!o.offers[a.idx]) fail('proposta indisponível');
      sellToOffer(state, a.idx, o.offers[a.idx]!.fee);
      return;
    }
    case 'counter': {
      const of = o.offers[a.idx];
      if (!of) fail('proposta indisponível');
      if (!Number.isInteger(a.fee) || a.fee <= of.fee) fail('peça mais do que a oferta atual');
      const max = of.max ?? of.fee;
      if (a.fee <= max) {
        sellToOffer(state, a.idx, a.fee);
        return;
      }
      const f = p.squad.find((x) => x.id === of.playerId);
      if (of.final || max <= of.fee) {
        // já era a última oferta (ou o clube não tem mais margem): desiste
        o.offers[a.idx] = null;
        state.news.push(`${of.club} desiste de ${f?.name ?? 'contratar'}: o preço ficou alto demais`);
        return;
      }
      of.fee = max;
      of.final = true;
      of.message = `${of.club} sobe para R$ ${max} mil e avisa: é a última oferta.`;
      return;
    }
    case 'reject': {
      const of = o.offers[a.idx];
      if (!of) fail('proposta indisponível');
      const f = p.squad.find((x) => x.id === of.playerId);
      o.offers[a.idx] = null;
      state.news.push(`${p.name} recusa a proposta do ${of.club} por ${f?.name ?? 'um jogador'}`);
      return;
    }
    case 'lend': {
      if (p.onLoan.length >= MAX_LOANS) fail(`no máximo ${MAX_LOANS} emprestados`);
      const inYouth = p.youth.find((x) => x.id === a.id);
      const inSquad = p.squad.find((x) => x.id === a.id);
      const f = inYouth ?? inSquad;
      if (!f) fail('jogador não encontrado');
      if (f.age > LOAN_AGE_LIMIT) fail(`só jogadores até ${LOAN_AGE_LIMIT} anos podem ser emprestados`);
      if (inSquad && p.squad.length <= SQUAD_MIN) fail(`o elenco precisa de pelo menos ${SQUAD_MIN} jogadores`);
      p.youth = p.youth.filter((x) => x.id !== a.id);
      p.squad = p.squad.filter((x) => x.id !== a.id);
      f.loanFromYouth = !!inYouth;
      p.onLoan.push(f);
      state.news.push(`${f.name} é emprestado para ganhar rodagem`);
      return;
    }
    case 'promote': {
      const y = p.youth.find((x) => x.id === a.id);
      if (!y) fail('garoto não encontrado');
      if (p.squad.length >= SQUAD_MAX) fail('elenco cheio');
      p.youth = p.youth.filter((x) => x.id !== a.id);
      p.squad.push({ ...y, wage: round1(marketWage(y.ovr) * 0.8), contract: 4, joined: state.season });
      state.news.push(`Cria da base, ${y.name} sobe para o profissional`);
      return;
    }
    case 'cut': {
      if (!p.youth.some((x) => x.id === a.id)) fail('garoto não encontrado');
      p.youth = p.youth.filter((x) => x.id !== a.id);
      return;
    }
    case 'tryout': {
      if (o.tryout) fail('já houve peneira nesta temporada');
      const cost = tryoutCost(p.tier);
      if (p.cash < cost) fail('caixa insuficiente');
      check(spendBudget(state, cost));
      p.cash -= cost;
      o.tryout = tryoutCandidates(deriveRng(state.seed, state.season, 'tryout'), p.tier, p.staff.scout, () => nextId(state), state.season, usedPlayerNames(state));
      state.news.push(`${p.name} abre peneira: centenas de garotos no campo do bairro`);
      return;
    }
    case 'sign': {
      const c = o.tryout?.[a.idx];
      if (!c) fail('candidato indisponível');
      if (c.age <= 19) {
        if (p.youth.length >= YOUTH_MAX) fail('base lotada');
        p.youth.push(c);
      } else {
        if (p.squad.length >= SQUAD_MAX) fail('elenco cheio');
        check(wageCheck(state, round1(marketWage(c.ovr) * 0.8)));
        p.squad.push({ ...c, wage: round1(marketWage(c.ovr) * 0.8) });
      }
      o.tryout![a.idx] = null;
      return;
    }
    case 'seats': {
      if (o.built.seats) fail('já há uma obra no estádio nesta temporada');
      const { seats, cost, down, perSeason } = seatsFor(p.capacity + p.capacityBuilding, a.size);
      if (a.financed) {
        if (p.sponsors.some((s) => s.name === STADIUM_INSTALLMENT_NAME)) fail('ainda há uma obra parcelada sendo paga');
        if (p.cash < down) fail('caixa insuficiente para a entrada');
        p.cash -= down;
        p.sponsors.push({ name: STADIUM_INSTALLMENT_NAME, perSeason: -perSeason, seasonsLeft: STADIUM_FINANCE.seasons });
      } else {
        if (p.cash < cost) fail('caixa insuficiente');
        p.cash -= cost;
      }
      p.capacityBuilding += seats;
      o.built.seats = true;
      state.news.push(`Obras no estádio do ${p.name}: +${seats} lugares até o fim da temporada`);
      return;
    }
    case 'facility': {
      if (o.built.facility) fail('só uma obra de estrutura por temporada');
      const level = p.facilities[a.which];
      if (level >= 5) fail('nível máximo');
      const cost = FACILITY_COST[level];
      if (p.cash < cost) fail('caixa insuficiente');
      p.cash -= cost;
      p.facilities[a.which] = level + 1;
      o.built.facility = true;
      return;
    }
    case 'staff': {
      const next = p.staff[a.which] + a.dir;
      if (next < 0 || next >= STAFF_WAGE.length) fail('nível inválido');
      p.staff[a.which] = next;
      return;
    }
    case 'ticket':
      p.ticket = a.level;
      return;
    case 'coach': {
      const c = o.coaches[a.idx];
      if (!c) fail('candidato indisponível');
      if (!coachAccepts(c, p.tier)) fail(`${c.name} não aceita treinar um clube da ${TIERS[p.tier].name}`);
      const fee = coachSeverance(p.coach);
      if (p.cash < fee) fail(`caixa insuficiente para a multa do técnico atual (R$ ${fee} mil)`);
      p.cash -= fee;
      o.coaches[a.idx] = null;
      state.news.push(`${p.name} anuncia ${c.name} como novo técnico (${c.style})`);
      p.coach = c;
      return;
    }
    case 'formation': {
      if (p.coach.formation === a.f) fail('já é o esquema atual');
      if (career) {
        // o técnico é você: troca o esquema quando quiser, sem custo de moral
        p.coach.formation = a.f;
        return;
      }
      if (o.formationChanged) fail('o técnico só aceita mudar o esquema uma vez por janela');
      p.coach.formation = a.f;
      p.coach.morale = Math.max(0, p.coach.morale - 10);
      o.formationChanged = true;
      state.news.push(`${p.coach.name} muda o esquema para o ${a.f} a pedido da diretoria`);
      return;
    }
    case 'business': {
      if (o.built.business) fail('um investimento no comércio por temporada');
      const level = p.businesses[a.which];
      if (level >= 3) fail('nível máximo');
      const cost = BUSINESSES.find((b) => b.id === a.which)!.cost[level];
      if (p.cash < cost) fail('caixa insuficiente');
      p.cash -= cost;
      p.businesses[a.which] = level + 1;
      o.built.business = true;
      if (a.which === 'escolinha') p.soul = Math.min(100, p.soul + 2);
      return;
    }
    case 'delegate':
      p.delegate[a.area] = !p.delegate[a.area];
      return;
    case 'loan': {
      if (o.built.loan) fail('um empréstimo por temporada');
      if (p.sponsors.filter((s) => s.name === LOAN_NAME).length >= 2) fail('o banco não empresta mais: já há dois empréstimos');
      const { amount, perSeason } = loanFor(p.tier, a.size);
      p.cash += amount;
      p.sponsors.push({ name: LOAN_NAME, perSeason, seasonsLeft: 3 });
      o.built.loan = true;
      return;
    }
    case 'opp': {
      const entry = o.opportunities[a.idx];
      if (!entry || entry.taken) fail('oportunidade indisponível');
      const cost = effectsCashCost(state, entry.opp.effects);
      if (cost > 0 && p.cash < cost) fail('caixa insuficiente');
      entry.taken = true;
      const notes = applyEffects(state, entry.opp.effects, actionRng());
      if (entry.opp.once) state.seenOnce.push(entry.opp.id);
      state.news.push(entry.opp.headline, ...notes);
      return;
    }
    case 'event': {
      if (!o.event || o.eventChoice !== null) fail('não há evento pendente');
      const opt = o.event.options[a.choice];
      const cost = effectsCashCost(state, opt.effects);
      if (cost > 0 && p.cash < cost) fail('caixa insuficiente');
      o.eventChoice = a.choice;
      const notes = applyEffects(state, opt.effects, actionRng());
      if (o.event.once) state.seenOnce.push(o.event.id);
      state.news.push(opt.headline, ...notes);
      return;
    }
    case 'auto':
      runAssistant(state, applyMut);
      return;
    case 'play': {
      if (o.event && o.eventChoice === null) fail('responda o evento antes de jogar');
      if (career) boardTurn(state);
      const areas = (Object.keys(p.delegate) as DelegateArea[]).filter((k) => p.delegate[k]);
      if (areas.length > 0) runAssistant(state, applyMut, areas);
      // a temporada começa: foto do elenco e prévia (o resultado de verdade sai no fim do calendário)
      state.live = {
        startSquad: structuredClone(p.squad),
        changes: [],
        lineups: [{ day: -1, ids: p.lineup?.ids ?? null, rotate: p.lineup?.rotate ?? true, formation: p.coach.formation, tactic: p.tactic }],
        moments: [],
        injuries: [],
        fatigue: [],
        elevens: [],
      };
      preview(state);
      state.reveal = state.calendar ? state.calendar.start : null;
      state.phase = 'season';
      return;
    }
  }
}

/** Vende o jogador da proposta `idx` pelo valor combinado. */
function sellToOffer(state: GameState, idx: number, fee: number): void {
  const p = state.player;
  const o = state.office;
  const of = o.offers[idx]!;
  const f = p.squad.find((x) => x.id === of.playerId);
  if (!f) fail('o jogador já não está no clube');
  if (p.squad.length <= SQUAD_MIN) fail(`o elenco precisa de pelo menos ${SQUAD_MIN} jogadores`);
  p.cash += fee;
  refundBudget(state, fee);
  p.squad = p.squad.filter((x) => x.id !== f.id);
  p.alumni.push(f);
  if (f.homegrown) {
    p.soul = Math.max(0, p.soul - 1);
    o.soldHomegrown++;
  }
  o.offers[idx] = null;
  moveToAiClub(state, f, deriveRng(state.seed, state.season, 'act', state.actions.length), of.club);
  state.news.push(`${f.name} é vendido ao ${of.club} por R$ ${fee} mil`);
}

/** Valida e guarda a escalação escolhida. */
function setLineup(p: PlayerClub, a: { ids: number[] | null; rotate: boolean }): void {
  if (a.ids) {
    const ids = [...new Set(a.ids)];
    if (ids.length !== a.ids.length || ids.length > 11) fail('escalação inválida');
    if (!ids.every((id) => p.squad.some((f) => f.id === id))) fail('só jogadores do elenco podem ser escalados');
  }
  p.lineup = { ids: a.ids ? a.ids.slice() : null, rotate: a.rotate };
}

/**
 * Última prévia calculada. No fim da temporada, se nada mudou desde ela (mesmas decisões),
 * o resultado é reaproveitado em vez de simular de novo. É só um atalho: sem ele o resultado é o mesmo.
 */
let lastPreview: { key: string; clone: GameState; result: SeasonResult } | null = null;

/** Impressão digital de tudo que entra na simulação da temporada em andamento. */
function previewKey(state: GameState): string {
  const p = state.player;
  return JSON.stringify([
    state.seed, state.season, state.history.length, p.cash, p.squad.map((f) => f.id), p.coach, p.lineup ?? null, p.tactic ?? null,
    state.live?.lineups, state.live?.changes.map((c) => [c.day, c.remove, c.add?.map((f) => f.id)]),
  ]);
}

/** Prévia da temporada: simula numa cópia e guarda calendário, jogos ao vivo, lesões e cansaço. */
function preview(state: GameState): void {
  const clone = structuredClone(state);
  const r = simulateSeason(clone);
  lastPreview = { key: previewKey(state), clone, result: r };
  state.calendar = clone.calendar;
  const live = state.live!;
  live.moments = r.moments;
  live.injuries = clone.live!.injuries;
  live.fatigue = clone.live!.fatigue;
  live.elevens = clone.live!.elevens;
}

/** Ações que podem acontecer com a temporada em andamento (na janela do meio do ano). */
const WINDOW_ACTIONS = new Set<Action['t']>(['buy', 'sell', 'bid', 'release', 'promote', 'lend', 'offer', 'counter', 'reject']);

/** Decisões no meio da temporada: valem para os jogos depois do dia atual; a prévia é refeita. */
function midSeason(state: GameState, a: Action): void {
  const p = state.player;
  const live = state.live;
  const cal = state.calendar;
  if (!live || !cal || state.reveal == null) fail('não há temporada em andamento');
  const day = state.reveal;
  if (a.t === 'interview') {
    // entrevista: não muda os jogos (os efeitos entram no fim da temporada), então não refaz a prévia
    const it = currentInterview(state);
    if (!it || it.day !== a.day) fail('não há entrevista agora');
    const q = it.questions[a.q];
    if (!q) fail('pergunta inválida');
    if (answered(state, it.day, it.kind).includes(a.q)) fail('pergunta já respondida');
    const ans = q.answers[a.a];
    (live.interviews ??= []).push({ day: it.day, kind: it.kind, q: a.q, a: a.a, quote: ans.text, effect: ans.effect });
    const who = state.career ? state.career.name : p.coach.name;
    state.news.push(`${who}${it.kind === 'coletiva' ? ' na coletiva' : ''}: "${ans.text}"`);
    return;
  }
  if (a.t === 'lineup' || a.t === 'formation' || a.t === 'tactic') {
    if (!state.career) fail('a escalação é com o técnico');
    if (a.t === 'lineup') setLineup(p, a);
    else if (a.t === 'tactic') {
      if (p.tactic === a.v) fail('já é a estratégia atual');
      p.tactic = a.v;
    } else {
      if (p.coach.formation === a.f) fail('já é o esquema atual');
      p.coach.formation = a.f;
    }
    live.lineups.push({ day, ids: p.lineup?.ids ?? null, rotate: p.lineup?.rotate ?? true, formation: p.coach.formation, tactic: p.tactic });
    preview(state);
    return;
  }
  if (!WINDOW_ACTIONS.has(a.t)) fail('com a temporada em andamento, só escalação e, em julho, transferências');
  const [open, close] = julyWindow(cal.year);
  if (day < open || day > close) fail('a janela do meio do ano vai de 1º a 31 de julho');
  const before = new Map(p.squad.map((f) => [f.id, f]));
  state.phase = 'office';
  try {
    applyMut(state, a);
  } finally {
    state.phase = 'season';
  }
  const after = new Set(p.squad.map((f) => f.id));
  const remove = [...before.keys()].filter((id) => !after.has(id));
  const add = p.squad.filter((f) => !before.has(f.id)).map((f) => structuredClone(f));
  if (remove.length > 0 || add.length > 0) live.changes.push({ day, add, remove });
  if (p.lineup?.ids) p.lineup.ids = p.lineup.ids.filter((id) => after.has(id));
  preview(state);
}

/** Fecha a temporada de verdade (mesmas decisões da prévia): finanças, evolução, carreira, histórico. */
function finishSeason(state: GameState): void {
  const liveBefore = state.live;
  {
    {
      let result: SeasonResult;
      const cached = lastPreview && lastPreview.key === previewKey(state) ? lastPreview : null;
      lastPreview = null;
      if (cached) {
        // mesma simulação da prévia: adota o estado já simulado (só as ações e o dia mostrado são deste estado)
        const actions = state.actions;
        Object.assign(state, cached.clone);
        state.actions = actions;
        result = cached.result;
      } else {
        result = simulateSeason(state);
      }
      // entrevistas e coletivas: efeitos na torcida, diretoria, reputação e moral
      const fx = interviewEffects({ ...state, live: liveBefore });
      state.player.mood = Math.max(0, Math.min(100, state.player.mood + fx.mood));
      state.player.coach.morale = Math.max(0, Math.min(100, state.player.coach.morale + fx.morale));
      if (state.career) {
        state.career.board.confidence = Math.max(0, Math.min(100, state.career.board.confidence + fx.board));
        state.career.reputation = Math.max(0, Math.min(100, state.career.reputation + fx.rep));
      }
      state.reveal = null;
      state.live = null;
      // depois de adotar a prévia, a carreira é a do estado simulado
      const career = state.career;
      if (career) {
        result.coachNews = settleCareer(state, result);
        result.headlines.push(...result.coachNews);
        // falência do clube: o técnico fica sem emprego, a carreira continua
        if (state.over === 'falencia') {
          state.over = null;
          career.unemployed = true;
        }
      }
      state.history.push(result);
      state.news.push(...result.headlines);
      state.phase = state.over ? 'over' : 'summary';
      if (career && career.age >= CAREER_END_AGE) {
        state.over = 'fim';
        state.phase = 'over';
      } else if (!career && !state.over && state.season >= MAX_SEASONS) {
        state.over = 'fim';
        state.phase = 'over';
      }
      return;
    }
  }
}

/** Ações que no modo técnico são da diretoria (o técnico não mexe). */
const BOARD_ACTIONS = new Set<Action['t']>(['seats', 'facility', 'staff', 'ticket', 'loan', 'business', 'opp', 'event', 'delegate', 'coach']);
/** a diretoria está agindo (o assistente cuidando do clube no modo técnico) */
let boardActing = false;

/** A diretoria cuida do estádio, estrutura e finanças (modo técnico). */
function boardTurn(state: GameState): void {
  boardActing = true;
  try {
    runAssistant(state, applyMut, ['estadio']);
  } finally {
    boardActing = false;
  }
}

function check(msg: string | null): void {
  if (msg) fail(msg);
}

/** Até que dia mostrar a temporada; null = acabou (vai para o resumo). */
export function advanceTarget(cal: SeasonCalendar, reveal: number, to: AdvanceTo): number | null {
  let target: number;
  if (to === 0) {
    const next = cal.matches.find((m) => m.day > reveal);
    target = next ? next.day : cal.end;
  } else if (to === 1) {
    target = reveal + 7;
  } else if (to === 2) {
    // até o último dia do mês atual (se já for o último dia, até o fim do mês seguinte)
    const { m } = dayToDate(cal.year, reveal);
    const endOf = (month: number) => Math.round((Date.UTC(cal.year, month, 0) - Date.UTC(cal.year, 0, 0)) / 86400000);
    target = endOf(m) > reveal ? endOf(m) : endOf(m + 1);
  } else {
    target = cal.end;
  }
  // a janela do meio do ano não passa batido: avançar por jogo, semana ou mês para no dia em que ela abre
  const [open] = julyWindow(cal.year);
  if (to !== 3 && reveal < open && target > open) target = open;
  return target >= cal.end ? null : target;
}

/** Reconstrói uma run inteira a partir da seed, fundação e ações. */
export function replay(seed: number, foundation: Foundation, actions: readonly Action[], opts: GameOptions = {}): GameState {
  const state = newGame(seed, foundation, opts);
  for (const a of actions) {
    applyMut(state, a);
    state.actions.push(a);
  }
  return state;
}


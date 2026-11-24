import { COACH_WAGE } from '../data/club';
import { TIERS } from '../data/pyramid';
import { initials } from './clubs';
import { payroll } from './finance';
import { marketWage } from './footballers';
import { projectFinance } from './office';
import { deriveRng, type Rng } from './rng';
import { clamp } from './util';
import type {
  BoardPersonality, Club, CoachCareer, CoachStyle, GameState, JobOffer, PlayerClub, SeasonResult, Tier,
} from './types';

/**
 * Modo técnico: o jogador é o técnico e troca de clube ao longo da carreira.
 * O clube que ele treina ocupa o lugar do "clube do jogador" no motor; quando ele sai,
 * aquele clube volta a ser da IA (com o mesmo nome, elenco e divisões) e o novo clube assume o lugar.
 */

export const CAREER_START_AGE = 35;
export const CAREER_END_AGE = 70;

export const BOARD_INFO: Record<BoardPersonality, { label: string; text: string; budget: number; wage: number; patience: number; confidence: number }> = {
  paciente: { label: 'Paciente', text: 'Dá tempo ao trabalho: perdoa um ano ruim, mas não abre muito o cofre.', budget: 0.45, wage: 0.08, patience: 0.7, confidence: 65 },
  imediatista: { label: 'Imediatista', text: 'Abre o cofre e cobra resultado já: uma temporada ruim e a cabeça rola.', budget: 0.65, wage: 0.14, patience: 1.4, confidence: 55 },
  mao_de_vaca: { label: 'Mão de vaca', text: 'Cuida do caixa acima de tudo: pouca verba, folha apertada, odeia prejuízo.', budget: 0.25, wage: 0.03, patience: 1, confidence: 60 },
};
const PERSONALITIES: BoardPersonality[] = ['paciente', 'imediatista', 'mao_de_vaca'];

export function isCoachMode(state: GameState): boolean {
  return state.career !== undefined;
}

/** Estrelas do técnico (0–4) pela reputação. */
export function starsFor(reputation: number): number {
  return clamp(Math.floor(reputation / 20), 0, 4);
}

/** Nível de clube que costuma querer um técnico com essa reputação. */
export function tierForReputation(rep: number): Tier {
  return clamp(7 - Math.floor(rep / 14), 1, 7) as Tier;
}

/* ------------------------------ Propostas ------------------------------ */

const PITCH: Record<Tier, string[]> = {
  7: ['Montar um time competitivo na Várzea', 'Subir para o Estadual Série B'],
  6: ['Brigar pelo acesso ao Estadual', 'Fazer uma campanha digna no Estadual Série B'],
  5: ['Ficar entre os 4 do Estadual', 'Vaga na Série D'],
  4: ['Passar da fase de grupos da Série D', 'Acesso à Série C'],
  3: ['Fugir do rebaixamento na Série C', 'Brigar pelo acesso à Série B'],
  2: ['Campanha segura na Série B', 'Acesso à Série A'],
  1: ['Permanecer na Série A', 'Vaga na Copa Continental', 'Título brasileiro'],
};

/**
 * Propostas de emprego da janela. Empregado: às vezes nenhuma, às vezes uma ou duas.
 * Desempregado (começo da carreira ou demitido): sempre 3, no nível da reputação ou um abaixo.
 */
export function jobOffers(state: GameState, rng: Rng, unemployed: boolean): JobOffer[] {
  const c = state.career!;
  const target = tierForReputation(c.reputation);
  let count: number;
  if (unemployed) count = 3;
  else count = rng.chance(0.45) ? (rng.chance(0.35) ? 2 : 1) : 0;
  if (count === 0) return [];
  const allowed = (t: Tier) => (unemployed ? t === target || t === Math.min(7, target + 1) : t >= target - 1 && t <= target + 1 && t <= state.player.tier);
  // clubes sem divisão nenhuma (outros estados fora da Série D) não contratam
  const pool = state.clubs.filter((cl) => (cl.national !== null || cl.stateDiv !== null) && allowed(cl.tier) && (unemployed || cl.tier < state.player.tier || rng.chance(0.3)));
  const out: JobOffer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count * 6 && out.length < count && pool.length > 0; i++) {
    const cl = rng.weighted(pool, (x) => (x.tier === target ? 3 : 1) * (1 + (x.prestige ?? 0) / 10));
    if (used.has(cl.id)) continue;
    used.add(cl.id);
    out.push({
      clubId: cl.id,
      club: cl.name,
      tier: cl.tier,
      personality: rng.pick(PERSONALITIES),
      contract: rng.int(2, 3),
      pitch: rng.pick(PITCH[cl.tier]),
    });
  }
  return out.sort((a, b) => a.tier - b.tier);
}

/* ------------------------------ Troca de clube ------------------------------ */

const FACILITY_BY_TIER: Record<Tier, number> = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 1, 6: 0, 7: 0 };
const STAFF_BY_TIER: Record<Tier, number> = { 1: 3, 2: 2, 3: 2, 4: 1, 5: 1, 6: 0, 7: 0 };
const BUSINESS_BY_TIER: Record<Tier, number> = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 0, 6: 0, 7: 0 };

/** O clube que o técnico deixa volta a ser da IA, com o id do clube que ele assume. */
function toAiClub(p: PlayerClub, id: string): Club {
  return {
    id,
    name: p.name,
    short: p.short,
    colors: p.colors,
    strength: p.strength,
    tier: p.tier,
    national: p.national,
    stateDiv: p.stateDiv,
    prestige: p.prestige,
    squad: [...p.squad, ...p.onLoan].map((f) => ({ ...f, intent: undefined, askWage: undefined, leaving: undefined, loanFromYouth: undefined })),
  };
}

/** Estrutura e finanças de um clube da IA que passa a ser treinado pelo jogador. */
function toPlayerClub(c: Club, coach: PlayerClub['coach'], rivalId: string): PlayerClub {
  const t = c.tier;
  const r = TIERS[t];
  const prestige = c.prestige ?? 0;
  const fac = Math.min(5, FACILITY_BY_TIER[t] + (prestige >= 8 ? 1 : 0));
  const biz = BUSINESS_BY_TIER[t];
  return {
    id: 'player',
    name: c.name,
    short: c.short || initials(c.name),
    colors: c.colors,
    strength: c.strength,
    tier: t,
    national: c.national,
    stateDiv: c.stateDiv,
    prestige: c.prestige,
    origin: 'pub',
    cash: Math.round(r.moneyScale * (25 + prestige * 3)),
    negativeSeasons: 0,
    pendingDeduction: 0,
    capacity: Math.round(Math.max(r.minStadium * 1.25, r.typicalFans * 1.1, 600) + prestige * 3000),
    capacityBuilding: 0,
    fans: Math.round(r.typicalFans * (1 + prestige * 0.15)),
    soul: 60,
    hype: 25 + prestige * 3,
    ticket: 1,
    facilities: { ct: fac, academy: fac, medical: fac },
    staff: { scout: STAFF_BY_TIER[t], fitness: STAFF_BY_TIER[t] },
    coach,
    businesses: { bar: biz, loja: biz, escolinha: biz, estacionamento: biz, foodtruck: biz },
    mood: 60,
    delegate: { contratos: false, base: false, mercado: false, estadio: false },
    continental: null,
    worldCup: false,
    derby: { w: 0, d: 0, l: 0 },
    copaSpot: false,
    sponsors: [],
    squad: c.squad.map((f) => ({ ...f })),
    youth: [],
    onLoan: [],
    alumni: [],
    rivalId,
    rivalHatred: 40,
    formMod: 0,
  };
}

/** Técnico (objeto do motor) a partir da carreira. */
export function careerCoach(c: CoachCareer, style: CoachStyle, formation: PlayerClub['coach']['formation'], tier: Tier): PlayerClub['coach'] {
  const rating = starsFor(c.reputation);
  return {
    name: c.name,
    style,
    rating,
    wage: Math.round(Math.max(COACH_WAGE[rating], TIERS[tier].moneyScale * 4)),
    age: c.age,
    formation,
    contract: c.contract,
    morale: 70,
  };
}

/** O técnico assume o clube `clubId` (troca de lugar com o clube atual). */
export function takeOver(state: GameState, offer: JobOffer): void {
  const c = state.career!;
  const idx = state.clubs.findIndex((x) => x.id === offer.clubId);
  if (idx < 0) throw new Error('clube da proposta não existe');
  const target = state.clubs[idx];
  const old = state.player;
  // rival: o clube mais forte da mesma competição
  const sameComp = state.clubs.filter((x) => x.id !== target.id && (target.national !== null ? x.national === target.national : x.stateDiv === target.stateDiv));
  const rival = sameComp.sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1))[0] ?? state.clubs.find((x) => x.id !== target.id)!;
  const rivalId = rival.id === target.id ? old.rivalId : rival.id;
  state.clubs[idx] = toAiClub(old, target.id);
  // se o rival escolhido era o próprio clube antigo (mesmo id do alvo), ele agora é o clube que saiu
  c.contract = offer.contract;
  c.board = {
    personality: offer.personality,
    confidence: BOARD_INFO[offer.personality].confidence,
    budget: 0,
    wageCap: 0,
  };
  // saiu no meio do contrato para aceitar a proposta
  const last = c.stints[c.stints.length - 1];
  if (last && last.to === null) {
    last.to = state.season - 1;
    last.exit = 'proposta';
    c.reputation = Math.max(0, c.reputation - 2);
  }
  state.player = toPlayerClub(target, careerCoach(c, old.coach.style, old.coach.formation, target.tier), rivalId);
  // clube de outro estado passa a disputar o nosso Estadual (assim nunca fica sem competição se cair da Série D)
  if (state.player.stateDiv === null) state.player.stateDiv = 'A';
  c.stints.push({ club: target.name, colors: target.colors, from: state.season, to: null, tier: target.tier });
  c.unemployed = false;
  c.offers = [];
}

/* ------------------------------ Diretoria ------------------------------ */

/** Verba e teto salarial da janela, pela personalidade da diretoria e pelo caixa. */
export function setBoardBudget(state: GameState): void {
  const c = state.career!;
  const p = state.player;
  const info = BOARD_INFO[c.board.personality];
  const proj = projectFinance(state);
  const spare = Math.max(0, p.cash + proj.net * 0.5);
  c.board.budget = Math.round(spare * info.budget);
  const pay = payroll(p);
  c.board.wageCap = Math.round(Math.max(pay * (1 + info.wage), pay + marketWage(TIERS[p.tier].meanStrength) * 1.5));
}

/** Gasto em transferência: precisa caber na verba. */
export function spendBudget(state: GameState, fee: number): string | null {
  const c = state.career;
  if (!c) return null;
  if (fee > c.board.budget) return `a diretoria não libera: a verba da janela é de R$ ${c.board.budget} mil`;
  c.board.budget -= fee;
  return null;
}

/** A folha nova cabe no teto da diretoria? */
export function wageCheck(state: GameState, extraWage: number): string | null {
  const c = state.career;
  if (!c) return null;
  if (payroll(state.player) + extraWage > c.board.wageCap) return `a diretoria não aprova: a folha passaria do teto de R$ ${c.board.wageCap} mil/ano`;
  return null;
}

/** Venda: metade do valor volta como verba para a janela. */
export function refundBudget(state: GameState, fee: number): void {
  if (state.career) state.career.board.budget += Math.round(fee * 0.5);
}

/* ------------------------------ Fim de temporada ------------------------------ */

/**
 * Fim da temporada do técnico: confiança da diretoria, reputação, idade e contrato.
 * Modo leve: demitido, sempre aparecem propostas (talvez de um clube menor).
 */
export function settleCareer(state: GameState, r: SeasonResult): string[] {
  const c = state.career!;
  const info = BOARD_INFO[c.board.personality];
  const news: string[] = [];
  let conf = 0;
  for (const o of r.objectives) conf += o.met ? (o.main ? 20 : 4) : o.main ? -25 * info.patience : -3;
  if (r.outcome === 'queda') conf -= 25 * info.patience;
  if (r.outcome === 'acesso' || r.outcome === 'campeao') conf += 15;
  if (r.finance.net < 0) conf -= c.board.personality === 'mao_de_vaca' ? 15 : 6;
  for (const cup of r.cups) if (cup.champion) conf += 10;
  const mine = r.awards ? [r.awards.general, ...r.awards.leagues].flatMap((s) => s.items).filter((i) => i.winner.mine && (i.id === 'tecnico' || i.id === 'tecnico_ano')) : [];
  conf += mine.length * 8;
  c.board.confidence = clamp(Math.round(c.board.confidence + conf), 0, 100);

  // reputação
  let rep = 0;
  const main = r.objectives.find((o) => o.main);
  if (main) rep += main.met ? 4 : -3;
  if (r.nextTier < r.tier) rep += 6;
  if (r.outcome === 'queda') rep -= 6;
  for (const comp of r.comps) if (comp.won) rep += Math.round((8 - comp.tier) * 1.2);
  for (const cup of r.cups) if (cup.champion) rep += cup.id === 'mundial' ? 15 : cup.id === 'cc' ? 12 : cup.id === 'copa' ? 7 : cup.id === 'le' ? 6 : 2;
  for (const it of mine) rep += it.id === 'tecnico_ano' ? 10 : 4;
  c.age++;
  c.contract--;

  const club = state.player.name;
  const stint = c.stints[c.stints.length - 1];
  const leave = (exit: 'demitido' | 'contrato') => {
    c.unemployed = true;
    if (stint && stint.to === null) {
      stint.to = state.season;
      stint.exit = exit;
    }
  };
  if (c.board.confidence <= 15) {
    rep -= 8;
    leave('demitido');
    news.push(`DEMITIDO: a diretoria do ${club} perde a paciência com ${c.name}`);
  } else if (c.contract <= 0) {
    if (c.board.confidence >= 45) {
      c.contract = 2;
      news.push(`${club} renova com ${c.name} por mais 2 temporadas`);
    } else {
      leave('contrato');
      news.push(`Fim de contrato: ${club} não renova com ${c.name}`);
    }
  } else if (c.board.confidence <= 35) {
    news.push(`Cadeira balança: diretoria do ${club} cobra ${c.name} (confiança ${c.board.confidence})`);
  }
  // ganhos ficam mais difíceis perto do topo (100 é para lendas); perdas valem cheio
  const gain = rep > 0 ? rep * Math.max(0.15, 1 - c.reputation / 110) : rep;
  c.reputation = clamp(Math.round(c.reputation + gain), 0, 100);
  return news;
}

/** Nova janela no modo técnico: propostas, verba e técnico atualizado. */
export function careerWindow(state: GameState, withOffers: boolean): void {
  const c = state.career!;
  if (withOffers) c.offers = jobOffers(state, deriveRng(state.seed, state.season, 'jobs'), c.unemployed);
  const p = state.player;
  p.coach = careerCoach(c, p.coach.style, p.coach.formation, p.tier);
  setBoardBudget(state);
}

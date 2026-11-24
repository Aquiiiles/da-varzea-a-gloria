import { BUSINESSES } from '../data/club';
import { FACILITY_COST, MAX_LOANS, STAFF_WAGE, TIERS, YOUTH_MAX } from '../data/pyramid';
import { coachAccepts, coachSeverance } from './clubops';
import { scaled } from './effects';
import { payroll } from './finance';
import { bestEleven, marketValue, squadStrength, tryoutCost } from './footballers';
import { effectsCashCost, projectFinance, seatsFor } from './office';
import { ARENA } from './finance';
import { ActionError } from './util';
import type { Action, DelegateArea, Effect, Footballer, GameState, Tier } from './types';

type Apply = (state: GameState, a: Action) => void;

const ALL_AREAS: DelegateArea[] = ['contratos', 'base', 'mercado', 'estadio'];

/**
 * Assistente: faz uma gestão sensata e conservadora.
 * - sem `areas` (botão "Assistente decide"): tudo, inclusive evento, oportunidades, técnico e comércio;
 * - com `areas` (delegação): só as áreas entregues aos diretores.
 * É uma função pura do estado (determinística), então o replay só precisa registrar a ação que a disparou.
 */
export function runAssistant(state: GameState, apply: Apply, areas?: DelegateArea[]): void {
  const full = !areas;
  const on = new Set(areas ?? ALL_AREAS);
  const tryDo = (a: Action): boolean => {
    try {
      apply(state, a);
      return true;
    } catch (e) {
      if (e instanceof ActionError) return false;
      throw e;
    }
  };
  const p = state.player;
  const o = state.office;
  const mean = TIERS[p.tier].meanStrength;
  /** caixa que sobra depois de garantir a temporada */
  const spare = () => p.cash + Math.min(0, projectFinance(state).net) - payroll(p) * 0.15;

  if (full) {
    // evento
    if (o.event && o.eventChoice === null) {
      const scores = o.event.options.map((opt) => scoreEffects(state, opt.effects));
      const pick: 0 | 1 = scores[1] > scores[0] ? 1 : 0;
      if (!tryDo({ t: 'event', choice: pick })) tryDo({ t: 'event', choice: pick === 0 ? 1 : 0 });
    }
    // oportunidades
    o.opportunities.forEach((entry, idx) => {
      if (!entry.taken && scoreEffects(state, entry.opp.effects) > 0.5 && spare() > effectsCashCost(state, entry.opp.effects)) tryDo({ t: 'opp', idx });
    });
  }

  const xi = bestEleven(p.squad).ids;

  if (on.has('contratos')) {
    // contratos renovam sozinhos: libera reservas veteranos e quem não vai vingar
    for (const f of p.squad.slice()) {
      const keep = xi.has(f.id) || (f.age <= 23 && f.potHi >= mean);
      if (f.contract === 1 && !keep !== !!f.leaving) tryDo({ t: 'leave', id: f.id });
    }
  }

  if (on.has('mercado')) {
    // propostas: vende reserva bem pago ou quando a oferta é irrecusável
    o.offers.forEach((of, idx) => {
      if (!of) return;
      const f = p.squad.find((x) => x.id === of.playerId);
      if (!f) return;
      const value = marketValue(f);
      if ((!xi.has(f.id) && of.fee >= value) || of.fee >= value * 1.6) tryDo({ t: 'offer', idx });
    });
  }

  if (on.has('base')) {
    for (const y of p.youth.slice()) {
      const weakest = weakestAt(p.squad, y.pos, xi);
      if (y.ovr >= weakest - 1 || (y.age >= 19 && y.potHi >= mean)) tryDo({ t: 'promote', id: y.id });
      else if (y.age >= 18 && y.potHi < mean - 2) tryDo({ t: 'cut', id: y.id });
    }
    for (const y of p.youth.slice()) {
      if (p.onLoan.filter((x) => !x.recovering).length >= MAX_LOANS) break;
      if (y.age >= 17 && y.ovr < mean - 8 && y.potHi >= mean) tryDo({ t: 'lend', id: y.id });
    }
  }

  if (on.has('estadio') && p.tier > 1) {
    const need = TIERS[(p.tier - 1) as Tier].minStadium - (p.capacity + p.capacityBuilding);
    const crowded = p.fans > p.capacity * 1.15;
    if (need > 0) {
      // estádio abaixo do exigido para subir: a menor obra que resolve, ou a maior que couber no caixa
      const options = ([0, 1, 2] as const).map((size) => ({ size, ...seatsFor(p.capacity + p.capacityBuilding, size) }));
      const solves = options.find((o) => o.seats >= need && o.cost <= spare());
      const biggest = [...options].reverse().find((o) => o.cost <= spare());
      const pick = solves ?? biggest;
      if (pick) tryDo({ t: 'seats', size: pick.size });
    } else if (crowded && spare() > 0) {
      const { cost } = seatsFor(p.capacity + p.capacityBuilding, 0);
      if (cost <= spare()) tryDo({ t: 'seats', size: 0 });
    }
  }
  // grandes projetos com o dinheiro que sobra (a diretoria faz isso sozinha no modo técnico)
  if (on.has('estadio') && p.tier <= 2) {
    if (!p.arena && p.cash > ARENA.arena.cost * 2.5) tryDo({ t: 'project', which: 'arena' });
    else if (p.arena === 1 && p.cash > ARENA.multiuso.cost * 2.5) tryDo({ t: 'project', which: 'multiuso' });
    if (p.arena && !p.naming && p.cash < ARENA.multiuso.cost) tryDo({ t: 'project', which: 'naming' });
  }

  if (on.has('mercado')) {
    for (let k = 0; k < 3; k++) {
      const base = squadStrength(p.squad);
      let best = -1;
      let bestScore = 0;
      o.market.forEach((l, idx) => {
        if (!l) return;
        const gain = squadStrength([...p.squad, l.player]) - base;
        if (gain < 0.2 || l.fee + l.player.wage > spare()) return;
        const score = gain / (l.fee + l.player.wage * 2 + 1);
        if (score > bestScore) {
          bestScore = score;
          best = idx;
        }
      });
      if (best < 0 || !tryDo({ t: 'buy', idx: best })) break;
    }
    const xiNow = bestEleven(p.squad).ids;
    for (const f of p.squad.filter((x) => !xiNow.has(x.id) && x.age >= 30).sort((a, b) => b.wage - a.wage)) {
      if (p.squad.length <= 20) break;
      tryDo({ t: 'sell', id: f.id });
    }
  }

  if (on.has('estadio')) {
    const fac = p.facilities.academy <= p.facilities.ct ? 'academy' : 'ct';
    if (p.facilities[fac] < 5 && spare() > FACILITY_COST[p.facilities[fac]] * 2) tryDo({ t: 'facility', which: fac });
    const demand = p.fans;
    const ticket = demand > p.capacity * 1.4 ? 2 : demand < p.capacity * 0.6 ? 0 : 1;
    if (p.ticket !== ticket) tryDo({ t: 'ticket', level: ticket });
  }

  if (on.has('base') && !o.tryout && p.facilities.academy >= 1 && p.youth.length < YOUTH_MAX - 2 && spare() > tryoutCost(p.tier) * 4) {
    if (tryDo({ t: 'tryout' })) {
      o.tryout!.forEach((c, idx) => {
        if (c && c.potHi >= mean + 6) tryDo({ t: 'sign', idx });
      });
    }
  }

  if (full) {
    // técnico: troca por um claramente melhor que caiba no orçamento
    let bestCoach = -1;
    o.coaches.forEach((c, idx) => {
      if (!c || c.rating <= p.coach.rating || !coachAccepts(c, p.tier)) return;
      if (c.wage * 4 + coachSeverance(p.coach) > spare()) return;
      if (bestCoach < 0 || c.rating > o.coaches[bestCoach]!.rating) bestCoach = idx;
    });
    if (bestCoach >= 0) tryDo({ t: 'coach', idx: bestCoach });
    // olheiro
    if (p.staff.scout < 3 && spare() > STAFF_WAGE[p.staff.scout + 1] * 5) tryDo({ t: 'staff', which: 'scout', dir: 1 });
    // comércio: o negócio mais barato disponível, se sobrar dinheiro
    const options = BUSINESSES.filter((b) => p.businesses[b.id] < 3 && (b.id !== 'estacionamento' || p.capacity >= 3000))
      .map((b) => ({ id: b.id, cost: b.cost[p.businesses[b.id]] }))
      .sort((a, b) => a.cost - b.cost);
    if (options.length > 0 && spare() > options[0].cost * 3) tryDo({ t: 'business', which: options[0].id });
    // socorro
    if (p.negativeSeasons >= 1 && p.cash + projectFinance(state).net < 0) tryDo({ t: 'loan', size: 0 });
  }
}

function weakestAt(squad: Footballer[], pos: Footballer['pos'], xi: Set<number>): number {
  const inXi = squad.filter((f) => f.pos === pos && xi.has(f.id)).map((f) => f.ovr);
  return inXi.length > 0 ? Math.min(...inXi) : 0;
}

/** Avaliação simples de um pacote de efeitos (positivo = bom negócio). */
function scoreEffects(state: GameState, effects: readonly Effect[]): number {
  const p = state.player;
  const ms = TIERS[p.tier].moneyScale;
  const broke = p.cash < payroll(p) * 0.2;
  let score = 0;
  for (const e of effects) {
    switch (e.type) {
      case 'add': {
        const v = scaled(state, e.value, e.scale);
        if (e.stat === 'cash') score += (v / ms / 10) * (broke ? 2 : 1);
        else if (e.stat === 'soul') score += (v / 4) * (p.soul + v < 35 ? 3 : 1);
        else if (e.stat === 'form') score += v * 2;
        else if (e.stat === 'hype') score += v / 20;
        else if (e.stat === 'fans') score += v / 200;
        break;
      }
      case 'mul':
        score += (e.value - 1) * 10;
        break;
      case 'sponsor':
        score += (scaled(state, e.perSeason, e.scale) / ms / 10) * (e.seasons ?? 6);
        break;
      case 'sign':
        score += 1.5;
        break;
      case 'sellStar':
        score += broke ? 1 : -2;
        break;
      case 'recolor':
        score -= 1;
        break;
    }
  }
  return score;
}

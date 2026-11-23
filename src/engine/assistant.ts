import { FACILITY_COST, MAX_LOANS, STAFF_WAGE, TIERS, YOUTH_MAX } from '../data/pyramid';
import { scaled } from './effects';
import { payroll } from './finance';
import { bestEleven, marketValue, squadStrength, tryoutCost } from './footballers';
import { effectsCashCost, projectFinance, seatsFor } from './office';
import { ActionError } from './util';
import type { Action, Effect, Footballer, GameState, Tier } from './types';

type Apply = (state: GameState, a: Action) => void;

/**
 * Assistente: faz uma gestão sensata e conservadora da temporada.
 * É uma função pura do estado (determinística), então o replay só precisa registrar 'auto'.
 */
export function runAssistant(state: GameState, apply: Apply): void {
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

  // 1) evento
  if (o.event && o.eventChoice === null) {
    const scores = o.event.options.map((opt) => scoreEffects(state, opt.effects));
    const pick: 0 | 1 = scores[1] > scores[0] ? 1 : 0;
    if (!tryDo({ t: 'event', choice: pick })) tryDo({ t: 'event', choice: pick === 0 ? 1 : 0 });
  }

  // 2) oportunidades
  o.opportunities.forEach((entry, idx) => {
    if (!entry.taken && scoreEffects(state, entry.opp.effects) > 0.5 && spare() > effectsCashCost(state, entry.opp.effects)) {
      tryDo({ t: 'opp', idx });
    }
  });

  // 3) contratos (renovam sozinhos): libera reservas veteranos e quem não vai vingar
  const xi = bestEleven(p.squad).ids;
  for (const f of p.squad.slice()) {
    const keep = xi.has(f.id) || (f.age <= 23 && f.potHi >= mean);
    if (f.contract === 1 && !keep !== !!f.leaving) tryDo({ t: 'leave', id: f.id });
  }

  // 3b) propostas: vende reserva bem pago ou quando a oferta é irrecusável
  o.offers.forEach((of, idx) => {
    if (!of) return;
    const f = p.squad.find((x) => x.id === of.playerId);
    if (!f) return;
    const value = marketValue(f);
    if ((!xi.has(f.id) && of.fee >= value) || of.fee >= value * 1.6) tryDo({ t: 'offer', idx });
  });

  // 4) base: promove quem já briga por vaga; dispensa quem não vai vingar
  for (const y of p.youth.slice()) {
    const weakest = weakestAt(p.squad, y.pos, xi);
    if (y.ovr >= weakest - 1 || (y.age >= 19 && y.potHi >= mean)) tryDo({ t: 'promote', id: y.id });
    else if (y.age >= 18 && y.potHi < mean - 2) tryDo({ t: 'cut', id: y.id });
  }

  // 4b) empresta garotos que ainda não jogam para ganharem rodagem
  for (const y of p.youth.slice()) {
    if (p.onLoan.length >= MAX_LOANS) break;
    if (y.age >= 17 && y.ovr < mean - 8 && y.potHi >= mean) tryDo({ t: 'lend', id: y.id });
  }

  // 5) estádio: prepara a vistoria do acesso
  if (p.tier > 1) {
    const need = TIERS[(p.tier - 1) as Tier].minStadium - (p.capacity + p.capacityBuilding);
    const contender = squadStrength(p.squad) >= mean + 0.5;
    const crowded = p.fans > p.capacity * 1.15;
    if (need > 0 && (contender || crowded) || (need <= 0 && crowded && spare() > 0)) {
      for (const size of [0, 1, 2] as const) {
        const { seats, cost } = seatsFor(p.capacity + p.capacityBuilding, size);
        if ((need <= 0 || seats >= need || size === 2) && cost <= spare()) {
          tryDo({ t: 'seats', size });
          break;
        }
      }
    }
  }

  // 6) reforços: melhores ganhos de força por libra
  for (let k = 0; k < 3; k++) {
    const base = squadStrength(p.squad);
    let best = -1;
    let bestScore = 0;
    o.market.forEach((l, idx) => {
      if (!l) return;
      const gain = squadStrength([...p.squad, l.player]) - base;
      const yearly = l.player.wage;
      if (gain < 0.2 || l.fee + yearly > spare()) return;
      const score = gain / (l.fee + yearly * 2 + 1);
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    });
    if (best < 0 || !tryDo({ t: 'buy', idx: best })) break;
  }

  // 7) enxuga o elenco: vende reservas veteranos
  const xiNow = bestEleven(p.squad).ids;
  const surplus = p.squad.filter((f) => !xiNow.has(f.id) && f.age >= 30).sort((a, b) => b.wage - a.wage);
  for (const f of surplus) {
    if (p.squad.length <= 20) break;
    tryDo({ t: 'sell', id: f.id });
  }

  // 8) estrutura e staff quando sobra dinheiro
  const fac = p.facilities.academy <= p.facilities.ct ? 'academy' : 'ct';
  if (p.facilities[fac] < 5 && spare() > FACILITY_COST[p.facilities[fac]] * 2) tryDo({ t: 'facility', which: fac });
  for (const role of ['coach', 'scout'] as const) {
    const lvl = p.staff[role];
    if (lvl < 3 && spare() > STAFF_WAGE[lvl + 1] * 5) tryDo({ t: 'staff', which: role, dir: 1 });
  }

  // 9) peneira
  if (!o.tryout && p.facilities.academy >= 1 && p.youth.length < YOUTH_MAX - 2 && spare() > tryoutCost(p.tier) * 4) {
    if (tryDo({ t: 'tryout' })) {
      o.tryout!.forEach((c, idx) => {
        if (c && c.potHi >= mean + 6) tryDo({ t: 'sign', idx });
      });
    }
  }

  // 10) ingresso conforme a procura
  const demand = p.fans;
  const cap = p.capacity;
  const ticket = demand > cap * 1.4 ? 2 : demand < cap * 0.6 ? 0 : 1;
  if (p.ticket !== ticket) tryDo({ t: 'ticket', level: ticket });

  // 11) socorro: empréstimo se a temporada vai fechar no vermelho de novo
  if (p.negativeSeasons >= 1 && p.cash + projectFinance(state).net < 0) tryDo({ t: 'loan', size: 0 });
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

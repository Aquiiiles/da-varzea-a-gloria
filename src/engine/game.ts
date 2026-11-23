import { CARDS, STADIUM_CARD_IDS } from '../data/cards';
import { EVENTS, EVENT_CHANCE } from '../data/events';
import { MAX_SEASONS, TIERS } from '../data/pyramid';
import { generateWorld, initials, randomPersonName } from './clubs';
import { applyEffects } from './effects';
import { deriveRng } from './rng';
import { simulateSeason, stadiumAllows, PLAYER_ID } from './season';
import type { Card, Foundation, GameEvent, GameState, Origin, PlayerClub, Squadman, Tier } from './types';

interface OriginPreset {
  cash: number;
  fans: number;
  soul: number;
  hype: number;
  strength: number;
  capacity: number;
  sponsor?: { name: string; perSeason: number };
}

export const ORIGINS: Record<Origin, OriginPreset & { label: string; blurb: string }> = {
  pub: {
    label: 'Time de pub', blurb: 'Torcida e alma altas, pouco dinheiro.',
    cash: 25, fans: 420, soul: 85, hype: 10, strength: 20, capacity: 500,
  },
  fabrica: {
    label: 'Time de fábrica', blurb: 'Patrocinador fixo (renda estável), torcida pequena.',
    cash: 35, fans: 160, soul: 65, hype: 5, strength: 20, capacity: 600,
    sponsor: { name: 'Metalúrgica Aurora', perSeason: 22 },
  },
  youtuber: {
    label: 'Time de YouTuber', blurb: 'Hype e dinheiro altos, moral instável, rivais com bônus contra você.',
    cash: 90, fans: 300, soul: 45, hype: 85, strength: 21, capacity: 500,
  },
};

export function sanitizeName(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 28);
  return clean.length > 0 ? clean : 'Várzea FC';
}

export function newGame(seed: number, foundation: Foundation): GameState {
  const seedU = seed >>> 0;
  const f: Foundation = { ...foundation, name: sanitizeName(foundation.name) };
  const rng = deriveRng(seedU, 'world');
  const taken = new Set<string>([f.name]);
  const { world, serial } = generateWorld(rng, taken);
  const preset = ORIGINS[f.origin];

  // rival: o clube do bairro vizinho, na mesma divisão
  const rival = rng.pick(world[8]);
  const squadRng = deriveRng(seedU, 'squad');
  const squad: Squadman[] = [3, 2, 2].map((finishing, i) => ({
    id: `p${i}`,
    name: randomPersonName(squadRng),
    finishing,
    goals: 0,
    seasons: 0,
    joined: 1,
    active: true,
  }));

  const player: PlayerClub = {
    id: PLAYER_ID,
    name: f.name,
    short: initials(f.name),
    colors: f.colors,
    strength: preset.strength,
    tier: 8,
    origin: f.origin,
    founded: 1,
    cash: preset.cash,
    negativeSeasons: 0,
    pendingDeduction: 0,
    capacity: preset.capacity,
    fans: preset.fans,
    soul: preset.soul,
    hype: preset.hype,
    staff: { coach: 0, scout: 0, fitness: 0, academy: 0 },
    sponsors: preset.sponsor ? [{ ...preset.sponsor, seasonsLeft: null }] : [],
    squad,
    rivalId: rival.id,
    rivalHatred: 30,
  };

  const state: GameState = {
    version: 1,
    seed: seedU,
    foundation: f,
    season: 1,
    choices: [],
    phase: 'draft',
    player,
    world,
    offer: [],
    event: null,
    seenEvents: [],
    history: [],
    news: [`Nasce o ${f.name}: clube de bairro se inscreve na ${TIERS[8].name}`, `${rival.name} será o grande rival`],
    over: null,
    serial: serial + squad.length,
  };
  state.offer = drawCards(state);
  return state;
}

function tierAllowed(tier: Tier, item: { minTier?: Tier; maxTier?: Tier }): boolean {
  // minTier/maxTier em termos de "nível": minTier 6 = só do nível 6 para cima (6..1)
  if (item.minTier !== undefined && tier > item.minTier) return false;
  if (item.maxTier !== undefined && tier < item.maxTier) return false;
  return true;
}

/** 3 cartas distintas, sorteadas por peso, preferindo tipos diferentes. */
export function drawCards(state: GameState): Card[] {
  const rng = deriveRng(state.seed, state.season, 'cards');
  const pool = CARDS.filter((c) => tierAllowed(state.player.tier, c));
  const picked: Card[] = [];
  // se o estádio atual não comporta a divisão de cima, sempre vem uma carta de estádio
  const p = state.player;
  if (p.tier > 1 && !stadiumAllows(p.capacity, (p.tier - 1) as Tier)) {
    const stadium = pool.filter((c) => STADIUM_CARD_IDS.includes(c.id));
    if (stadium.length > 0) picked.push(rng.weighted(stadium, (c) => c.weight));
  }
  while (picked.length < 3 && picked.length < pool.length) {
    const available = pool.filter((c) => !picked.includes(c));
    const card = rng.weighted(available, (c) => c.weight * (picked.some((x) => x.kind === c.kind) ? 0.25 : 1));
    picked.push(card);
  }
  return rng.shuffle(picked);
}

export function drawEvent(state: GameState): GameEvent | null {
  const rng = deriveRng(state.seed, state.season, 'event');
  if (!rng.chance(EVENT_CHANCE)) return null;
  const pool = EVENTS.filter((e) => tierAllowed(state.player.tier, e) && !(e.once && state.seenEvents.includes(e.id)));
  if (pool.length === 0) return null;
  return rng.weighted(pool, (e) => e.weight);
}

/** Quantas opções a decisão atual tem (para validação de replays). */
export function optionCount(state: GameState): number {
  if (state.phase === 'draft') return state.offer.length;
  if (state.phase === 'event') return 2;
  return 0;
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

/**
 * Aplica uma escolha na fase atual ('draft' ou 'event') e, se for a última decisão
 * da temporada, simula a temporada. Retorna um NOVO estado (o original não é mutado).
 */
export function choose(prev: GameState, index: number): GameState {
  if (prev.phase !== 'draft' && prev.phase !== 'event') throw new Error(`não há escolha na fase ${prev.phase}`);
  if (!Number.isInteger(index) || index < 0 || index >= optionCount(prev)) throw new Error(`escolha inválida: ${index}`);
  const state = clone(prev);
  state.choices.push(index);
  const decision = state.choices.length;

  if (state.phase === 'draft') {
    const card = state.offer[index];
    applyEffects(state, card.effects, deriveRng(state.seed, state.season, 'apply', decision));
    state.news.push(`${state.player.name} aposta em: ${card.title.toLowerCase()}`);
    const event = drawEvent(state);
    if (event) {
      state.event = event;
      state.phase = 'event';
      return state;
    }
  } else {
    const event = state.event!;
    const option = event.options[index];
    applyEffects(state, option.effects, deriveRng(state.seed, state.season, 'apply', decision));
    state.seenEvents.push(event.id);
    state.news.push(option.headline);
  }
  return playSeason(state);
}

function playSeason(state: GameState): GameState {
  state.event = null;
  state.offer = [];
  const result = simulateSeason(state);
  state.history.push(result);
  state.news.push(...result.headlines);
  state.phase = state.over ? 'over' : 'summary';
  if (!state.over && state.season >= MAX_SEASONS) {
    state.over = 'fim';
    state.phase = 'over';
  }
  return state;
}

/** Sai do resumo e começa a próxima temporada. */
export function advance(prev: GameState): GameState {
  if (prev.phase !== 'summary') throw new Error(`advance só no resumo (fase: ${prev.phase})`);
  const state = clone(prev);
  state.season++;
  state.phase = 'draft';
  state.offer = drawCards(state);
  return state;
}

/** Reconstrói uma run inteira a partir da seed, fundação e lista de escolhas. */
export function replay(seed: number, foundation: Foundation, choices: readonly number[]): GameState {
  let state = newGame(seed, foundation);
  for (const c of choices) {
    if (state.phase === 'summary') state = advance(state);
    if (state.phase === 'over') break;
    state = choose(state, c);
  }
  return state;
}

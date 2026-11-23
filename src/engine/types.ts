/** Tipos centrais do motor. Tudo serializável (sem funções), para rodar igual no cliente e no servidor. */

export type Origin = 'pub' | 'fabrica' | 'youtuber';

/** Nível da pirâmide: 1 = Premier (topo) ... 8 = Liga Regional (fundo). */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Club {
  id: string;
  name: string;
  short: string;
  colors: [string, string];
  /** força 0–100 */
  strength: number;
  tier: Tier;
  /** gigantes históricos: puxam a força para cima ano após ano */
  prestige?: number;
}

export interface Squadman {
  id: string;
  name: string;
  /** peso na divisão de gols do clube */
  finishing: number;
  goals: number;
  seasons: number;
  joined: number;
  active: boolean;
}

export interface Sponsor {
  name: string;
  /** receita por temporada (mil £) */
  perSeason: number;
  /** temporadas restantes; null = permanente */
  seasonsLeft: number | null;
}

export interface Staff {
  coach: number; // 0–3: bônus de força em jogo
  scout: number; // 0–3: crescimento anual
  fitness: number; // 0–3: reduz desgaste anual
  academy: number; // 0–3: base, crescimento anual
}

export interface PlayerClub extends Club {
  origin: Origin;
  founded: number;
  /** caixa em mil £ */
  cash: number;
  negativeSeasons: number;
  /** pontos a descontar na próxima temporada */
  pendingDeduction: number;
  capacity: number;
  fans: number;
  /** 0–100 */
  soul: number;
  /** 0–100 */
  hype: number;
  staff: Staff;
  sponsors: Sponsor[];
  squad: Squadman[];
  rivalId: string;
  /** 0–100: ódio do clássico */
  rivalHatred: number;
}

/* ---------------------------- Efeitos (dados) ---------------------------- */

export type Stat =
  | 'strength'
  | 'cash'
  | 'fans'
  | 'soul'
  | 'capacity'
  | 'hype'
  | 'rivalStrength'
  | 'rivalHatred'
  | 'coach'
  | 'scout'
  | 'fitness'
  | 'academy';

export type Effect =
  /** soma valor; se `scale`, multiplica pela escala de dinheiro da divisão atual */
  | { type: 'add'; stat: Stat; value: number; scale?: boolean }
  /** multiplica (ex.: torcida x1.2) */
  | { type: 'mul'; stat: 'fans' | 'cash' | 'capacity'; value: number }
  | { type: 'sponsor'; name: string; perSeason: number; seasons: number | null; scale?: boolean }
  /** contrata um jogador nomeado (nome sorteado pela seed) */
  | { type: 'signing'; finishing: number }
  /** craque mais artilheiro ativo sai */
  | { type: 'loseStar' }
  /** muda as cores do clube (gera par novo pela seed) */
  | { type: 'recolor' };

export type CardKind = 'reforco' | 'staff' | 'infra' | 'dinheiro' | 'aliciar';

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  text: string;
  /** peso de sorteio */
  weight: number;
  minTier?: Tier;
  maxTier?: Tier;
  effects: Effect[];
}

export interface EventOption {
  label: string;
  effects: Effect[];
  headline: string;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  weight: number;
  minTier?: Tier;
  maxTier?: Tier;
  /** só aparece uma vez por run */
  once?: boolean;
  options: [EventOption, EventOption];
}

/* ------------------------------ Partidas ------------------------------ */

export interface MatchResult {
  home: string;
  away: string;
  hg: number;
  ag: number;
  /** pênaltis (só mata-mata) */
  pens?: [number, number];
  extraTime?: boolean;
  winner?: string;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  deduction: number;
}

export interface PlayoffResult {
  semis: MatchResult[];
  final: MatchResult;
  winner: string;
}

export type Outcome =
  | 'campeao' // campeão e sobe (ou campeão da Premier)
  | 'acesso' // sobe direto sem título
  | 'acesso_playoff'
  | 'barrado_estadio' // teria subido, mas o estádio não permite
  | 'fica'
  | 'queda'
  | 'falencia';

export interface LeagueSeason {
  tier: Tier;
  table: TableRow[];
  /** rodadas do clube do jogador (na ordem) — para momentos ao vivo */
  playerMatches: MatchResult[];
  playoff?: PlayoffResult;
  promoted: string[];
  relegated: string[];
}

export interface FinanceReport {
  tickets: number;
  tv: number;
  sponsors: number;
  wages: number;
  upkeep: number;
  net: number;
  cashEnd: number;
}

export interface SeasonResult {
  season: number;
  year: number;
  tier: Tier;
  position: number;
  points: number;
  deduction: number;
  outcome: Outcome;
  /** divisão em que o clube vai jogar a próxima temporada */
  nextTier: Tier;
  /** se foi barrado pelo estádio: capacidade exigida */
  stadiumRequired?: number;
  playoff?: PlayoffResult;
  table: TableRow[];
  /** nomes dos clubes da tabela (snapshot) */
  clubNames: Record<string, string>;
  playerMatches: MatchResult[];
  topScorer: { name: string; goals: number } | null;
  finance: FinanceReport;
  strength: number;
  headlines: string[];
}

/* ------------------------------ Estado ------------------------------ */

export type Phase = 'draft' | 'event' | 'summary' | 'over';

export interface Foundation {
  name: string;
  colors: [string, string];
  origin: Origin;
}

export interface GameState {
  version: 1;
  seed: number;
  foundation: Foundation;
  /** temporada atual (1..MAX_SEASONS) */
  season: number;
  /** todas as escolhas feitas até agora, na ordem (uma por decisão) */
  choices: number[];
  phase: Phase;
  player: PlayerClub;
  /** clubes da IA, por nível */
  world: Record<Tier, Club[]>;
  /** cartas oferecidas na temporada atual */
  offer: Card[];
  /** evento pendente (se houver) */
  event: GameEvent | null;
  seenEvents: string[];
  history: SeasonResult[];
  /** manchetes acumuladas (ticker) */
  news: string[];
  over: null | 'falencia' | 'fim';
  /** contador para ids únicos determinísticos */
  serial: number;
}

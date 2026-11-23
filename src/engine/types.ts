/** Tipos centrais do motor. Tudo serializável (sem funções), para rodar igual no cliente e no servidor. */

export type Origin = 'pub' | 'fabrica' | 'youtuber';

/** Nível da escada: 1 Série A · 2 Série B · 3 Série C · 4 Série D · 5 Estadual · 6 Estadual Série B · 7 Várzea. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type NationalDiv = 1 | 2 | 3 | 4;
/** Divisão no estado: A (Estadual), B (Estadual Série B), V (Várzea). */
export type StateDiv = 'A' | 'B' | 'V';

/** Clube da IA: uma força só (overall médio do time titular). */
export interface Club {
  id: string;
  name: string;
  short: string;
  colors: [string, string];
  /** overall médio do time (escala 30–95) */
  strength: number;
  /** nível atual (derivado de `national` e `stateDiv`) */
  tier: Tier;
  /** divisão nacional (null = não disputa) */
  national: NationalDiv | null;
  /** divisão no nosso estado (null = clube de outro estado) */
  stateDiv: StateDiv | null;
  /** gigantes históricos: puxam a força para cima ano após ano */
  prestige?: number;
}

export type CompId = 'varzea' | 'estadual_b' | 'estadual_a' | 'serie_d' | 'serie_c' | 'serie_b' | 'serie_a';

/** Resultado de uma competição de liga (com fases) do ponto de vista do jogador. */
export interface CompResult {
  id: CompId;
  name: string;
  tier: Tier;
  /** tabelas: 1ª fase, grupos, quadrangulares */
  tables: { name: string; rows: TableRow[] }[];
  /** jogos de mata-mata do jogador */
  ties: CupMatch[];
  /** nome do campeão */
  champion: string;
  /** como o jogador terminou: "Campeão", "Vice", "Semifinal", "7º na 1ª fase" */
  finish: string;
  /** o jogador foi campeão */
  won: boolean;
  clubNames: Record<string, string>;
}

/* ------------------------------ Jogadores ------------------------------ */

export type Position = 'GOL' | 'DEF' | 'MEI' | 'ATA';

export interface Footballer {
  id: number;
  name: string;
  pos: Position;
  age: number;
  /** overall atual (inteiro) */
  ovr: number;
  /** potencial real (escondido; a UI mostra a faixa do olheiro) */
  pot: number;
  /** faixa de potencial que o olheiro enxerga */
  potLo: number;
  potHi: number;
  /** salário anual (mil £) */
  wage: number;
  /** temporadas restantes de contrato, contando a atual (1 = último ano) */
  contract: number;
  goals: number;
  apps: number;
  /** temporada em que chegou */
  joined: number;
  /** cria da base? */
  homegrown: boolean;
  /** marcado para NÃO renovar: sai de graça quando o contrato acabar */
  leaving?: boolean;
  /** emprestado a partir da base (volta para a base) */
  loanFromYouth?: boolean;
}

export type ListingProfile = 'promessa' | 'pronto' | 'veterano' | 'livre';

/** Jogador à venda no mercado. */
export interface Listing {
  player: Footballer;
  fee: number;
  /** clube vendedor (texto) */
  from: string;
  profile: ListingProfile;
}

/** Proposta de um clube da IA por um jogador seu. */
export interface Offer {
  playerId: number;
  fee: number;
  club: string;
  clubTier: Tier;
}

/* ------------------------------ Clube do jogador ------------------------------ */

export type Facility = 'ct' | 'academy' | 'medical';
export type StaffRole = 'scout' | 'fitness';
export type CoachStyle = 'ofensivo' | 'retranqueiro' | 'formador' | 'motivador' | 'estrategista';
export type BusinessId = 'bar' | 'loja' | 'escolinha' | 'estacionamento' | 'foodtruck';
export type DelegateArea = 'contratos' | 'base' | 'mercado' | 'estadio';

export interface Coach {
  name: string;
  style: CoachStyle;
  /** 0–4: bônus de força de 0,5 por nível */
  rating: number;
  /** salário anual (mil £) */
  wage: number;
  age: number;
}

export type CompetitionId = 'estado' | 'copa' | 'cc' | 'le' | 'mundial';

export interface CupMatch {
  round: string;
  opponent: string;
  /** divisão do adversário na pirâmide (null = clube estrangeiro) */
  opponentTier: Tier | null;
  home: boolean;
  result: MatchResult;
  /** venceu o jogo (ou avançou, em jogo único) */
  won: boolean;
  /** passou de fase neste jogo (null = jogo de ida) */
  advanced: boolean | null;
  /** eliminou um clube 3+ níveis acima */
  giantKill: boolean;
}

export interface CupRun {
  id: CompetitionId;
  name: string;
  matches: CupMatch[];
  champion: boolean;
  /** fase em que caiu (ou "Campeão") */
  reached: string;
  prize: number;
}

export type ObjectiveKind = 'subir' | 'brigar' | 'meio' | 'nao_cair' | 'titulo' | 'top4' | 'classico' | 'copa' | 'base' | 'casa';

export interface Objective {
  kind: ObjectiveKind;
  text: string;
  /** objetivo principal (da diretoria) ou bônus (da torcida) */
  main: boolean;
  /** parâmetro (ex.: posição máxima, fase da copa) */
  target: number;
  met?: boolean;
}

/** Lance de um jogo ao vivo. */
export interface LiveEvent {
  minute: number;
  kind: 'gol' | 'chance' | 'defesa' | 'cartao' | 'apito' | 'penaltis';
  /** true = lance do clube do jogador */
  mine: boolean;
  text: string;
  score: [number, number];
}

export interface LiveMoment {
  kind: 'playoff' | 'ultima_rodada' | 'zebra' | 'final_copa' | 'final_cc' | 'final_le' | 'mundial' | 'classico' | 'final_estadual' | 'final_estado';
  title: string;
  stake: string;
  homeName: string;
  awayName: string;
  /** o jogador é o mandante? */
  playerHome: boolean;
  result: MatchResult;
  events: LiveEvent[];
}
export type TicketPolicy = 0 | 1 | 2; // popular, normal, caro

export interface Sponsor {
  name: string;
  /** receita por temporada (mil £); negativo = dívida parcelada */
  perSeason: number;
  /** temporadas restantes; null = permanente */
  seasonsLeft: number | null;
}

export interface PlayerClub extends Club {
  origin: Origin;
  /** caixa em mil £ */
  cash: number;
  negativeSeasons: number;
  /** pontos a descontar na temporada atual */
  pendingDeduction: number;
  capacity: number;
  /** lugares em obra: ficam prontos no fim da temporada */
  capacityBuilding: number;
  fans: number;
  /** 0–100 */
  soul: number;
  /** 0–100 */
  hype: number;
  ticket: TicketPolicy;
  facilities: Record<Facility, number>; // 0–5
  staff: Record<StaffRole, number>; // 0–4
  coach: Coach;
  businesses: Record<BusinessId, number>; // 0–3
  /** torcedômetro 0–100 */
  mood: number;
  /** áreas entregues ao assistente (rodam sozinhas a cada temporada) */
  delegate: Record<DelegateArea, boolean>;
  /** competição continental desta temporada */
  continental: 'cc' | 'le' | null;
  /** disputa o Mundial nesta temporada */
  worldCup: boolean;
  /** histórico do clássico (liga e copas) */
  derby: { w: number; d: number; l: number };
  /** vaga na Copa Nacional desta temporada (campeão da Copa do Estado do ano anterior) */
  copaSpot: boolean;
  sponsors: Sponsor[];
  squad: Footballer[];
  youth: Footballer[];
  /** emprestados a outros clubes nesta temporada (voltam no fim) */
  onLoan: Footballer[];
  /** ex-jogadores (para o ídolo) */
  alumni: Footballer[];
  rivalId: string;
  /** 0–100: ódio do clássico */
  rivalHatred: number;
  /** modificador de forma só desta temporada (eventos) */
  formMod: number;
}

/* ---------------------------- Efeitos (dados) ---------------------------- */

export type Stat = 'cash' | 'fans' | 'soul' | 'capacity' | 'hype' | 'rivalStrength' | 'rivalHatred' | 'form';

export type Effect =
  /** soma valor; se `scale`, multiplica pela escala de dinheiro da divisão atual */
  | { type: 'add'; stat: Stat; value: number; scale?: boolean }
  | { type: 'mul'; stat: 'fans' | 'capacity'; value: number }
  | { type: 'sponsor'; name: string; perSeason: number; seasons: number | null; scale?: boolean }
  /** contrata um jogador: overall relativo à média da divisão, idade [min,max], posição opcional */
  | { type: 'sign'; rel: number; age: [number, number]; pos?: Position }
  /** vende o melhor jogador pelo valor de mercado x `mult` */
  | { type: 'sellStar'; mult: number }
  /** muda as cores do clube (gera par novo pela seed) */
  | { type: 'recolor' };

export interface Opportunity {
  id: string;
  title: string;
  text: string;
  weight: number;
  minTier?: Tier;
  maxTier?: Tier;
  once?: boolean;
  /** rótulo do botão de aceitar */
  accept: string;
  effects: Effect[];
  headline: string;
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
  once?: boolean;
  options: [EventOption, EventOption];
}

/* ------------------------------ Ações (log da run) ------------------------------ */

export type Action =
  | { t: 'buy'; idx: number } // compra a listagem idx do mercado
  | { t: 'sell'; id: number }
  | { t: 'release'; id: number }
  | { t: 'leave'; id: number } // alterna "não renovar" (sai de graça no fim do contrato)
  | { t: 'offer'; idx: number } // aceita a proposta idx
  | { t: 'lend'; id: number } // empresta um jovem por uma temporada
  | { t: 'promote'; id: number } // base → profissional
  | { t: 'cut'; id: number } // dispensa da base
  | { t: 'tryout' } // faz a peneira
  | { t: 'sign'; idx: number } // contrata candidato idx da peneira
  | { t: 'seats'; size: 0 | 1 | 2 }
  | { t: 'facility'; which: Facility }
  | { t: 'staff'; which: StaffRole; dir: 1 | -1 }
  | { t: 'coach'; idx: number } // contrata o candidato idx a técnico
  | { t: 'business'; which: BusinessId }
  | { t: 'delegate'; area: DelegateArea }
  | { t: 'ticket'; level: TicketPolicy }
  | { t: 'loan'; size: 0 | 1 }
  | { t: 'opp'; idx: number } // aceita a oportunidade idx
  | { t: 'event'; choice: 0 | 1 }
  | { t: 'auto' } // assistente faz a gestão da temporada
  | { t: 'play' } // simula a temporada
  | { t: 'next' }; // sai do resumo para a próxima temporada

/* ------------------------------ Partidas ------------------------------ */

export interface MatchResult {
  home: string;
  away: string;
  hg: number;
  ag: number;
  pens?: [number, number];
  extraTime?: boolean;
  /** placar ao fim dos 90 minutos (quando houve prorrogação) */
  reg?: [number, number];
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

export type Outcome = 'campeao' | 'acesso' | 'acesso_playoff' | 'barrado_estadio' | 'fica' | 'queda' | 'falencia';

export interface FinanceReport {
  tickets: number;
  tv: number;
  sponsors: number;
  wages: number;
  staff: number;
  upkeep: number;
  /** comércio local (bar, loja...) */
  commerce: number;
  /** premiações de copa e bônus de objetivos */
  prizes: number;
  net: number;
  cashEnd: number;
  attendance: number;
}

export interface SeasonResult {
  season: number;
  year: number;
  tier: Tier;
  position: number;
  points: number;
  deduction: number;
  outcome: Outcome;
  nextTier: Tier;
  stadiumRequired?: number;
  playoff?: PlayoffResult;
  table: TableRow[];
  clubNames: Record<string, string>;
  playerMatches: MatchResult[];
  topScorer: { name: string; goals: number } | null;
  finance: FinanceReport;
  /** força do time titular na temporada */
  strength: number;
  headlines: string[];
  /** saídas e chegadas automáticas (aposentadoria, contrato) */
  departures: string[];
  /** renovações automáticas feitas no fim da temporada */
  renewals: string[];
  cups: CupRun[];
  objectives: Objective[];
  moments: LiveMoment[];
  derby: { w: number; d: number; l: number } | null;
  /** torcedômetro no fim da temporada e variação */
  mood: number;
  moodDelta: number;
  /** contratações feitas na janela */
  signings: number;
  /** crias da base no time titular */
  homegrownXI: number;
  /** competições de liga do jogador na temporada (estadual e nacional) */
  comps: CompResult[];
  /** notícias do mundo da bola */
  worldNews: string[];
}

/* ------------------------------ Estado ------------------------------ */

export type Phase = 'office' | 'summary' | 'over';

export interface Foundation {
  name: string;
  colors: [string, string];
  origin: Origin;
}

export interface SeasonOffice {
  market: (Listing | null)[];
  /** propostas recebidas (null = já aceita) */
  offers: (Offer | null)[];
  /** candidatos da peneira (null = já contratado) */
  tryout: (Footballer | null)[] | null;
  opportunities: { opp: Opportunity; taken: boolean }[];
  event: GameEvent | null;
  eventChoice: 0 | 1 | null;
  /** ações de obra/estrutura já feitas nesta temporada */
  built: { seats: boolean; facility: boolean; loan: boolean; business: boolean };
  coaches: (Coach | null)[];
  objectives: Objective[];
  /** contratações e vendas de crias da base nesta janela (torcida e conquistas) */
  signings: number;
  soldHomegrown: number;
}

export interface GameState {
  version: 3;
  seed: number;
  foundation: Foundation;
  season: number;
  /** todas as ações feitas, na ordem (replay e URL) */
  actions: Action[];
  phase: Phase;
  player: PlayerClub;
  /** todos os clubes da IA (nacionais, do estado e de outros estados) */
  clubs: Club[];
  office: SeasonOffice;
  seenOnce: string[];
  history: SeasonResult[];
  news: string[];
  over: null | 'falencia' | 'fim';
  serial: number;
}

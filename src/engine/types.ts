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
  /** elenco do clube (a força é o time titular dele) */
  squad: Footballer[];
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
  /** intenção para o fim da temporada (decidida na abertura da janela, visível para o presidente) */
  intent?: ContractIntent;
  /** salário combinado para a renovação (fixado na abertura da janela; não muda se ele evoluir até o fim) */
  askWage?: number;
  /** destaque num campeonato da base (ex.: "Artilheiro da Copinha 2028") */
  highlight?: string;
  /** temporada em que o garoto da base pediu para subir ao profissional */
  askUp?: number;
}

/** Um jogo do time de base do jogador. */
export interface YouthGame {
  round: string;
  opponent: string;
  gf: number;
  ga: number;
  pens?: [number, number];
}

/** Campanha num campeonato da base. */
export interface YouthComp {
  key: string;
  name: string;
  finish: string;
  champion: string;
  won: boolean;
  games: YouthGame[];
  scorers: { id: number; name: string; goals: number }[];
  /** força do time da base na competição */
  strength: number;
}

/**
 * renova: aceita renovar pelo salário de mercado · aumento: renova, mas pede aumento grande ·
 * sai: não quer renovar · clube_maior: cresceu demais e vai para um clube maior · aposenta: pendura as chuteiras.
 */
export type ContractIntent = 'renova' | 'aumento' | 'sai' | 'clube_maior' | 'aposenta';

export type NegotiationStatus = 'aceita' | 'recusada' | 'contra_clube' | 'contra_jogador' | 'encerrada';

/** Negociação por um jogador de outro clube nesta janela. */
export interface Negotiation {
  clubId: string;
  playerId: number;
  rounds: number;
  status: NegotiationStatus;
  /** contraproposta do clube (taxa) ou do jogador (salário anual) */
  askFee?: number;
  askWage?: number;
  /** últimos valores oferecidos */
  fee: number;
  wage: number;
  years: number;
  message: string;
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
  /** quanto o clube aceita pagar no máximo (escondido; a negociação revela) */
  max?: number;
  /** o clube já fez a última oferta */
  final?: boolean;
  /** resposta do clube na negociação */
  message?: string;
}

/* ------------------------------ Clube do jogador ------------------------------ */

export type Facility = 'ct' | 'academy' | 'medical';
export type StaffRole = 'scout' | 'fitness';
export type CoachStyle = 'ofensivo' | 'retranqueiro' | 'formador' | 'motivador' | 'estrategista';

/** Estratégia de jogo (o técnico troca quando quiser). */
export type Tactic = 'equilibrado' | 'ofensivo' | 'retranqueiro' | 'contra_ataque' | 'pressao';
export type BusinessId = 'bar' | 'loja' | 'escolinha' | 'estacionamento' | 'foodtruck';
export type DelegateArea = 'contratos' | 'base' | 'mercado' | 'estadio';

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-5-1';

export interface Coach {
  name: string;
  style: CoachStyle;
  /** 0–4 (1 a 5 estrelas) */
  rating: number;
  /** salário anual (R$ mil) */
  wage: number;
  age: number;
  /** esquema tático preferido: define o time titular */
  formation: Formation;
  /** temporadas restantes de contrato (contando a atual) */
  contract: number;
  /** 0–100: moral com a diretoria; atender pedidos sobe, ignorar desce */
  morale: number;
}

export type CoachRequestKind = 'contratar' | 'nao_vender' | 'promover' | 'estrutura';

/** Pedido do técnico para a janela (avaliado ao jogar a temporada). */
export interface CoachRequest {
  kind: CoachRequestKind;
  text: string;
  pos?: Position;
  minOvr?: number;
  playerId?: number;
  /** nível de CT pedido */
  level?: number;
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
  /** dia do calendário (o jogo é mostrado quando a temporada chega nele) */
  day?: number;
  kind: 'playoff' | 'ultima_rodada' | 'zebra' | 'final_copa' | 'final_cc' | 'final_le' | 'mundial' | 'classico' | 'final_estadual' | 'final_estado' | 'jogo';
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
  /** vaga na Copa do Brasil desta temporada (campeão da Copa do Estado do ano anterior) */
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
  /** escalação escolhida (null/ausente = o técnico escolhe os melhores) */
  lineup?: { ids: number[] | null; rotate: boolean };
  /** estratégia de jogo (modo técnico; ausente = a do estilo do técnico) */
  tactic?: Tactic;
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
  | { t: 'renew'; id: number } // renova agora (ou tenta convencer quem quer sair)
  | { t: 'bid'; club: string; player: number; fee: number; wage: number; years: number } // proposta por jogador de outro clube
  | { t: 'offer'; idx: number } // aceita a proposta idx
  | { t: 'lend'; id: number } // empresta um jovem por uma temporada
  | { t: 'promote'; id: number } // base → profissional
  | { t: 'cut'; id: number } // dispensa da base
  | { t: 'tryout' } // faz a peneira
  | { t: 'sign'; idx: number } // contrata candidato idx da peneira
  | { t: 'seats'; size: 0 | 1 | 2; financed?: boolean }
  | { t: 'facility'; which: Facility }
  | { t: 'staff'; which: StaffRole; dir: 1 | -1 }
  | { t: 'coach'; idx: number } // contrata o candidato idx a técnico
  | { t: 'formation'; f: Formation } // pede ao técnico outro esquema (custa moral)
  | { t: 'business'; which: BusinessId }
  | { t: 'delegate'; area: DelegateArea }
  | { t: 'ticket'; level: TicketPolicy }
  | { t: 'loan'; size: 0 | 1 }
  | { t: 'opp'; idx: number } // aceita a oportunidade idx
  | { t: 'event'; choice: 0 | 1 }
  | { t: 'auto' } // assistente faz a gestão da temporada
  | { t: 'play' } // simula a temporada
  | { t: 'advance'; to: AdvanceTo } // mostra a temporada até o próximo jogo, semana, mês ou fim
  | { t: 'job'; idx: number } // técnico: aceita uma proposta de emprego
  | { t: 'lineup'; ids: number[] | null; rotate: boolean } // técnico: escalação (null = os melhores)
  | { t: 'interview'; day: number; q: number; a: number } // entrevista pós-jogo ou coletiva (dia do jogo, pergunta, resposta)
  | { t: 'tactic'; v: Tactic } // técnico: estratégia de jogo
  | { t: 'counter'; idx: number; fee: number } // pede mais por um jogador seu (proposta idx)
  | { t: 'reject'; idx: number } // recusa a proposta idx
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
  /** empate no confronto: classificou o de melhor campanha */
  advantage?: boolean;
  /** dia do ano em que o jogo acontece (calendário) */
  day?: number;
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
  /** prêmios da temporada (gerais e de cada liga) */
  awards?: SeasonAwards;
  /** campeonatos da base */
  youth?: YouthComp[];
  /** clube do jogador nesta temporada (no modo técnico ele muda) */
  club?: { name: string; colors: [string, string] };
  /** modo técnico: como terminou a temporada para o técnico */
  coachNews?: string[];
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
  /** técnico: pedido da janela, se foi atendido, moral no fim e se saiu */
  coachReport: { name: string; request: CoachRequest | null; met: boolean | null; morale: number; moraleDelta: number; left: string | null };
  /** notícias do mundo da bola */
  worldNews: string[];
}

/* ------------------------------ Estado ------------------------------ */

export type Phase = 'office' | 'season' | 'summary' | 'over';

export type GameMode = 'presidente' | 'tecnico';

export interface Foundation {
  /** presidente: nome do clube; técnico: nome do técnico */
  name: string;
  colors: [string, string];
  origin: Origin;
  /** modo de jogo (padrão: presidente) */
  mode?: GameMode;
  /** técnico: estilo de jogo */
  style?: CoachStyle;
}

/** Personalidade da diretoria (modo técnico). */
export type BoardPersonality = 'paciente' | 'imediatista' | 'mao_de_vaca';

export interface Board {
  personality: BoardPersonality;
  /** 0–100: confiança no técnico; zerou, demissão */
  confidence: number;
  /** verba para contratações nesta janela (R$ mil) */
  budget: number;
  /** teto da folha salarial anual (R$ mil) */
  wageCap: number;
}

/** Proposta de emprego para o técnico. */
export interface JobOffer {
  clubId: string;
  club: string;
  tier: Tier;
  personality: BoardPersonality;
  /** temporadas de contrato */
  contract: number;
  /** o que a diretoria espera */
  pitch: string;
}

export interface CareerStint {
  club: string;
  colors: [string, string];
  from: number;
  /** última temporada no clube (null = atual) */
  to: number | null;
  tier: Tier;
  /** por que saiu */
  exit?: 'demitido' | 'proposta' | 'contrato';
}

/** Carreira do técnico (modo técnico). */
export interface CoachCareer {
  name: string;
  age: number;
  /** 0–100: decide quem te quer e as estrelas do técnico */
  reputation: number;
  board: Board;
  /** temporadas restantes de contrato com o clube atual */
  contract: number;
  /** sem clube: precisa aceitar uma proposta antes de jogar */
  unemployed: boolean;
  offers: JobOffer[];
  stints: CareerStint[];
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
  negotiations: Negotiation[];
  /** pedido do técnico nesta janela */
  request: CoachRequest | null;
  /** ids no elenco quando a janela abriu (para o pedido "não venda") */
  formationChanged: boolean;
  objectives: Objective[];
  /** contratações e vendas de crias da base nesta janela (torcida e conquistas) */
  signings: number;
  soldHomegrown: number;
}

/** Escalação escolhida a partir de um dia (vale para os jogos depois dele). */
export interface LineupEntry {
  day: number;
  /** titulares escolhidos (null = o técnico escolhe os melhores) */
  ids: number[] | null;
  /** rodízio: poupa quem está muito cansado */
  rotate: boolean;
  formation: Formation;
  /** estratégia de jogo valendo a partir deste dia */
  tactic?: Tactic;
}

/** Mudança no elenco durante a temporada (janela do meio do ano). */
export interface RosterChange {
  day: number;
  add?: Footballer[];
  remove?: number[];
}

/** Temporada em andamento: a foto do começo e as decisões tomadas no meio dela. */
export interface LiveSeason {
  startSquad: Footballer[];
  changes: RosterChange[];
  lineups: LineupEntry[];
  /** prévia: jogos ao vivo, lesões e cansaço (recalculados a cada decisão) */
  moments: LiveMoment[];
  injuries: { id: number; name: string; from: number; to: number }[];
  fatigue: { day: number; fatigue: Record<number, number> }[];
  /** escalação de cada jogo do clube (ids dos titulares) */
  elevens: { day: number; ids: number[] }[];
  /** respostas em entrevistas e coletivas (os efeitos entram no fim da temporada) */
  interviews?: { day: number; kind: 'pos' | 'coletiva'; q: number; a: number; quote: string; effect: { mood?: number; board?: number; rep?: number; morale?: number } }[];
}

/** 0 = próximo jogo, 1 = uma semana, 2 = até o fim do mês, 3 = até o fim da temporada */
export type AdvanceTo = 0 | 1 | 2 | 3;

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
  /** calendário da última temporada simulada (só a atual; não vai para o histórico) */
  calendar?: SeasonCalendar | null;
  /** até que dia do calendário a temporada já foi mostrada (null = já terminou de mostrar) */
  reveal?: number | null;
  /** modo técnico: carreira do técnico (ausente no modo presidente) */
  career?: CoachCareer;
  /** temporada em andamento (entre "jogar" e o fim do calendário) */
  live?: LiveSeason | null;
  /** ranking de técnicos: pontos das últimas temporadas por clube (técnico da IA) e "me" (o jogador, modo técnico) */
  coachPoints?: Record<string, number[]>;
}

/** Um nome numa premiação (jogador ou técnico). */
export interface AwardEntry {
  name: string;
  club: string;
  /** é do clube do jogador? */
  mine: boolean;
  pos?: Position;
  age?: number;
  detail: string;
}

export interface AwardItem {
  id: 'craque' | 'artilheiro' | 'tecnico' | 'revelacao' | 'bola' | 'chuteira' | 'tecnico_ano' | 'revelacao_ano';
  title: string;
  winner: AwardEntry;
  /** os 3 finalistas (o vencedor primeiro) */
  finalists: AwardEntry[];
}

export interface AwardSet {
  /** "Temporada" (gerais) ou o nome da liga */
  scope: string;
  compId?: CompId;
  items: AwardItem[];
  /** seleção (time da temporada / do campeonato), 4-3-3 */
  team?: AwardEntry[];
}

export interface SeasonAwards {
  general: AwardSet;
  leagues: AwardSet[];
}

/** Fase de pontos de uma competição do jogador, com todos os jogos (para as tabelas parciais). */
export interface CalendarStage {
  comp: CompId;
  compName: string;
  name: string;
  ids: string[];
  deductions: Record<string, number>;
  /** [dia, índice do mandante, índice do visitante, gols do mandante, gols do visitante] (índices em `ids`) */
  matches: [number, number, number, number, number][];
}

/** Um jogo do clube do jogador no calendário. */
export interface CalendarMatch {
  day: number;
  comp: string;
  round: string;
  opponent: string;
  opponentTier: Tier | null;
  home: boolean;
  gf: number;
  ga: number;
  pens?: [number, number];
  extraTime?: boolean;
  advantage?: boolean;
  /** mata-mata: passou de fase? (null = não decide) */
  advanced: boolean | null;
}

export interface SeasonCalendar {
  season: number;
  year: number;
  /** primeiro e último dia da temporada */
  start: number;
  end: number;
  stages: CalendarStage[];
  /** jogos do jogador em ordem de data */
  matches: CalendarMatch[];
  clubNames: Record<string, string>;
}

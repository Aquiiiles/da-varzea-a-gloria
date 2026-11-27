import { traitsOf } from './traits';
import { REF_INFO, refereeFor } from './matchday';
import { matchStamina } from './stamina';
import { personName } from './footballers';
import { createRng, deriveRng, hashSeed, type Rng } from './rng';
import type { CalendarMatch, Footballer, GameState, LiveEvent, LiveMoment, MatchResult } from './types';

const GOAL = [
  'GOOOL! {p} manda para o fundo da rede!',
  'É GOL! {p} aparece livre e não perdoa!',
  'GOLAÇO! {p} acerta um chute de fora da área!',
  'GOL! {p} de cabeça, depois do escanteio!',
  'Tá lá dentro! {p} completa o cruzamento!',
  'GOL! {p} dribla o goleiro e empurra!',
];
const CHANCE = [
  '{t} quase marca: a bola raspa a trave!',
  'Que chance! O atacante do {t} isolou sozinho na cara do gol.',
  'Bola no travessão! O {t} assusta.',
  '{t} pressiona e a zaga tira em cima da linha!',
];
const SAVE = ['Defesaça do goleiro do {t}!', 'O goleiro do {t} voa e espalma para escanteio!', 'Milagre! O goleiro do {t} salva no reflexo.'];
const RED = ['Vermelho! {p} é expulso depois de uma entrada dura.', 'Cartão vermelho direto para {p}!'];
const CARD = ['Cartão amarelo para {p}, que chegou atrasado.', 'Jogo pegado: {p} leva amarelo.', 'O árbitro mostra o amarelo para {p}.'];

function fill(tpl: string, p: string, t: string): string {
  return tpl.replace('{p}', p).replace('{t}', t);
}

const SCORE_WEIGHT = { GOL: 0, DEF: 0.5, MEI: 2, ATA: 5 };
/** Peso de cada um para ser o autor do gol (finalizador e cabeceador fazem mais). */
const scoreWeight = (f: Footballer) => {
  const t = traitsOf(f);
  return SCORE_WEIGHT[f.pos] * Math.pow(1.06, f.ovr - 50) * (t.includes('finalizacao') ? 1.6 : 1) * (t.includes('cabeceio') ? 1.2 : 1);
};

/**
 * Lances de um jogo já simulado: o placar é o do motor; a narração só distribui os gols no tempo,
 * escolhe os autores (seu elenco tem nome; o adversário ganha nomes fictícios) e acrescenta lances de efeito.
 */
export function narrate(
  rng0: Rng,
  r: MatchResult,
  playerHome: boolean,
  homeName: string,
  awayName: string,
  squad: readonly Footballer[],
  oppSquad: readonly Footballer[] = [],
  cards?: Incident[],
  fieldAt?: (block: number) => Footballer[],
  extras?: NarrationExtras,
): LiveEvent[] {
  if (r.blocks) return narrateBlocks(rng0, r, playerHome, homeName, awayName, squad, oppSquad, cards ?? [], fieldAt, extras);
  const rng = rng0;
  const events: Omit<LiveEvent, 'score'>[] = [];
  const reg = r.reg ?? [r.hg, r.ag];
  const myName = (): string => (squad.length > 0 ? rng.weighted(squad, (f) => SCORE_WEIGHT[f.pos] * Math.pow(1.06, f.ovr - 50)).name : 'o camisa 9');
  const oppNames = [personName(rng), personName(rng), personName(rng)];
  const oppName = () => (oppSquad.length > 0 ? rng.weighted(oppSquad, (f) => SCORE_WEIGHT[f.pos] * Math.pow(1.06, f.ovr - 50)).name : rng.pick(oppNames));

  const goals = (h: number, a: number, from: number, to: number) => {
    const sides = rng.shuffle([...Array(h).fill('h'), ...Array(a).fill('a')] as ('h' | 'a')[]);
    const minutes = sides.map(() => rng.int(from, to)).sort((x, y) => x - y);
    sides.forEach((side, i) => {
      const mine = (side === 'h') === playerHome;
      events.push({ minute: minutes[i], kind: 'gol', mine, text: fill(rng.pick(GOAL), mine ? myName() : oppName(), '') });
    });
  };
  goals(reg[0], reg[1], 2, 90);
  if (r.extraTime) goals(r.hg - reg[0], r.ag - reg[1], 92, 120);

  // lances de efeito para o jogo respirar
  const extra = rng.int(4, 7);
  for (let i = 0; i < extra; i++) {
    const mine = rng.chance(0.5);
    const team = mine === playerHome ? homeName : awayName;
    const other = mine === playerHome ? awayName : homeName;
    const kind = rng.pick(['chance', 'chance', 'defesa', 'cartao'] as const);
    const text = kind === 'chance' ? fill(rng.pick(CHANCE), '', team) : kind === 'defesa' ? fill(rng.pick(SAVE), '', other) : fill(rng.pick(CARD), mine ? myName() : oppName(), team);
    events.push({ minute: rng.int(3, r.extraTime ? 118 : 89), kind, mine, text });
  }
  events.push({ minute: 0, kind: 'apito', mine: false, text: 'Rola a bola!' });
  if (r.extraTime) events.push({ minute: 90, kind: 'apito', mine: false, text: 'Fim do tempo normal. Vamos para a prorrogação!' });
  events.sort((a, b) => a.minute - b.minute || (a.kind === 'apito' ? -1 : 1));

  // placar acumulado
  let h = 0;
  let a = 0;
  const out: LiveEvent[] = events.map((e) => {
    if (e.kind === 'gol') {
      if (e.mine === playerHome) h++;
      else a++;
    }
    return { ...e, score: [h, a] as [number, number] };
  });
  const end = r.extraTime ? 120 : 90;
  if (r.pens) {
    const myPens = playerHome ? r.pens[0] : r.pens[1];
    const theirPens = playerHome ? r.pens[1] : r.pens[0];
    out.push({ minute: end, kind: 'apito', mine: false, text: 'Empate na prorrogação. Decisão nos pênaltis!', score: [h, a] });
    out.push({
      minute: end,
      kind: 'penaltis',
      mine: myPens > theirPens,
      text: myPens > theirPens ? `CLASSIFICADO NOS PÊNALTIS! ${myPens} a ${theirPens}!` : `Eliminado nos pênaltis: ${myPens} a ${theirPens}.`,
      score: [h, a],
    });
  } else {
    out.push({ minute: end, kind: 'apito', mine: false, text: 'Fim de jogo!', score: [h, a] });
  }
  return out;
}


export interface Incident {
  name: string;
  kind: 'amarelo' | 'vermelho' | 'lesao';
  minute?: number;
}

const INJURY = ['{p} sente a coxa e pede para sair.', '{p} cai machucado e não volta.', 'Preocupação: {p} sai de maca.'];

/**
 * Narração em blocos de 5 minutos (jogos do técnico): cada bloco tem o próprio sorteio,
 * então mexer no time num minuto não muda nada do que já foi narrado antes.
 */
function narrateBlocks(
  rng0: Rng,
  r: MatchResult,
  playerHome: boolean,
  homeName: string,
  awayName: string,
  squad: readonly Footballer[],
  oppSquad: readonly Footballer[],
  incidents: Incident[],
  fieldAt?: (block: number) => Footballer[],
  extras?: NarrationExtras,
): LiveEvent[] {
  const base = rng0.int(1, 2 ** 30);
  const etSeed = rng0.int(1, 2 ** 30);
  const oppFallback = personName(createRng(rng0.int(1, 2 ** 30)));
  const pick = (rng: Rng, list: readonly Footballer[], fallback: string) =>
    list.length > 0 ? rng.weighted(list, (f) => SCORE_WEIGHT[f.pos] * Math.pow(1.06, f.ovr - 50)).name : fallback;
  const events: Omit<LiveEvent, 'score'>[] = [];
  const blocks = r.blocks!;
  blocks.forEach(([h, a], b) => {
    const rng = createRng((base + b * 7919) >>> 0);
    const from = b * 5 + 1;
    const to = b * 5 + 5;
    const sides = rng.shuffle([...Array(h).fill('h'), ...Array(a).fill('a')] as ('h' | 'a')[]);
    for (const side of sides) {
      const mine = (side === 'h') === playerHome;
      const minute = rng.int(from, to);
      if (mine) {
        // o autor sai de quem estava em campo no bloco
        const field = fieldAt?.(b) ?? [];
        const list = field.length > 0 ? field : squad;
        const who = list.length > 0 ? rng.weighted(list, scoreWeight) : null;
        events.push({ minute, kind: 'gol', mine, text: fill(rng.pick(GOAL), who?.name ?? 'o camisa 9', ''), ...(who && field.length > 0 ? { who: who.id } : {}) });
      } else events.push({ minute, kind: 'gol', mine, text: fill(rng.pick(GOAL), pick(rng, oppSquad, oppFallback), '') });
    }
    // lances de efeito e cartões do adversário
    const rt = r.rates?.[b];
    const homeShare = rt && rt[0] + rt[1] > 0 ? rt[0] / (rt[0] + rt[1]) : 0.5;
    if (rng.chance(0.28)) {
      const mine = rng.chance(playerHome ? homeShare : 1 - homeShare);
      const team = mine === playerHome ? homeName : awayName;
      const other = mine === playerHome ? awayName : homeName;
      const kind = rng.pick(['chance', 'chance', 'defesa'] as const);
      events.push({ minute: rng.int(from, Math.min(to, 89)), kind, mine, text: kind === 'chance' ? fill(rng.pick(CHANCE), '', team) : fill(rng.pick(SAVE), '', other) });
    }
    if (rng.chance(0.05)) events.push({ minute: rng.int(from, Math.min(to, 89)), kind: 'cartao', mine: false, text: fill(rng.pick(CARD), pick(rng, oppSquad, oppFallback), '') });
  });
  // prorrogação
  if (r.extraTime) {
    const reg = r.reg ?? [r.hg, r.ag];
    const rng = createRng(etSeed);
    const sides = rng.shuffle([...Array(r.hg - reg[0]).fill('h'), ...Array(r.ag - reg[1]).fill('a')] as ('h' | 'a')[]);
    for (const side of sides) {
      const mine = (side === 'h') === playerHome;
      events.push({ minute: rng.int(92, 120), kind: 'gol', mine, text: fill(rng.pick(GOAL), mine ? pick(rng, squad, 'o camisa 9') : pick(rng, oppSquad, oppFallback), '') });
    }
  }
  // o que aconteceu de verdade com o seu time (conta para suspensão e muda o jogo)
  for (const c of incidents) {
    const rng = createRng((base ^ (c.minute ?? 0) * 104729) >>> 0);
    const minute = c.minute ?? rng.int(5, 88);
    const text = c.kind === 'lesao' ? fill(rng.pick(INJURY), c.name, '') : c.kind === 'vermelho' ? fill(rng.pick(RED), c.name, '') : fill(rng.pick(CARD), c.name, '');
    events.push({ minute, kind: c.kind === 'lesao' ? 'lesao' : 'cartao', mine: true, text, ...(c.kind === 'amarelo' ? {} : { alert: true }) });
  }
  // clima: árbitro, clássico e torcida (sorteio próprio; não mexe no resto da narração)
  if (extras?.referee) events.push({ minute: 0, kind: 'apito', mine: false, text: `Apita ${extras.referee}.` });
  if (extras?.derbyHeat !== undefined) {
    const t = extras.derbyHeat;
    events.push({ minute: 1, kind: 'chance', mine: false, text: t >= 70 ? 'Clássico pegando fogo: provocação nas arquibancadas e entradas duras desde o começo.' : t >= 40 ? 'Clima de clássico: estádio cheio e muita rivalidade.' : 'Começa o clássico, com respeito dos dois lados.' });
  }
  if (extras?.crowd && playerHome) {
    let h = 0;
    let a = 0;
    for (let b = 0; b < blocks.length; b++) {
      const behind = h < a;
      if (behind) {
        const minute = b * 5 + 1 + (base % 4);
        events.push({ minute, kind: 'chance', mine: extras.crowd === 'empurra', text: extras.crowd === 'empurra' ? 'A torcida canta mais alto e empurra o time para frente!' : 'Vaias na arquibancada. O time sente a pressão.' });
        break;
      }
      h += blocks[b][0];
      a += blocks[b][1];
    }
  }
  events.push({ minute: 0, kind: 'apito', mine: false, text: 'Rola a bola!' });
  events.push({ minute: 45, kind: 'apito', mine: false, text: 'Fim do primeiro tempo.' });
  if (r.extraTime) events.push({ minute: 90, kind: 'apito', mine: false, text: 'Fim do tempo normal. Vamos para a prorrogação!' });
  events.sort((a, b) => a.minute - b.minute || (a.kind === 'apito' ? (a.minute === 45 ? 1 : -1) : b.kind === 'apito' ? (b.minute === 45 ? -1 : 1) : 0));
  return finish(events, r, playerHome, extras);
}

/** Placar acumulado, apito final e pênaltis. */
function finish(events: Omit<LiveEvent, 'score'>[], r: MatchResult, playerHome: boolean, extras?: NarrationExtras): LiveEvent[] {
  let h = 0;
  let a = 0;
  const out: LiveEvent[] = events.map((e) => {
    if (e.kind === 'gol') {
      if (e.mine === playerHome) h++;
      else a++;
    }
    return { ...e, score: [h, a] as [number, number] };
  });
  const end = r.extraTime ? 120 : 90;
  if (r.pens) {
    const myPens = playerHome ? r.pens[0] : r.pens[1];
    const theirPens = playerHome ? r.pens[1] : r.pens[0];
    let shown: [number, number] | null = null;
    out.push({ minute: end, kind: 'apito', mine: false, text: 'Empate na prorrogação. Decisão nos pênaltis!', score: [h, a] });
    // cobrança por cobrança (jogos do técnico): para quando um lado não alcança mais
    if (r.kicks) {
      const [hk, ak] = r.kicks;
      const mineK = playerHome ? hk : ak;
      const theirK = playerHome ? ak : hk;
      const myNames = extras?.kickers ?? [];
      const oppNames = extras?.oppKickers ?? [];
      let m = 0;
      let t = 0;
      let k = 0;
      let done = false;
      for (let i = 0; i < mineK.length && !done; i++) {
        for (const side of [0, 1] as const) {
          const hit = side === 0 ? mineK[i] : theirK[i];
          const list = side === 0 ? myNames : oppNames;
          const name = list.length > 0 ? list[i % list.length] : side === 0 ? 'o batedor' : 'o batedor deles';
          if (hit) side === 0 ? m++ : t++;
          out.push({ minute: end, kind: 'penaltis', mine: side === 0, kick: k++, text: hit ? `${name} bate e marca! (${m} x ${t})` : `${side === 0 ? `${name} perde!` : `${name} para no goleiro!`} (${m} x ${t})`, score: [h, a] });
          if (i < 5) {
            // quem está atrás ainda alcança com as cobranças que restam?
            const remM = 4 - i;
            const remT = side === 0 ? 5 - i : 4 - i;
            if (m > t + remT || t > m + remM) {
              done = true;
              break;
            }
          } else if (side === 1 && m !== t) done = true;
        }
      }
      // placar da disputa como foi narrado (o motor bate as 5 de qualquer jeito)
      shown = [m, t];
    }
    const [fm, ft] = shown ?? [myPens, theirPens];
    out.push({
      minute: end,
      kind: 'penaltis',
      mine: myPens > theirPens,
      text: myPens > theirPens ? `CLASSIFICADO NOS PÊNALTIS! ${fm} a ${ft}!` : `Eliminado nos pênaltis: ${fm} a ${ft}.`,
      score: [h, a],
    });
  } else {
    out.push({ minute: end, kind: 'apito', mine: false, text: 'Fim de jogo!', score: [h, a] });
  }
  return out;
}

export function moment(
  rng: Rng,
  kind: LiveMoment['kind'],
  title: string,
  stake: string,
  r: MatchResult,
  playerId: string,
  name: (id: string) => string,
  squad: readonly Footballer[],
  oppSquad: (id: string) => readonly Footballer[] = () => [],
  cards?: Incident[],
  fieldAt?: (block: number) => Footballer[],
  extras?: NarrationExtras,
): LiveMoment {
  const playerHome = r.home === playerId;
  const homeName = name(r.home);
  const awayName = name(r.away);
  const opp = playerHome ? r.away : r.home;
  return { kind, title, stake, homeName, awayName, playerHome, result: r, events: narrate(rng, r, playerHome, homeName, awayName, squad, oppSquad(opp), cards, fieldAt, extras) };
}

/**
 * Narração rápida de um jogo do calendário (ao avançar jogo a jogo). Usa o placar já simulado;
 * o sorteio da narração é próprio do dia, então rever o mesmo jogo conta a mesma história.
 */
export function quickMoment(state: GameState, m: CalendarMatch): LiveMoment {
  const p = state.player;
  const opp = `adv:${m.opponent}`;
  const home = m.home ? 'player' : opp;
  const away = m.home ? opp : 'player';
  const r: MatchResult = { home, away, hg: m.home ? m.gf : m.ga, ag: m.home ? m.ga : m.gf };
  if (m.pens) r.pens = m.home ? m.pens : [m.pens[1], m.pens[0]];
  if (m.extraTime) r.extraTime = true;
  if (m.advanced !== null) r.winner = m.advanced ? 'player' : opp;
  if (m.half) r.half = m.home ? m.half : [m.half[1], m.half[0]];
  if (m.blocks) r.blocks = m.home ? m.blocks : m.blocks.map(([x, y]) => [y, x] as [number, number]);
  if (m.rates) r.rates = m.home ? m.rates : m.rates.map(([x, y]) => [y, x] as [number, number]);
  const club = state.clubs.find((c) => c.name === m.opponent);
  const name = (id: string) => (id === 'player' ? p.name : m.opponent);
  const cards: Incident[] = [
    ...(state.live?.cards ?? []).filter((c) => c.day === m.day),
    ...(state.live?.injuries ?? []).filter((i) => i.from === m.day).map((i) => ({ name: i.name, kind: 'lesao' as const, minute: i.minute })),
  ];
  const tl = matchStamina(state, m.day);
  const byId = new Map(p.squad.map((f) => [f.id, f]));
  const fieldAt = tl ? (b: number) => [...(tl[b]?.keys() ?? [])].map((id) => byId.get(id)).filter((f): f is Footballer => !!f) : undefined;
  if (m.kicks) r.kicks = m.home ? m.kicks : [m.kicks[1], m.kicks[0]];
  const extras: NarrationExtras | undefined = state.career
    ? (() => {
        const ref = refereeFor(state.seed, state.season, m.day);
        const derby = club?.id === p.rivalId;
        const last = (f: { name: string }) => f.name.split(' ').slice(-1)[0];
        return {
          referee: `${ref.name}${ref.profile !== 'normal' ? ` (${REF_INFO[ref.profile].label.toLowerCase()})` : ''}`,
          ...(derby ? { derbyHeat: p.rivalHatred } : {}),
          crowd: m.home ? (p.mood >= 60 ? 'empurra' : p.mood < 30 ? 'vaia' : null) : null,
          kickers: (m.kickers ?? []).map((id) => byId.get(id)).filter((f): f is Footballer => !!f).map(last),
          oppKickers: (club?.squad ?? []).filter((f) => f.pos !== 'GOL').sort((x, y) => y.ovr - x.ovr).map(last),
        };
      })()
    : undefined;
  const mo = moment(deriveRng(state.seed, state.season, 'narra', m.day), 'jogo', `${m.comp} · ${m.round}`, m.home ? 'Em casa.' : 'Fora de casa.', r, 'player', name, p.squad, () => club?.squad ?? [], cards, fieldAt, extras);
  mo.day = m.day;
  return mo;
}

/** Números de um bloco de 5 minutos, do ponto de vista do jogador. */
export interface BlockStat {
  /** posse de bola do seu time (%) */
  poss: number;
  /** finalizações [suas, deles] */
  shots: [number, number];
  /** chutes no gol [seus, deles] */
  onTarget: [number, number];
  /** pressão: sua fatia do volume de jogo (0 a 1), só pela força em campo */
  press: number;
  /** domínio no bloco (0 a 1): a pressão misturada com as finalizações que saíram */
  flow: number;
}

/**
 * Estatísticas por bloco, derivadas das médias de gol que o motor usou (e dos gols que saíram).
 * Cada bloco tem o próprio sorteio: mexer aos 60' não muda o que já aconteceu antes.
 */
export function blockStats(r: MatchResult, playerHome: boolean, seed: number): BlockStat[] | null {
  if (!r.blocks || !r.rates) return null;
  return r.rates.map((rt, b) => {
    const rng = createRng(hashSeed(seed, 'stats', b));
    const [gm, go] = playerHome ? r.blocks![b] : [r.blocks![b][1], r.blocks![b][0]];
    const [m, o] = playerHome ? rt : [rt[1], rt[0]];
    const press = m + o > 0 ? m / (m + o) : 0.5;
    const poss = Math.max(30, Math.min(70, Math.round(50 + (press - 0.5) * 55 + rng.int(-3, 3))));
    const extra = (rate: number) => rng.poisson((rate * 8) / 18);
    const sm = gm + extra(m);
    const so = go + extra(o);
    const target = (goals: number, shots: number) => {
      let t = goals;
      for (let i = goals; i < shots; i++) if (rng.chance(0.3)) t++;
      return t;
    };
    const shotShare = sm + so > 0 ? sm / (sm + so) : press;
    const flow = Math.round((press * 0.5 + shotShare * 0.5) * 1000) / 1000;
    return { poss, shots: [sm, so], onTarget: [target(gm, sm), target(go, so)], press, flow };
  });
}

/** Clima do jogo para a narração (modo técnico). */
export interface NarrationExtras {
  referee?: string;
  /** tensão do clássico (0 a 100), só em clássico */
  derbyHeat?: number;
  /** em casa, perdendo: a torcida empurra ou vaia */
  crowd?: 'empurra' | 'vaia' | null;
  /** nomes dos seus batedores, na ordem */
  kickers?: string[];
  oppKickers?: string[];
}

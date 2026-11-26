import { personName } from './footballers';
import { createRng, deriveRng, type Rng } from './rng';
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
const CARD = ['Cartão amarelo para {p}, que chegou atrasado.', 'Jogo pegado: {p} leva amarelo.', 'O árbitro mostra o amarelo para {p}.'];

function fill(tpl: string, p: string, t: string): string {
  return tpl.replace('{p}', p).replace('{t}', t);
}

const SCORE_WEIGHT = { GOL: 0, DEF: 0.5, MEI: 2, ATA: 5 };

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
  cards?: { name: string; kind: 'amarelo' | 'vermelho' }[],
): LiveEvent[] {
  if (r.half) return narrateHalves(rng0, r, playerHome, homeName, awayName, squad, oppSquad, cards ?? []);
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

const RED = ['Vermelho! {p} é expulso depois de uma entrada dura.', 'Cartão vermelho direto para {p}!'];

/**
 * Narração em dois tempos (jogos com intervalo): o 1º tempo usa um sorteio e o 2º outro,
 * então mudar o 2º tempo (intervalo) não muda nada do que já foi narrado.
 */
function narrateHalves(
  rng0: Rng,
  r: MatchResult,
  playerHome: boolean,
  homeName: string,
  awayName: string,
  squad: readonly Footballer[],
  oppSquad: readonly Footballer[],
  cards: { name: string; kind: 'amarelo' | 'vermelho' }[],
): LiveEvent[] {
  const r1 = createRng(rng0.int(1, 2 ** 30));
  const r2 = createRng(rng0.int(1, 2 ** 30));
  const r3 = createRng(rng0.int(1, 2 ** 30));
  const pick = (rng: Rng, list: readonly Footballer[], fallback: string) =>
    list.length > 0 ? rng.weighted(list, (f) => SCORE_WEIGHT[f.pos] * Math.pow(1.06, f.ovr - 50)).name : fallback;
  const oppFallback = personName(createRng(rng0.int(1, 2 ** 30)));
  const events: Omit<LiveEvent, 'score'>[] = [];
  const reg = r.reg ?? [r.hg, r.ag];
  const half = r.half!;
  const goals = (rng: Rng, h: number, a: number, from: number, to: number) => {
    const sides = rng.shuffle([...Array(h).fill('h'), ...Array(a).fill('a')] as ('h' | 'a')[]);
    const minutes = sides.map(() => rng.int(from, to)).sort((x, y) => x - y);
    sides.forEach((side, i) => {
      const mine = (side === 'h') === playerHome;
      events.push({ minute: minutes[i], kind: 'gol', mine, text: fill(rng.pick(GOAL), mine ? pick(rng, squad, 'o camisa 9') : pick(rng, oppSquad, oppFallback), '') });
    });
  };
  const flavor = (rng: Rng, n: number, from: number, to: number) => {
    for (let i = 0; i < n; i++) {
      const mine = rng.chance(0.5);
      const team = mine === playerHome ? homeName : awayName;
      const other = mine === playerHome ? awayName : homeName;
      const kind = rng.pick(['chance', 'chance', 'defesa'] as const);
      events.push({ minute: rng.int(from, to), kind, mine, text: kind === 'chance' ? fill(rng.pick(CHANCE), '', team) : fill(rng.pick(SAVE), '', other) });
    }
  };
  // 1º tempo
  goals(r1, half[0], half[1], 2, 45);
  flavor(r1, r1.int(2, 4), 3, 44);
  // 2º tempo (e prorrogação)
  goals(r2, reg[0] - half[0], reg[1] - half[1], 46, 90);
  flavor(r2, r2.int(2, 4), 47, 89);
  if (r.extraTime) goals(r2, r.hg - reg[0], r.ag - reg[1], 92, 120);
  // cartões do seu time (os de verdade, que contam para suspensão) e alguns do adversário
  for (const c of cards) {
    const minute = r3.int(5, 88);
    events.push({ minute, kind: 'cartao', mine: true, text: fill(c.kind === 'vermelho' ? r3.pick(RED) : r3.pick(CARD), c.name, '') });
  }
  for (let i = r3.int(0, 2); i > 0; i--) events.push({ minute: r3.int(5, 88), kind: 'cartao', mine: false, text: fill(r3.pick(CARD), pick(r3, oppSquad, oppFallback), '') });
  events.push({ minute: 0, kind: 'apito', mine: false, text: 'Rola a bola!' });
  events.push({ minute: 45, kind: 'apito', mine: false, text: 'Fim do primeiro tempo.' });
  if (r.extraTime) events.push({ minute: 90, kind: 'apito', mine: false, text: 'Fim do tempo normal. Vamos para a prorrogação!' });
  events.sort((a, b) => a.minute - b.minute || (a.kind === 'apito' ? (a.minute === 45 ? 1 : -1) : b.kind === 'apito' ? (b.minute === 45 ? -1 : 1) : 0));
  return finish(events, r, playerHome);
}

/** Placar acumulado, apito final e pênaltis. */
function finish(events: Omit<LiveEvent, 'score'>[], r: MatchResult, playerHome: boolean): LiveEvent[] {
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
  cards?: { name: string; kind: 'amarelo' | 'vermelho' }[],
): LiveMoment {
  const playerHome = r.home === playerId;
  const homeName = name(r.home);
  const awayName = name(r.away);
  const opp = playerHome ? r.away : r.home;
  return { kind, title, stake, homeName, awayName, playerHome, result: r, events: narrate(rng, r, playerHome, homeName, awayName, squad, oppSquad(opp), cards) };
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
  const club = state.clubs.find((c) => c.name === m.opponent);
  const name = (id: string) => (id === 'player' ? p.name : m.opponent);
  const cards = (state.live?.cards ?? []).filter((c) => c.day === m.day);
  const mo = moment(deriveRng(state.seed, state.season, 'narra', m.day), 'jogo', `${m.comp} · ${m.round}`, m.home ? 'Em casa.' : 'Fora de casa.', r, 'player', name, p.squad, () => club?.squad ?? [], cards);
  mo.day = m.day;
  return mo;
}

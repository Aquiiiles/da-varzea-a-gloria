import { personName } from './footballers';
import type { Rng } from './rng';
import type { Footballer, LiveEvent, LiveMoment, MatchResult } from './types';

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
export function narrate(rng: Rng, r: MatchResult, playerHome: boolean, homeName: string, awayName: string, squad: readonly Footballer[], oppSquad: readonly Footballer[] = []): LiveEvent[] {
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
): LiveMoment {
  const playerHome = r.home === playerId;
  const homeName = name(r.home);
  const awayName = name(r.away);
  const opp = playerHome ? r.away : r.home;
  return { kind, title, stake, homeName, awayName, playerHome, result: r, events: narrate(rng, r, playerHome, homeName, awayName, squad, oppSquad(opp)) };
}

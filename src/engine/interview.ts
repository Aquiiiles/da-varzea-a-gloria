import { outcomeOf } from './calendarView';
import type { CalendarMatch, GameState } from './types';

/**
 * Entrevista pós-jogo e coletiva antes de jogo decisivo. As perguntas dependem do momento:
 * goleada, clássico, zebra, eliminação, título, sequência boa ou ruim. Três tons de resposta
 * (humilde, confiante, polêmico) mexem na torcida, na diretoria, na reputação e no vestiário.
 * Os efeitos entram no fim da temporada; o placar dos jogos não muda.
 */

export interface InterviewEffect {
  /** torcedômetro */
  mood?: number;
  /** confiança da diretoria (modo técnico) */
  board?: number;
  /** reputação do técnico (modo técnico) */
  rep?: number;
  /** moral do técnico (modo presidente) */
  morale?: number;
}

export interface InterviewAnswer {
  tone: 'humilde' | 'confiante' | 'polêmico';
  text: string;
  effect: InterviewEffect;
}

export interface InterviewQuestion {
  text: string;
  answers: [InterviewAnswer, InterviewAnswer, InterviewAnswer];
}

export interface Interview {
  kind: 'pos' | 'coletiva';
  /** dia do jogo */
  day: number;
  title: string;
  match: CalendarMatch;
  questions: InterviewQuestion[];
}

type Ctx =
  | 'titulo' | 'final_perdida' | 'eliminado' | 'classificado' | 'classico_v' | 'classico_d' | 'goleada_v' | 'goleada_d' | 'zebra_v'
  | 'sequencia_ruim' | 'sequencia_boa';

const H = (text: string, effect: InterviewEffect): InterviewAnswer => ({ tone: 'humilde', text, effect });
const C = (text: string, effect: InterviewEffect): InterviewAnswer => ({ tone: 'confiante', text, effect });
const P = (text: string, effect: InterviewEffect): InterviewAnswer => ({ tone: 'polêmico', text, effect });

const POS: Record<Ctx, { title: string; q: InterviewQuestion[] }> = {
  titulo: {
    title: 'É campeão!',
    q: [
      {
        text: 'O que esse título significa para você?',
        answers: [
          H('O mérito é dos jogadores e da torcida. Eu só ajudei a organizar.', { mood: 3, board: 3, morale: 4 }),
          C('É só o começo. Esse grupo vai ganhar muito mais.', { mood: 4, rep: 2, morale: 3 }),
          P('Muita gente duvidou da gente. Hoje quem fala sou eu.', { mood: 5, rep: 3, board: -2 }),
        ],
      },
    ],
  },
  final_perdida: {
    title: 'Vice na final',
    q: [
      {
        text: 'Faltou o quê para levantar a taça?',
        answers: [
          H('O adversário foi melhor. Vamos aprender e voltar mais fortes.', { mood: 1, board: 2, morale: 2 }),
          C('Chegamos à final; o trabalho está no caminho certo.', { mood: 0, rep: 1, morale: 1 }),
          P('A arbitragem decidiu. Todo mundo viu.', { mood: 3, board: -4, rep: 1, morale: -1 }),
        ],
      },
    ],
  },
  eliminado: {
    title: 'Eliminado',
    q: [
      {
        text: 'A eliminação foi um fracasso?',
        answers: [
          H('Assumo a responsabilidade. Vamos corrigir os erros.', { mood: 1, board: 3, morale: 1 }),
          C('Fracasso não. O foco agora é o campeonato.', { mood: -1, rep: 0, morale: 2 }),
          P('Com esse elenco, não dava para pedir mais.', { mood: -3, board: -5, morale: -4 }),
        ],
      },
      {
        text: 'A torcida protestou na saída. Recado para ela?',
        answers: [
          H('Ela tem razão de cobrar. Vamos dar a resposta em campo.', { mood: 3, board: 1 }),
          C('Peço paciência: o time vai crescer.', { mood: 1, morale: 1 }),
          P('Protesto não ganha jogo. Quem quer ajudar, apoia.', { mood: -5, rep: 1 }),
        ],
      },
    ],
  },
  classificado: {
    title: 'Classificado!',
    q: [
      {
        text: 'Dá para sonhar com o título?',
        answers: [
          H('Um jogo de cada vez. Ainda tem muito caminho.', { board: 2, morale: 2 }),
          C('Viemos para ser campeões, sim.', { mood: 3, rep: 1, morale: 2 }),
          P('Quem tiver medo de nós está certo.', { mood: 4, rep: 2, board: -1, morale: 1 }),
        ],
      },
    ],
  },
  classico_v: {
    title: 'O clássico é nosso',
    q: [
      {
        text: 'Vitória no clássico. Recado para o rival?',
        answers: [
          H('Respeito o rival. Hoje fomos um pouco melhores.', { mood: 1, board: 2, morale: 1 }),
          C('A cidade tem dono, e hoje ficou claro.', { mood: 4, rep: 1, morale: 2 }),
          P('Eles falaram muito a semana inteira. Agora estão quietos.', { mood: 6, rep: 2, board: -2 }),
        ],
      },
    ],
  },
  classico_d: {
    title: 'Derrota no clássico',
    q: [
      {
        text: 'Perder o clássico pesa no seu cargo?',
        answers: [
          H('Pesa, e eu entendo a dor do torcedor. Vou trabalhar dobrado.', { mood: 2, board: 2, morale: 1 }),
          C('Clássico é um jogo. Meu trabalho é a temporada inteira.', { mood: -2, rep: 0, morale: 2 }),
          P('O time deles é melhor pago. Assim fica difícil.', { mood: -4, board: -4, morale: -3 }),
        ],
      },
    ],
  },
  goleada_v: {
    title: 'Goleada',
    q: [
      {
        text: 'Foi a melhor atuação da temporada?',
        answers: [
          H('Foi um bom dia, mas não ganhamos nada ainda.', { board: 1, morale: 1 }),
          C('Esse é o futebol que a gente treina. Vai ser assim.', { mood: 3, rep: 1, morale: 2 }),
          P('Quem criticou o time na semana deve estar com vergonha.', { mood: 3, rep: 1, board: -2 }),
        ],
      },
    ],
  },
  goleada_d: {
    title: 'Goleada sofrida',
    q: [
      {
        text: 'O que aconteceu hoje?',
        answers: [
          H('Fomos muito mal. Peço desculpas ao torcedor.', { mood: 3, board: 2, morale: -1 }),
          C('Um jogo ruim não apaga o trabalho. Vamos reagir.', { mood: -1, morale: 2 }),
          P('Alguns jogadores não honraram a camisa. Vai ter mudança.', { mood: 2, board: -2, morale: -5 }),
        ],
      },
      {
        text: 'A diretoria ainda confia em você?',
        answers: [
          H('Isso é com eles. Eu sigo trabalhando.', { board: 2 }),
          C('Confia, e eu vou provar que está certa.', { board: 1, rep: 1 }),
          P('Se não confiar, que diga logo.', { board: -5, rep: 1 }),
        ],
      },
    ],
  },
  zebra_v: {
    title: 'Zebra!',
    q: [
      {
        text: 'Vocês derrubaram um time bem maior. Qual foi o segredo?',
        answers: [
          H('Humildade e muito trabalho. O grupo merece.', { mood: 3, board: 2, morale: 2 }),
          C('Estudamos o adversário e o plano funcionou.', { mood: 2, rep: 3, morale: 1 }),
          P('Grande, só no orçamento. Dentro de campo, somos iguais.', { mood: 5, rep: 3, board: -1 }),
        ],
      },
    ],
  },
  sequencia_ruim: {
    title: 'Fase ruim',
    q: [
      {
        text: 'São três derrotas seguidas. A crise chegou?',
        answers: [
          H('É um momento difícil e a culpa é minha. Vamos sair dele juntos.', { mood: 2, board: 2, morale: 1 }),
          C('Crise é palavra forte. O time está perto de virar a chave.', { mood: -1, morale: 2 }),
          P('Com os reforços que pedi e não vieram, era previsível.', { mood: 1, board: -6, rep: 1, morale: -2 }),
        ],
      },
    ],
  },
  sequencia_boa: {
    title: 'Embalados',
    q: [
      {
        text: 'Quatro vitórias seguidas. O time chegou no ponto?',
        answers: [
          H('Estamos bem, mas tem muito campeonato pela frente.', { board: 2, morale: 1 }),
          C('Chegou. E ainda dá para melhorar.', { mood: 3, rep: 1, morale: 2 }),
          P('Agora todo mundo quer nos elogiar. Onde estavam antes?', { mood: 2, rep: 2, board: -1 }),
        ],
      },
    ],
  },
};

const COLETIVA: { title: string; q: InterviewQuestion } = {
  title: 'Coletiva antes do jogo decisivo',
  q: {
    text: 'O que o torcedor pode esperar do time?',
    answers: [
      H('Respeito total ao adversário e entrega total do nosso lado.', { board: 2, morale: 2 }),
      C('Vamos jogar para ganhar, em qualquer campo.', { mood: 3, rep: 1, morale: 2 }),
      P('Se jogarmos o que sabemos, não tem jogo.', { mood: 4, rep: 2, board: -2, morale: 1 }),
    ],
  },
};

function contextOf(state: GameState, m: CalendarMatch, before: CalendarMatch[]): Ctx | null {
  const p = state.player;
  const rival = state.clubs.find((c) => c.id === p.rivalId)?.name;
  const r = outcomeOf(m);
  const base = m.round.replace(/ \((ida|volta)\)$/, '');
  if (base === 'Final' && m.advanced === true) return 'titulo';
  if (base === 'Final' && m.advanced === false) return 'final_perdida';
  if (m.advanced === false) return 'eliminado';
  if (m.advanced === true && m.round.includes('volta')) return 'classificado';
  if (rival && m.opponent === rival) return r === 'V' ? 'classico_v' : r === 'D' ? 'classico_d' : null;
  if (m.gf - m.ga >= 3) return 'goleada_v';
  if (m.ga - m.gf >= 3) return 'goleada_d';
  if (r === 'V' && m.opponentTier !== null && m.opponentTier < p.tier) return 'zebra_v';
  const last = [...before.slice(-3), m].map(outcomeOf);
  if (before.length >= 3 && last.slice(-3).every((x) => x === 'D')) return 'sequencia_ruim';
  if (before.length >= 3 && last.length >= 4 && last.slice(-4).every((x) => x === 'V')) return 'sequencia_boa';
  return null;
}

function decisive(state: GameState, m: CalendarMatch): boolean {
  const rival = state.clubs.find((c) => c.id === state.player.rivalId)?.name;
  return /^Final|\(volta\)/.test(m.round) || (!!rival && m.opponent === rival);
}

/** Perguntas já respondidas (dia do jogo + tipo). */
export function answered(state: GameState, day: number, kind: Interview['kind']): number[] {
  return (state.live?.interviews ?? []).filter((x) => x.day === day && x.kind === kind).map((x) => x.q);
}

/** Soma dos efeitos das respostas da temporada. */
export function interviewEffects(state: GameState): Required<InterviewEffect> {
  const sum = { mood: 0, board: 0, rep: 0, morale: 0 };
  for (const x of state.live?.interviews ?? []) {
    sum.mood += x.effect.mood ?? 0;
    sum.board += x.effect.board ?? 0;
    sum.rep += x.effect.rep ?? 0;
    sum.morale += x.effect.morale ?? 0;
  }
  return sum;
}

/**
 * Entrevista disponível agora: a pós-jogo do último jogo (até 3 dias depois) ou a coletiva do próximo
 * jogo decisivo (até 4 dias antes). Continua disponível depois de respondida (a tela mostra as respostas).
 */
export function currentInterview(state: GameState): Interview | null {
  const cal = state.calendar;
  const day = state.reveal;
  if (!cal || day == null || state.phase !== 'season') return null;
  const played = cal.matches.filter((m) => m.day <= day);
  const last = played[played.length - 1];
  if (last && day - last.day <= 3) {
    const ctx = contextOf(state, last, played.slice(0, -1));
    if (ctx) {
      const it = POS[ctx];
      return { kind: 'pos', day: last.day, title: it.title, match: last, questions: it.q };
    }
  }
  const next = cal.matches.find((m) => m.day > day);
  if (next && next.day - day <= 4 && decisive(state, next)) {
    return { kind: 'coletiva', day: next.day, title: COLETIVA.title, match: next, questions: [COLETIVA.q] };
  }
  return null;
}

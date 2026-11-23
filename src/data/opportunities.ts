import type { Opportunity } from '../engine/types';

/**
 * Propostas especiais que aparecem no escritório (1 a 3 por temporada). Aceitar é opcional.
 * Valores com `scale: true` são multiplicados pela escala de dinheiro da divisão atual.
 */
export const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'padaria', weight: 8, accept: 'Fechar',
    title: 'Patrocínio local', text: 'A padaria do bairro quer estampar a manga da camisa por 3 temporadas.',
    effects: [{ type: 'sponsor', name: 'Padaria Pão Quente', perSeason: 6, seasons: 3, scale: true }],
    headline: 'Padaria do bairro vira patrocinadora',
  },
  {
    id: 'bet', weight: 6, accept: 'Assinar',
    title: 'Casa de apostas na camisa', text: 'Dinheiro farto por 4 temporadas. A torcida antiga torce o nariz.',
    effects: [{ type: 'sponsor', name: 'Bet Relâmpago', perSeason: 16, seasons: 4, scale: true }, { type: 'add', stat: 'soul', value: -8 }],
    headline: 'Clube fecha com casa de apostas',
  },
  {
    id: 'vaquinha', weight: 5, accept: 'Lançar',
    title: 'Vaquinha da torcida', text: 'Os sócios se juntam para ajudar o caixa.',
    effects: [{ type: 'add', stat: 'cash', value: 10, scale: true }, { type: 'add', stat: 'soul', value: 3 }, { type: 'add', stat: 'fans', value: -20 }],
    headline: 'Torcida faz vaquinha pelo clube',
  },
  {
    id: 'investidor', weight: 4, accept: 'Aceitar a mala',
    title: 'Investidor anônimo', text: 'Uma mala de dinheiro de origem nebulosa.',
    effects: [{ type: 'add', stat: 'cash', value: 35, scale: true }, { type: 'add', stat: 'soul', value: -14 }],
    headline: 'Dinheiro de origem nebulosa entra no clube',
  },
  {
    id: 'naming', weight: 3, maxTier: 6, once: true, accept: 'Vender o nome',
    title: 'Naming rights do estádio', text: 'O estádio ganharia o nome de um banco digital. Para sempre.',
    effects: [{ type: 'sponsor', name: 'Arena Kripto9', perSeason: 14, seasons: null, scale: true }, { type: 'add', stat: 'soul', value: -12 }],
    headline: 'Estádio do clube ganha nome de banco digital',
  },
  {
    id: 'veterano', weight: 6, accept: 'Contratar',
    title: 'Veterano sem clube', text: 'Um atacante de 34 anos topa jogar por pouco. Dura uma temporada, talvez duas.',
    effects: [{ type: 'sign', rel: 4, age: [33, 35], pos: 'ATA' }, { type: 'add', stat: 'cash', value: -2, scale: true }],
    headline: 'Veterano rodado assina com o clube',
  },
  {
    id: 'emprestimo_gigante', weight: 4, minTier: 7, accept: 'Aceitar',
    title: 'Gigante oferece empréstimo de joia', text: 'Um clube grande quer dar rodagem a um garoto. Ele chega pronto e o gigante paga parte do salário.',
    effects: [{ type: 'sign', rel: 3, age: [19, 20] }],
    headline: 'Joia de gigante chega emprestada',
  },
  {
    id: 'aliciar', weight: 4, accept: 'Aliciar',
    title: 'Aliciar o capitão rival', text: 'Ele chega, o rival enfraquece e o clássico pega fogo.',
    effects: [{ type: 'sign', rel: 2, age: [26, 30] }, { type: 'add', stat: 'rivalStrength', value: -2 }, { type: 'add', stat: 'rivalHatred', value: 20 }, { type: 'add', stat: 'cash', value: -10, scale: true }],
    headline: 'Capitão do rival troca de lado: clássico vira guerra',
  },
  {
    id: 'pretemporada', weight: 4, accept: 'Ir',
    title: 'Convite para torneio de pré-temporada', text: 'Viagem cansativa, mas paga bem e dá visibilidade.',
    effects: [{ type: 'add', stat: 'cash', value: 5, scale: true }, { type: 'add', stat: 'hype', value: 6 }, { type: 'add', stat: 'form', value: -0.7 }],
    headline: 'Clube viaja para torneio de verão',
  },
  {
    id: 'influencer', weight: 3, accept: 'Topar',
    title: 'Influencer quer virar "embaixador"', text: 'Hype garantido. A arquibancada raiz odeia.',
    effects: [{ type: 'add', stat: 'hype', value: 18 }, { type: 'mul', stat: 'fans', value: 1.08 }, { type: 'add', stat: 'soul', value: -5 }],
    headline: 'Influencer vira embaixador do clube',
  },
];

import type { Card } from '../engine/types';

/**
 * Valores de `cash` com `scale: true` são multiplicados pela escala de dinheiro da divisão atual.
 * (Ex.: -18 na Liga Regional = -18 mil; na Premier = -1,6 mi.)
 */
/** Cartas que aumentam o estádio (garantidas na oferta quando o estádio trava o acesso). */
export const STADIUM_CARD_IDS = ['infra_arquibancada', 'infra_estadio'];

export const CARDS: Card[] = [
  // ---------------------------- Reforço ----------------------------
  {
    id: 'ref_veterano', kind: 'reforco', weight: 10,
    title: 'Veterano rodado', text: 'Um atacante de 34 anos que ainda sabe onde a bola cai.',
    effects: [{ type: 'add', stat: 'strength', value: 4 }, { type: 'add', stat: 'cash', value: -10, scale: true }, { type: 'signing', finishing: 3 }],
  },
  {
    id: 'ref_promessa', kind: 'reforco', weight: 9,
    title: 'Promessa da base vizinha', text: 'Ninguém ainda percebeu o talento do garoto.',
    effects: [{ type: 'add', stat: 'strength', value: 5 }, { type: 'add', stat: 'cash', value: -14, scale: true }, { type: 'signing', finishing: 2 }],
  },
  {
    id: 'ref_camisa10', kind: 'reforco', weight: 6,
    title: 'Camisa 10 de verdade', text: 'Caro, mas muda o patamar do time.',
    effects: [{ type: 'add', stat: 'strength', value: 9 }, { type: 'add', stat: 'cash', value: -32, scale: true }, { type: 'signing', finishing: 4 }],
  },
  {
    id: 'ref_pacote', kind: 'reforco', weight: 5,
    title: 'Pacote de 5 reforços', text: 'Um empresário oferece meio elenco de uma vez.',
    effects: [{ type: 'add', stat: 'strength', value: 7 }, { type: 'add', stat: 'cash', value: -24, scale: true }, { type: 'add', stat: 'soul', value: -3 }],
  },
  {
    id: 'ref_estrangeiro', kind: 'reforco', weight: 4, maxTier: 4,
    title: 'Craque estrangeiro', text: 'Chega de jatinho e com salário de estrela.',
    effects: [{ type: 'add', stat: 'strength', value: 11 }, { type: 'add', stat: 'cash', value: -45, scale: true }, { type: 'add', stat: 'hype', value: 10 }, { type: 'signing', finishing: 5 }],
  },
  // ---------------------------- Staff ----------------------------
  {
    id: 'staff_tecnico', kind: 'staff', weight: 7,
    title: 'Técnico estudioso', text: 'Prancheta, vídeo e treino tático. +força em todos os jogos.',
    effects: [{ type: 'add', stat: 'coach', value: 1 }, { type: 'add', stat: 'cash', value: -8, scale: true }],
  },
  {
    id: 'staff_olheiro', kind: 'staff', weight: 6,
    title: 'Olheiro de várzea', text: 'Acha joia em campo de terra. O elenco melhora todo ano.',
    effects: [{ type: 'add', stat: 'scout', value: 1 }, { type: 'add', stat: 'cash', value: -6, scale: true }],
  },
  {
    id: 'staff_preparador', kind: 'staff', weight: 6,
    title: 'Preparador físico', text: 'Menos lesões, menos desgaste de uma temporada para outra.',
    effects: [{ type: 'add', stat: 'fitness', value: 1 }, { type: 'add', stat: 'cash', value: -5, scale: true }],
  },
  // ------------------------- Infraestrutura -------------------------
  {
    id: 'infra_arquibancada', kind: 'infra', weight: 9,
    title: 'Arquibancada nova', text: 'Mais lugares, mais bilheteria. +50% de capacidade e mais um setor.',
    effects: [{ type: 'mul', stat: 'capacity', value: 1.5 }, { type: 'add', stat: 'capacity', value: 300, scale: true }, { type: 'add', stat: 'cash', value: -16, scale: true }],
  },
  {
    id: 'infra_estadio', kind: 'infra', weight: 4,
    title: 'Estádio novo', text: 'Obra grande: mais que dobra a capacidade. A cidade inteira comenta.',
    effects: [{ type: 'mul', stat: 'capacity', value: 2.2 }, { type: 'add', stat: 'cash', value: -40, scale: true }, { type: 'add', stat: 'fans', value: 200 }],
  },
  {
    id: 'infra_gramado', kind: 'infra', weight: 5,
    title: 'Gramado híbrido', text: 'O time joga melhor em casa.',
    effects: [{ type: 'add', stat: 'strength', value: 2 }, { type: 'add', stat: 'cash', value: -9, scale: true }],
  },
  {
    id: 'infra_base', kind: 'infra', weight: 5,
    title: 'Categorias de base', text: 'Investimento de longo prazo: o elenco cresce sozinho e a alma agradece.',
    effects: [{ type: 'add', stat: 'academy', value: 1 }, { type: 'add', stat: 'soul', value: 3 }, { type: 'add', stat: 'cash', value: -12, scale: true }],
  },
  // ---------------------------- Dinheiro ----------------------------
  {
    id: 'din_padaria', kind: 'dinheiro', weight: 9,
    title: 'Patrocínio local', text: 'A padaria do bairro estampa a camisa por 3 temporadas.',
    effects: [{ type: 'sponsor', name: 'Padaria Pão Quente', perSeason: 8, seasons: 3, scale: true }],
  },
  {
    id: 'din_bet', kind: 'dinheiro', weight: 6,
    title: 'Casa de apostas', text: 'Dinheiro farto. A torcida antiga torce o nariz.',
    effects: [{ type: 'sponsor', name: 'Bet Relâmpago', perSeason: 18, seasons: 4, scale: true }, { type: 'add', stat: 'soul', value: -8 }],
  },
  {
    id: 'din_vaquinha', kind: 'dinheiro', weight: 6,
    title: 'Vaquinha da torcida', text: 'Os sócios se juntam e salvam o caixa.',
    effects: [{ type: 'add', stat: 'cash', value: 12, scale: true }, { type: 'add', stat: 'soul', value: 4 }],
  },
  {
    id: 'din_investidor', kind: 'dinheiro', weight: 4,
    title: 'Investidor anônimo', text: 'Uma mala de dinheiro de origem nebulosa.',
    effects: [{ type: 'add', stat: 'cash', value: 40, scale: true }, { type: 'add', stat: 'soul', value: -14 }],
  },
  {
    id: 'din_naming', kind: 'dinheiro', weight: 3, maxTier: 5,
    title: 'Naming rights do estádio', text: 'O estádio ganha nome de banco digital.',
    effects: [{ type: 'sponsor', name: 'Arena Kripto9', perSeason: 25, seasons: null, scale: true }, { type: 'add', stat: 'soul', value: -10 }],
  },
  // ------------------------- Aliciar do rival -------------------------
  {
    id: 'ali_capitao', kind: 'aliciar', weight: 4,
    title: 'Aliciar o capitão rival', text: 'Ele chega; o rival enfraquece; o clássico pega fogo.',
    effects: [{ type: 'add', stat: 'strength', value: 5 }, { type: 'add', stat: 'rivalStrength', value: -5 }, { type: 'add', stat: 'rivalHatred', value: 20 }, { type: 'add', stat: 'cash', value: -14, scale: true }, { type: 'signing', finishing: 3 }],
  },
  {
    id: 'ali_tecnico', kind: 'aliciar', weight: 3,
    title: 'Roubar o técnico do rival', text: 'Contrato assinado na madrugada.',
    effects: [{ type: 'add', stat: 'coach', value: 1 }, { type: 'add', stat: 'rivalStrength', value: -4 }, { type: 'add', stat: 'rivalHatred', value: 15 }, { type: 'add', stat: 'cash', value: -10, scale: true }],
  },
];

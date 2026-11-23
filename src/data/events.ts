import type { GameEvent } from '../engine/types';

export const EVENT_CHANCE = 0.45;

export const EVENTS: GameEvent[] = [
  {
    id: 'bilionario', weight: 4, once: true, minTier: 6,
    title: 'Um bilionário quer comprar 51% do clube',
    text: 'Ele promete dinheiro sem fim. Ninguém sabe de onde vem a fortuna.',
    options: [
      { label: 'Vender', headline: 'Clube vendido a bilionário misterioso', effects: [{ type: 'add', stat: 'cash', value: 80, scale: true }, { type: 'add', stat: 'strength', value: 6 }, { type: 'add', stat: 'soul', value: -30 }] },
      { label: 'Recusar', headline: 'Presidente recusa oferta milionária: "o clube é do povo"', effects: [{ type: 'add', stat: 'soul', value: 6 }, { type: 'add', stat: 'fans', value: 100 }] },
    ],
  },
  {
    id: 'craque_sai', weight: 5,
    title: 'Seu craque quer sair para um gigante',
    text: 'A proposta é alta. Ele já postou foto com a camisa do outro clube.',
    options: [
      { label: 'Vender', headline: 'Craque vendido; caixa respira', effects: [{ type: 'loseStar' }, { type: 'add', stat: 'strength', value: -5 }, { type: 'add', stat: 'cash', value: 30, scale: true }] },
      { label: 'Segurar', headline: 'Clube segura o craque, que treina emburrado', effects: [{ type: 'add', stat: 'strength', value: -1 }, { type: 'add', stat: 'soul', value: 2 }] },
    ],
  },
  {
    id: 'gramado_alagou', weight: 5,
    title: 'O gramado alagou',
    text: 'A chuva destruiu o campo. Reformar custa caro; mandar jogos fora custa torcida.',
    options: [
      { label: 'Reformar', headline: 'Clube reforma gramado às pressas', effects: [{ type: 'add', stat: 'cash', value: -10, scale: true }] },
      { label: 'Jogar fora', headline: 'Sem casa, time vira andarilho', effects: [{ type: 'add', stat: 'fans', value: -80 }, { type: 'add', stat: 'strength', value: -2 }] },
    ],
  },
  {
    id: 'mudar_cores', weight: 3, once: true,
    title: 'Patrocinador exige mudar as cores',
    text: 'Uma marca de energético paga muito se o uniforme virar a cor dela.',
    options: [
      { label: 'Mudar', headline: 'Clube troca as cores de origem', effects: [{ type: 'recolor' }, { type: 'add', stat: 'cash', value: 30, scale: true }, { type: 'add', stat: 'soul', value: -18 }] },
      { label: 'Manter', headline: 'Diretoria mantém cores históricas', effects: [{ type: 'add', stat: 'soul', value: 4 }] },
    ],
  },
  {
    id: 'mudar_cidade', weight: 2, once: true, maxTier: 5,
    title: 'Proposta para mudar de cidade',
    text: 'Uma cidade maior oferece estádio pronto, mas o bairro ficaria sem time.',
    options: [
      { label: 'Mudar', headline: 'Clube abandona o bairro e muda de cidade', effects: [{ type: 'mul', stat: 'capacity', value: 2.5 }, { type: 'add', stat: 'cash', value: 25, scale: true }, { type: 'add', stat: 'soul', value: -35 }, { type: 'mul', stat: 'fans', value: 0.6 }] },
      { label: 'Ficar', headline: 'Clube fica no bairro: "aqui é a nossa casa"', effects: [{ type: 'add', stat: 'soul', value: 6 }] },
    ],
  },
  {
    id: 'festa_torcida', weight: 4,
    title: 'Torcida organiza festa de aniversário',
    text: 'Bancar a festa custa, mas aproxima o clube do bairro.',
    options: [
      { label: 'Bancar', headline: 'Festa do clube para a cidade', effects: [{ type: 'add', stat: 'cash', value: -4, scale: true }, { type: 'mul', stat: 'fans', value: 1.12 }, { type: 'add', stat: 'soul', value: 3 }] },
      { label: 'Recusar', headline: 'Diretoria corta festa da torcida', effects: [{ type: 'add', stat: 'soul', value: -3 }] },
    ],
  },
  {
    id: 'documentario', weight: 3,
    title: 'Plataforma de streaming quer filmar o clube',
    text: 'Um documentário traz hype e dinheiro, mas expõe os bastidores.',
    options: [
      { label: 'Aceitar', headline: 'Clube vira série de streaming', effects: [{ type: 'add', stat: 'hype', value: 20 }, { type: 'add', stat: 'cash', value: 10, scale: true }, { type: 'add', stat: 'soul', value: -4 }, { type: 'mul', stat: 'fans', value: 1.15 }] },
      { label: 'Recusar', headline: 'Clube fecha as portas para câmeras', effects: [{ type: 'add', stat: 'soul', value: 2 }] },
    ],
  },
  {
    id: 'rival_provoca', weight: 4,
    title: 'O rival provocou nas redes',
    text: 'O presidente rival chamou seu clube de "time de bairro". Responder?',
    options: [
      { label: 'Responder', headline: 'Guerra de notas oficiais entre os rivais', effects: [{ type: 'add', stat: 'rivalHatred', value: 15 }, { type: 'add', stat: 'hype', value: 8 }] },
      { label: 'Ignorar', headline: 'Clube ignora provocação do rival', effects: [{ type: 'add', stat: 'soul', value: 1 }] },
    ],
  },
  {
    id: 'calote', weight: 3, minTier: 5,
    title: 'Empresário oferece "antecipar receitas"',
    text: 'Dinheiro agora, juros altos depois.',
    options: [
      { label: 'Aceitar', headline: 'Clube antecipa receitas com juros altos', effects: [{ type: 'add', stat: 'cash', value: 25, scale: true }, { type: 'sponsor', name: 'Juros do empréstimo', perSeason: -10, seasons: 3, scale: true }] },
      { label: 'Recusar', headline: 'Diretoria recusa empréstimo arriscado', effects: [] },
    ],
  },
  {
    id: 'base_joia', weight: 3,
    title: 'Joia da base recebe proposta',
    text: 'Um garoto de 16 anos já tem proposta de clube grande.',
    options: [
      { label: 'Vender', headline: 'Clube vende joia da base', effects: [{ type: 'add', stat: 'cash', value: 18, scale: true }, { type: 'add', stat: 'soul', value: -3 }] },
      { label: 'Manter', headline: 'Joia da base renova até 2040', effects: [{ type: 'add', stat: 'strength', value: 3 }, { type: 'signing', finishing: 3 }] },
    ],
  },
];

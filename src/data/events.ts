import type { GameEvent } from '../engine/types';

export const EVENT_CHANCE = 0.45;

export const EVENTS: GameEvent[] = [
  {
    id: 'bilionario', weight: 4, once: true, minTier: 6,
    title: 'Um bilionário quer comprar 51% do clube',
    text: 'Ele promete dinheiro sem fim. Ninguém sabe de onde vem a fortuna.',
    options: [
      { label: 'Vender', headline: 'Clube vendido a bilionário misterioso', effects: [{ type: 'add', stat: 'cash', value: 120, scale: true }, { type: 'add', stat: 'soul', value: -30 }, { type: 'add', stat: 'hype', value: 20 }] },
      { label: 'Recusar', headline: 'Presidente recusa oferta milionária: "o clube é do povo"', effects: [{ type: 'add', stat: 'soul', value: 6 }, { type: 'mul', stat: 'fans', value: 1.05 }] },
    ],
  },
  {
    id: 'craque_sai', weight: 5,
    title: 'Seu craque quer sair para um gigante',
    text: 'A proposta é 50% acima do valor de mercado. Ele já postou foto com a camisa do outro clube.',
    options: [
      { label: 'Vender', headline: 'Craque vendido; caixa respira', effects: [{ type: 'sellStar', mult: 1.5 }] },
      { label: 'Segurar', headline: 'Clube segura o craque, que treina emburrado', effects: [{ type: 'add', stat: 'form', value: -1 }, { type: 'add', stat: 'soul', value: 2 }] },
    ],
  },
  {
    id: 'gramado_alagou', weight: 5,
    title: 'O gramado alagou',
    text: 'A chuva destruiu o campo. Reformar custa caro; mandar jogos fora custa torcida e rendimento.',
    options: [
      { label: 'Reformar', headline: 'Clube reforma gramado às pressas', effects: [{ type: 'add', stat: 'cash', value: -8, scale: true }] },
      { label: 'Jogar fora', headline: 'Sem casa, time vira andarilho', effects: [{ type: 'mul', stat: 'fans', value: 0.85 }, { type: 'add', stat: 'form', value: -1.5 }] },
    ],
  },
  {
    id: 'mudar_cores', weight: 3, once: true,
    title: 'Patrocinador exige mudar as cores',
    text: 'Uma marca de energético paga muito se o uniforme virar a cor dela.',
    options: [
      { label: 'Mudar', headline: 'Clube troca as cores de origem', effects: [{ type: 'recolor' }, { type: 'add', stat: 'cash', value: 25, scale: true }, { type: 'add', stat: 'soul', value: -18 }] },
      { label: 'Manter', headline: 'Diretoria mantém cores históricas', effects: [{ type: 'add', stat: 'soul', value: 4 }] },
    ],
  },
  {
    id: 'mudar_cidade', weight: 2, once: true, maxTier: 5,
    title: 'Proposta para mudar de cidade',
    text: 'Uma cidade maior oferece estádio pronto, mas o bairro ficaria sem time.',
    options: [
      { label: 'Mudar', headline: 'Clube abandona o bairro e muda de cidade', effects: [{ type: 'mul', stat: 'capacity', value: 2.5 }, { type: 'add', stat: 'cash', value: 20, scale: true }, { type: 'add', stat: 'soul', value: -35 }, { type: 'mul', stat: 'fans', value: 0.6 }] },
      { label: 'Ficar', headline: 'Clube fica no bairro: "aqui é a nossa casa"', effects: [{ type: 'add', stat: 'soul', value: 6 }] },
    ],
  },
  {
    id: 'festa_torcida', weight: 4,
    title: 'Torcida organiza festa de aniversário',
    text: 'Bancar a festa custa, mas aproxima o clube do bairro.',
    options: [
      { label: 'Bancar', headline: 'Festa do clube para a cidade', effects: [{ type: 'add', stat: 'cash', value: -3, scale: true }, { type: 'mul', stat: 'fans', value: 1.1 }, { type: 'add', stat: 'soul', value: 3 }] },
      { label: 'Recusar', headline: 'Diretoria corta festa da torcida', effects: [{ type: 'add', stat: 'soul', value: -3 }] },
    ],
  },
  {
    id: 'documentario', weight: 3,
    title: 'Plataforma de streaming quer filmar o clube',
    text: 'Um documentário traz hype e dinheiro, mas expõe os bastidores.',
    options: [
      { label: 'Aceitar', headline: 'Clube vira série de streaming', effects: [{ type: 'add', stat: 'hype', value: 20 }, { type: 'add', stat: 'cash', value: 6, scale: true }, { type: 'add', stat: 'soul', value: -4 }, { type: 'mul', stat: 'fans', value: 1.12 }] },
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
    id: 'lesao', weight: 4,
    title: 'Surto de lesões no elenco',
    text: 'Meio time no departamento médico. Dá para trazer um fisioterapeuta de ponta às pressas.',
    options: [
      { label: 'Pagar', headline: 'Clube contrata fisioterapeuta de emergência', effects: [{ type: 'add', stat: 'cash', value: -5, scale: true }] },
      { label: 'Aguentar', headline: 'Elenco remendado por causa de lesões', effects: [{ type: 'add', stat: 'form', value: -2 }] },
    ],
  },
  {
    id: 'agiota', weight: 3, minTier: 6,
    title: 'Empresário oferece "antecipar receitas"',
    text: 'Dinheiro agora, juros altos depois: devolve 160% em 3 temporadas.',
    options: [
      { label: 'Aceitar', headline: 'Clube antecipa receitas com juros altos', effects: [{ type: 'add', stat: 'cash', value: 20, scale: true }, { type: 'sponsor', name: 'Parcela da antecipação', perSeason: -10.7, seasons: 3, scale: true }] },
      { label: 'Recusar', headline: 'Diretoria recusa empréstimo arriscado', effects: [] },
    ],
  },
];

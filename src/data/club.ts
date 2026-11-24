import type { BusinessId, CoachStyle, DelegateArea, Tactic } from '../engine/types';

export const COACH_STYLES: Record<CoachStyle, { label: string; effect: string }> = {
  ofensivo: { label: 'Ofensivo', effect: 'Time faz mais gols (+15%), mas também sofre mais (+10%).' },
  retranqueiro: { label: 'Retranqueiro', effect: 'Sofre bem menos gols (-18%), mas marca menos (-10%).' },
  formador: { label: 'Formador', effect: 'Jovens até 23 anos evoluem mais rápido.' },
  motivador: { label: 'Motivador', effect: 'Time oscila menos na temporada e a torcida gosta dele.' },
  estrategista: { label: 'Estrategista', effect: '+0,4 de força extra nos mata-matas (copas e playoffs).' },
};

/** Salário anual de referência por nível de técnico (mil £). */
export const COACH_WAGE = [0, 40, 160, 650, 2600];

export const COACH_FIRST = ['Seu Zé', 'Professor', 'Mister', 'Velho', 'Doutor', 'Capitão'];

export interface BusinessInfo {
  id: BusinessId;
  name: string;
  text: string;
  /** custo para abrir/ampliar por nível (índice = nível a construir − 1) */
  cost: [number, number, number];
}

export const BUSINESSES: BusinessInfo[] = [
  { id: 'bar', name: 'Bar do clube', text: 'Cerveja e pastel em dia de jogo. Rende com o público.', cost: [15, 70, 300] },
  { id: 'foodtruck', name: 'Feira de food trucks', text: 'Comida de rua no entorno do estádio. Rende com público e hype.', cost: [10, 50, 220] },
  { id: 'loja', name: 'Loja oficial', text: 'Camisas e lembranças. Vende mais com torcida grande, hype e um ídolo em campo.', cost: [25, 120, 500] },
  { id: 'estacionamento', name: 'Estacionamento', text: 'Vagas pagas em dia de jogo. Só vale com estádio grande.', cost: [40, 180, 700] },
  { id: 'escolinha', name: 'Escolinha paga', text: 'Mensalidades de crianças do bairro. Renda fixa e aproxima o clube da comunidade (+alma).', cost: [20, 90, 350] },
];

/** Manutenção anual do comércio: 8% do investido. */
export const BUSINESS_UPKEEP_RATE = 0.08;

export const DELEGATE_INFO: Record<DelegateArea, { label: string; text: string }> = {
  contratos: { label: 'Diretor de contratos', text: 'Libera reservas veteranos e jogadores que não vão vingar.' },
  base: { label: 'Coordenador da base', text: 'Promove, empresta e dispensa garotos; faz a peneira quando há dinheiro.' },
  mercado: { label: 'Diretor de futebol', text: 'Contrata reforços, vende reservas e responde propostas.' },
  estadio: { label: 'Gerente do estádio', text: 'Amplia o estádio para a vistoria do acesso, define o ingresso e investe em estrutura.' },
};

/** Estratégias de jogo: multiplicadores de gols [a favor, contra]. */
export const TACTICS: Record<Tactic, { label: string; effect: string; goals: [number, number] }> = {
  equilibrado: { label: 'Equilibrado', effect: 'Sem riscos: joga o que o elenco permite.', goals: [1, 1] },
  ofensivo: { label: 'Ofensivo', effect: 'Mais gols a favor (+15%), mas também contra (+10%).', goals: [1.15, 1.1] },
  retranqueiro: { label: 'Retranca', effect: 'Sofre bem menos (-18%), marca menos (-10%).', goals: [0.9, 0.82] },
  contra_ataque: { label: 'Contra-ataque', effect: 'Fecha a casinha e sai rápido: rende mais contra times mais fortes.', goals: [0.95, 0.9] },
  pressao: { label: 'Pressão alta', effect: 'Sufoca o adversário (+10% gols, -5% contra), mas cansa mais o elenco.', goals: [1.1, 0.95] },
};

/** Estratégia padrão de cada estilo de técnico. */
export const STYLE_TACTIC: Record<CoachStyle, Tactic> = {
  ofensivo: 'ofensivo',
  retranqueiro: 'retranqueiro',
  formador: 'equilibrado',
  motivador: 'equilibrado',
  estrategista: 'contra_ataque',
};

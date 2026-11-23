import { scaled, TIERS, type Effect, type GameState, type Tier } from '../engine';

export function money(k: number): string {
  const sign = k < 0 ? '-' : '';
  const v = Math.abs(k);
  if (v >= 1000) return `${sign}£ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  return `${sign}£ ${Math.round(v).toLocaleString('pt-BR')} mil`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

export function tierLabel(t: Tier): string {
  return `${TIERS[t].name} · ${t}ª divisão`;
}

export const STAFF_LABEL: Record<string, string> = {
  coach: 'técnico',
  scout: 'olheiro',
  fitness: 'preparador',
  academy: 'base',
};

export interface Chip {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Descreve os efeitos de uma carta/opção em "chips" legíveis. */
export function describeEffects(state: GameState, effects: readonly Effect[]): Chip[] {
  const chips: Chip[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'add': {
        const v = scaled(state, e.value, e.scale);
        const sign = v > 0 ? '+' : '';
        const good = v > 0;
        switch (e.stat) {
          case 'strength': chips.push({ text: `${sign}${v} força`, tone: good ? 'good' : 'bad' }); break;
          case 'cash': chips.push({ text: `${v > 0 ? '+' : ''}${money(v)}`, tone: good ? 'good' : 'bad' }); break;
          case 'fans': chips.push({ text: `${sign}${num(v)} torcedores`, tone: good ? 'good' : 'bad' }); break;
          case 'soul': chips.push({ text: `${sign}${v} alma`, tone: good ? 'good' : 'bad' }); break;
          case 'capacity': chips.push({ text: `${sign}${num(v)} lugares`, tone: good ? 'good' : 'bad' }); break;
          case 'hype': chips.push({ text: `${sign}${v} hype`, tone: good ? 'good' : 'neutral' }); break;
          case 'rivalStrength': chips.push({ text: `rival ${sign}${v} força`, tone: v < 0 ? 'good' : 'bad' }); break;
          case 'rivalHatred': chips.push({ text: `${sign}${v} ódio do clássico`, tone: 'neutral' }); break;
          default: chips.push({ text: `${sign}${v} ${STAFF_LABEL[e.stat]}`, tone: good ? 'good' : 'bad' });
        }
        break;
      }
      case 'mul': {
        const pct = Math.round((e.value - 1) * 100);
        const label = e.stat === 'fans' ? 'torcida' : e.stat === 'capacity' ? 'capacidade' : 'caixa';
        chips.push({ text: `${pct > 0 ? '+' : ''}${pct}% ${label}`, tone: pct > 0 ? 'good' : 'bad' });
        break;
      }
      case 'sponsor': {
        const v = scaled(state, e.perSeason, e.scale);
        const dur = e.seasons === null ? 'para sempre' : `${e.seasons} temp.`;
        chips.push({ text: `${v > 0 ? '+' : ''}${money(v)}/temp. (${dur})`, tone: v > 0 ? 'good' : 'bad' });
        break;
      }
      case 'signing': chips.push({ text: 'novo jogador', tone: 'good' }); break;
      case 'loseStar': chips.push({ text: 'perde o craque', tone: 'bad' }); break;
      case 'recolor': chips.push({ text: 'cores novas', tone: 'bad' }); break;
    }
  }
  return chips;
}

export const OUTCOME_LABEL: Record<string, string> = {
  campeao: 'CAMPEÃO',
  acesso: 'ACESSO',
  acesso_playoff: 'ACESSO NO PLAYOFF',
  barrado_estadio: 'BARRADO PELO ESTÁDIO',
  fica: 'PERMANECE',
  queda: 'REBAIXADO',
  falencia: 'FALÊNCIA',
};

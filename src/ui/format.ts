import { scaled, TIERS, type Effect, type Footballer, type GameState, type Tier } from '../engine';

/** Valores do motor estão em mil £. */
export function money(k: number): string {
  const sign = k < 0 ? '-' : '';
  const v = Math.abs(k);
  if (v >= 1000) return `${sign}£ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (v >= 1) return `${sign}£ ${Math.round(v).toLocaleString('pt-BR')} mil`;
  return `${sign}£ ${Math.round(v * 1000).toLocaleString('pt-BR')}`;
}

/** Salário anual (mil £) mostrado por semana, como nos modos carreira. */
export function weekly(k: number): string {
  const perWeek = (k * 1000) / 52;
  if (perWeek >= 1000) return `£ ${(perWeek / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil/sem`;
  return `£ ${Math.round(perWeek).toLocaleString('pt-BR')}/sem`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

export function tierLabel(t: Tier): string {
  return `${TIERS[t].name} · ${t}ª divisão`;
}

export function potLabel(f: Footballer): string {
  return f.potLo === f.potHi ? `${f.potHi}` : `${f.potLo}–${f.potHi}`;
}

export function ovrTone(ovr: number, tier: Tier): string {
  const d = ovr - TIERS[tier].meanStrength;
  if (d >= 4) return 'ovr-elite';
  if (d >= 0) return 'ovr-good';
  if (d >= -4) return 'ovr-ok';
  return 'ovr-weak';
}

export interface Chip {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Descreve efeitos de oportunidades/eventos em "chips" legíveis. */
export function describeEffects(state: GameState, effects: readonly Effect[]): Chip[] {
  const chips: Chip[] = [];
  for (const e of effects) {
    switch (e.type) {
      case 'add': {
        const v = scaled(state, e.value, e.scale);
        const sign = v > 0 ? '+' : '';
        const good = v > 0;
        switch (e.stat) {
          case 'cash': chips.push({ text: `${sign}${money(v)}`, tone: good ? 'good' : 'bad' }); break;
          case 'fans': chips.push({ text: `${sign}${num(v)} torcedores`, tone: good ? 'good' : 'bad' }); break;
          case 'soul': chips.push({ text: `${sign}${v} alma`, tone: good ? 'good' : 'bad' }); break;
          case 'capacity': chips.push({ text: `${sign}${num(v)} lugares`, tone: good ? 'good' : 'bad' }); break;
          case 'hype': chips.push({ text: `${sign}${v} hype`, tone: good ? 'good' : 'neutral' }); break;
          case 'form': chips.push({ text: `${sign}${v} forma na temporada`, tone: good ? 'good' : 'bad' }); break;
          case 'rivalStrength': chips.push({ text: `rival ${sign}${v} força`, tone: v < 0 ? 'good' : 'bad' }); break;
          case 'rivalHatred': chips.push({ text: `${sign}${v} ódio do clássico`, tone: 'neutral' }); break;
        }
        break;
      }
      case 'mul': {
        const pct = Math.round((e.value - 1) * 100);
        chips.push({ text: `${pct > 0 ? '+' : ''}${pct}% ${e.stat === 'fans' ? 'torcida' : 'capacidade'}`, tone: pct > 0 ? 'good' : 'bad' });
        break;
      }
      case 'sponsor': {
        const v = scaled(state, e.perSeason, e.scale);
        const dur = e.seasons === null ? 'para sempre' : `${e.seasons} temp.`;
        chips.push({ text: `${v > 0 ? '+' : ''}${money(v)}/temp. (${dur})`, tone: v > 0 ? 'good' : 'bad' });
        break;
      }
      case 'sign': {
        const mean = TIERS[state.player.tier].meanStrength;
        chips.push({ text: `jogador ~${Math.round(mean + e.rel)} OVR, ${e.age[0]}–${e.age[1]} anos`, tone: 'good' });
        break;
      }
      case 'sellStar': chips.push({ text: `vende o craque (${Math.round(e.mult * 100)}% do valor)`, tone: 'bad' }); break;
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

export const POS_LABEL = { GOL: 'Goleiro', DEF: 'Defensor', MEI: 'Meia', ATA: 'Atacante' } as const;

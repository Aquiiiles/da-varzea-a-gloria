import { TIERS } from '../data/pyramid';
import { nextId } from './effects';
import { makeFootballer, round1 } from './footballers';
import { deriveRng, type Rng } from './rng';
import { clamp } from './util';
import type { GameState } from './types';

/**
 * Evento extraordinário: raro (~1 a cada 4 temporadas), sem escolha, muito bom ou muito ruim.
 * Sorteado na abertura da janela; o efeito vale na hora e vira manchete.
 */

/** Chance por temporada e intervalo mínimo entre dois eventos. */
export const EXTRA_CHANCE = 0.3;
export const EXTRA_GAP = 3;

interface Extra {
  id: string;
  good: boolean;
  weight: number;
  /** aplica o efeito e devolve o texto (ou null se não serve para o clube agora) */
  apply: (state: GameState, rng: Rng) => { title: string; text: string } | null;
}

const ms = (s: GameState) => TIERS[s.player.tier].moneyScale;

const EXTRAS: Extra[] = [
  {
    id: 'investidor', good: true, weight: 3,
    apply: (s) => {
      const v = Math.round(ms(s) * 120);
      s.player.cash += v;
      if (s.career) {
        s.career.board.budget += Math.round(v * 0.5);
        s.career.board.confidence = clamp(s.career.board.confidence + 5, 0, 100);
      }
      return { title: 'Investidor compra parte do clube', text: `Um grupo de investidores entra no ${s.player.name} e injeta R$ ${v.toLocaleString('pt-BR')} mil no caixa.` };
    },
  },
  {
    id: 'viral', good: true, weight: 3,
    apply: (s) => {
      const p = s.player;
      p.fans = Math.round(p.fans * 1.4);
      p.hype = clamp(p.hype + 25, 0, 100);
      p.mood = clamp(p.mood + 10, 0, 100);
      return { title: 'A torcida viralizou', text: `Um vídeo da torcida do ${p.name} roda o país: a torcida cresce 40% e o clube vira assunto nacional.` };
    },
  },
  {
    id: 'craque_base', good: true, weight: 2,
    apply: (s) => {
      const p = s.player;
      const pool = [...p.youth, ...p.squad.filter((f) => f.age <= 21)];
      if (pool.length === 0) return null;
      const f = pool.sort((a, b) => b.pot - a.pot || a.id - b.id)[0];
      f.ovr = Math.min(95, f.ovr + 8);
      f.pot = Math.min(95, Math.max(f.pot, f.ovr) + 6);
      f.potHi = Math.min(95, Math.max(f.potHi, f.pot));
      f.potLo = Math.min(f.potHi, f.potLo + 6);
      return { title: 'Um garoto explode', text: `${f.name}, de ${f.age} anos, dá um salto de qualidade que ninguém esperava: +8 de overall e potencial lá em cima.` };
    },
  },
  {
    id: 'patrocinio', good: true, weight: 3,
    apply: (s) => {
      const v = Math.round(ms(s) * 40);
      s.player.sponsors.push({ name: 'Patrocínio extraordinário', perSeason: v, seasonsLeft: 3 });
      return { title: 'Patrocínio gigante', text: `Uma multinacional fecha com o ${s.player.name}: R$ ${v.toLocaleString('pt-BR')} mil por temporada durante 3 temporadas.` };
    },
  },
  {
    id: 'idolo', good: true, weight: 2,
    apply: (s, rng) => {
      const p = s.player;
      if (p.squad.length >= 28) return null;
      const mean = TIERS[p.tier].meanStrength;
      const f = makeFootballer(rng, { id: nextId(s), ovr: mean + 6, age: 33, season: s.season, contract: 1, scout: 4, wageMult: 0.4 });
      f.wage = round1(f.wage);
      p.squad.push({ ...f, joined: s.season });
      return { title: 'Ídolo volta para casa', text: `${f.name} (${f.pos}, ${f.ovr}) aceita jogar a última temporada no ${p.name} quase de graça, por amor à camisa.` };
    },
  },
  {
    id: 'terreno', good: true, weight: 2,
    apply: (s) => {
      const p = s.player;
      const seats = Math.max(2000, Math.round(p.capacity * 0.5 / 100) * 100);
      p.capacityBuilding += seats;
      return { title: 'Prefeitura ajuda o estádio', text: `A prefeitura doa terreno e estrutura: +${seats.toLocaleString('pt-BR')} lugares ficam prontos no fim da temporada.` };
    },
  },
  {
    id: 'escandalo', good: false, weight: 3,
    apply: (s) => {
      const p = s.player;
      const v = Math.round(ms(s) * 60);
      p.cash -= v;
      p.mood = clamp(p.mood - 15, 0, 100);
      if (s.career) s.career.board.confidence = clamp(s.career.board.confidence - 10, 0, 100);
      return { title: 'Escândalo na diretoria', text: `Desvio de dinheiro no ${p.name}: R$ ${v.toLocaleString('pt-BR')} mil some do caixa e a torcida fica furiosa.` };
    },
  },
  {
    id: 'incendio', good: false, weight: 2,
    apply: (s) => {
      const p = s.player;
      if (p.capacity < 1000) return null;
      const lost = Math.round(p.capacity * 0.4 / 100) * 100;
      p.capacity -= lost;
      return { title: 'Incêndio no estádio', text: `Um incêndio destrói parte das arquibancadas do ${p.name}: ${lost.toLocaleString('pt-BR')} lugares a menos até a reconstrução.` };
    },
  },
  {
    id: 'lesao', good: false, weight: 3,
    apply: (s) => {
      const p = s.player;
      if (p.squad.length <= 17) return null;
      const f = p.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0];
      p.squad = p.squad.filter((x) => x.id !== f.id);
      // fica fora a temporada toda e volta no fim (como um empréstimo)
      p.onLoan.push({ ...f, loanFromYouth: false, recovering: true });
      return { title: 'Lesão grave do craque', text: `${f.name}, o melhor do elenco, rompe o ligamento do joelho e perde a temporada inteira.` };
    },
  },
  {
    id: 'punicao', good: false, weight: 2,
    apply: (s) => {
      s.player.pendingDeduction += 6;
      return { title: 'Punição do tribunal', text: `O ${s.player.name} é julgado por escalação irregular e começa a temporada com 6 pontos a menos.` };
    },
  },
  {
    id: 'patrocinador', good: false, weight: 2,
    apply: (s) => {
      const p = s.player;
      const before = p.sponsors.length;
      p.sponsors = p.sponsors.filter((x) => x.perSeason < 0);
      p.cash -= Math.round(ms(s) * 10);
      return { title: 'Patrocinador quebra', text: `A empresa que patrocinava o ${p.name} vai à falência${before > p.sponsors.length ? ' e os contratos de patrocínio acabam' : ''}, deixando um rombo no caixa.` };
    },
  },
  {
    id: 'virose', good: false, weight: 2,
    apply: (s) => {
      s.player.formMod -= 2.5;
      return { title: 'Surto de virose', text: `Uma virose derruba o elenco do ${s.player.name} na pré-temporada: o time começa o ano bem abaixo.` };
    },
  },
];

/** Sorteia (ou não) o evento extraordinário da temporada e aplica. */
export function rollExtraordinary(state: GameState): void {
  if (state.season < 3) return;
  if (state.lastExtraordinary !== undefined && state.season - state.lastExtraordinary < EXTRA_GAP) return;
  const rng = deriveRng(state.seed, state.season, 'extraordinario');
  if (!rng.chance(EXTRA_CHANCE)) return;
  const pool = EXTRAS.slice();
  for (let tries = 0; tries < 4 && pool.length > 0; tries++) {
    const ev = rng.weighted(pool, (e) => e.weight);
    pool.splice(pool.indexOf(ev), 1);
    const out = ev.apply(state, rng);
    if (!out) continue;
    state.lastExtraordinary = state.season;
    state.office.extraordinary = { ...out, good: ev.good };
    state.news.push(`EXTRAORDINÁRIO: ${out.title}`);
    return;
  }
}


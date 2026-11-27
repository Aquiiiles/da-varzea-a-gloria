import { offerWage } from './career';
import { julyWindow } from './calendar';
import { outcomeOf } from './calendarView';
import { deriveRng } from './rng';
import { clamp } from './util';
import type { BoardPersonality, CalendarMatch, GameState, JobOffer, Tier } from './types';

/**
 * A diretoria acompanha a temporada jogo a jogo (modo técnico).
 * Sequência ruim com a confiança baixa: ultimato (vencer X dos próximos Y jogos). Não cumpriu: demitido na hora.
 * Tudo sai dos jogos já mostrados, então avançar até o fim da temporada não escapa da cobrança.
 */

interface Rule {
  /** últimos jogos olhados e derrotas que acendem o alerta */
  window: number;
  losses: number;
  /** só cobra se a confiança estiver abaixo disso */
  conf: number;
  /** ultimato: vencer `need` dos próximos `games` */
  games: number;
  need: number;
}

export const BOARD_RULES: Record<BoardPersonality, Rule> = {
  paciente: { window: 6, losses: 4, conf: 50, games: 3, need: 1 },
  imediatista: { window: 4, losses: 3, conf: 66, games: 2, need: 1 },
  mao_de_vaca: { window: 5, losses: 3, conf: 58, games: 3, need: 1 },
};

/** Jogos depois de um ultimato cumprido em que a diretoria não cobra de novo. */
const CALM = 5;
/** Jogos antes de a diretoria poder dar ultimato. */
const MIN_GAMES = 6;

const wins = (ms: CalendarMatch[]) => ms.filter((m) => outcomeOf(m) === 'V').length;

/**
 * Processa os jogos mostrados entre os dias (from, to]. Pode abrir, cumprir ou estourar um ultimato.
 * Devolve o dia da demissão (ou null) e põe as notícias em `state.news`.
 */
export function boardWatch(state: GameState, fromDay: number, toDay: number): number | null {
  const c = state.career;
  const cal = state.calendar;
  if (!c || c.unemployed || !cal || c.firedDay !== undefined) return null;
  const ms = cal.matches;
  const club = state.player.name;
  const rival = rivalName(state);
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    if (m.day <= fromDay || m.day > toDay) continue;
    // clássico e decisão: vale mais para a diretoria e vira manchete
    const res = outcomeOf(m);
    if (rival && m.opponent === rival) {
      // quanto mais quente a rivalidade, mais o clássico pesa
      const weight = 4 + Math.round(state.player.rivalHatred / 20);
      c.board.confidence = clamp(c.board.confidence + (res === 'V' ? weight : res === 'D' ? -weight : 0), 0, 100);
      state.news.push(
        res === 'V'
          ? `CLÁSSICO: ${club} vence o ${rival} por ${m.gf} a ${m.ga} e a cidade é do ${club}`
          : res === 'D'
            ? `CLÁSSICO: ${rival} vence o ${club} por ${m.ga} a ${m.gf}; a torcida cobra ${c.name}`
            : `CLÁSSICO: ${club} e ${rival} empatam em ${m.gf} a ${m.ga}`,
      );
    } else if (isDecisive(m)) {
      if (res === 'V') {
        c.board.confidence = clamp(c.board.confidence + 3, 0, 100);
        state.news.push(`DECISÃO: ${club} passa pelo ${m.opponent} (${m.comp}, ${m.round.split(' · ')[0]})`);
      } else if (res === 'D') state.news.push(`DECISÃO: ${club} cai diante do ${m.opponent} (${m.comp}, ${m.round.split(' · ')[0]})`);
    }
    const u = c.ultimatum;
    if (u) {
      if (i < u.from) continue;
      const window = ms.slice(u.from, Math.min(ms.length, u.from + u.games));
      const sofar = window.filter((x) => x.day <= m.day);
      if (wins(sofar) >= u.needWins) {
        c.ultimatum = null;
        c.calmFrom = i + 1 + CALM;
        c.board.confidence = clamp(c.board.confidence + 6, 0, 100);
        state.news.push(`ULTIMATO CUMPRIDO: ${c.name} respira no ${club}`);
      } else if (sofar.length >= window.length) {
        c.ultimatum = null;
        c.firedDay = m.day;
        state.news.push(`DEMITIDO: ${c.name} não cumpre o ultimato e deixa o ${club}`);
        return m.day;
      }
      continue;
    }
    // começo de trabalho: a diretoria só cobra depois de alguns jogos
    if (i + 1 < MIN_GAMES || i + 1 < (c.calmFrom ?? 0) || i + 1 >= ms.length) continue;
    const rule = BOARD_RULES[c.board.personality];
    if (c.board.confidence >= rule.conf) continue;
    const last = ms.slice(Math.max(0, i + 1 - rule.window), i + 1);
    if (last.length < rule.window) continue;
    const losses = last.filter((x) => outcomeOf(x) === 'D').length;
    if (losses >= rule.losses && wins(last) <= 1) {
      c.ultimatum = { from: i + 1, games: rule.games, needWins: rule.need, day: m.day };
      state.news.push(`ULTIMATO: a diretoria do ${club} exige ${rule.need === 1 ? 'uma vitória' : `${rule.need} vitórias`} nos próximos ${rule.games} jogos`);
    }
  }
  return null;
}

/** Jogos que ainda faltam no ultimato e vitórias que ainda precisa (para a interface). */
export function ultimatumStatus(state: GameState): { left: number; need: number } | null {
  const c = state.career;
  const u = c?.ultimatum;
  const cal = state.calendar;
  if (!u || !cal || state.reveal == null) return null;
  const window = cal.matches.slice(u.from, u.from + u.games);
  const played = window.filter((m) => m.day <= state.reveal!);
  return { left: window.length - played.length, need: Math.max(0, u.needWins - wins(played)) };
}

const PITCH_MID: Record<Tier, string> = {
  1: 'Brigar por títulos e Libertadores',
  2: 'Subir para a Série A',
  3: 'Acesso à Série B',
  4: 'Acesso à Série C',
  5: 'Ganhar o Estadual',
  6: 'Subir para o Estadual',
  7: 'Dominar a Várzea',
};

/**
 * Proposta no meio da temporada: quando a janela de julho abre, um clube maior pode querer o técnico
 * para o ano que vem (pré-contrato). Mais chance para quem vai bem e tem reputação.
 */
export function midSeasonOffer(state: GameState, fromDay: number, toDay: number): void {
  const c = state.career;
  const cal = state.calendar;
  if (!c || c.unemployed || !cal || c.firedDay !== undefined || c.agreed || c.midOffer) return;
  const [open, close] = julyWindow(cal.year);
  if (!(open > fromDay && open <= toDay)) return;
  const p = state.player;
  const rng = deriveRng(state.seed, state.season, 'proposta-meio');
  // campanha até aqui: aproveitamento dos jogos já mostrados
  const played = cal.matches.filter((m) => m.day <= open);
  const pts = played.reduce((s, m) => s + (outcomeOf(m) === 'V' ? 3 : outcomeOf(m) === 'E' ? 1 : 0), 0);
  const pct = played.length > 0 ? pts / (played.length * 3) : 0;
  const chance = clamp(0.08 + Math.max(0, pct - 0.45) * 1.4 + c.reputation / 400, 0, 0.75);
  if (!rng.chance(chance)) return;
  const pool = state.clubs.filter((cl) =>
    p.tier === 1 ? cl.tier === 1 && cl.strength > p.strength + 2 : cl.tier < p.tier && cl.tier >= Math.max(1, p.tier - 2) && (cl.national !== null || cl.stateDiv !== null),
  );
  if (pool.length === 0) return;
  const cl = rng.weighted(pool, (x) => 1 + (x.prestige ?? 0) / 6);
  const personalities: BoardPersonality[] = ['paciente', 'imediatista', 'mao_de_vaca'];
  const offer: JobOffer = { clubId: cl.id, club: cl.name, tier: cl.tier, personality: rng.pick(personalities), contract: rng.int(2, 3), pitch: PITCH_MID[cl.tier], wage: offerWage(state, cl.id, cl.tier) };
  c.midOffer = { offer, until: close };
  state.news.push(`SONDAGEM: o ${cl.name} quer ${c.name} para a próxima temporada`);
}

/** Resposta à proposta do meio da temporada. Aceitar pode vazar e irritar a diretoria atual. */
export function answerMidOffer(state: GameState, accept: boolean): void {
  const c = state.career!;
  const mo = c.midOffer!;
  mo.answered = true;
  const club = state.player.name;
  if (accept) {
    c.agreed = mo.offer;
    const leak = deriveRng(state.seed, state.season, 'vazou').chance(0.35);
    if (leak) {
      c.board.confidence = clamp(c.board.confidence - 15, 0, 100);
      state.news.push(`VAZOU: ${c.name} acertou com o ${mo.offer.club} para o ano que vem; a diretoria do ${club} não gostou`);
    } else {
      state.news.push(`${c.name} assina pré-contrato com o ${mo.offer.club} (em sigilo)`);
    }
  } else {
    c.board.confidence = clamp(c.board.confidence + 3, 0, 100);
    state.news.push(`${c.name} recusa o ${mo.offer.club} e fica no ${club}`);
  }
}

/** Nome do rival do clube do técnico (clássico). */
export function rivalName(state: GameState): string | null {
  const id = state.player.rivalId;
  return state.clubs.find((c) => c.id === id)?.name ?? null;
}

/** Jogo decisivo: final, semifinal ou jogo de mata-mata que decide a vaga. */
export function isDecisive(m: CalendarMatch): boolean {
  return m.advanced !== null && /final|semi/i.test(m.round);
}

import { TIERS } from '../data/pyramid';
import { marketValue } from './footballers';
import { personalityOf } from './personality';
import { deriveRng } from './rng';
import { clamp } from './util';
import type { Courting, Dilemma, DilemmaKind, GameState } from './types';

/** Texto e opções de cada notícia com escolha. */
export const DILEMMA_INFO: Record<DilemmaKind, { title: (name: string) => string; options: string[] }> = {
  balada: { title: (n) => `${n} é flagrado em balada na véspera de jogo`, options: ['Multar', 'Afastar por um jogo', 'Abafar o caso'] },
  banco: { title: (n) => `${n} reclama em público de ficar no banco`, options: ['Conversar', 'Multar', 'Ignorar'] },
  organizada: { title: () => 'Torcida organizada pede uma reunião com o técnico', options: ['Receber', 'Ignorar', 'Mandar o capitão'] },
  amistoso: { title: () => 'Proposta de amistoso caça-níquel no meio da semana', options: ['Aceitar o dinheiro', 'Recusar'] },
};

/** Opções do assédio ao craque. */
export const COURTED_OPTIONS = ['Segurar', 'Vender agora', 'Dar aumento'] as const;

/** Prazo para responder uma notícia com escolha (depois some). */
export const DILEMMA_DAYS = 14;

/**
 * No começo da temporada (modo técnico): se um clube maior vai assediar o craque e quais notícias com escolha
 * aparecem (duas por temporada, em datas do calendário). Tudo com sorteio próprio.
 */
export function planDecisions(state: GameState): void {
  const live = state.live;
  const cal = state.calendar;
  const p = state.player;
  if (!state.career || !live || !cal || cal.matches.length < 6) return;
  const days = cal.matches.map((m) => m.day);
  const rng = deriveRng(state.seed, state.season, 'decisoes');
  // assédio: metade das temporadas, o melhor do elenco (não emprestado)
  const star = p.squad.filter((f) => !f.loan).sort((a, b) => b.ovr - a.ovr || a.id - b.id)[0];
  const bigger = state.clubs.filter((c) => c.tier < p.tier && (c.national !== null || c.stateDiv !== null));
  if (star && bigger.length > 0 && rng.chance(0.5)) {
    const club = rng.pick(bigger);
    live.courting = {
      day: days[Math.floor(days.length * 0.4)],
      playerId: star.id,
      name: star.name,
      clubId: club.id,
      club: club.name,
      fee: Math.max(1, Math.round(marketValue(star) * 1.6)),
    };
  } else live.courting = null;
  // duas notícias com escolha
  const kinds = rng.shuffle(['balada', 'banco', 'organizada', 'amistoso'] as DilemmaKind[]).slice(0, 2);
  const out: Dilemma[] = [];
  kinds.forEach((kind, i) => {
    const day = days[Math.floor(days.length * (i === 0 ? 0.25 : 0.7))];
    const pool = p.squad.filter((f) => f.pos !== 'GOL');
    const f = kind === 'balada' ? rng.pick(pool) : kind === 'banco' ? pool.slice().sort((a, b) => a.ovr - b.ovr)[Math.floor(pool.length * 0.6)] : undefined;
    out.push({ day, kind, ...(f ? { playerId: f.id, name: f.name } : {}) });
  });
  live.dilemmas = out.sort((a, b) => a.day - b.day);
}

/** O assédio está esperando resposta hoje? */
export function pendingCourting(state: GameState): Courting | null {
  const c = state.live?.courting;
  if (!c || c.choice !== undefined || state.reveal == null || state.reveal < c.day) return null;
  if (!state.player.squad.some((f) => f.id === c.playerId)) return null;
  return c;
}

/** Notícias com escolha abertas hoje (índice na lista). */
export function pendingDilemmas(state: GameState): { d: Dilemma; idx: number }[] {
  const day = state.reveal;
  if (day == null) return [];
  return (state.live?.dilemmas ?? [])
    .map((d, idx) => ({ d, idx }))
    .filter(({ d }) => d.choice === undefined && day >= d.day && day <= d.day + DILEMMA_DAYS && (d.playerId === undefined || state.player.squad.some((f) => f.id === d.playerId)));
}

/** Aplica a escolha de uma notícia. Devolve a manchete. */
export function resolveDilemma(state: GameState, idx: number, choice: number): string {
  const live = state.live!;
  const d = live.dilemmas![idx];
  const day = state.reveal!;
  const p = state.player;
  const c = state.career!;
  const hit = (delta: number) => d.playerId !== undefined && (live.moraleHits ??= []).push({ day, id: d.playerId, delta });
  const conf = (x: number) => (c.board.confidence = clamp(c.board.confidence + x, 0, 100));
  const mood = (x: number) => (p.mood = clamp(p.mood + x, 0, 100));
  const who = c.name;
  let text = '';
  switch (d.kind) {
    case 'balada':
      if (choice === 0) {
        hit(-8);
        conf(2);
        text = `${who} multa ${d.name} pela balada; diretoria aprova`;
      } else if (choice === 1) {
        hit(-15);
        conf(4);
        mood(2);
        (live.benched ??= []).push({ id: d.playerId!, from: day, to: day + 7 });
        text = `${who} afasta ${d.name} por um jogo: "aqui tem regra"`;
      } else {
        const leak = deriveRng(state.seed, state.season, 'abafa', day).chance(0.4);
        if (leak) {
          conf(-6);
          mood(-5);
          text = `Imprensa descobre que ${who} abafou a balada de ${d.name}; torcida e diretoria reclamam`;
        } else text = `Caso da balada de ${d.name} morre sem barulho`;
      }
      break;
    case 'banco': {
      const j = d.playerId !== undefined ? personalityOf(p.squad.find((f) => f.id === d.playerId) ?? { id: d.playerId, name: d.name ?? '' }) : 'equilibrado';
      if (choice === 0) {
        hit(j === 'temperamental' ? 4 : 8);
        text = `${who} chama ${d.name} para conversar e o clima melhora`;
      } else if (choice === 1) {
        hit(j === 'profissional' ? -4 : -10);
        conf(2);
        text = `${who} multa ${d.name} pelas declarações`;
      } else {
        hit(j === 'leal' ? -2 : -5);
        text = `${who} ignora as reclamações de ${d.name}`;
      }
      break;
    }
    case 'organizada':
      if (choice === 0) {
        mood(6);
        text = `${who} recebe a organizada e ganha a arquibancada`;
      } else if (choice === 1) {
        mood(-6);
        text = `Organizada protesta: ${who} não quis receber os torcedores`;
      } else {
        mood(3);
        text = `Capitão do ${p.name} conversa com a organizada e acalma os ânimos`;
      }
      break;
    case 'amistoso':
      if (choice === 0) {
        const cash = Math.round(TIERS[p.tier].moneyScale * 8);
        p.cash += cash;
        (live.fatigueHits ??= []).push({ day, delta: 12 });
        text = `${p.name} topa amistoso no meio da semana e fatura R$ ${cash} mil; elenco chega mais cansado`;
      } else text = `${who} recusa amistoso caça-níquel: "prioridade é o campeonato"`;
      break;
  }
  d.choice = choice;
  d.outcome = text;
  return text;
}

import { PLAYER_ID } from './season';
import type { GameState } from './types';

export interface Achievement {
  id: string;
  title: string;
  text: string;
  unlocked: boolean;
}

/** Conquistas: derivadas do histórico da run (função pura). */
export function achievements(state: GameState): Achievement[] {
  const h = state.history;
  const p = state.player;
  const up = (r: (typeof h)[number]) => r.nextTier < r.tier;
  const cupGames = h.flatMap((r) => r.cups.flatMap((c) => c.matches));
  const champion = (id: string) => h.some((r) => r.cups.some((c) => c.id === id && c.champion));
  const bigWin = h.some((r) =>
    r.playerMatches.some((m) => {
      const mine = m.home === PLAYER_ID ? m.hg : m.ag;
      const theirs = m.home === PLAYER_ID ? m.ag : m.hg;
      return mine - theirs >= 6;
    }),
  );
  const list: Omit<Achievement, 'unlocked'>[] = [];
  const check: boolean[] = [];
  const a = (id: string, title: string, text: string, ok: boolean) => {
    list.push({ id, title, text });
    check.push(ok);
  };
  a('raiz', 'Raiz', 'Subir de divisão sem contratar ninguém na temporada.', h.some((r) => up(r) && r.signings === 0));
  a('fabrica', 'Fábrica de craques', 'Ter 5 crias da base no time titular.', h.some((r) => r.homegrownXI >= 5));
  a('matagigante', 'Mata-gigante', 'Eliminar na copa um clube 3 ou mais divisões acima.', cupGames.some((m) => m.giantKill));
  a('davi', 'Davi contra Golias', 'Eliminar um clube da Série A sem estar numa série nacional.', h.some((r) => r.tier >= 5 && r.cups.some((c) => c.matches.some((m) => m.advanced === true && m.opponentTier === 1))));
  a('elevador', 'Sobe e desce', 'Subir e cair pelo menos 3 vezes cada.', h.filter(up).length >= 3 && h.filter((r) => r.nextTier > r.tier).length >= 3);
  a('foguete', 'Foguete', 'Três acessos seguidos.', h.some((_, i) => i >= 2 && up(h[i]) && up(h[i - 1]) && up(h[i - 2])));
  a('barrado', 'Regulamento é regulamento', 'Conquistar a vaga em campo e ser barrado pelo estádio.', h.some((r) => r.outcome === 'barrado_estadio'));
  a('contas', 'Contas em dia', 'Jogar 50 temporadas sem fechar nenhuma no vermelho.', h.length >= 50 && h.every((r) => r.finance.cashEnd >= 0));
  a('classico', 'O clássico é nosso', 'Vencer o rival 10 vezes.', p.derby.w >= 10);
  a('goleada', 'Chocolate', 'Vencer um jogo por 6 gols de diferença.', bigWin);
  a('caldeirao', 'Caldeirão', 'Terminar uma temporada com a torcida em festa (85+).', h.some((r) => r.mood >= 85));
  a('alma', 'Alma de várzea', 'Chegar à Série A com alma 80 ou mais.', h.some((r) => r.tier === 1) && p.soul >= 80);
  a('estadual', 'Dono do estado', 'Ser campeão estadual.', h.some((r) => r.comps.some((c) => c.id === 'estadual_a' && c.won)));
  a('serieD', 'Calendário cheio', 'Disputar a Série D.', h.some((r) => r.tier <= 4));
  a('copa', 'Copeiro', 'Ganhar a Copa do Brasil.', champion('copa'));
  a('europa', 'Conquistador da América', 'Ganhar a Libertadores.', champion('cc'));
  a('mundo', 'O Milagre', 'Ganhar o Mundial de Clubes.', champion('mundial'));
  a('premier', 'Da várzea à glória', 'Ser campeão da Série A.', h.some((r) => r.comps.some((c) => c.id === 'serie_a' && c.won)));
  return list.map((x, i) => ({ ...x, unlocked: check[i] }));
}

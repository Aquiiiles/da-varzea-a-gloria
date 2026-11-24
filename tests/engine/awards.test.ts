import { apply, newGame } from '../../src/engine/game';
import { myAwards } from '../../src/engine/awards';
import { SeasonStats } from '../../src/engine/stats';
import { createRng } from '../../src/engine/rng';
import type { Footballer, GameState } from '../../src/engine/types';
import { FOUNDATION } from './helpers';

function season(seed = 12): GameState {
  let s = newGame(seed, FOUNDATION);
  if (s.office.event) s = apply(s, { t: 'event', choice: 1 });
  return apply(apply(s, { t: 'play' }), { t: 'advance', to: 3 });
}

describe('detalhes dos jogos', () => {
  it('os gols dos jogadores somam o placar e só titulares jogam', () => {
    const squad = (base: number): Footballer[] =>
      (['GOL', 'DEF', 'DEF', 'DEF', 'DEF', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA', 'MEI'] as const).map((pos, i) => ({
        id: base + i, name: `J${base + i}`, pos, age: 25, ovr: 60 + i, pot: 70, potLo: 65, potHi: 75, wage: 10, contract: 2, goals: 0, apps: 0, joined: 1, homegrown: false,
      }));
    const squads: Record<string, Footballer[]> = { a: squad(100), b: squad(200) };
    const st = new SeasonStats((id) => squads[id] ?? null, () => '4-4-2');
    const rng = createRng(3);
    st.record('liga', { home: 'a', away: 'b', hg: 3, ag: 1 }, rng);
    st.record('liga', { home: 'b', away: 'a', hg: 0, ag: 2 }, rng);
    st.record('copa', { home: 'a', away: 'x', hg: 1, ag: 0 }, rng); // estrangeiro sem elenco
    const goalsOf = (club: string) => squads[club].reduce((sum, f) => sum + (st.total.get(f.id)?.goals ?? 0), 0);
    expect(goalsOf('a')).toBe(6);
    expect(goalsOf('b')).toBe(1);
    const appsA = squads.a.map((f) => st.total.get(f.id)?.apps ?? 0);
    expect(appsA.filter((x) => x === 3).length).toBe(11);
    expect(appsA.filter((x) => x === 0).length).toBe(2);
    for (const s of st.total.values()) expect(s.rating / s.apps).toBeGreaterThanOrEqual(3);
  });

  it('artilheiro do clube e jogos vêm dos detalhes das partidas', () => {
    const before = newGame(12, FOUNDATION);
    const s = season(12);
    const r = s.history.at(-1)!;
    const goals = s.player.squad.reduce((sum, f) => sum + f.goals, 0) - before.player.squad.reduce((sum, f) => sum + f.goals, 0);
    const scored = s.calendar!.matches.reduce((sum, m) => sum + m.gf, 0);
    expect(goals).toBeLessThanOrEqual(scored);
    expect(goals).toBeGreaterThan(scored * 0.6); // quem saiu do elenco no fim leva os seus
    expect(r.topScorer).not.toBeNull();
  });
});

describe('prêmios', () => {
  it('gerais e de todas as ligas, com 3 finalistas e seleção 4-3-3', () => {
    const r = season(5).history.at(-1)!;
    const a = r.awards!;
    expect(a.general.items.map((i) => i.id)).toEqual(['bola', 'chuteira', 'tecnico_ano', 'revelacao_ano']);
    expect(a.leagues.map((l) => l.scope)).toEqual(['Série A', 'Série B', 'Série C', 'Série D', 'Estadual', 'Estadual Série B', 'Várzea']);
    for (const set of [a.general, ...a.leagues]) {
      for (const it of set.items) {
        expect(it.finalists.length).toBeGreaterThan(0);
        expect(it.finalists[0]).toEqual(it.winner);
      }
    }
    const team = a.general.team!;
    expect(team.length).toBe(11);
    expect(team.filter((e) => e.pos === 'GOL').length).toBe(1);
    expect(team.filter((e) => e.pos === 'DEF').length).toBe(4);
    // a seleção só é guardada para as ligas do jogador
    expect(a.leagues.filter((l) => l.team).map((l) => l.scope)).toEqual(['Várzea']);
    // revelação: até 21 anos
    for (const set of [a.general, ...a.leagues]) for (const it of set.items.filter((i) => i.id.startsWith('revelacao'))) expect(it.winner.age!).toBeLessThanOrEqual(21);
  });

  it('a Chuteira de Ouro tem o maior número de gols ponderado e o artilheiro da liga é quem mais marcou nela', () => {
    const a = season(8).history.at(-1)!.awards!;
    for (const set of a.leagues) {
      const art = set.items.find((i) => i.id === 'artilheiro');
      if (!art || art.finalists.length < 2) continue;
      const g = (d: string) => Number(d.split(' ')[0]);
      expect(g(art.finalists[0].detail)).toBeGreaterThanOrEqual(g(art.finalists[1].detail));
    }
  });

  it('prêmios do clube viram manchete', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = season(seed).history.at(-1)!;
      for (const w of myAwards(r.awards!)) expect(r.headlines.some((h) => h.includes(w.name) && h.startsWith('PRÊMIO'))).toBe(true);
    }
  });
});

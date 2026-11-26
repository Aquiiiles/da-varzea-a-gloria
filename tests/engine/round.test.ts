import { describe, expect, it } from 'vitest';
import { apply, newGame } from '../../src/engine/game';
import { myPosition, opponentInfo, roundOn, tableAfter } from '../../src/engine/round';
import { PLAYER_ID } from '../../src/engine/season';
import type { Foundation, GameState } from '../../src/engine/types';

const COACH: Foundation = { name: 'Professor Zeca', colors: ['#c8102e', '#ffffff'], origin: 'pub', mode: 'tecnico', style: 'motivador' };

function season(seed = 7): GameState {
  return apply(apply(newGame(seed, COACH), { t: 'job', idx: 0 }), { t: 'play' });
}

describe('rodada a rodada', () => {
  it('a rodada traz o jogo do técnico primeiro e os outros jogos do mesmo dia da fase', () => {
    let s = season();
    expect(myPosition(s, s.reveal!)).toBeNull(); // antes do 1º jogo não há posição
    s = apply(s, { t: 'advance', to: 0 });
    const r = roundOn(s, s.reveal!)!;
    expect(r).toBeTruthy();
    expect(r.games[0].mine).toBe(true);
    const m = s.calendar!.matches.find((x) => x.day === s.reveal)!;
    const myScore = r.moment.playerHome ? [r.games[0].hg, r.games[0].ag] : [r.games[0].ag, r.games[0].hg];
    expect(myScore).toEqual([m.gf, m.ga]);
    if (r.stage) {
      const sameDay = r.stage.matches.filter(([d]) => d === r.day);
      expect(r.games.length).toBe(sameDay.length);
      for (const g of r.games) expect(g.goals.length).toBe(g.hg + g.ag);
      for (const g of r.games.slice(1)) expect(g.goals.every((x) => x.minute >= 1 && x.minute <= 90)).toBe(true);
    }
    // determinístico: a mesma rodada conta a mesma história
    expect(JSON.stringify(roundOn(s, s.reveal!))).toBe(JSON.stringify(r));
  });

  it('tabela depois da rodada: setas somam zero e a posição do técnico bate', () => {
    let s = season(3);
    for (let i = 0; i < 4; i++) s = apply(s, { t: 'advance', to: 0 });
    const r = roundOn(s, s.reveal!);
    if (!r?.stage) return;
    const rows = tableAfter(r.stage, r.day);
    expect(rows.reduce((sum, x) => sum + x.delta, 0)).toBe(0);
    const me = rows.find((x) => x.clubId === PLAYER_ID)!;
    expect(myPosition(s, s.reveal!)!.pos).toBe(me.pos);
  });

  it('adversário: forma dos últimos jogos (até 5) e posição', () => {
    let s = season(5);
    for (let i = 0; i < 6; i++) s = apply(s, { t: 'advance', to: 0 });
    const next = s.calendar!.matches.find((m) => m.day > s.reveal!)!;
    const info = opponentInfo(s, next);
    expect(info.name).toBe(next.opponent);
    expect(info.form.length).toBeLessThanOrEqual(5);
    expect(info.form.every((x) => ['V', 'E', 'D'].includes(x))).toBe(true);
  });
});

describe('elencos e técnicos reais (pacote)', () => {
  it('clubes do pacote recebem técnico e jogadores reais sem mudar a força', async () => {
    const { REAL_PACK } = await import('../../src/data/realclubs');
    const plain = newGame(11, COACH);
    const real = newGame(11, COACH, { pack: REAL_PACK });
    const fla = real.clubs.find((c) => c.name === 'Flamengo')!;
    expect(fla.coachName).toBe('Filipe Luís');
    expect(fla.squad.some((f) => f.name === 'Pedro' && f.pos === 'ATA')).toBe(true);
    expect(fla.squad.length).toBeGreaterThanOrEqual(18);
    // mesma posição no mundo: a força do clube é a do mundo gerado (±1)
    const same = plain.clubs.find((c) => c.id === fla.id)!;
    expect(Math.abs(same.strength - fla.strength)).toBeLessThan(1.5);
    // nomes de jogadores não se repetem
    const names = real.clubs.flatMap((c) => c.squad.map((f) => f.name));
    expect(new Set(names).size).toBe(names.length);
    // determinístico
    expect(JSON.stringify(newGame(11, COACH, { pack: REAL_PACK }).clubs)).toBe(JSON.stringify(real.clubs));
  });

  it('pacote importado aceita técnico e elenco em texto ou objeto', async () => {
    const { parseNamePack } = await import('../../src/engine/namepack');
    const pack = parseNamePack({ divisions: { 1: [{ name: 'Time X', coach: 'Fulano', squad: ['João;ATA;2000;80', { name: 'Zé', pos: 'gol', born: 1995, rating: 70 }, 'ruim;XYZ;2000;80'] }] } });
    expect(typeof pack).toBe('object');
    const c = (pack as Exclude<typeof pack, string>).divisions[1]![0];
    expect(c.coach).toBe('Fulano');
    expect(c.squad).toHaveLength(2);
  });
});

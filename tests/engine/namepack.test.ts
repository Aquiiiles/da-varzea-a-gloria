import { applyMut, newGame, replay } from '../../src/engine/game';
import { parseNamePack, type NamePack } from '../../src/engine/namepack';
import { FOUNDATION } from './helpers';

const names = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
const PACK = parseNamePack({
  title: 'Teste',
  divisions: { 1: names('Grande', 25).map((name, i) => (i === 0 ? { name, short: 'gr1', colors: ['#111111', '#eeeeee'] } : name)), 2: names('Médio', 20), 3: names('Pequeno', 5) },
  pool: names('Sem divisão', 10),
}) as NamePack;

describe('pacote de nomes', () => {
  it('valida o arquivo e rejeita lixo', () => {
    expect(typeof PACK).toBe('object');
    expect(typeof parseNamePack(null)).toBe('string');
    expect(typeof parseNamePack({ divisions: {} })).toBe('string');
    expect(typeof parseNamePack({ divisions: { 1: [{ name: '' }, 42] } })).toBe('string');
    const p = parseNamePack({ divisions: { 1: [{ name: 'X', colors: ['red', 'blue'] }] } }) as NamePack;
    expect(p.divisions[1]![0].colors).toBeUndefined();
  });

  it('o primeiro nome vai para o clube mais forte da divisão; Estadual e Várzea continuam fictícios', () => {
    const s = newGame(9, FOUNDATION, { pack: PACK });
    const a = s.clubs.filter((c) => c.national === 1).sort((x, y) => y.strength - x.strength);
    expect(a[0].name).toBe('Grande 1');
    expect(a[0].short).toBe('GR1');
    expect(a[0].colors).toEqual(['#111111', '#eeeeee']);
    expect(a.every((c) => c.name.startsWith('Grande'))).toBe(true);
    expect(a.length).toBe(20);
    const stateOnly = s.clubs.filter((c) => c.national === null && c.stateDiv !== null);
    expect(stateOnly.some((c) => /^(Grande|Médio|Pequeno|Sem divisão) /.test(c.name))).toBe(false);
    // lista curta: só os mais fortes da Série C mudam de nome
    expect(s.clubs.filter((c) => c.national === 3 && c.name.startsWith('Pequeno')).length).toBe(5);
    expect(s.clubs.filter((c) => c.national === null && c.stateDiv === null && c.name.startsWith('Sem divisão')).length).toBe(10);
  });

  it('não repete nomes nem rouba o nome do clube do jogador', () => {
    const pack = parseNamePack({ divisions: { 1: [FOUNDATION.name, 'Dup', 'Dup', 'Outro'] } }) as NamePack;
    const s = newGame(3, FOUNDATION, { pack });
    const all = s.clubs.map((c) => c.name);
    expect(all.filter((n) => n === FOUNDATION.name).length).toBe(0);
    expect(all.filter((n) => n === 'Dup').length).toBe(1);
    expect(all).toContain('Outro');
  });

  it('só muda nomes: várias temporadas dão os mesmos resultados com e sem pacote', () => {
    const run = (pack: NamePack | null) => {
      const s = newGame(21, FOUNDATION, { pack });
      for (let season = 0; season < 4; season++) {
        for (const a of [{ t: 'auto' }, { t: 'play' }, { t: 'next' }] as const) {
          applyMut(s, a);
          s.actions.push(a);
        }
      }
      return s;
    };
    const plain = run(null);
    const named = run(PACK);
    const shape = (s: ReturnType<typeof run>) => s.history.map((r) => [r.tier, r.outcome, r.strength, r.finance.cashEnd, r.nextTier]);
    expect(shape(named)).toEqual(shape(plain));
    expect(named.clubs.map((c) => [c.id, c.strength, c.national, c.stateDiv])).toEqual(plain.clubs.map((c) => [c.id, c.strength, c.national, c.stateDiv]));
    expect(named.player.squad).toEqual(plain.player.squad);
    // e o replay com pacote reconstrói o mesmo estado
    expect(JSON.stringify(replay(21, FOUNDATION, named.actions, { pack: PACK }))).toBe(JSON.stringify(named));
  });
});

describe('clubes reais (padrão)', () => {
  it('o pacote embutido é válido e põe os gigantes na Série A', async () => {
    const { REAL_PACK } = await import('../../src/data/realclubs');
    expect(typeof parseNamePack(JSON.parse(JSON.stringify(REAL_PACK)))).toBe('object');
    const s = newGame(1, FOUNDATION, { pack: REAL_PACK });
    const a = s.clubs.filter((c) => c.national === 1).map((c) => c.name);
    expect(a).toContain('Flamengo');
    expect(a).toContain('Palmeiras');
    expect(new Set(s.clubs.map((c) => c.name)).size).toBe(s.clubs.length);
  });
});
